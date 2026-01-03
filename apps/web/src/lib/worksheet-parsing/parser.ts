/**
 * Worksheet Parser
 *
 * Uses the LLM client to parse abacus workbook page images
 * into structured problem data.
 */
import { llm, type LLMProgress, type ReasoningEffort } from '@/lib/llm'
import { WorksheetParsingResultSchema, type WorksheetParsingResult } from './schemas'
import { buildWorksheetParsingPrompt, type PromptOptions } from './prompt-builder'

/**
 * Available model configurations for worksheet parsing
 */
export interface ModelConfig {
  /** Unique identifier for this config */
  id: string
  /** Display name for UI */
  name: string
  /** Provider name */
  provider: 'openai' | 'anthropic'
  /** Model ID to use */
  model: string
  /** Reasoning effort (for GPT-5.2+) */
  reasoningEffort?: ReasoningEffort
  /** Description of when to use this config */
  description: string
  /** Whether this is the default config */
  isDefault?: boolean
}

/**
 * Available model configurations for worksheet parsing
 */
export const PARSING_MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'gpt-5.2-thinking',
    name: 'GPT-5.2 Thinking',
    provider: 'openai',
    model: 'gpt-5.2',
    reasoningEffort: 'medium',
    description: 'Best balance of quality and speed for worksheet analysis',
    isDefault: true,
  },
  {
    id: 'gpt-5.2-thinking-high',
    name: 'GPT-5.2 Thinking (High)',
    provider: 'openai',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    description: 'More thorough reasoning, better for difficult handwriting',
  },
  {
    id: 'gpt-5.2-instant',
    name: 'GPT-5.2 Instant',
    provider: 'openai',
    model: 'gpt-5.2-chat-latest',
    reasoningEffort: 'none',
    description: 'Faster but less accurate, good for clear worksheets',
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    description: 'Alternative provider, good for comparison',
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
  /** Specific provider to use (defaults to configured default) */
  provider?: string
  /** Specific model to use (defaults to configured default) */
  model?: string
  /** Reasoning effort for GPT-5.2+ models */
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
    provider: explicitProvider,
    model: explicitModel,
    reasoningEffort: explicitReasoningEffort,
    modelConfigId,
  } = options

  // Resolve model config
  let provider = explicitProvider
  let model = explicitModel
  let reasoningEffort = explicitReasoningEffort

  if (modelConfigId) {
    const config = getModelConfig(modelConfigId)
    if (config) {
      provider = provider ?? config.provider
      model = model ?? config.model
      reasoningEffort = reasoningEffort ?? config.reasoningEffort
    }
  } else if (!provider && !model) {
    // Use default config
    const defaultConfig = getDefaultModelConfig()
    provider = defaultConfig.provider
    model = defaultConfig.model
    reasoningEffort = reasoningEffort ?? defaultConfig.reasoningEffort
  }

  // Build the prompt
  const prompt = buildWorksheetParsingPrompt(promptOptions)

  // Make the vision call
  const response = await llm.vision({
    prompt,
    images: [imageDataUrl],
    schema: WorksheetParsingResultSchema,
    maxRetries,
    onProgress,
    provider,
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
