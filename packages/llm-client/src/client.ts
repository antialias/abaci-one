import { z } from "zod";
import { loadConfigFromEnv, PROVIDER_NAME } from "./config";
import { Logger } from "./logger";
import type { StreamMiddleware } from "./middleware";
import { ClaudeCodeProvider } from "./providers/claude-code";
import { executeWithRetry, getRetryDelay, isRetryableError } from "./retry";
import type {
	LLMClientConfig,
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
import { LLMValidationError, ProviderNotConfiguredError } from "./types";

/**
 * The schema sent with a free-text request. claude_code ignores it in text
 * mode (the answer is the model's text), but every request carries one.
 */
const TextAnswerSchema = z.object({
	text: z.string().describe("Your whole reply, as plain text"),
});

/**
 * LLM Client for making type-safe LLM calls with multi-provider support
 *
 * Features:
 * - One provider: Claude Code (`claude -p`) through the switch proxy, which
 *   does any falling back between upstreams
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
	private provider: ClaudeCodeProvider | undefined;
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
	 * Reasoning and output deltas are reported as they arrive.
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
	 * events and `complete.data` is the whole reply.
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
		const model = request.model ?? this.getDefaultModel();
		const provider = this.getOrCreateProvider();

		const jsonSchema = z.toJSONSchema(request.schema, {
			unrepresentable: "any",
		}) as Record<string, unknown>;

		requestLogger.debug("Starting stream request", {
			provider: PROVIDER_NAME,
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
			model,
		);
	}

	private async *createRawTextStream(
		request: LLMTextStreamRequest,
	): AsyncGenerator<StreamEvent<string>, void, unknown> {
		const model = request.model ?? this.getDefaultModel();
		const provider = this.getOrCreateProvider();

		const base: ProviderRequest = {
			prompt: request.prompt,
			system: request.system,
			images: request.images,
			jsonSchema: z.toJSONSchema(TextAnswerSchema) as Record<string, unknown>,
			textOutput: true,
			model,
			reasoningEffort: request.reasoningEffort ?? defaultReasoningEffort(model),
			timeoutMs: request.timeoutMs ?? 120_000,
			priority: request.priority,
			signal: request.signal,
		};

		yield* this.runStream(
			provider,
			base,
			request.maxRetries ?? this.config.defaultMaxRetries,
			(content) =>
				typeof content === "string"
					? { ok: true, data: content }
					: {
							ok: false,
							feedback: {
								field: "text",
								error: "Expected the reply as a string",
								received: content,
							},
						},
			model,
		);
	}

	/**
	 * One streamed request with retries. Validation failures are fed back;
	 * retryable failures are retried only while nothing has streamed yet (a
	 * caller already showing text would otherwise see it twice).
	 */
	private async *runStream<D>(
		provider: ClaudeCodeProvider,
		base: ProviderRequest,
		maxRetries: number,
		validate: (
			content: unknown,
		) => { ok: true; data: D } | { ok: false; feedback: ValidationFeedback },
		model: string,
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
					provider: PROVIDER_NAME,
					model,
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
	 * Whether the claude_code provider is configured (LLM_CLAUDE_CODE_API_KEY)
	 */
	isConfigured(): boolean {
		return this.config.provider !== undefined;
	}

	/**
	 * The provider's name, as recorded with usage: always "claude_code"
	 */
	getProviderName(): string {
		return PROVIDER_NAME;
	}

	/**
	 * Get the default model
	 */
	getDefaultModel(): string {
		return (
			this.config.defaultModel ??
			this.config.provider?.defaultModel ??
			"default"
		);
	}

	/**
	 * Execute the LLM request with retry logic
	 */
	private async executeRequest<T extends z.ZodType>(
		request: LLMRequest<T>,
	): Promise<LLMResponse<z.infer<T>>> {
		const model = request.model ?? this.getDefaultModel();
		const maxRetries = request.maxRetries ?? this.config.defaultMaxRetries;
		const provider = this.getOrCreateProvider();

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
			provider: PROVIDER_NAME,
			model,
			rawResponse: providerResponse.rawContent,
			jsonSchema: JSON.stringify(jsonSchema, null, 2),
		};
	}

	/**
	 * The claude_code provider, built on first use
	 */
	private getOrCreateProvider(): ClaudeCodeProvider {
		if (this.provider) {
			return this.provider;
		}
		const providerConfig = this.config.provider;
		if (!providerConfig) {
			throw new ProviderNotConfiguredError(PROVIDER_NAME);
		}
		// No base URL default: the proxy client secret must only ever go to
		// the proxy.
		if (!providerConfig.baseUrl) {
			throw new Error(
				"claude_code provider requires an explicit LLM_CLAUDE_CODE_BASE_URL " +
					"(the switch proxy's root, e.g. http://nas:8787)",
			);
		}
		this.provider = new ClaudeCodeProvider(providerConfig);
		return this.provider;
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
