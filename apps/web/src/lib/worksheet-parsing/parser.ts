/**
 * Worksheet Parser
 *
 * Uses the LLM client to parse abacus workbook page images
 * into structured problem data.
 */
import {
  type LLMClient,
  type LLMProgress,
  llm,
  type ReasoningEffort,
  type StreamEvent,
} from '@/lib/llm'
import { prepareImageForLlm } from '../llm-image'
import { buildWorksheetParsingPrompt, type PromptOptions } from './prompt-builder'
import { type WorksheetParsingResult, WorksheetParsingResultSchema } from './schemas'

/**
 * Parsing configurations: how hard the model thinks. The model is the app's
 * default (LLM_CLAUDE_CODE_DEFAULT_MODEL) unless a config names one.
 */
export interface ModelConfig {
  /** Unique identifier for this config */
  id: string
  /** Display name for UI */
  name: string
  /** Model or class id (default: the provider's default) */
  model?: string
  /** Reasoning effort */
  reasoningEffort?: ReasoningEffort
  /** Description of when to use this config */
  description: string
  /** Whether this is the default config */
  isDefault?: boolean
}

/**
 * Available configurations for worksheet parsing
 */
export const PARSING_MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'default',
    name: 'Default',
    reasoningEffort: 'medium',
    description: 'Best balance of quality and speed for worksheet analysis',
    isDefault: true,
  },
  {
    id: 'thorough',
    name: 'Thorough',
    reasoningEffort: 'high',
    description: 'More thorough reasoning, better for difficult handwriting',
  },
  {
    id: 'fast',
    name: 'Fast',
    reasoningEffort: 'low',
    description: 'Faster but less accurate, good for clear worksheets',
  },
]

/**
 * Get the default model config
 */
export function getDefaultModelConfig(): ModelConfig {
  return PARSING_MODEL_CONFIGS.find((c) => c.isDefault) ?? PARSING_MODEL_CONFIGS[0]
}

/**
 * Get a model config by ID
 */
export function getModelConfig(id: string): ModelConfig | undefined {
  return PARSING_MODEL_CONFIGS.find((c) => c.id === id)
}

/**
 * Options for parsing a worksheet
 */
export interface ParseWorksheetOptions {
  /** Progress callback for UI updates */
  onProgress?: (progress: LLMProgress) => void
  /** Maximum retries on validation failure */
  maxRetries?: number
  /** Additional prompt customization */
  promptOptions?: PromptOptions
  /** Specific model to use (defaults to configured default) */
  model?: string
  /** Reasoning effort */
  reasoningEffort?: ReasoningEffort
  /** Use a specific model config by ID */
  modelConfigId?: string
}

/**
 * Result of worksheet parsing
 */
export interface ParseWorksheetResult {
  /** Parsed worksheet data */
  data: WorksheetParsingResult
  /** Number of LLM call attempts made */
  attempts: number
  /** Provider used */
  provider: string
  /** Model used */
  model: string
  /** Token usage */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Raw JSON response from the LLM (before validation/parsing) */
  rawResponse: string
  /** JSON Schema sent to the LLM (with field descriptions) */
  jsonSchema: string
}

/**
 * Parse an abacus workbook page image
 *
 * @param imageDataUrl - Base64-encoded data URL of the worksheet image
 * @param options - Parsing options
 * @returns Structured parsing result
 *
 * @example
 * ```typescript
 * import { parseWorksheetImage } from '@/lib/worksheet-parsing'
 *
 * const result = await parseWorksheetImage(imageDataUrl, {
 *   onProgress: (p) => console.log(p.message),
 * })
 *
 * console.log(`Found ${result.data.problems.length} problems`)
 * console.log(`Overall confidence: ${result.data.overallConfidence}`)
 * ```
 */
export async function parseWorksheetImage(
  imageDataUrl: string,
  options: ParseWorksheetOptions = {}
): Promise<ParseWorksheetResult> {
  const {
    onProgress,
    maxRetries = 2,
    promptOptions = {},
    model: explicitModel,
    reasoningEffort: explicitReasoningEffort,
    modelConfigId,
  } = options

  // Resolve model config
  let model = explicitModel
  let reasoningEffort = explicitReasoningEffort

  if (modelConfigId) {
    const config = getModelConfig(modelConfigId)
    if (config) {
      model = model ?? config.model
      reasoningEffort = reasoningEffort ?? config.reasoningEffort
    }
  } else if (!model) {
    // Use default config
    const defaultConfig = getDefaultModelConfig()
    model = defaultConfig.model
    reasoningEffort = reasoningEffort ?? defaultConfig.reasoningEffort
  }

  // Build the prompt
  const prompt = buildWorksheetParsingPrompt(promptOptions)

  // Make the vision call
  const response = await llm.vision({
    prompt,
    images: [await prepareImageForLlm(imageDataUrl)],
    schema: WorksheetParsingResultSchema,
    maxRetries,
    onProgress,
    model,
    reasoningEffort,
  })

  return {
    data: response.data,
    attempts: response.attempts,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    rawResponse: response.rawResponse,
    jsonSchema: response.jsonSchema,
  }
}

/**
 * Streaming event specific to worksheet parsing
 */
export type WorksheetParseStreamEvent =
  | StreamEvent<WorksheetParsingResult>
  | { type: 'progress'; stage: string; message: string }

/**
 * Options for streaming worksheet parsing
 */
export interface StreamParseWorksheetOptions {
  /** Additional prompt customization */
  promptOptions?: PromptOptions
  /** Specific model to use (defaults to configured default) */
  model?: string
  /** Use a specific model config by ID */
  modelConfigId?: string
  /** Request timeout in milliseconds (default: 5 minutes for streaming) */
  timeoutMs?: number
}

/**
 * Stream parse an abacus workbook page image with the model's reasoning
 *
 * Streams the parsing process through the LLM client, including:
 * - Reasoning (the model's thinking about each problem, when it shows any)
 * - Output deltas (partial structured output)
 * - Final validated result
 *
 * @param imageDataUrl - Base64-encoded data URL of the worksheet image
 * @param options - Parsing options
 * @param llmClient - LLM client to use (typically with middleware for task integration)
 * @returns AsyncGenerator yielding stream events
 *
 * @example
 * ```typescript
 * import { streamParseWorksheetImage } from '@/lib/worksheet-parsing'
 * import { createTaskLLM } from '@/lib/llm'
 *
 * const taskLLM = createTaskLLM(handle)
 * const stream = streamParseWorksheetImage(imageDataUrl, {}, taskLLM)
 *
 * for await (const event of stream) {
 *   if (event.type === 'complete') {
 *     console.log('Found', event.data.problems.length, 'problems')
 *   }
 * }
 * ```
 */
export async function* streamParseWorksheetImage(
  imageDataUrl: string,
  options: StreamParseWorksheetOptions,
  llmClient: LLMClient
): AsyncGenerator<WorksheetParseStreamEvent, void, unknown> {
  const {
    promptOptions = {},
    model: explicitModel,
    modelConfigId,
    timeoutMs = 300_000, // 5 minutes default for streaming
  } = options

  const config = (modelConfigId && getModelConfig(modelConfigId)) || getDefaultModelConfig()
  const model = explicitModel ?? config.model
  const effort = config.reasoningEffort ?? 'medium'

  // Emit progress event
  yield {
    type: 'progress',
    stage: 'preparing',
    message: 'Preparing worksheet analysis...',
  }

  // Build the prompt
  const prompt = buildWorksheetParsingPrompt(promptOptions)

  // Stream the response using provided client (with middleware)
  const stream = llmClient.stream({
    prompt,
    images: [await prepareImageForLlm(imageDataUrl)],
    schema: WorksheetParsingResultSchema,
    model,
    reasoning: { effort },
    timeoutMs,
  })

  // Yield all events from the LLM stream
  for await (const event of stream) {
    yield event
  }
}

/**
 * Re-parse specific problems with additional context
 *
 * Used when the user provides corrections or hints about specific problems
 * that were incorrectly parsed in the first attempt.
 *
 * @param imageDataUrl - Base64-encoded data URL of the worksheet image
 * @param problemNumbers - Which problems to focus on
 * @param additionalContext - User-provided context or hints
 * @param originalWarnings - Warnings from the original parse
 * @param options - Parsing options
 */
export async function reparseProblems(
  imageDataUrl: string,
  problemNumbers: number[],
  additionalContext: string,
  originalWarnings: string[],
  options: Omit<ParseWorksheetOptions, 'promptOptions'> = {}
): Promise<ParseWorksheetResult> {
  return parseWorksheetImage(imageDataUrl, {
    ...options,
    promptOptions: {
      focusProblemNumbers: problemNumbers,
      additionalContext: `${additionalContext}

Previous warnings for these problems:
${originalWarnings.map((w) => `- ${w}`).join('\n')}`,
    },
  })
}

/**
 * Compute problem statistics from parsed results
 */
export function computeParsingStats(result: WorksheetParsingResult) {
  const problems = result.problems

  // Count problems needing review (low confidence)
  const lowConfidenceProblems = problems.filter(
    (p) => p.termsConfidence < 0.7 || p.studentAnswerConfidence < 0.7
  )

  // Count problems with answers
  const answeredProblems = problems.filter((p) => p.studentAnswer !== null)

  // Compute accuracy if answers are present
  const correctAnswers = answeredProblems.filter((p) => p.studentAnswer === p.correctAnswer)

  return {
    totalProblems: problems.length,
    answeredProblems: answeredProblems.length,
    unansweredProblems: problems.length - answeredProblems.length,
    correctAnswers: correctAnswers.length,
    incorrectAnswers: answeredProblems.length - correctAnswers.length,
    accuracy: answeredProblems.length > 0 ? correctAnswers.length / answeredProblems.length : null,
    lowConfidenceCount: lowConfidenceProblems.length,
    problemsNeedingReview: lowConfidenceProblems.map((p) => p.problemNumber),
    warningCount: result.warnings.length,
  }
}

/**
 * Merge corrections into parsing result
 *
 * Creates a new result with user corrections applied.
 */
export function applyCorrections(
  result: WorksheetParsingResult,
  corrections: Array<{
    problemNumber: number
    correctedTerms?: number[] | null
    correctedStudentAnswer?: number | null
    shouldExclude?: boolean
    shouldRestore?: boolean
  }>
): WorksheetParsingResult {
  const correctionMap = new Map(corrections.map((c) => [c.problemNumber, c]))

  const correctedProblems = result.problems.map((problem) => {
    const correction = correctionMap.get(problem.problemNumber)
    if (!correction) return problem

    // Handle exclude/restore toggle
    if (correction.shouldExclude) {
      return { ...problem, excluded: true }
    }
    if (correction.shouldRestore) {
      return { ...problem, excluded: false }
    }

    return {
      ...problem,
      terms: correction.correctedTerms ?? problem.terms,
      correctAnswer: correction.correctedTerms
        ? correction.correctedTerms.reduce((sum, t) => sum + t, 0)
        : problem.correctAnswer,
      studentAnswer:
        correction.correctedStudentAnswer !== undefined
          ? correction.correctedStudentAnswer
          : problem.studentAnswer,
      // Boost confidence since user verified
      termsConfidence: correction.correctedTerms ? 1.0 : problem.termsConfidence,
      studentAnswerConfidence:
        correction.correctedStudentAnswer !== undefined ? 1.0 : problem.studentAnswerConfidence,
    }
  })

  // Recalculate overall confidence (only for non-excluded problems)
  const activeProblems = correctedProblems.filter((p) => !p.excluded)
  const avgConfidence =
    activeProblems.length > 0
      ? activeProblems.reduce(
          (sum, p) => sum + (p.termsConfidence + p.studentAnswerConfidence) / 2,
          0
        ) / activeProblems.length
      : 0

  return {
    ...result,
    problems: correctedProblems,
    overallConfidence: avgConfidence,
    needsReview: activeProblems.some(
      (p) => p.termsConfidence < 0.7 || p.studentAnswerConfidence < 0.7
    ),
  }
}
