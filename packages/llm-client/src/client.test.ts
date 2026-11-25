import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LLMClient } from "./client";

const schema = z.object({ answer: z.string() });

describe("LLMClient streams on a provider that cannot stream (the kill switch)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const openAiAnswer = (content: unknown) =>
		vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "chatcmpl-test",
					choices: [
						{
							index: 0,
							message: { role: "assistant", content: JSON.stringify(content) },
							finish_reason: "stop",
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

	const env = {
		LLM_DEFAULT_PROVIDER: "openai",
		LLM_OPENAI_API_KEY: "sk-test",
	};

	it("stream() makes one call and reports its validated result", async () => {
		const fetchSpy = openAiAnswer({ answer: "ok" });
		vi.stubGlobal("fetch", fetchSpy);
		const events = [];
		for await (const event of new LLMClient({}, env).stream({
			prompt: "hi",
			system: "Be brief.",
			images: ["data:image/png;base64,AAAA"],
			schema,
		})) {
			events.push(event);
		}
		expect(events).toEqual([
			{
				type: "complete",
				data: { answer: "ok" },
				usage: { promptTokens: 10, completionTokens: 5 },
				rawResponse: JSON.stringify({ answer: "ok" }),
				provider: "openai",
				model: "gpt-5.2",
			},
		]);
		const body = JSON.parse(
			(fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
		);
		const content = body.messages[0].content;
		expect(content[0].type).toBe("image_url");
		expect(content[1].text.startsWith("Be brief.\n\nhi")).toBe(true);
	});

	it("streamText() asks for the reply as JSON and yields it as one delta", async () => {
		vi.stubGlobal("fetch", openAiAnswer({ text: "Hello there" }));
		const events = [];
		for await (const event of new LLMClient({}, env).streamText({
			prompt: "hi",
		})) {
			events.push(event);
		}
		expect(events.map((e) => e.type)).toEqual(["output_delta", "complete"]);
		expect(events[0]).toMatchObject({ text: "Hello there" });
		expect(events[1]).toMatchObject({ data: "Hello there" });
	});
});

describe("LLMClient retired providers", () => {
	it("no longer knows the switch provider (kill switch is openai or anthropic)", async () => {
		const client = new LLMClient(
			{},
			{
				LLM_DEFAULT_PROVIDER: "switch",
				LLM_SWITCH_API_KEY: "sk-proxy",
				LLM_SWITCH_BASE_URL: "http://192.0.2.1:8787/v1",
			},
		);

		await expect(
			client.call({ prompt: "hi", schema, maxRetries: 0 }),
		).rejects.toThrow(/Unknown provider: switch/);
	});
});
