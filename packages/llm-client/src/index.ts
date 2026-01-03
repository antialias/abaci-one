/**
 * @soroban/llm-client
 *
 * Type-safe LLM client with multi-provider support, Zod schema validation,
 * and retry logic with validation feedback.
 *
 * @example
 * ```typescript
 * import { LLMClient } from '@soroban/llm-client'
 * import { z } from 'zod'
 *
 * const llm = new LLMClient()
 *
 * const SentimentSchema = z.object({
 *   sentiment: z.enum(['positive', 'negative', 'neutral']),
 *   confidence: z.number().min(0).max(1),
 * })
 *
 * const response = await llm.call({
 *   prompt: 'Analyze sentiment: "I love this product!"',
 *   schema: SentimentSchema,
 *   onProgress: (p) => console.log(p.message),
 * })
 *
 * console.log(response.data.sentiment) // 'positive'
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { LLMClient } from './client'

// Types
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
} from './types'

// Errors
export {
  LLMValidationError,
  LLMApiError,
  LLMTruncationError,
  LLMContentFilterError,
  LLMJsonParseError,
  ProviderNotConfiguredError,
} from './types'

// Config utilities
export {
  loadConfigFromEnv,
  getProviderConfig,
  getConfiguredProviders,
  isProviderConfigured,
} from './config'

// Retry utilities (for advanced usage)
export { executeWithRetry, buildFeedbackPrompt, isRetryableError, getRetryDelay } from './retry'
export type { RetryOptions } from './retry'

// Providers (for advanced usage / custom providers)
export { BaseProvider } from './providers/base'
export { OpenAIProvider } from './providers/openai'
export { AnthropicProvider } from './providers/anthropic'
