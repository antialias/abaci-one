import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { LLMClient } from "../client";
import type { ProviderConfig, ProviderRequest } from "../types";
import {
	LLMApiError,
	LLMJsonParseError,
	LLMNetworkError,
	LLMTimeoutError,
} from "../types";
import {
	type ClaudeCliRun,
	type ClaudeCliRunner,
	ClaudeCodeProvider,
	proxyRoot,
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

	it("refuses images until the provider sends them", async () => {
		const fake = fakeRunner([]);
		await expect(
			new ClaudeCodeProvider(config, fake.runner).call({
				...request,
				images: ["data:image/png;base64,AAAA"],
			}),
		).rejects.toThrow(/does not take images/);
		expect(fake.runs).toHaveLength(0);
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

	it("runs no more than the configured number at once", async () => {
		let active = 0;
		let peak = 0;
		const runner: ClaudeCliRunner = async (run) => {
			active++;
			peak = Math.max(peak, active);
			await new Promise((r) => setTimeout(r, 20));
			run.onLine(resultLine({ structured_output: { title: "x" } }));
			active--;
			return { exitCode: 0, stderr: "", timedOut: false, stopped: false };
		};
		const provider = new ClaudeCodeProvider(
			{ ...config, options: { ...config.options, max_concurrency: "2" } },
			runner,
		);
		await Promise.all(Array.from({ length: 5 }, () => provider.call(request)));
		expect(peak).toBe(2);
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
