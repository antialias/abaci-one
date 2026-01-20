import { z } from "zod";
import type { ProviderConfig, ReasoningConfig, StreamEvent } from "../types";
import { LLMApiError, LLMTimeoutError, LLMNetworkError } from "../types";

/** Default idle timeout for streaming requests (2 minutes without data = abort) */
const DEFAULT_IDLE_TIMEOUT_MS = 120_000;

/** Default total timeout for streaming requests (15 minutes max total time) */
const DEFAULT_TOTAL_TIMEOUT_MS = 900_000;

/**
 * Content item for vision requests
 */
interface ContentItem {
  type: "input_text" | "input_image";
  text?: string;
  /** Image URL (base64 data URL format: data:image/png;base64,...) */
  image_url?: string;
}

/**
 * Message item for the Responses API input array
 */
interface InputMessage {
  role: "user" | "assistant" | "system";
  content: ContentItem[];
}

/**
 * OpenAI Responses API streaming event types
 */
type ResponsesStreamEvent =
  | { type: "response.created"; response: { id: string } }
  | { type: "response.in_progress" }
  | {
      type: "response.reasoning_summary_part.added";
      item_id: string;
      summary_index: number;
    }
  | {
      type: "response.reasoning_summary_text.delta";
      delta: string;
      summary_index: number;
    }
  | {
      type: "response.reasoning_summary_text.done";
      text: string;
      summary_index: number;
    }
  | { type: "response.reasoning_summary_part.done" }
  | { type: "response.output_item.added"; item: { type: string; id: string } }
  | { type: "response.output_text.delta"; delta: string; output_index: number }
  | { type: "response.output_text.done"; text: string }
  | {
      type: "response.output_item.done";
      item: { type: string; content?: Array<{ type: string; text?: string }> };
    }
  | {
      type: "response.completed";
      response: {
        id: string;
        output: Array<{
          type: string;
          content?: Array<{ type: string; text?: string }>;
        }>;
        usage?: {
          input_tokens: number;
          output_tokens: number;
          reasoning_tokens?: number;
        };
      };
    }
  | { type: "response.failed"; error: { message: string; code?: string } }
  | { type: "error"; error: { message: string; type?: string; code?: string } };

/**
 * OpenAI Responses API provider with streaming support
 *
 * Uses the new Responses API endpoint which provides:
 * - Reasoning summaries (shows the model's thinking process)
 * - Semantic streaming events
 * - Better support for reasoning models (o1, o3, o4-mini, GPT-5.2)
 */
export class OpenAIResponsesProvider {
  readonly name = "openai";

  constructor(private readonly config: ProviderConfig) {}

  /**
   * Stream a response from the Responses API
   *
   * @param request - The request parameters
   * @param schema - Zod schema for response validation
   * @returns AsyncGenerator yielding stream events
   */
  async *stream<T>(
    request: {
      prompt: string;
      images?: string[];
      jsonSchema: Record<string, unknown>;
      model: string;
      reasoning?: ReasoningConfig;
      timeoutMs?: number;
    },
    schema: z.ZodType<T>,
  ): AsyncGenerator<StreamEvent<T>, void, unknown> {
    // Use the provided timeout as the idle timeout (time without receiving data)
    // This is smarter for streaming: we only abort if no data flows for this duration
    const idleTimeoutMs = request.timeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    const totalTimeoutMs = DEFAULT_TOTAL_TIMEOUT_MS;

    // Build the content array for the message
    const content: ContentItem[] = [];

    // Add images first (for vision)
    if (request.images && request.images.length > 0) {
      for (const imageDataUrl of request.images) {
        content.push({
          type: "input_image",
          image_url: imageDataUrl,
        });
      }
    }

    // Add the text prompt
    content.push({
      type: "input_text",
      text: request.prompt,
    });

    // Wrap content in a message - Responses API requires this structure for vision
    const input: InputMessage[] = [
      {
        role: "user",
        content,
      },
    ];

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: request.model,
      input,
      stream: true,
      text: {
        format: {
          type: "json_schema",
          name: "response",
          schema: request.jsonSchema,
          strict: true,
        },
      },
    };

    // Add reasoning configuration if provided
    if (request.reasoning) {
      requestBody.reasoning = {
        effort: request.reasoning.effort,
        summary: request.reasoning.summary ?? "auto",
      };
    }

    // Set up idle timeout (resets on each chunk) and total timeout (absolute limit)
    const controller = new AbortController();
    let idleTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let totalTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let idleTimedOut = false;

    const resetIdleTimeout = () => {
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      if (idleTimeoutMs > 0) {
        idleTimeoutId = setTimeout(() => {
          idleTimedOut = true;
          controller.abort();
        }, idleTimeoutMs);
      }
    };

    const clearAllTimeouts = () => {
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      if (totalTimeoutId) clearTimeout(totalTimeoutId);
    };

    // Set up initial idle timeout
    resetIdleTimeout();

    // Set up total timeout (absolute limit)
    if (totalTimeoutMs > 0) {
      totalTimeoutId = setTimeout(() => {
        controller.abort();
      }, totalTimeoutMs);
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      clearAllTimeouts();

      if (error instanceof Error && error.name === "AbortError") {
        const timeoutValue = idleTimedOut ? idleTimeoutMs : totalTimeoutMs;
        throw new LLMTimeoutError(this.name, timeoutValue);
      }

      throw new LLMNetworkError(
        this.name,
        error instanceof Error ? error : undefined,
      );
    }

    if (!response.ok) {
      clearAllTimeouts();
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message ?? errorText;
      } catch {
        // Keep original text
      }
      throw new LLMApiError(this.name, response.status, errorMessage);
    }

    // Process the SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      clearAllTimeouts();
      throw new LLMApiError(this.name, 500, "No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedOutput = "";
    let finalResponse: ResponsesStreamEvent | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Reset idle timeout on each received chunk - stream is still active
        resetIdleTimeout();

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            if (data === "[DONE]") {
              continue;
            }

            try {
              const event = JSON.parse(data) as ResponsesStreamEvent;

              // Handle different event types
              switch (event.type) {
                case "response.created":
                  yield {
                    type: "started",
                    responseId: event.response.id,
                  };
                  break;

                case "response.reasoning_summary_text.delta":
                  yield {
                    type: "reasoning",
                    text: event.delta,
                    summaryIndex: event.summary_index,
                    isDelta: true,
                  };
                  break;

                case "response.reasoning_summary_text.done":
                  yield {
                    type: "reasoning",
                    text: event.text,
                    summaryIndex: event.summary_index,
                    isDelta: false,
                  };
                  break;

                case "response.output_text.delta":
                  accumulatedOutput += event.delta;
                  yield {
                    type: "output_delta",
                    text: event.delta,
                    outputIndex: event.output_index,
                  };
                  break;

                case "response.completed":
                  finalResponse = event;
                  break;

                case "response.failed":
                  yield {
                    type: "error",
                    message: event.error.message,
                    code: event.error.code,
                  };
                  break;

                case "error":
                  yield {
                    type: "error",
                    message: event.error.message,
                    code: event.error.code ?? event.error.type,
                  };
                  break;
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

      // Clear timeouts on successful completion
      clearAllTimeouts();

      // Extract and validate the final output
      if (finalResponse && finalResponse.type === "response.completed") {
        const output = finalResponse.response.output;
        let outputText = accumulatedOutput;

        // If we didn't accumulate output, try to extract from final response
        if (!outputText && output) {
          for (const item of output) {
            if (item.type === "message" && item.content) {
              for (const content of item.content) {
                if (content.type === "output_text" && content.text) {
                  outputText = content.text;
                  break;
                }
              }
            }
          }
        }

        // Parse and validate the output
        try {
          const parsed = JSON.parse(outputText);
          const validated = schema.parse(parsed);

          yield {
            type: "complete",
            data: validated,
            usage: {
              promptTokens: finalResponse.response.usage?.input_tokens ?? 0,
              completionTokens:
                finalResponse.response.usage?.output_tokens ?? 0,
              reasoningTokens: finalResponse.response.usage?.reasoning_tokens,
            },
            rawResponse: outputText,
          };
        } catch (error) {
          yield {
            type: "error",
            message: `Failed to parse/validate response: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }
    } finally {
      clearAllTimeouts();
      reader.releaseLock();
    }
  }
}
