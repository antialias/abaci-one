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
export { LLMClient } from "./client";
// Config utilities
export {
	getConfiguredProviders,
	getProviderConfig,
	isProviderConfigured,
	loadConfigFromEnv,
} from "./config";
export { Logger } from "./logger";
// Middleware
export type { StreamMiddleware } from "./middleware";
export {
	createPersistenceMiddleware,
	type PersistenceOptions,
} from "./middleware/persistence";
export { AnthropicProvider } from "./providers/anthropic";
// Providers (for advanced usage / custom providers)
export { BaseProvider } from "./providers/base";
export { OpenAIProvider } from "./providers/openai";
export { OpenAIResponsesProvider } from "./providers/openai-responses";
export type { RetryOptions } from "./retry";
// Retry utilities (for advanced usage)
export {
	buildFeedbackPrompt,
	executeWithRetry,
	getRetryDelay,
	isRetryableError,
} from "./retry";
// Types
export type {
	// Embedding types
	EmbeddingRequest,
	EmbeddingResponse,
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
	ValidationFeedback,
} from "./types";
// Logging utilities
// Errors
export {
	defaultLogger,
	LLMApiError,
	LLMContentFilterError,
	LLMJsonParseError,
	LLMNetworkError,
	LLMTimeoutError,
	LLMTruncationError,
	LLMValidationError,
	ProviderNotConfiguredError,
} from "./types";
