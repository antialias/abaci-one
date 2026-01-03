import type { z } from 'zod'

/**
 * Provider configuration loaded from environment variables
 */
export interface ProviderConfig {
  /** Provider name (e.g., 'openai', 'anthropic') */
  name: string
  /** API key for authentication */
  apiKey: string
  /** Base URL for API requests */
  baseUrl: string
  /** Default model for this provider */
  defaultModel: string
  /** Provider-specific options */
  options?: Record<string, unknown>
}

/**
 * LLM client configuration
 */
export interface LLMClientConfig {
  /** Default provider to use */
  defaultProvider: string
  /** Default model (overrides provider default) */
  defaultModel?: string
  /** Configured providers */
  providers: Record<string, ProviderConfig>
  /** Default maximum retry attempts */
  defaultMaxRetries: number
}

/**
 * Reasoning effort levels for GPT-5.2+ models
 * Controls depth of reasoning (more = better quality, higher latency/cost)
 */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

/**
 * Request to make an LLM call with type-safe schema validation
 */
export interface LLMRequest<T extends z.ZodType> {
  /** The prompt to send to the LLM */
  prompt: string
  /** Base64 data URLs for vision requests */
  images?: string[]
  /** Zod schema for response validation */
  schema: T
  /** Override default provider */
  provider?: string
  /** Override default model */
  model?: string
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number
  /** Progress callback for UI feedback */
  onProgress?: (progress: LLMProgress) => void
  /**
   * Reasoning effort for GPT-5.2+ models (default: 'medium' for thinking models)
   * Higher values = better reasoning but more tokens/latency
   */
  reasoningEffort?: ReasoningEffort
}

/**
 * Progress updates during LLM call
 */
export interface LLMProgress {
  /** Current stage of the call */
  stage: 'preparing' | 'calling' | 'validating' | 'retrying'
  /** Current attempt number (1-indexed) */
  attempt: number
  /** Maximum number of attempts */
  maxAttempts: number
  /** Human-readable status message */
  message: string
  /** Validation error from previous attempt (for retries) */
  validationError?: ValidationFeedback
}

/**
 * Validation error feedback for retry prompts
 */
export interface ValidationFeedback {
  /** Field path that failed validation */
  field: string
  /** Error description */
  error: string
  /** Value that was received */
  received?: unknown
  /** Expected value or type */
  expected?: unknown
  /** Valid options (for enum fields) */
  validOptions?: string[]
}

/**
 * Response from an LLM call
 */
export interface LLMResponse<T> {
  /** Validated response data (typed according to schema) */
  data: T
  /** Token usage statistics */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Number of attempts needed */
  attempts: number
  /** Provider that was used */
  provider: string
  /** Model that was used */
  model: string
  /** Raw JSON response from the LLM (before parsing/validation) */
  rawResponse: string
  /** JSON Schema sent to the LLM (with field-level descriptions from .describe()) */
  jsonSchema: string
}

/**
 * Internal request passed to providers
 */
export interface ProviderRequest {
  /** The prompt to send */
  prompt: string
  /** Base64 data URLs for vision */
  images?: string[]
  /** JSON schema for structured output */
  jsonSchema: Record<string, unknown>
  /** Model to use */
  model: string
  /** Validation feedback from previous attempt */
  validationFeedback?: ValidationFeedback
  /** Reasoning effort level (for GPT-5.2+ models) */
  reasoningEffort?: ReasoningEffort
}

/**
 * Internal response from providers
 */
export interface ProviderResponse {
  /** Parsed content from the LLM */
  content: unknown
  /** Raw JSON string from the LLM (before parsing) */
  rawContent: string
  /** Token usage */
  usage: {
    promptTokens: number
    completionTokens: number
  }
  /** Finish reason */
  finishReason: string
}

/**
 * LLM Provider interface for implementing different providers
 */
export interface LLMProvider {
  /** Provider name */
  readonly name: string
  /** Make an LLM call */
  call(request: ProviderRequest): Promise<ProviderResponse>
}

/**
 * Error thrown when LLM validation fails after all retries
 */
export class LLMValidationError extends Error {
  constructor(public readonly feedback: ValidationFeedback) {
    super(`LLM validation failed: ${feedback.field} - ${feedback.error}`)
    this.name = 'LLMValidationError'
  }
}

/**
 * Error thrown when provider is not configured
 */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Provider '${provider}' is not configured. Check your environment variables.`)
    this.name = 'ProviderNotConfiguredError'
  }
}

/**
 * Error thrown when LLM API call fails
 */
export class LLMApiError extends Error {
  constructor(
    public readonly provider: string,
    public readonly statusCode: number,
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(`${provider} API error (${statusCode}): ${message}`)
    this.name = 'LLMApiError'
  }

  /** Check if this is a rate limit error */
  isRateLimited(): boolean {
    return this.statusCode === 429
  }

  /** Check if this is a server error that may be transient */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600
  }

  /** Check if this is a client error that won't be fixed by retrying */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500 && this.statusCode !== 429
  }
}

/**
 * Error thrown when LLM response is truncated due to token limits
 */
export class LLMTruncationError extends Error {
  constructor(
    public readonly provider: string,
    public readonly partialContent: unknown
  ) {
    super(`${provider} response was truncated due to token limits. Partial content received.`)
    this.name = 'LLMTruncationError'
  }
}

/**
 * Error thrown when LLM refuses to respond due to content filter
 */
export class LLMContentFilterError extends Error {
  constructor(
    public readonly provider: string,
    public readonly filterReason?: string
  ) {
    super(`${provider} refused to respond due to content filter${filterReason ? `: ${filterReason}` : ''}`)
    this.name = 'LLMContentFilterError'
  }
}

/**
 * Error thrown when JSON parsing fails
 */
export class LLMJsonParseError extends Error {
  constructor(
    public readonly rawContent: string,
    public readonly parseError: string
  ) {
    super(`Failed to parse LLM JSON response: ${parseError}`)
    this.name = 'LLMJsonParseError'
  }
}
