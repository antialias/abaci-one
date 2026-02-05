/**
 * LLM Client Singleton for apps/web
 *
 * This module provides a singleton instance of the LLM client that reads
 * configuration from environment variables. The client supports multiple
 * providers (OpenAI, Anthropic) and provides type-safe LLM calls with
 * Zod schema validation.
 *
 * @example
 * ```typescript
 * import { llm } from '@/lib/llm'
 * import { z } from 'zod'
 *
 * const response = await llm.call({
 *   prompt: 'Analyze this text...',
 *   schema: z.object({ sentiment: z.enum(['positive', 'negative', 'neutral']) }),
 * })
 * ```
 *
 * @see packages/llm-client/README.md for full documentation
 */

import { createPersistenceMiddleware, LLMClient } from '@soroban/llm-client'
import type { TaskHandle } from './task-manager'
import type { TaskEventBase } from './tasks/events'

// Re-export LLMClient class for use in other modules
export { LLMClient }

// Configurable snapshot interval for LLM streaming persistence
// Can be adjusted or moved to env config if needed
export const LLM_SNAPSHOT_INTERVAL_MS = 3000

// Create singleton instance
// Configuration is automatically loaded from environment variables:
// - LLM_DEFAULT_PROVIDER: Default provider (default: 'openai')
// - LLM_DEFAULT_MODEL: Default model override
// - LLM_OPENAI_API_KEY: OpenAI API key
// - LLM_OPENAI_BASE_URL: OpenAI base URL (optional)
// - LLM_ANTHROPIC_API_KEY: Anthropic API key
// - LLM_ANTHROPIC_BASE_URL: Anthropic base URL (optional)
export const llm = new LLMClient()

/**
 * Create an LLM client bound to a task handle.
 *
 * Automatically:
 * - Emits transient reasoning/output events to Socket.IO (real-time UI)
 * - Persists reasoning/output snapshots every 3s (page-reload recovery)
 *
 * @param handle - The task handle for emitting events
 * @returns A derived LLM client with persistence middleware
 *
 * @example
 * ```typescript
 * const taskLLM = createTaskLLM(handle)
 * for await (const event of taskLLM.stream({ prompt, schema })) {
 *   // Middleware handles reasoning, output_delta, and snapshots automatically
 *   if (event.type === 'complete') {
 *     finalResult = event.data
 *   } else if (event.type === 'error') {
 *     llmError = { message: event.message, code: event.code }
 *   }
 * }
 * ```
 */
export function createTaskLLM<
  TOutput,
  TEvent extends TaskEventBase & {
    type: string
    text?: string
    isDelta?: boolean
    summaryIndex?: number
    outputIndex?: number
  },
>(handle: TaskHandle<TOutput, TEvent>) {
  return llm.with(
    createPersistenceMiddleware({
      snapshotIntervalMs: LLM_SNAPSHOT_INTERVAL_MS,
      onReasoning: (text, isDelta, _accumulated) => {
        handle.emitTransient({ type: 'reasoning', text, isDelta } as TEvent)
      },
      onOutputDelta: (text, _accumulated) => {
        handle.emitTransient({ type: 'output_delta', text } as TEvent)
      },
      onReasoningSnapshot: (text) => {
        handle.emit({ type: 'reasoning_snapshot', text } as TEvent)
      },
      onOutputSnapshot: (text) => {
        handle.emit({ type: 'output_snapshot', text } as TEvent)
      },
    })
  )
}

// Re-export types and utilities for convenience
export type {
  LLMClientConfig,
  LLMProgress,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  // Streaming types
  LLMStreamRequest,
  LoggerFn,
  LoggingConfig,
  // Logging types
  LogLevel,
  PersistenceOptions,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ReasoningConfig,
  ReasoningEffort,
  StreamEvent,
  StreamEventComplete,
  StreamEventError,
  StreamEventOutputDelta,
  StreamEventReasoning,
  StreamEventStarted,
  // Middleware types
  StreamMiddleware,
  ValidationFeedback,
} from '@soroban/llm-client'

export {
  // Middleware
  createPersistenceMiddleware,
  defaultLogger,
  LLMApiError,
  LLMNetworkError,
  LLMTimeoutError,
  LLMValidationError,
  // Logging
  Logger,
  ProviderNotConfiguredError,
} from '@soroban/llm-client'
