import { z } from 'zod'
import type {
  LLMClientConfig,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ProviderRequest,
  ValidationFeedback,
} from './types'
import { ProviderNotConfiguredError } from './types'
import {
  loadConfigFromEnv,
  getProviderConfig,
  getConfiguredProviders,
  isProviderConfigured,
} from './config'
import { executeWithRetry } from './retry'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'

/**
 * Factory function type for creating providers
 */
type ProviderFactory = (config: LLMClientConfig, providerName: string) => LLMProvider

/**
 * Registry of provider factories
 */
const providerFactories: Record<string, ProviderFactory> = {
  openai: (config, name) => {
    const providerConfig = getProviderConfig(config, name)
    if (!providerConfig) throw new ProviderNotConfiguredError(name)
    return new OpenAIProvider(providerConfig)
  },
  anthropic: (config, name) => {
    const providerConfig = getProviderConfig(config, name)
    if (!providerConfig) throw new ProviderNotConfiguredError(name)
    return new AnthropicProvider(providerConfig)
  },
}

/**
 * LLM Client for making type-safe LLM calls with multi-provider support
 *
 * Features:
 * - Multi-provider support (OpenAI, Anthropic, etc.)
 * - Zod schema validation for responses
 * - Zod .describe() annotations included in prompts for LLM context
 * - Retry logic with validation feedback
 * - Progress callbacks for UI updates
 *
 * @example
 * ```typescript
 * import { LLMClient } from '@soroban/llm-client'
 * import { z } from 'zod'
 *
 * const llm = new LLMClient()
 *
 * const response = await llm.call({
 *   prompt: 'Extract sentiment from: "I love this!"',
 *   schema: z.object({
 *     sentiment: z.enum(['positive', 'negative', 'neutral'])
 *       .describe('The detected sentiment'),
 *     confidence: z.number()
 *       .describe('Confidence score between 0 and 1'),
 *   }).describe('Sentiment analysis result'),
 * })
 *
 * console.log(response.data.sentiment) // TypeScript knows this is valid
 * ```
 */
export class LLMClient {
  private readonly config: LLMClientConfig
  private readonly providers: Map<string, LLMProvider> = new Map()

  /**
   * Create a new LLM client
   *
   * @param configOverrides - Optional configuration overrides
   * @param env - Environment variables (defaults to process.env)
   */
  constructor(
    configOverrides?: Partial<LLMClientConfig>,
    env?: Record<string, string | undefined>
  ) {
    const envConfig = loadConfigFromEnv(env)
    this.config = {
      ...envConfig,
      ...configOverrides,
      providers: {
        ...envConfig.providers,
        ...configOverrides?.providers,
      },
    }
  }

  /**
   * Make a structured LLM call with schema validation
   *
   * @param request - The request configuration
   * @returns Type-safe response with validated data
   */
  async call<T extends z.ZodType>(
    request: LLMRequest<T>
  ): Promise<LLMResponse<z.infer<T>>> {
    return this.executeRequest(request)
  }

  /**
   * Make a vision call (convenience method for requests with images)
   *
   * @param request - The request configuration (must include images)
   * @returns Type-safe response with validated data
   */
  async vision<T extends z.ZodType>(
    request: LLMRequest<T> & { images: string[] }
  ): Promise<LLMResponse<z.infer<T>>> {
    return this.executeRequest(request)
  }

  /**
   * Get list of configured providers
   */
  getProviders(): string[] {
    return getConfiguredProviders(this.config)
  }

  /**
   * Check if a provider is configured
   */
  isProviderAvailable(providerName: string): boolean {
    return isProviderConfigured(this.config, providerName)
  }

  /**
   * Get the default provider name
   */
  getDefaultProvider(): string {
    return this.config.defaultProvider
  }

  /**
   * Get the default model
   */
  getDefaultModel(providerName?: string): string {
    if (this.config.defaultModel) {
      return this.config.defaultModel
    }
    const provider = getProviderConfig(this.config, providerName)
    return provider?.defaultModel ?? 'default'
  }

  /**
   * Execute the LLM request with retry logic
   */
  private async executeRequest<T extends z.ZodType>(
    request: LLMRequest<T>
  ): Promise<LLMResponse<z.infer<T>>> {
    const providerName = request.provider ?? this.config.defaultProvider
    const model = request.model ?? this.getDefaultModel(providerName)
    const maxRetries = request.maxRetries ?? this.config.defaultMaxRetries

    // Get or create provider instance
    const provider = this.getOrCreateProvider(providerName)

    // Convert Zod schema to JSON Schema using Zod v4's native method
    // This preserves .describe() annotations as "description" fields
    const jsonSchema = z.toJSONSchema(request.schema, {
      unrepresentable: 'any', // Convert unrepresentable types to {} instead of throwing
    }) as Record<string, unknown>

    // Execute with retry logic
    const { result: providerResponse, attempts } = await executeWithRetry(
      async (validationFeedback?: ValidationFeedback) => {
        const providerRequest: ProviderRequest = {
          prompt: request.prompt,
          images: request.images,
          jsonSchema,
          model,
          validationFeedback,
        }

        return provider.call(providerRequest)
      },
      (response) => {
        // Validate response against schema
        const parseResult = request.schema.safeParse(response.content)

        if (!parseResult.success) {
          // Extract first error for feedback (Zod v4 uses 'issues')
          const firstIssue = parseResult.error.issues[0]
          if (firstIssue) {
            return {
              field: firstIssue.path.join('.') || 'root',
              error: firstIssue.message,
              received: response.content,
            }
          }
          return {
            field: 'root',
            error: 'Validation failed',
            received: response.content,
          }
        }

        return null // Valid
      },
      {
        maxRetries,
        onProgress: request.onProgress,
      }
    )

    // Parse the validated response
    const parseResult = request.schema.safeParse(providerResponse.content)
    if (!parseResult.success) {
      // Should not happen after retry validation, but handle gracefully
      throw new Error('Validation failed after retry')
    }

    return {
      data: parseResult.data,
      usage: {
        promptTokens: providerResponse.usage.promptTokens,
        completionTokens: providerResponse.usage.completionTokens,
        totalTokens:
          providerResponse.usage.promptTokens + providerResponse.usage.completionTokens,
      },
      attempts,
      provider: providerName,
      model,
    }
  }

  /**
   * Get or create a provider instance
   */
  private getOrCreateProvider(providerName: string): LLMProvider {
    const name = providerName.toLowerCase()

    // Check cache
    const cached = this.providers.get(name)
    if (cached) {
      return cached
    }

    // Check if provider is configured
    if (!isProviderConfigured(this.config, name)) {
      throw new ProviderNotConfiguredError(name)
    }

    // Get factory
    const factory = providerFactories[name]
    if (!factory) {
      throw new Error(
        `Unknown provider: ${name}. Supported providers: ${Object.keys(providerFactories).join(', ')}`
      )
    }

    // Create and cache provider
    const provider = factory(this.config, name)
    this.providers.set(name, provider)

    return provider
  }
}
