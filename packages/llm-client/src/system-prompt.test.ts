/**
 * The caller's `system` instructions must reach the model on every path:
 * call, vision, stream and streamText, through the real client and providers.
 * claude_code runs a fake `claude` that records its arguments and stdin.
 */
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { z } from "zod";
import { LLMClient } from "./client";

const SYSTEM = "SYSTEM-MARKER-7f3a";
const schema = z.object({ answer: z.string() });
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("system instructions reach claude_code", () => {
	let home: string;
	let client: LLMClient;

	beforeAll(() => {
		home = mkdtempSync(join(tmpdir(), "llm-system-"));
		const cli = join(home, "fake-claude.sh");
		// Records argv (one per line) and stdin under its HOME, then answers.
		writeFileSync(
			cli,
			`#!/bin/sh
printf '%s\\n' "$@" > "$HOME/args.txt"
cat > "$HOME/stdin.txt"
echo '{"type":"result","subtype":"success","is_error":false,"result":"plain reply","structured_output":{"answer":"ok"},"usage":{"input_tokens":1,"output_tokens":1}}'
`,
		);
		chmodSync(cli, 0o755);
		client = new LLMClient(
			{},
			{
				LLM_DEFAULT_PROVIDER: "claude_code",
				LLM_CLAUDE_CODE_API_KEY: "dummy",
				LLM_CLAUDE_CODE_BASE_URL: "http://127.0.0.1:9",
				LLM_CLAUDE_CODE_CLI_PATH: cli,
				LLM_CLAUDE_CODE_HOME: home,
			},
		);
	});
	afterAll(() => rmSync(home, { recursive: true, force: true }));

	const args = () => readFileSync(join(home, "args.txt"), "utf8");
	const drain = async (gen: AsyncGenerator<unknown, void, unknown>) => {
		for await (const _ of gen) {
			// drain
		}
	};

	it("call()", async () => {
		const r = await client.call({
			system: SYSTEM,
			prompt: "p",
			schema,
			maxRetries: 0,
		});
		expect(r.data).toEqual({ answer: "ok" });
		expect(args()).toContain(SYSTEM);
	});

	it("vision()", async () => {
		await client.vision({
			system: SYSTEM,
			prompt: "p",
			images: [image],
			schema,
			maxRetries: 0,
		});
		expect(args()).toContain(SYSTEM);
	});

	it("stream()", async () => {
		await drain(
			client.stream({ system: SYSTEM, prompt: "p", schema, maxRetries: 0 }),
		);
		expect(args()).toContain(SYSTEM);
	});

	it("streamText()", async () => {
		await drain(
			client.streamText({ system: SYSTEM, prompt: "p", maxRetries: 0 }),
		);
		expect(args()).toContain(SYSTEM);
	});
});

describe("system instructions reach openai (the kill switch)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const answer = (content: unknown) =>
		vi.fn().mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						id: "chatcmpl-test",
						choices: [
							{
								index: 0,
								message: {
									role: "assistant",
									content: JSON.stringify(content),
								},
								finish_reason: "stop",
							},
						],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
		);
	const client = () =>
		new LLMClient(
			{},
			{ LLM_DEFAULT_PROVIDER: "openai", LLM_OPENAI_API_KEY: "sk-test" },
		);
	const sent = (spy: ReturnType<typeof vi.fn>) =>
		(spy.mock.calls[0] as [string, RequestInit])[1].body as string;

	it("call()", async () => {
		const spy = answer({ answer: "ok" });
		vi.stubGlobal("fetch", spy);
		await client().call({ system: SYSTEM, prompt: "p", schema, maxRetries: 0 });
		expect(sent(spy)).toContain(SYSTEM);
	});

	it("vision()", async () => {
		const spy = answer({ answer: "ok" });
		vi.stubGlobal("fetch", spy);
		await client().vision({
			system: SYSTEM,
			prompt: "p",
			images: [image],
			schema,
			maxRetries: 0,
		});
		expect(sent(spy)).toContain(SYSTEM);
	});
});
