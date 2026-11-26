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
// Image generation (switch proxy Images API, by image class)
// ---------------------------------------------------------------------------

/**
 * Record one image drawn through the switch proxy. Provider is `'switch'`;
 * model is the member that served it (e.g. `runway/gpt_image_2`), falling
 * back to the class when the proxy didn't say. The class goes in metadata.
 * No pricing row matches `switch/<member>`, so cost is unknown (null), not $0.
 */
export function recordImageGenUsage(
  served: { imageClass: string; member: string | null },
  context: UsageContext,
  metadata?: Record<string, unknown>
): void {
  recordAiUsage({
    ...context,
    provider: 'switch',
    model: served.member || served.imageClass,
    apiType: 'image',
    imageCount: 1,
    metadata: { ...metadata, imageClass: served.imageClass },
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
