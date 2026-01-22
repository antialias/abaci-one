import { z } from "zod";
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  LLMClientConfig,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamRequest,
  LoggingConfig,
  ProviderRequest,
  StreamEvent,
  ValidationFeedback,
} from "./types";
import { LLMApiError, ProviderNotConfiguredError } from "./types";
import {
  loadConfigFromEnv,
  getProviderConfig,
  getConfiguredProviders,
  isProviderConfigured,
} from "./config";
import { executeWithRetry } from "./retry";
import { Logger } from "./logger";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIResponsesProvider } from "./providers/openai-responses";

/**
 * Factory function type for creating providers
 */
type ProviderFactory = (
  config: LLMClientConfig,
  providerName: string,
) => LLMProvider;

/**
 * Registry of provider factories
 */
const providerFactories: Record<string, ProviderFactory> = {
  openai: (config, name) => {
    const providerConfig = getProviderConfig(config, name);
    if (!providerConfig) throw new ProviderNotConfiguredError(name);
    return new OpenAIProvider(providerConfig);
  },
  anthropic: (config, name) => {
    const providerConfig = getProviderConfig(config, name);
    if (!providerConfig) throw new ProviderNotConfiguredError(name);
    return new AnthropicProvider(providerConfig);
  },
};

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
  private readonly config: LLMClientConfig;
  private readonly providers: Map<string, LLMProvider> = new Map();
  private logger: Logger;

  /**
   * Create a new LLM client
   *
   * @param configOverrides - Optional configuration overrides
   * @param env - Environment variables (defaults to process.env)
   */
  constructor(
    configOverrides?: Partial<LLMClientConfig>,
    env?: Record<string, string | undefined>,
  ) {
    const envConfig = loadConfigFromEnv(env);
    this.config = {
      ...envConfig,
      ...configOverrides,
      providers: {
        ...envConfig.providers,
        ...configOverrides?.providers,
      },
      logging: configOverrides?.logging ?? envConfig.logging,
    };
    this.logger = new Logger(this.config.logging);
  }

  /**
   * Enable or disable logging at runtime
   */
  setLogging(config: Partial<LoggingConfig>): void {
    const newConfig = { ...this.config.logging, ...config } as LoggingConfig;
    this.config.logging = newConfig;
    this.logger = new Logger(newConfig);
  }

  /**
   * Make a structured LLM call with schema validation
   *
   * @param request - The request configuration
   * @returns Type-safe response with validated data
   */
  async call<T extends z.ZodType>(
    request: LLMRequest<T>,
  ): Promise<LLMResponse<z.infer<T>>> {
    return this.executeRequest(request);
  }

  /**
   * Make a vision call (convenience method for requests with images)
   *
   * @param request - The request configuration (must include images)
   * @returns Type-safe response with validated data
   */
  async vision<T extends z.ZodType>(
    request: LLMRequest<T> & { images: string[] },
  ): Promise<LLMResponse<z.infer<T>>> {
    return this.executeRequest(request);
  }

  /**
   * Stream an LLM response with reasoning summaries
   *
   * Uses the OpenAI Responses API to stream responses with:
   * - Reasoning summaries (shows the model's thinking process)
   * - Output text deltas (partial response text)
   * - Final validated response
   *
   * @param request - The stream request configuration
   * @returns AsyncGenerator yielding stream events
   *
   * @example
   * ```typescript
   * const stream = llm.stream({
   *   prompt: 'Analyze this worksheet',
   *   images: [imageDataUrl],
   *   schema: WorksheetSchema,
   *   reasoning: { effort: 'medium', summary: 'auto' },
   * });
   *
   * for await (const event of stream) {
   *   if (event.type === 'reasoning') {
   *     console.log('Thinking:', event.text);
   *   } else if (event.type === 'complete') {
   *     console.log('Result:', event.data);
   *   }
   * }
   * ```
   */
  async *stream<T extends z.ZodType>(
    request: LLMStreamRequest<T>,
  ): AsyncGenerator<StreamEvent<z.infer<T>>, void, unknown> {
    // Get logger for this request (may be overridden by request.debug)
    const requestLogger = this.logger.withEnabled(request.debug);

    const providerName = request.provider ?? this.config.defaultProvider;
    const model = request.model ?? this.getDefaultModel(providerName);

    requestLogger.debug("Starting stream request", {
      provider: providerName,
      model,
      promptLength: request.prompt.length,
      hasImages: !!request.images?.length,
    });

    // Currently only OpenAI Responses API supports streaming with reasoning
    if (providerName.toLowerCase() !== "openai") {
      throw new Error(
        `Streaming with reasoning is only supported for OpenAI. ` +
          `Provider '${providerName}' does not support the Responses API.`,
      );
    }

    // Get provider config
    const providerConfig = getProviderConfig(this.config, providerName);
    if (!providerConfig) {
      throw new ProviderNotConfiguredError(providerName);
    }

    // Create responses provider (separate from chat completions provider)
    const responsesProvider = new OpenAIResponsesProvider(
      providerConfig,
      requestLogger,
    );

    // Convert Zod schema to JSON Schema
    const jsonSchema = z.toJSONSchema(request.schema, {
      unrepresentable: "any",
    }) as Record<string, unknown>;

    // Default reasoning config for streaming
    const reasoning = request.reasoning ?? {
      effort:
        model.includes("5.2") && !model.includes("instant")
          ? ("medium" as const)
          : ("low" as const),
      summary: "auto" as const,
    };

    requestLogger.debug("Streaming with config", {
      reasoning,
      timeoutMs: request.timeoutMs,
      schemaKeys: Object.keys(jsonSchema),
    });

    // Stream the response
    yield* responsesProvider.stream<z.infer<T>>(
      {
        prompt: request.prompt,
        images: request.images,
        jsonSchema,
        model,
        reasoning,
        timeoutMs: request.timeoutMs,
      },
      request.schema as z.ZodType<z.infer<T>>,
    );
  }

  /**
   * Get list of configured providers
   */
  getProviders(): string[] {
    return getConfiguredProviders(this.config);
  }

  /**
   * Check if a provider is configured
   */
  isProviderAvailable(providerName: string): boolean {
    return isProviderConfigured(this.config, providerName);
  }

  /**
   * Get the default provider name
   */
  getDefaultProvider(): string {
    return this.config.defaultProvider;
  }

  /**
   * Get the default model
   */
  getDefaultModel(providerName?: string): string {
    if (this.config.defaultModel) {
      return this.config.defaultModel;
    }
    const provider = getProviderConfig(this.config, providerName);
    return provider?.defaultModel ?? "default";
  }

  /**
   * Generate embeddings for text using OpenAI's embedding API
   *
   * @param request - The embedding request
   * @returns Embedding response with Float32Array embeddings
   *
   * @example
   * ```typescript
   * const llm = new LLMClient()
   *
   * // Single text
   * const { embeddings } = await llm.embed({ input: 'Hello world' })
   * console.log(embeddings[0]) // Float32Array(1536)
   *
   * // Multiple texts (more efficient)
   * const { embeddings } = await llm.embed({
   *   input: ['Hello', 'World'],
   *   model: 'text-embedding-3-small'
   * })
   * ```
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Embeddings are only available via OpenAI
    const providerConfig = getProviderConfig(this.config, "openai");
    if (!providerConfig) {
      throw new ProviderNotConfiguredError("openai");
    }

    const model = request.model ?? "text-embedding-3-small";
    const inputTexts = Array.isArray(request.input)
      ? request.input
      : [request.input];

    const requestBody: Record<string, unknown> = {
      model,
      input: inputTexts,
    };

    if (request.dimensions) {
      requestBody.dimensions = request.dimensions;
    }

    const response = await fetch(`${providerConfig.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText) as {
          error?: { message?: string };
        };
        errorMessage = errorJson.error?.message ?? errorText;
      } catch {
        // Keep original text
      }

      throw new LLMApiError("openai", response.status, errorMessage);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      usage: { prompt_tokens: number; total_tokens: number };
      model: string;
    };

    // Sort by index to ensure correct order
    const sortedData = data.data.sort((a, b) => a.index - b.index);

    // Convert to Float32Arrays
    const embeddings = sortedData.map(
      (item) => new Float32Array(item.embedding),
    );

    return {
      embeddings,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }

  /**
   * Execute the LLM request with retry logic
   */
  private async executeRequest<T extends z.ZodType>(
    request: LLMRequest<T>,
  ): Promise<LLMResponse<z.infer<T>>> {
    const providerName = request.provider ?? this.config.defaultProvider;
    const model = request.model ?? this.getDefaultModel(providerName);
    const maxRetries = request.maxRetries ?? this.config.defaultMaxRetries;

    // Get or create provider instance
    const provider = this.getOrCreateProvider(providerName);

    // Convert Zod schema to JSON Schema using Zod v4's native method
    // This preserves .describe() annotations as "description" fields
    const jsonSchema = z.toJSONSchema(request.schema, {
      unrepresentable: "any", // Convert unrepresentable types to {} instead of throwing
    }) as Record<string, unknown>;

    // Determine default reasoning effort for GPT-5.2+ models
    // Use 'medium' if thinking model and not explicitly set
    const reasoningEffort =
      request.reasoningEffort ??
      (model.includes("5.2") && !model.includes("instant")
        ? "medium"
        : undefined);

    // Timeout for LLM requests (default 2 minutes)
    const timeoutMs = request.timeoutMs ?? 120_000;

    // Execute with retry logic
    const { result: providerResponse, attempts } = await executeWithRetry(
      async (validationFeedback?: ValidationFeedback) => {
        const providerRequest: ProviderRequest = {
          prompt: request.prompt,
          images: request.images,
          jsonSchema,
          model,
          validationFeedback,
          reasoningEffort,
          timeoutMs,
        };

        return provider.call(providerRequest);
      },
      (response) => {
        // Validate response against schema
        const parseResult = request.schema.safeParse(response.content);

        if (!parseResult.success) {
          // Extract first error for feedback (Zod v4 uses 'issues')
          const firstIssue = parseResult.error.issues[0];
          if (firstIssue) {
            return {
              field: firstIssue.path.join(".") || "root",
              error: firstIssue.message,
              received: response.content,
            };
          }
          return {
            field: "root",
            error: "Validation failed",
            received: response.content,
          };
        }

        return null; // Valid
      },
      {
        maxRetries,
        onProgress: request.onProgress,
      },
    );

    // Parse the validated response
    const parseResult = request.schema.safeParse(providerResponse.content);
    if (!parseResult.success) {
      // Should not happen after retry validation, but handle gracefully
      throw new Error("Validation failed after retry");
    }

    return {
      data: parseResult.data,
      usage: {
        promptTokens: providerResponse.usage.promptTokens,
        completionTokens: providerResponse.usage.completionTokens,
        totalTokens:
          providerResponse.usage.promptTokens +
          providerResponse.usage.completionTokens,
      },
      attempts,
      provider: providerName,
      model,
      rawResponse: providerResponse.rawContent,
      jsonSchema: JSON.stringify(jsonSchema, null, 2),
    };
  }

  /**
   * Get or create a provider instance
   */
  private getOrCreateProvider(providerName: string): LLMProvider {
    const name = providerName.toLowerCase();

    // Check cache
    const cached = this.providers.get(name);
    if (cached) {
      return cached;
    }

    // Check if provider is configured
    if (!isProviderConfigured(this.config, name)) {
      throw new ProviderNotConfiguredError(name);
    }

    // Get factory
    const factory = providerFactories[name];
    if (!factory) {
      throw new Error(
        `Unknown provider: ${name}. Supported providers: ${Object.keys(providerFactories).join(", ")}`,
      );
    }

    // Create and cache provider
    const provider = factory(this.config, name);
    this.providers.set(name, provider);

    return provider;
  }
}
