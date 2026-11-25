/**
 * LLM client usage recording middleware and wrappers.
 *
 * - createUsageRecordingMiddleware: StreamMiddleware that auto-records on stream completion
 * - trackedCall: wraps llm.call() with automatic usage recording
 * - trackedEmbed: wraps llm.embed() with automatic usage recording
 *
 * IMPORTANT: This module is transitively imported by client components via
 * llm.ts → worksheet-parsing → PhotoViewerEditor → SummaryClient.
 * All imports of ./helpers (which pulls in @/db via ./record) MUST be
 * dynamic import() to avoid bundling node:http into the client.
 */

import type {
  EmbeddingRequest,
  EmbeddingResponse,
  LLMClient,
  LLMRequest,
  LLMResponse,
  StreamEvent,
  StreamMiddleware,
} from '@soroban/llm-client'
import type { z } from 'zod'
import type { AiFeatureValue } from './features'

export interface UsageRecordingContext {
  userId: string
  feature: AiFeatureValue
  backgroundTaskId?: string
}

/**
 * StreamMiddleware that records usage from the 'complete' event.
 *
 * Intercepts the stream, watches for the `complete` event, and calls
 * recordAiUsage() with token counts. All events are yielded downstream
 * unchanged.
 */
export function createUsageRecordingMiddleware(
  context: UsageRecordingContext,
  /** Provider name, when the complete event doesn't carry one */
  provider?: string,
  /** Model name, when the complete event doesn't carry one */
  model?: string
): StreamMiddleware {
  return {
    async *wrap<T>(
      stream: AsyncGenerator<StreamEvent<T>, void, unknown>
    ): AsyncGenerator<StreamEvent<T>, void, unknown> {
      for await (const event of stream) {
        if (event.type === 'complete') {
          const { recordLlmClientStreamUsage } = await import('./helpers')
          recordLlmClientStreamUsage(
            event.usage,
            event.provider ?? provider ?? 'unknown',
            event.model ?? model ?? 'unknown',
            context
          )
        }
        yield event
      }
    },
  }
}

/**
 * Call llm.call() and record usage automatically.
 */
export async function trackedCall<T extends z.ZodType>(
  llm: LLMClient,
  request: LLMRequest<T>,
  context: UsageRecordingContext
): Promise<LLMResponse<z.infer<T>>> {
  const response = await llm.call(request)
  const { recordLlmClientUsage } = await import('./helpers')
  recordLlmClientUsage(response, context)
  return response
}

/**
 * Call llm.embed() and record usage automatically.
 */
export async function trackedEmbed(
  llm: LLMClient,
  request: EmbeddingRequest,
  context: UsageRecordingContext
): Promise<EmbeddingResponse> {
  const response = await llm.embed(request)
  const { recordEmbeddingUsage } = await import('./helpers')
  recordEmbeddingUsage(response, context)
  return response
}
