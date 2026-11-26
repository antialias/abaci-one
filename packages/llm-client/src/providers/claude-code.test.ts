import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { LLMClient } from "../client";
import type {
	ProviderConfig,
	ProviderRequest,
	ProviderStreamEvent,
	StreamEvent,
} from "../types";
import {
	LLMAbortedError,
	LLMApiError,
	LLMJsonParseError,
	LLMNetworkError,
	LLMTimeoutError,
	LLMValidationError,
} from "../types";
import {
	type ClaudeCliRun,
	type ClaudeCliRunner,
	ClaudeCodeProvider,
	errorStatus,
	proxyRoot,
	SlotPool,
	sniffImageType,
	spawnClaudeCli,
} from "./claude-code";

const config: ProviderConfig = {
	name: "claude_code",
	apiKey: "proxy-secret",
	baseUrl: "http://nas.example:8787/v1/",
	defaultModel: "claude-sonnet-5",
	options: { home: "/tmp/claude-code-test-home", cli_path: "/opt/claude" },
};

const request: ProviderRequest = {
	prompt: "Write a song title",
	jsonSchema: {
		type: "object",
		properties: { title: { type: "string" } },
		required: ["title"],
	},
	model: "claude-sonnet-5",
	timeoutMs: 5_000,
};

const resultLine = (fields: Record<string, unknown>) =>
	JSON.stringify({
		type: "result",
		subtype: "success",
		is_error: false,
		usage: {
			input_tokens: 10,
			cache_creation_input_tokens: 900,
			cache_read_input_tokens: 5,
			output_tokens: 42,
		},
		...fields,
	});

/** A runner that replays stdout lines and records what it was asked to run. */
function fakeRunner(
	lines: string[],
	extra: { timedOut?: boolean; exitCode?: number; stderr?: string } = {},
) {
	const runs: ClaudeCliRun[] = [];
	let stoppedAt: number | null = null;
	const runner: ClaudeCliRunner = async (run) => {
		runs.push(run);
		for (const [i, line] of lines.entries()) {
			if (run.onLine(line) === "stop") {
				stoppedAt = i;
				break;
			}
		}
		return {
			exitCode: extra.exitCode ?? 0,
			stderr: extra.stderr ?? "",
			timedOut: extra.timedOut ?? false,
			stopped: stoppedAt !== null,
		};
	};
	return { runner, runs, stoppedAt: () => stoppedAt };
}

describe("ClaudeCodeProvider", () => {
	it("runs claude -p against the proxy with a minimal environment", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "Hi" } }),
		]);
		const provider = new ClaudeCodeProvider(config, fake.runner);
		const before = process.env.DATABASE_URL;
		process.env.DATABASE_URL = "postgres://must-not-leak";
		try {
			await provider.call(request);
		} finally {
			if (before === undefined) delete process.env.DATABASE_URL;
			else process.env.DATABASE_URL = before;
		}

		const run = fake.runs[0];
		expect(run.command).toBe("/opt/claude");
		expect(run.cwd).toBe("/tmp/claude-code-test-home");
		expect(run.args.slice(0, 4)).toEqual([
			"-p",
			"--bare",
			"--model",
			"claude-sonnet-5",
		]);
		expect(run.args).toContain("--no-session-persistence");
		expect(run.args[run.args.indexOf("--tools") + 1]).toBe("");
		expect(run.args[run.args.indexOf("--output-format") + 1]).toBe(
			"stream-json",
		);
		expect(JSON.parse(run.args[run.args.indexOf("--json-schema") + 1])).toEqual(
			request.jsonSchema,
		);
		expect(run.stdin).toContain("Write a song title");

		expect(run.env.ANTHROPIC_BASE_URL).toBe("http://nas.example:8787");
		expect(run.env.ANTHROPIC_AUTH_TOKEN).toBe("proxy-secret");
		expect(run.env.ANTHROPIC_API_KEY).toBeUndefined();
		expect(run.env.DATABASE_URL).toBeUndefined();
		expect(Object.keys(run.env).sort()).toEqual([
			"ANTHROPIC_AUTH_TOKEN",
			"ANTHROPIC_BASE_URL",
			"ANTHROPIC_CUSTOM_MODEL_OPTION",
			"ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES",
			"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
			"CLAUDE_CONFIG_DIR",
			"DISABLE_AUTOUPDATER",
			"DISABLE_ERROR_REPORTING",
			"DISABLE_TELEMETRY",
			"HOME",
			"PATH",
		]);
	});

	it("returns the structured output and counts cached input as prompt tokens", async () => {
		const fake = fakeRunner([
			JSON.stringify({ type: "system", subtype: "init" }),
			"not json at all",
			resultLine({ structured_output: { title: "Nine Plus Six" } }),
		]);
		const response = await new ClaudeCodeProvider(config, fake.runner).call(
			request,
		);
		expect(response.content).toEqual({ title: "Nine Plus Six" });
		expect(response.usage).toEqual({ promptTokens: 915, completionTokens: 42 });
		expect(response.finishReason).toBe("success");
	});

	it("falls back to JSON in the result text when there is no structured output", async () => {
		const fake = fakeRunner([
			resultLine({ result: '```json\n{"title":"Beads"}\n```' }),
		]);
		const response = await new ClaudeCodeProvider(config, fake.runner).call(
			request,
		);
		expect(response.content).toEqual({ title: "Beads" });
	});

	it("reports unparseable result text as a JSON parse error (retryable)", async () => {
		const fake = fakeRunner([resultLine({ result: "Sure! Here is a title." })]);
		await expect(
			new ClaudeCodeProvider(config, fake.runner).call(request),
		).rejects.toBeInstanceOf(LLMJsonParseError);
	});

	it("stops at the first refused attempt and reports its status", async () => {
		const fake = fakeRunner([
			JSON.stringify({ type: "system", subtype: "init" }),
			JSON.stringify({
				type: "system",
				subtype: "api_retry",
				attempt: 1,
				error_status: 401,
				error: "authentication_failed",
				retry_delay_ms: 563,
			}),
			resultLine({ structured_output: { title: "never read" } }),
		]);
		const err = await new ClaudeCodeProvider(config, fake.runner)
			.call(request)
			.catch((e) => e);
		expect(fake.stoppedAt()).toBe(1);
		expect(err).toBeInstanceOf(LLMApiError);
		expect((err as LLMApiError).statusCode).toBe(401);
		expect((err as LLMApiError).isClientError()).toBe(true);
	});

	it("turns a refused 429 into a rate limit carrying the CLI's delay", async () => {
		const fake = fakeRunner([
			JSON.stringify({
				type: "system",
				subtype: "api_retry",
				error_status: 429,
				error: "rate_limit",
				retry_delay_ms: 2_000,
			}),
		]);
		const err = (await new ClaudeCodeProvider(config, fake.runner)
			.call(request)
			.catch((e) => e)) as LLMApiError;
		expect(err.isRateLimited()).toBe(true);
		expect(err.retryAfterMs).toBe(2_000);
	});

	it("reports a retry with no status as the proxy being unreachable", async () => {
		const fake = fakeRunner([
			JSON.stringify({
				type: "system",
				subtype: "api_retry",
				error_status: null,
				error: "connection_error",
			}),
		]);
		await expect(
			new ClaudeCodeProvider(config, fake.runner).call(request),
		).rejects.toBeInstanceOf(LLMNetworkError);
	});

	it("reads a usage-limit error result as a rate limit", async () => {
		const fake = fakeRunner([
			resultLine({
				is_error: true,
				result: "Claude AI usage limit reached|1790000000",
			}),
		]);
		const err = (await new ClaudeCodeProvider(config, fake.runner)
			.call(request)
			.catch((e) => e)) as LLMApiError;
		expect(err).toBeInstanceOf(LLMApiError);
		expect(err.statusCode).toBe(429);
	});

	it("reports a timeout", async () => {
		const fake = fakeRunner([], { timedOut: true, exitCode: 143 });
		await expect(
			new ClaudeCodeProvider(config, fake.runner).call(request),
		).rejects.toBeInstanceOf(LLMTimeoutError);
	});

	it("reports a CLI that refuses its arguments as a non-retryable error", async () => {
		const fake = fakeRunner([], {
			exitCode: 1,
			stderr: "Error: --json-schema is not valid",
		});
		const err = (await new ClaudeCodeProvider(config, fake.runner)
			.call(request)
			.catch((e) => e)) as LLMApiError;
		expect(err).toBeInstanceOf(LLMApiError);
		expect(err.isClientError()).toBe(true);
		expect(err.message).toMatch(/refused the run: Error: --json-schema/);
	});

	it("reports a run killed without a result as a network error (retryable)", async () => {
		const fake = fakeRunner([], {
			exitCode: null as unknown as number,
			stderr: "",
		});
		await expect(
			new ClaudeCodeProvider(config, fake.runner).call(request),
		).rejects.toBeInstanceOf(LLMNetworkError);
	});

	it("drops the 2020-12 $schema URI that Claude Code's validator rejects", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "x" } }),
		]);
		await new ClaudeCodeProvider(config, fake.runner).call({
			...request,
			jsonSchema: {
				$schema: "https://json-schema.org/draft/2020-12/schema",
				...request.jsonSchema,
			},
		});
		const args = fake.runs[0].args;
		expect(JSON.parse(args[args.indexOf("--json-schema") + 1])).toEqual(
			request.jsonSchema,
		);
	});

	it("sends the prompt and images as one stream-json user message", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "x" } }),
		]);
		await new ClaudeCodeProvider(config, fake.runner).call({
			...request,
			images: ["data:image/png;base64,AAAA", "data:image/jpeg;base64,BBBB"],
		});
		const run = fake.runs[0];
		expect(run.args[run.args.indexOf("--input-format") + 1]).toBe(
			"stream-json",
		);
		expect(run.stdin.endsWith("\n")).toBe(true);
		const message = JSON.parse(run.stdin);
		expect(message.type).toBe("user");
		expect(message.message.role).toBe("user");
		const [first, second, text] = message.message.content;
		expect(first).toEqual({
			type: "image",
			source: { type: "base64", media_type: "image/png", data: "AAAA" },
		});
		expect(second.source).toEqual({
			type: "base64",
			media_type: "image/jpeg",
			data: "BBBB",
		});
		expect(text.type).toBe("text");
		expect(text.text).toContain("Write a song title");
	});

	it("refuses an image that is not a data URL, without running anything", async () => {
		const fake = fakeRunner([]);
		const err = await new ClaudeCodeProvider(config, fake.runner)
			.call({ ...request, images: ["https://example.com/a.png"] })
			.catch((e) => e);
		expect(err).toBeInstanceOf(LLMApiError);
		expect((err as LLMApiError).isClientError()).toBe(true);
		expect(fake.runs).toHaveLength(0);
	});

	it("gives a request naming an OpenAI model the configured default", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "a" } }),
			resultLine({ structured_output: { title: "b" } }),
			resultLine({ structured_output: { title: "c" } }),
		]);
		const provider = new ClaudeCodeProvider(
			{ ...config, defaultModel: "claude-abaci" },
			fake.runner,
		);
		await provider.call({ ...request, model: "gpt-5.2" });
		await provider.call({ ...request, model: "o3-mini" });
		await provider.call({ ...request, model: "claude-opus-5" });
		const models = fake.runs.map((r) => r.args[r.args.indexOf("--model") + 1]);
		expect(models).toEqual(["claude-abaci", "claude-abaci", "claude-opus-5"]);
	});

	it("declares the requested id as a custom model that thinks and takes --effort", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "a" } }),
		]);
		await new ClaudeCodeProvider(config, fake.runner).call({
			...request,
			model: "claude-abaci",
		});
		const env = fake.runs[0].env;
		expect(env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe("claude-abaci");
		expect(
			env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES.split(","),
		).toEqual(["effort", "thinking", "adaptive_thinking"]);
	});

	it("adds standing instructions after its own system prompt", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "a" } }),
		]);
		await new ClaudeCodeProvider(config, fake.runner).call({
			...request,
			system: "You grade worksheets.",
		});
		const run = fake.runs[0];
		const system = run.args[run.args.indexOf("--system-prompt") + 1];
		expect(system).toMatch(/structured output\.\n\nYou grade worksheets\.$/);
		expect(JSON.parse(run.stdin).message.content[0].text).not.toContain(
			"You grade worksheets.",
		);
	});

	it("passes a reasoning effort Claude Code knows, and drops the rest", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "a" } }),
			resultLine({ structured_output: { title: "b" } }),
		]);
		const provider = new ClaudeCodeProvider(config, fake.runner);
		await provider.call({ ...request, reasoningEffort: "high" });
		await provider.call({ ...request, reasoningEffort: "minimal" });
		expect(fake.runs[0].args.slice(-2)).toEqual(["--effort", "high"]);
		expect(fake.runs[1].args).not.toContain("--effort");
	});

	it("reads an API 4xx result as the request's own fault (not retried)", async () => {
		const fake = fakeRunner([
			resultLine({
				is_error: true,
				result:
					'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"image exceeds 5 MB maximum"}}',
			}),
		]);
		const err = (await new ClaudeCodeProvider(config, fake.runner)
			.call(request)
			.catch((e) => e)) as LLMApiError;
		expect(err).toBeInstanceOf(LLMApiError);
		expect(err.statusCode).toBe(400);
		expect(err.isClientError()).toBe(true);
	});

	it("labels an image by its bytes, not by its data URL", async () => {
		const fake = fakeRunner([
			resultLine({ structured_output: { title: "x" } }),
		]);
		const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
		await new ClaudeCodeProvider(config, fake.runner).call({
			...request,
			images: [`data:image/jpeg;base64,${png}`],
		});
		const message = JSON.parse(fake.runs[0].stdin);
		expect(message.message.content[0].source.media_type).toBe("image/png");
	});
});

describe("errorStatus", () => {
	it("takes the status Claude Code reports", () => {
		expect(errorStatus("API Error: 413 request_too_large")).toBe(413);
		expect(errorStatus("API Error: 529 overloaded")).toBe(529);
	});
	it("falls back on the wording", () => {
		expect(errorStatus("Claude AI usage limit reached")).toBe(429);
		expect(errorStatus("invalid_request_error: bad image")).toBe(400);
		expect(errorStatus("something broke")).toBe(502);
	});
});

describe("sniffImageType", () => {
	it("knows png, jpeg, gif and webp", () => {
		expect(sniffImageType("iVBORw0KGgo=")).toBe("image/png");
		expect(sniffImageType("/9j/4AAQSkZJRg==")).toBe("image/jpeg");
		expect(sniffImageType(btoa("GIF89a......"))).toBe("image/gif");
		expect(sniffImageType(btoa("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
		expect(sniffImageType(btoa("plain text here"))).toBeUndefined();
	});
});

describe("ClaudeCodeProvider queue", () => {
	/** A runner whose runs end only when told to. */
	function heldRunner() {
		const runs: Array<{ run: ClaudeCliRun; finish: () => void }> = [];
		let notify: (() => void) | undefined;
		const runner: ClaudeCliRunner = (run) =>
			new Promise((resolve) => {
				runs.push({
					run,
					finish: () => {
						run.onLine(resultLine({ structured_output: { title: "x" } }));
						resolve({
							exitCode: 0,
							stderr: "",
							timedOut: false,
							stopped: false,
						});
					},
				});
				notify?.();
			});
		const started = async (n: number) => {
			while (runs.length < n) {
				await new Promise<void>((r) => {
					notify = r;
				});
			}
		};
		return { runner, runs, started };
	}
	const settle = () => new Promise((r) => setTimeout(r, 10));
	const limited = (limit: number) => ({
		...config,
		options: { ...config.options, max_concurrency: String(limit) },
	});

	it("keeps one slot free for interactive requests", async () => {
		const pool = new SlotPool();
		const held = heldRunner();
		const provider = new ClaudeCodeProvider(limited(3), held.runner, pool);

		const background = Array.from({ length: 4 }, () => provider.call(request));
		await held.started(2);
		await settle();
		expect(held.runs).toHaveLength(2); // background holds limit - 1

		const kid = provider.call({ ...request, priority: "interactive" });
		await held.started(3);
		expect(pool.usage).toMatchObject({ running: 3, background: 2 });

		for (const r of held.runs) r.finish();
		await settle();
		for (const r of held.runs) r.finish();
		await Promise.all([...background, kid]);
		expect(pool.usage).toMatchObject({ running: 0, background: 0, waiting: 0 });
	});

	it("serves a waiting interactive request before earlier background ones", async () => {
		const pool = new SlotPool();
		const held = heldRunner();
		const provider = new ClaudeCodeProvider(limited(2), held.runner, pool);

		const kid1 = provider.call({
			...request,
			priority: "interactive",
			prompt: "kid 1",
		});
		const bg1 = provider.call({ ...request, prompt: "bg 1" });
		await held.started(2);
		const bg2 = provider.call({ ...request, prompt: "bg 2" });
		const kid2 = provider.call({
			...request,
			priority: "interactive",
			prompt: "kid 2",
		});
		await settle();

		held.runs[0].finish(); // kid 1 frees a slot: kid 2 gets it, not bg 2
		await held.started(3);
		expect(held.runs[2].run.stdin).toContain("kid 2");

		held.runs[1].finish();
		await held.started(4);
		expect(held.runs[3].run.stdin).toContain("bg 2");
		held.runs[2].finish();
		held.runs[3].finish();
		await Promise.all([kid1, bg1, bg2, kid2]);
	});

	it("hands a freed slot to the waiter, never to a newcomer", async () => {
		const pool = new SlotPool();
		const take = (priority: "interactive" | "background") =>
			pool.acquire({ limit: 1, priority, provider: "p", timeoutMs: 0 });

		const releaseA = await take("interactive");
		const b = take("interactive");
		releaseA();
		const c = take("interactive"); // arrives in the gap before b resumes
		expect(pool.usage).toMatchObject({ running: 1, waiting: 1 });
		(await b)();
		(await c)();
		expect(pool.usage).toMatchObject({ running: 0, waiting: 0 });
	});

	it("counts the wait for a slot against the request's timeout", async () => {
		const pool = new SlotPool();
		const held = heldRunner();
		const provider = new ClaudeCodeProvider(limited(1), held.runner, pool);

		const first = provider.call({ ...request, priority: "interactive" });
		await held.started(1);
		const err = await provider
			.call({ ...request, priority: "interactive", timeoutMs: 30 })
			.catch((e) => e);
		expect(err).toBeInstanceOf(LLMTimeoutError);
		expect(held.runs).toHaveLength(1); // never spawned

		const late = provider.call({
			...request,
			priority: "interactive",
			timeoutMs: 2_000,
		});
		await settle();
		held.runs[0].finish();
		await held.started(2);
		expect(held.runs[1].run.timeoutMs).toBeLessThan(2_000);
		held.runs[1].finish();
		await Promise.all([first, late]);
	});

	it("takes an aborted request out of the queue without running it", async () => {
		const pool = new SlotPool();
		const held = heldRunner();
		const provider = new ClaudeCodeProvider(limited(1), held.runner, pool);

		const first = provider.call({ ...request, priority: "interactive" });
		await held.started(1);
		const controller = new AbortController();
		const queued = provider
			.call({ ...request, priority: "interactive", signal: controller.signal })
			.catch((e) => e);
		await settle();
		controller.abort();
		expect(await queued).toBeInstanceOf(LLMAbortedError);
		expect(pool.usage.waiting).toBe(0);

		held.runs[0].finish();
		await first;
		expect(held.runs).toHaveLength(1);
	});

	it("ends a running request when its signal aborts", async () => {
		const pool = new SlotPool();
		const runner: ClaudeCliRunner = (run) =>
			new Promise((resolve) => {
				run.signal?.addEventListener("abort", () =>
					resolve({
						exitCode: null,
						stderr: "",
						timedOut: false,
						stopped: true,
					}),
				);
			});
		const controller = new AbortController();
		const call = new ClaudeCodeProvider(limited(1), runner, pool)
			.call({ ...request, signal: controller.signal })
			.catch((e) => e);
		await settle();
		controller.abort();
		expect(await call).toBeInstanceOf(LLMAbortedError);
		expect(pool.usage.running).toBe(0);
	});
});

/** stream-json lines as Claude Code writes them with --include-partial-messages. */
const se = (event: Record<string, unknown>) =>
	JSON.stringify({ type: "stream_event", event });
const blockStart = (index: number, type: string) =>
	se({ type: "content_block_start", index, content_block: { type } });
const delta = (index: number, d: Record<string, unknown>) =>
	se({ type: "content_block_delta", index, delta: d });

async function collect<T>(gen: AsyncGenerator<T, void, unknown>): Promise<T[]> {
	const out: T[] = [];
	for await (const event of gen) out.push(event);
	return out;
}

describe("ClaudeCodeProvider.stream", () => {
	const structuredRun = [
		JSON.stringify({ type: "system", subtype: "init", session_id: "sess-1" }),
		se({ type: "message_start" }),
		blockStart(0, "thinking"),
		delta(0, { type: "thinking_delta", thinking: "Counting the " }),
		delta(0, { type: "thinking_delta", thinking: "problems." }),
		delta(0, { type: "signature_delta", signature: "sig" }),
		blockStart(1, "text"),
		delta(1, { type: "text_delta", text: "There are two." }),
		blockStart(2, "tool_use"),
		delta(2, { type: "input_json_delta", partial_json: "" }),
		delta(2, { type: "input_json_delta", partial_json: '{"title"' }),
		delta(2, { type: "input_json_delta", partial_json: ': "Hi"}' }),
		JSON.stringify({ type: "assistant", message: { content: [] } }),
		resultLine({ structured_output: { title: "Hi" } }),
	];

	it("runs with partial messages and summarized thinking", async () => {
		const fake = fakeRunner(structuredRun);
		await collect(new ClaudeCodeProvider(config, fake.runner).stream(request));
		const args = fake.runs[0].args;
		expect(args).toContain("--include-partial-messages");
		expect(args[args.indexOf("--thinking-display") + 1]).toBe("summarized");
		expect(args).toContain("--json-schema");
	});

	it("maps thinking and prose to reasoning, the answer's JSON to output, then the result", async () => {
		const fake = fakeRunner(structuredRun);
		const events = await collect(
			new ClaudeCodeProvider(config, fake.runner).stream(request),
		);
		expect(events.map((e) => e.type)).toEqual([
			"started",
			"reasoning",
			"reasoning",
			"reasoning",
			"output_delta",
			"output_delta",
			"result",
		]);
		expect(events[0]).toEqual({ type: "started", responseId: "sess-1" });
		const reasoning = events
			.filter((e) => e.type === "reasoning")
			.map((e) => (e as { text: string }).text)
			.join("");
		expect(reasoning).toBe("Counting the problems.\n\nThere are two.");
		const output = events
			.filter((e) => e.type === "output_delta")
			.map((e) => (e as { text: string }).text)
			.join("");
		expect(JSON.parse(output)).toEqual({ title: "Hi" });
		const last = events.at(-1) as Extract<
			ProviderStreamEvent,
			{ type: "result" }
		>;
		expect(last.response.content).toEqual({ title: "Hi" });
		expect(last.response.usage).toEqual({
			promptTokens: 915,
			completionTokens: 42,
		});
	});

	it("streams a text answer as output, with no schema and the caller's system prompt", async () => {
		const fake = fakeRunner([
			blockStart(0, "text"),
			delta(0, { type: "text_delta", text: "Hello, " }),
			delta(0, { type: "text_delta", text: "young geometer." }),
			resultLine({ result: "Hello, young geometer." }),
		]);
		const events = await collect(
			new ClaudeCodeProvider(config, fake.runner).stream({
				...request,
				textOutput: true,
				system: "You are Euclid.",
			}),
		);
		const run = fake.runs[0];
		expect(run.args).not.toContain("--json-schema");
		expect(run.args[run.args.indexOf("--system-prompt") + 1]).toBe(
			"You are Euclid.",
		);
		expect(JSON.parse(run.stdin).message.content[0].text).toBe(
			"Write a song title",
		);
		expect(events.map((e) => e.type)).toEqual([
			"output_delta",
			"output_delta",
			"result",
		]);
		const last = events.at(-1) as Extract<
			ProviderStreamEvent,
			{ type: "result" }
		>;
		expect(last.response.content).toBe("Hello, young geometer.");
	});

	it("throws a refused attempt after what streamed before it", async () => {
		const fake = fakeRunner([
			blockStart(0, "thinking"),
			delta(0, { type: "thinking_delta", thinking: "hmm" }),
			JSON.stringify({
				type: "system",
				subtype: "api_retry",
				error_status: 529,
				error: "overloaded",
			}),
		]);
		const seen: string[] = [];
		const err = await (async () => {
			for await (const e of new ClaudeCodeProvider(config, fake.runner).stream(
				request,
			)) {
				seen.push(e.type);
			}
		})().catch((e) => e);
		expect(seen).toEqual(["reasoning"]);
		expect(err).toBeInstanceOf(LLMApiError);
		expect((err as LLMApiError).statusCode).toBe(529);
	});

	it("aborts the process when the consumer stops reading", async () => {
		let signal: AbortSignal | undefined;
		const runner: ClaudeCliRunner = async (run) => {
			signal = run.signal;
			run.onLine(blockStart(0, "text"));
			run.onLine(delta(0, { type: "text_delta", text: "a" }));
			await new Promise<void>((resolve) =>
				run.signal?.addEventListener("abort", () => resolve()),
			);
			return { exitCode: null, stderr: "", timedOut: false, stopped: true };
		};
		const provider = new ClaudeCodeProvider(config, runner);
		for await (const _event of provider.stream({
			...request,
			textOutput: true,
		})) {
			break;
		}
		expect(signal?.aborted).toBe(true);
	});
});

describe("LLMClient.stream through claude_code", () => {
	const env = {
		LLM_DEFAULT_PROVIDER: "claude_code",
		LLM_CLAUDE_CODE_API_KEY: "proxy-secret",
		LLM_CLAUDE_CODE_BASE_URL: "http://nas:8787",
		LLM_CLAUDE_CODE_DEFAULT_MODEL: "claude-abaci",
	};
	const withProvider = (runner: ClaudeCliRunner) => {
		const client = new LLMClient({}, env);
		const provider = new ClaudeCodeProvider(
			{
				name: "claude_code",
				apiKey: "proxy-secret",
				baseUrl: "http://nas:8787",
				defaultModel: "claude-abaci",
			},
			runner,
		);
		// The client builds providers itself; hand it one with a fake runner.
		(client as unknown as { providers: Map<string, unknown> }).providers.set(
			"claude_code",
			provider,
		);
		return client;
	};
	const schema = z.object({ title: z.string() });

	it("yields reasoning and output, then the validated answer with provider and model", async () => {
		const fake = fakeRunner([
			blockStart(0, "thinking"),
			delta(0, { type: "thinking_delta", thinking: "thinking" }),
			blockStart(1, "tool_use"),
			delta(1, { type: "input_json_delta", partial_json: '{"title":"Hi"}' }),
			resultLine({ structured_output: { title: "Hi" } }),
		]);
		const events = await collect(
			withProvider(fake.runner).stream({
				prompt: "p",
				images: ["data:image/png;base64,AAAA"],
				schema,
				model: "gpt-5.2",
				reasoning: { effort: "medium", summary: "auto" },
			}),
		);
		expect(events.map((e) => e.type)).toEqual([
			"reasoning",
			"output_delta",
			"complete",
		]);
		expect(events[2]).toMatchObject({
			type: "complete",
			data: { title: "Hi" },
			provider: "claude_code",
			usage: { promptTokens: 915, completionTokens: 42 },
		});
		const args = fake.runs[0].args;
		expect(args[args.indexOf("--model") + 1]).toBe("claude-abaci");
		expect(args.slice(-2)).toEqual(["--effort", "medium"]);
	});

	it("retries an answer that fails the schema, telling the model why", async () => {
		const fake = fakeRunner([]);
		let call = 0;
		const runner: ClaudeCliRunner = async (run) => {
			fake.runs.push(run);
			call++;
			run.onLine(
				resultLine({
					structured_output: call === 1 ? { title: 7 } : { title: "ok" },
				}),
			);
			return { exitCode: 0, stderr: "", timedOut: false, stopped: false };
		};
		const events = await collect(
			withProvider(runner).stream({ prompt: "p", schema, maxRetries: 1 }),
		);
		expect(events.at(-1)).toMatchObject({
			type: "complete",
			data: { title: "ok" },
		});
		expect(fake.runs).toHaveLength(2);
		expect(JSON.parse(fake.runs[1].stdin).message.content[0].text).toMatch(
			/title/,
		);
	});

	it("voids the streamed answer before a retry streams a new one", async () => {
		let call = 0;
		const runner: ClaudeCliRunner = async (run) => {
			call++;
			run.onLine(blockStart(0, "tool_use"));
			run.onLine(
				delta(0, {
					type: "input_json_delta",
					partial_json: call === 1 ? '{"title":7}' : '{"title":"ok"}',
				}),
			);
			run.onLine(
				resultLine({
					structured_output: call === 1 ? { title: 7 } : { title: "ok" },
				}),
			);
			return { exitCode: 0, stderr: "", timedOut: false, stopped: false };
		};
		const events = await collect(
			withProvider(runner).stream({ prompt: "p", schema, maxRetries: 1 }),
		);
		expect(events.map((e) => e.type)).toEqual([
			"output_delta",
			"output_reset",
			"output_delta",
			"complete",
		]);
	});

	it("voids the answer when the CLI asks the model again within a run", async () => {
		const fake = fakeRunner([
			se({ type: "message_start" }),
			blockStart(0, "tool_use"),
			delta(0, { type: "input_json_delta", partial_json: '{"title":7}' }),
			se({ type: "message_start" }),
			blockStart(0, "tool_use"),
			delta(0, { type: "input_json_delta", partial_json: '{"title":"ok"}' }),
			resultLine({ structured_output: { title: "ok" } }),
		]);
		const events = await collect(
			withProvider(fake.runner).stream({ prompt: "p", schema }),
		);
		expect(events.map((e) => e.type)).toEqual([
			"output_delta",
			"output_reset",
			"output_delta",
			"complete",
		]);
	});

	it("gives up with a validation error once retries run out", async () => {
		const runner: ClaudeCliRunner = async (run) => {
			run.onLine(resultLine({ structured_output: { title: 7 } }));
			return { exitCode: 0, stderr: "", timedOut: false, stopped: false };
		};
		await expect(
			collect(
				withProvider(runner).stream({ prompt: "p", schema, maxRetries: 0 }),
			),
		).rejects.toBeInstanceOf(LLMValidationError);
	});

	it("streamText yields the reply's text and the whole reply", async () => {
		const fake = fakeRunner([
			blockStart(0, "text"),
			delta(0, { type: "text_delta", text: "Hi " }),
			delta(0, { type: "text_delta", text: "there" }),
			resultLine({ result: "Hi there" }),
		]);
		const events: StreamEvent<string>[] = await collect(
			withProvider(fake.runner).streamText({ prompt: "p", system: "s" }),
		);
		expect(events.map((e) => e.type)).toEqual([
			"output_delta",
			"output_delta",
			"complete",
		]);
		expect(events[2]).toMatchObject({ type: "complete", data: "Hi there" });
		expect(fake.runs[0].args).not.toContain("--json-schema");
	});
});

describe("proxyRoot", () => {
	it("strips a trailing /v1 and slashes", () => {
		expect(proxyRoot("http://nas:8787/v1")).toBe("http://nas:8787");
		expect(proxyRoot("http://nas:8787/v1/")).toBe("http://nas:8787");
		expect(proxyRoot("http://nas:8787")).toBe("http://nas:8787");
	});
});

describe("spawnClaudeCli (real process)", () => {
	const dir = mkdtempSync(join(tmpdir(), "claude-cli-test-"));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	const script = (body: string) => {
		const path = join(dir, `${Math.random().toString(36).slice(2)}.mjs`);
		writeFileSync(path, body);
		return path;
	};

	const base = {
		command: process.execPath,
		env: { PATH: process.env.PATH ?? "" },
		cwd: join(dir, "home"),
		timeoutMs: 5_000,
	};

	it("feeds stdin and hands back each stdout line", async () => {
		const path = script(`
			let input = "";
			process.stdin.on("data", (c) => (input += c));
			process.stdin.on("end", () => {
				process.stdout.write(JSON.stringify({ type: "echo", input }) + "\\n");
				process.stdout.write(JSON.stringify({ type: "result" }));
			});
		`);
		const lines: string[] = [];
		const result = await spawnClaudeCli({
			...base,
			args: [path],
			stdin: "hello prompt",
			onLine: (line) => {
				lines.push(line);
				return undefined;
			},
		});
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(lines[0])).toEqual({
			type: "echo",
			input: "hello prompt",
		});
		expect(JSON.parse(lines[1])).toEqual({ type: "result" });
	});

	it("ends the process when a line asks to stop", async () => {
		const path = script(`
			process.stdout.write("first\\n");
			setInterval(() => process.stdout.write("more\\n"), 50);
		`);
		const lines: string[] = [];
		const result = await spawnClaudeCli({
			...base,
			args: [path],
			stdin: "",
			onLine: (line) => {
				lines.push(line);
				return "stop";
			},
		});
		expect(result.stopped).toBe(true);
		expect(lines).toEqual(["first"]);
	});

	it("ends the process when its signal aborts", async () => {
		const path = script("setInterval(() => process.stdout.write('x\\n'), 20);");
		const abort = new AbortController();
		setTimeout(() => abort.abort(), 100);
		const result = await spawnClaudeCli({
			...base,
			args: [path],
			stdin: "",
			signal: abort.signal,
			onLine: () => undefined,
		});
		expect(result.stopped).toBe(true);
		expect(result.timedOut).toBe(false);
	});

	it("kills a process that outlives its timeout", async () => {
		const path = script("setInterval(() => {}, 1000);");
		const result = await spawnClaudeCli({
			...base,
			args: [path],
			stdin: "",
			timeoutMs: 200,
			onLine: () => undefined,
		});
		expect(result.timedOut).toBe(true);
	});
});

describe("LLMClient with the claude_code provider", () => {
	it("refuses the auto-derived base URL before running anything", async () => {
		const client = new LLMClient(
			{},
			{
				LLM_DEFAULT_PROVIDER: "claude_code",
				LLM_CLAUDE_CODE_API_KEY: "proxy-secret",
			},
		);
		await expect(
			client.call({
				prompt: "hi",
				schema: z.object({ a: z.string() }),
				maxRetries: 0,
			}),
		).rejects.toThrow(/LLM_CLAUDE_CODE_BASE_URL/);
	});

	it("is discovered from LLM_CLAUDE_CODE_* with claude-sonnet-5 as its default model", () => {
		const client = new LLMClient(
			{},
			{
				LLM_DEFAULT_PROVIDER: "claude_code",
				LLM_CLAUDE_CODE_API_KEY: "proxy-secret",
				LLM_CLAUDE_CODE_BASE_URL: "http://nas:8787",
			},
		);
		expect(client.getDefaultProvider()).toBe("claude_code");
		expect(client.getDefaultModel()).toBe("claude-sonnet-5");
	});
});
