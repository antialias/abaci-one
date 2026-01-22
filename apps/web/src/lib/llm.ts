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

import { LLMClient } from "@soroban/llm-client";

// Create singleton instance
// Configuration is automatically loaded from environment variables:
// - LLM_DEFAULT_PROVIDER: Default provider (default: 'openai')
// - LLM_DEFAULT_MODEL: Default model override
// - LLM_OPENAI_API_KEY: OpenAI API key
// - LLM_OPENAI_BASE_URL: OpenAI base URL (optional)
// - LLM_ANTHROPIC_API_KEY: Anthropic API key
// - LLM_ANTHROPIC_BASE_URL: Anthropic base URL (optional)
export const llm = new LLMClient();

// Re-export types and utilities for convenience
export type {
  LLMClientConfig,
  LLMRequest,
  LLMResponse,
  LLMProgress,
  LLMProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ValidationFeedback,
  ReasoningEffort,
  // Streaming types
  LLMStreamRequest,
  ReasoningConfig,
  StreamEvent,
  StreamEventStarted,
  StreamEventReasoning,
  StreamEventOutputDelta,
  StreamEventError,
  StreamEventComplete,
  // Logging types
  LogLevel,
  LoggerFn,
  LoggingConfig,
} from "@soroban/llm-client";

export {
  LLMValidationError,
  LLMApiError,
  LLMTimeoutError,
  LLMNetworkError,
  ProviderNotConfiguredError,
  // Logging
  Logger,
  defaultLogger,
} from "@soroban/llm-client";
