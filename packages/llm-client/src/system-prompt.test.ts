/**
 * The caller's `system` instructions must reach the model on every path:
 * call, vision, stream and streamText, through the real client and provider.
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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
