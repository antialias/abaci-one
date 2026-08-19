import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LLMClient } from "./client";

const schema = z.object({ answer: z.string() });

describe("LLMClient provider factories", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("switch provider (claude-switch-proxy)", () => {
		it("refuses the auto-derived https://api.switch.com/v1 base URL", async () => {
			// Without LLM_SWITCH_BASE_URL the env loader invents
			// https://api.switch.com/v1 — a real third-party host. The factory must
			// throw before any request is made so the proxy client secret can never
			// leak there.
			const fetchSpy = vi.fn();
			vi.stubGlobal("fetch", fetchSpy);

			const client = new LLMClient(
				{},
				{
					LLM_DEFAULT_PROVIDER: "switch",
					LLM_SWITCH_API_KEY: "sk-proxy",
				},
			);

			await expect(
				client.call({ prompt: "hi", schema, maxRetries: 0 }),
			).rejects.toThrow(/LLM_SWITCH_BASE_URL/);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("routes default calls to the proxy with the OpenAI chat-completions shape", async () => {
			const fetchSpy = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						id: "chatcmpl-test",
						model: "abaci",
						choices: [
							{
								index: 0,
								message: {
									role: "assistant",
									content: JSON.stringify({ answer: "ok" }),
								},
								finish_reason: "stop",
							},
						],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
							total_tokens: 15,
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
			vi.stubGlobal("fetch", fetchSpy);

			const client = new LLMClient(
				{},
				{
					LLM_DEFAULT_PROVIDER: "switch",
					LLM_SWITCH_API_KEY: "sk-proxy",
					LLM_SWITCH_BASE_URL: "http://proxy.test/v1",
				},
			);

			const result = await client.call({ prompt: "hi", schema });

			expect(result.data).toEqual({ answer: "ok" });
			expect(result.provider).toBe("switch");
			expect(result.model).toBe("abaci");

			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("http://proxy.test/v1/chat/completions");
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer sk-proxy",
			);

			const body = JSON.parse(init.body as string) as Record<string, unknown>;
			expect(body.model).toBe("abaci");
			expect((body.response_format as { type: string } | undefined)?.type).toBe(
				"json_schema",
			);
			// The wire rejects streaming and client tools with a 400, and "abaci"
			// is not a GPT-5.2 model, so reasoning_effort must not be inferred.
			expect(body).not.toHaveProperty("stream");
			expect(body).not.toHaveProperty("tools");
			expect(body).not.toHaveProperty("reasoning_effort");
		});

		it("throws ProviderNotConfiguredError when no LLM_SWITCH_API_KEY is set", async () => {
			const client = new LLMClient({}, { LLM_DEFAULT_PROVIDER: "switch" });

			await expect(
				client.call({ prompt: "hi", schema, maxRetries: 0 }),
			).rejects.toThrow(/switch/);
		});
	});
});
