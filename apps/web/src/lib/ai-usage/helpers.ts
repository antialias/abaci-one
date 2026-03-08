/**
 * Provider-specific usage recording helpers.
 *
 * Each helper knows how to extract cost-relevant metrics from a specific
 * provider's response shape. Call sites use a one-liner instead of manually
 * constructing the full record.
 */

import type { AiFeatureValue } from './features'
import { recordAiUsage } from './record'

/** Context required for every usage record */
export interface UsageContext {
  userId: string
  feature: AiFeatureValue
  backgroundTaskId?: string
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions API
// Response shape: { usage: { prompt_tokens, completion_tokens, total_tokens } }
// ---------------------------------------------------------------------------

export function recordOpenAiChatUsage(
  response: {
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    model?: string
  },
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider: 'openai',
    model: response.model ?? 'unknown',
    apiType: 'chat_completions',
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  })
}

// ---------------------------------------------------------------------------
// OpenAI Responses API (non-streaming)
// Response shape: { usage: { input_tokens, output_tokens }, model }
// ---------------------------------------------------------------------------

export function recordOpenAiResponsesUsage(
  response: {
    usage?: {
      input_tokens?: number
      output_tokens?: number
      // reasoning is nested inside output_tokens_details in the raw API
    }
    model?: string
  },
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider: 'openai',
    model: response.model ?? 'unknown',
    apiType: 'responses',
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  })
}

// ---------------------------------------------------------------------------
// OpenAI Responses API (streaming SSE)
// Called with extracted usage from the response.completed event
// ---------------------------------------------------------------------------

export function recordOpenAiResponsesStreamUsage(
  usage: { input_tokens?: number; output_tokens?: number; reasoning_tokens?: number },
  model: string,
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider: 'openai',
    model,
    apiType: 'responses_streaming',
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    reasoningTokens: usage.reasoning_tokens ?? null,
  })
}

// ---------------------------------------------------------------------------
// @soroban/llm-client call() response
// Response shape: { usage: { promptTokens, completionTokens, totalTokens }, provider, model }
// ---------------------------------------------------------------------------

export function recordLlmClientUsage(
  response: {
    usage: { promptTokens: number; completionTokens: number; totalTokens?: number }
    provider: string
    model: string
  },
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider: response.provider,
    model: response.model,
    apiType: 'responses',
    inputTokens: response.usage.promptTokens,
    outputTokens: response.usage.completionTokens,
  })
}

// ---------------------------------------------------------------------------
// @soroban/llm-client stream() complete event
// Event shape: { usage: { promptTokens, completionTokens, reasoningTokens? } }
// ---------------------------------------------------------------------------

export function recordLlmClientStreamUsage(
  usage: { promptTokens: number; completionTokens: number; reasoningTokens?: number },
  provider: string,
  model: string,
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider,
    model,
    apiType: 'responses_streaming',
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
    reasoningTokens: usage.reasoningTokens ?? null,
  })
}

// ---------------------------------------------------------------------------
// @soroban/llm-client embed() response
// Response shape: { usage: { promptTokens, totalTokens }, model }
// ---------------------------------------------------------------------------

export function recordEmbeddingUsage(
  response: { usage: { promptTokens: number; totalTokens: number }; model: string },
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider: 'openai',
    model: response.model,
    apiType: 'embedding',
    inputTokens: response.usage.promptTokens,
    outputTokens: response.usage.totalTokens - response.usage.promptTokens,
  })
}

// ---------------------------------------------------------------------------
// Image generation (OpenAI gpt-image-1, Gemini)
// ---------------------------------------------------------------------------

export function recordImageGenUsage(
  provider: 'openai' | 'gemini',
  model: string,
  context: UsageContext,
  metadata?: Record<string, unknown>
): void {
  recordAiUsage({
    ...context,
    provider,
    model,
    apiType: 'image',
    imageCount: 1,
    metadata: metadata ?? null,
  })
}

// ---------------------------------------------------------------------------
// TTS (OpenAI gpt-4o-mini-tts)
// ---------------------------------------------------------------------------

export function recordTtsUsage(text: string, model: string, context: UsageContext): void {
  recordAiUsage({
    ...context,
    provider: 'openai',
    model,
    apiType: 'tts',
    inputCharacters: text.length,
  })
}

// ---------------------------------------------------------------------------
// Realtime voice session heartbeat (interim client-reported metrics)
// ---------------------------------------------------------------------------

export function recordRealtimeHeartbeat(
  report: {
    durationSeconds: number
    turnCount: number
    modelCharacters: number
    userCharacters: number
    toolCallCount: number
    endReason?: 'user' | 'timeout' | 'network' | 'error'
    final?: boolean
  },
  model: string,
  context: UsageContext
): void {
  recordAiUsage({
    ...context,
    provider: 'openai',
    model,
    apiType: 'realtime',
    audioDurationSeconds: report.durationSeconds,
    inputCharacters: report.userCharacters,
    outputTokens: report.modelCharacters,
    metadata: {
      turnCount: report.turnCount,
      toolCallCount: report.toolCallCount,
      endReason: report.endReason ?? null,
      final: report.final ?? false,
    },
  })
}

// ---------------------------------------------------------------------------
// ElevenLabs music generation
// ---------------------------------------------------------------------------

export function recordElevenLabsUsage(
  compositionPlan: { sections: Array<{ duration_ms: number }> },
  context: UsageContext
): void {
  const totalDurationMs = compositionPlan.sections.reduce((sum, s) => sum + s.duration_ms, 0)
  recordAiUsage({
    ...context,
    provider: 'elevenlabs',
    model: 'music_v1',
    apiType: 'music',
    audioDurationSeconds: totalDurationMs / 1000,
  })
}
