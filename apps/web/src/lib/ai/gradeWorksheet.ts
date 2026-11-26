import { readFile } from 'fs/promises'
import { z } from 'zod'
import { SINGLE_CARRY_PATH } from '@/app/create/worksheets/progressionPath'
import { AiFeature } from '@/lib/ai-usage/features'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import { llm } from '@/lib/llm'
import { prepareImageForLlm } from '@/lib/llm-image'

/**
 * Grading result structure returned by the vision model
 */
export interface GradingResult {
  problems: Array<{
    index: number
    operandA: number
    operandB: number
    correctAnswer: number
    studentAnswer: number | null
    isCorrect: boolean
    digitCount: number
    requiresRegrouping: boolean
  }>
  totalProblems: number
  correctCount: number
  accuracy: number
  errorPatterns: string[]
  currentStepEstimate: string
  suggestedStepId: string
  reasoning: string
  feedback: string
}

/**
 * Validation error structure for retry prompts
 */
interface ValidationError {
  field: string
  value?: any
  error: string
  validOptions?: string[]
  expected?: any
}

/**
 * The grading answer's shape (checked again by validateGradingResult)
 */
const GradingSchema = z.object({
  problems: z.array(
    z.object({
      index: z.number().int(),
      operandA: z.number().int(),
      operandB: z.number().int(),
      correctAnswer: z.number().int(),
      studentAnswer: z.number().int().nullable(),
      isCorrect: z.boolean(),
      digitCount: z.number().int(),
      requiresRegrouping: z.boolean(),
    })
  ),
  totalProblems: z.number().int(),
  correctCount: z.number().int(),
  accuracy: z.number(),
  errorPatterns: z.array(z.string()),
  currentStepEstimate: z.string(),
  suggestedStepId: z.string(),
  reasoning: z.string(),
  feedback: z.string(),
}) satisfies z.ZodType<GradingResult>

/**
 * Build the grading prompt with progression context
 */
function buildGradingPrompt(validationError?: ValidationError): string {
  const stepDescriptions = SINGLE_CARRY_PATH.map(
    (step) => `- ${step.id}: ${step.name} - ${step.description}`
  ).join('\n')

  const validStepIds = SINGLE_CARRY_PATH.map((s) => s.id).join(', ')

  let prompt = `You are grading an elementary math worksheet to determine the student's exact position in a mastery progression path.

AVAILABLE PROGRESSION STEPS:
${stepDescriptions}
`

  // Add validation error feedback if this is a retry
  if (validationError) {
    prompt += `

PREVIOUS ATTEMPT HAD VALIDATION ERROR:
Field: ${validationError.field}
Error: ${validationError.error}
${validationError.validOptions ? `Valid options: ${validationError.validOptions.join(', ')}` : ''}
${validationError.expected !== undefined ? `Expected value: ${validationError.expected}` : ''}

Please correct this error and try again.
`
  }

  prompt += `

TASK:
1. Examine the worksheet image and identify all addition problems
2. Read the student's handwritten answers carefully
3. Grade each problem as correct or incorrect
4. Identify specific error patterns (e.g., "forgets to carry in tens place", "misaligns digits")
5. Determine which progression step ID best matches their current skill level
6. Recommend the EXACT next step ID they should practice

Return JSON matching the schema exactly.

CRITICAL: suggestedStepId MUST be one of: ${validStepIds}`

  return prompt
}

/**
 * Grade the worksheet image with the app's LLM client (deep reasoning)
 */
async function callVisionModel(
  imageDataUrl: string,
  prompt: string,
  userId?: string
): Promise<GradingResult> {
  const request = {
    prompt,
    images: [imageDataUrl],
    schema: GradingSchema,
    reasoningEffort: 'high' as const,
    timeoutMs: 300_000,
    // Retries live in gradeWorksheetWithVision, which feeds back its own checks.
    maxRetries: 0,
  }
  const response = userId
    ? await trackedCall(llm, request, { userId, feature: AiFeature.WORKSHEET_GRADE })
    : await llm.vision(request)
  return response.data
}

/**
 * Validate grading result and return errors if any
 */
function validateGradingResult(result: GradingResult): ValidationError | null {
  // Validate step ID
  const validStep = SINGLE_CARRY_PATH.find((s) => s.id === result.suggestedStepId)
  if (!validStep) {
    return {
      field: 'suggestedStepId',
      value: result.suggestedStepId,
      error: `Invalid step ID. Must be one of the provided progression steps.`,
      validOptions: SINGLE_CARRY_PATH.map((s) => s.id),
    }
  }

  // Validate problem count
  if (result.totalProblems !== result.problems.length) {
    return {
      field: 'totalProblems',
      error: `totalProblems (${result.totalProblems}) doesn't match problems array length (${result.problems.length})`,
      expected: result.problems.length,
    }
  }

  // Validate accuracy calculation
  const expectedAccuracy = result.correctCount / result.totalProblems
  if (Math.abs(result.accuracy - expectedAccuracy) > 0.01) {
    return {
      field: 'accuracy',
      error: `Accuracy ${result.accuracy} doesn't match correctCount/totalProblems = ${expectedAccuracy}`,
      expected: expectedAccuracy,
    }
  }

  return null
}

/**
 * Grade worksheet with a vision model and retry logic
 *
 * @param imagePath - Path to worksheet image file
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns Complete grading assessment with progression recommendation
 */
export async function gradeWorksheetWithVision(
  imagePath: string,
  maxRetries = 2,
  userId?: string
): Promise<GradingResult> {
  // Read and encode image
  const imageBuffer = await readFile(imagePath)
  // Its real type from its bytes, scaled to what the API takes
  const dataUrl = await prepareImageForLlm(imageBuffer)

  let lastError: Error | null = null
  let validationError: ValidationError | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build prompt (includes validation error if retry)
      const prompt = buildGradingPrompt(validationError)

      const result = await callVisionModel(dataUrl, prompt, userId)

      // Validate result
      const error = validateGradingResult(result)

      if (error) {
        if (attempt < maxRetries) {
          // Retry with validation error
          console.warn(`Retry ${attempt + 1}: Validation error in ${error.field} - ${error.error}`)
          validationError = error
          continue
        }

        // Out of retries, apply fallback fixes
        console.error(`All retries exhausted. Applying fallback fixes.`)

        if (error.field === 'suggestedStepId') {
          result.suggestedStepId = SINGLE_CARRY_PATH[0].id
        } else if (error.field === 'totalProblems') {
          result.totalProblems = result.problems.length
        } else if (error.field === 'accuracy') {
          result.accuracy = result.correctCount / result.totalProblems
        }

        return result
      }

      // All validations passed
      return result
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        console.warn(`Retry ${attempt + 1}: ${lastError.message}`)
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
      }
    }
  }

  throw lastError || new Error('Grading failed after all retries')
}
