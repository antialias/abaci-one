import { z } from "zod";
import {
	getConfiguredProviders,
	getProviderConfig,
	isProviderConfigured,
	loadConfigFromEnv,
} from "./config";
import { Logger } from "./logger";
import type { StreamMiddleware } from "./middleware";
import { AnthropicProvider } from "./providers/anthropic";
import { ClaudeCodeProvider } from "./providers/claude-code";
import { OpenAIProvider } from "./providers/openai";
import { executeWithRetry, getRetryDelay, isRetryableError } from "./retry";
import type {
	LLMClientConfig,
	LLMProvider,
	LLMRequest,
	LLMResponse,
	LLMStreamRequest,
	LLMTextStreamRequest,
	LoggingConfig,
	ProviderRequest,
	ProviderResponse,
	ReasoningEffort,
	StreamEvent,
	ValidationFeedback,
} from "./types";
import {
	LLMApiError,
	LLMValidationError,
	ProviderNotConfiguredError,
} from "./types";

/** The schema a text answer is asked for from a provider that cannot stream text. */
const TextAnswerSchema = z.object({
	text: z.string().describe("Your whole reply, as plain text"),
});

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
	// Claude Code in print mode (`claude -p`), pointed at the switch proxy.
	// Configured via LLM_CLAUDE_CODE_API_KEY (the proxy client secret) and
	// LLM_CLAUDE_CODE_BASE_URL (the proxy root); see providers/claude-code.ts.
	claude_code: (config, name) => {
		const providerConfig = getProviderConfig(config, name);
		if (!providerConfig) throw new ProviderNotConfiguredError(name);
		// The generic env fallback would invent https://api.claude_code.com/v1
		// and hand it the proxy secret: require an explicit base URL.
		if (providerConfig.baseUrl === "https://api.claude_code.com/v1") {
			throw new Error(
				"claude_code provider requires an explicit LLM_CLAUDE_CODE_BASE_URL " +
					"(the switch proxy's root, e.g. http://nas:8787)",
			);
		}
		return new ClaudeCodeProvider(providerConfig);
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
	private readonly middleware: StreamMiddleware[];
	private logger: Logger;

	/**
	 * Create a new LLM client
	 *
	 * @param configOverrides - Optional configuration overrides
	 * @param env - Environment variables (defaults to process.env)
	 * @param middleware - Internal: middleware stack (use .with() to add middleware)
	 */
	constructor(
		configOverrides?: Partial<LLMClientConfig>,
		env?: Record<string, string | undefined>,
		middleware?: StreamMiddleware[],
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
		this.middleware = middleware ?? [];
	}

	/**
	 * Create a derived client with additional middleware.
	 *
	 * The new client shares the same configuration but has its own middleware stack.
	 * Middleware is applied in order: first middleware wraps raw stream,
	 * second wraps first's output, etc.
	 *
	 * @param middleware - Middleware to add to the new client
	 * @returns A new LLMClient instance with the combined middleware
	 *
	 * @example
	 * ```typescript
	 * const base = new LLMClient()
	 * const withPersistence = base.with(createPersistenceMiddleware({
	 *   onReasoning: (text) => console.log('Reasoning:', text),
	 *   onReasoningSnapshot: (text) => db.save({ reasoning: text }),
	 * }))
	 * ```
	 */
	with(...middleware: StreamMiddleware[]): LLMClient {
		return new LLMClient(
			this.config,
			undefined, // env already loaded into config
			[...this.middleware, ...middleware],
		);
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
	 * Stream an LLM response: the model's reasoning and its answer as they
	 * arrive, then the answer validated against the schema.
	 *
	 * Providers with their own stream() (claude_code) report reasoning and
	 * output deltas; the others (openai, anthropic) make one call() and report
	 * only its result, so a caller works the same whichever provider answers.
	 *
	 * An answer that fails the schema is retried with the failure fed back, as
	 * call() does; so is a retryable failure that came before anything streamed.
	 *
	 * @example
	 * ```typescript
	 * for await (const event of llm.stream({
	 *   prompt: 'Analyze this worksheet',
	 *   images: [imageDataUrl],
	 *   schema: WorksheetSchema,
	 *   reasoning: { effort: 'medium' },
	 * })) {
	 *   if (event.type === 'reasoning') console.log('Thinking:', event.text);
	 *   else if (event.type === 'complete') console.log('Result:', event.data);
	 * }
	 * ```
	 */
	async *stream<T extends z.ZodType>(
		request: LLMStreamRequest<T>,
	): AsyncGenerator<StreamEvent<z.infer<T>>, void, unknown> {
		yield* this.applyMiddleware(this.createRawStream(request));
	}

	/**
	 * Stream a free-text answer (a chat reply). Text arrives as `output_delta`
	 * events and `complete.data` is the whole reply. A provider that cannot
	 * stream text answers in one piece.
	 */
	async *streamText(
		request: LLMTextStreamRequest,
	): AsyncGenerator<StreamEvent<string>, void, unknown> {
		yield* this.applyMiddleware(this.createRawTextStream(request));
	}

	private async *applyMiddleware<D>(
		raw: AsyncGenerator<StreamEvent<D>, void, unknown>,
	): AsyncGenerator<StreamEvent<D>, void, unknown> {
		let stream = raw;
		for (const mw of this.middleware) {
			stream = mw.wrap(stream);
		}
		yield* stream;
	}

	/**
	 * Create the raw provider stream without middleware
	 */
	private async *createRawStream<T extends z.ZodType>(
		request: LLMStreamRequest<T>,
	): AsyncGenerator<StreamEvent<z.infer<T>>, void, unknown> {
		const requestLogger = this.logger.withEnabled(request.debug);
		const providerName = request.provider ?? this.config.defaultProvider;
		const model = request.model ?? this.getDefaultModel(providerName);
		const provider = this.getOrCreateProvider(providerName);

		const jsonSchema = z.toJSONSchema(request.schema, {
			unrepresentable: "any",
		}) as Record<string, unknown>;

		requestLogger.debug("Starting stream request", {
			provider: providerName,
			model,
			promptLength: request.prompt.length,
			hasImages: !!request.images?.length,
		});

		const base: ProviderRequest = {
			prompt: request.prompt,
			system: request.system,
			images: request.images,
			jsonSchema,
			model,
			reasoningEffort:
				request.reasoning?.effort ?? defaultReasoningEffort(model),
			timeoutMs: request.timeoutMs ?? 300_000,
			priority: request.priority,
			signal: request.signal,
		};

		yield* this.runStream(
			provider,
			base,
			request.maxRetries ?? this.config.defaultMaxRetries,
			(content) => {
				const parsed = request.schema.safeParse(content);
				if (parsed.success) return { ok: true, data: parsed.data };
				const issue = parsed.error.issues[0];
				return {
					ok: false,
					feedback: {
						field: issue?.path.join(".") || "root",
						error: issue?.message ?? "Validation failed",
						received: content,
					},
				};
			},
			{ provider: providerName, model },
		);
	}

	private async *createRawTextStream(
		request: LLMTextStreamRequest,
	): AsyncGenerator<StreamEvent<string>, void, unknown> {
		const providerName = request.provider ?? this.config.defaultProvider;
		const model = request.model ?? this.getDefaultModel(providerName);
		const provider = this.getOrCreateProvider(providerName);
		const textOutput = typeof provider.stream === "function";

		const base: ProviderRequest = {
			prompt: request.prompt,
			system: request.system,
			images: request.images,
			jsonSchema: z.toJSONSchema(TextAnswerSchema) as Record<string, unknown>,
			textOutput,
			model,
			reasoningEffort: request.reasoningEffort ?? defaultReasoningEffort(model),
			timeoutMs: request.timeoutMs ?? 120_000,
			priority: request.priority,
			signal: request.signal,
		};

		let sawText = false;
		for await (const event of this.runStream(
			provider,
			base,
			request.maxRetries ?? this.config.defaultMaxRetries,
			(content) => {
				if (textOutput && typeof content === "string") {
					return { ok: true, data: content };
				}
				const parsed = TextAnswerSchema.safeParse(content);
				return parsed.success
					? { ok: true, data: parsed.data.text }
					: {
							ok: false,
							feedback: {
								field: "text",
								error: "Expected the reply as a string",
								received: content,
							},
						};
			},
			{ provider: providerName, model },
		)) {
			if (event.type === "output_delta") sawText = true;
			// A provider that answered in one piece: the reply is its one delta.
			if (event.type === "complete" && !sawText && event.data) {
				yield { type: "output_delta", text: event.data, outputIndex: 0 };
			}
			yield event;
		}
	}

	/**
	 * One streamed request with retries. Validation failures are fed back;
	 * retryable failures are retried only while nothing has streamed yet (a
	 * caller already showing text would otherwise see it twice).
	 */
	private async *runStream<D>(
		provider: LLMProvider,
		base: ProviderRequest,
		maxRetries: number,
		validate: (
			content: unknown,
		) => { ok: true; data: D } | { ok: false; feedback: ValidationFeedback },
		meta: { provider: string; model: string },
	): AsyncGenerator<StreamEvent<D>, void, unknown> {
		const maxAttempts = maxRetries + 1;
		let feedback: ValidationFeedback | undefined;
		let outputShown = false;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const providerRequest: ProviderRequest = {
				...base,
				validationFeedback: feedback,
			};
			if (outputShown) {
				// The answer starts over: whoever showed the last one clears it.
				yield { type: "output_reset" };
				outputShown = false;
			}
			let streamed = false;
			let response: ProviderResponse | undefined;
			try {
				if (provider.stream) {
					for await (const event of provider.stream(providerRequest)) {
						if (event.type === "result") {
							response = event.response;
						} else {
							if (event.type !== "started") streamed = true;
							if (event.type === "output_delta") outputShown = true;
							if (event.type === "output_reset") outputShown = false;
							yield event;
						}
					}
				} else {
					response = await provider.call(providerRequest);
				}
			} catch (error) {
				if (attempt < maxAttempts && !streamed && isRetryableError(error)) {
					await sleep(getRetryDelay(error, attempt, 1000, 60_000));
					continue;
				}
				throw error;
			}
			if (!response) {
				throw new Error(`${provider.name} stream ended without a result`);
			}

			const checked = validate(response.content);
			if (checked.ok) {
				yield {
					type: "complete",
					data: checked.data,
					usage: {
						promptTokens: response.usage.promptTokens,
						completionTokens: response.usage.completionTokens,
					},
					rawResponse: response.rawContent,
					provider: meta.provider,
					model: meta.model,
				};
				return;
			}
			if (attempt >= maxAttempts) {
				throw new LLMValidationError(checked.feedback);
			}
			feedback = checked.feedback;
		}
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

		const reasoningEffort =
			request.reasoningEffort ?? defaultReasoningEffort(model);

		// Timeout for LLM requests (default 2 minutes)
		const timeoutMs = request.timeoutMs ?? 120_000;

		// Execute with retry logic
		const { result: providerResponse, attempts } = await executeWithRetry(
			async (validationFeedback?: ValidationFeedback) => {
				const providerRequest: ProviderRequest = {
					prompt: request.prompt,
					system: request.system,
					images: request.images,
					jsonSchema,
					model,
					validationFeedback,
					reasoningEffort,
					timeoutMs,
					priority: request.priority,
					signal: request.signal,
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

/**
 * The reasoning effort a request gets when it names none: 'medium' for the
 * OpenAI GPT-5.2 thinking models (as before), otherwise the provider's own.
 */
function defaultReasoningEffort(model: string): ReasoningEffort | undefined {
	return model.includes("5.2") && !model.includes("instant")
		? "medium"
		: undefined;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
