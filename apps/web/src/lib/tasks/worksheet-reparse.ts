/**
 * Worksheet Re-Parsing Background Task
 *
 * Wraps the LLM-based selective problem re-parsing in a background task for:
 * - Real-time progress streaming via Socket.IO
 * - Survival across page reloads
 * - Event replay for late-joining clients
 * - Database persistence of results
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { z } from 'zod'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { createTask, type TaskHandle } from '../task-manager'
import { llm } from '@/lib/llm'
import {
  type ParsedProblem,
  type BoundingBox,
  type WorksheetParsingResult,
  getModelConfig,
  getDefaultModelConfig,
  calculateCropRegion,
  CROP_PADDING,
} from '../worksheet-parsing'

/**
 * Input for worksheet re-parsing task
 */
export interface WorksheetReparseInput {
  /** Attachment ID for database association */
  attachmentId: string
  /** Player ID for database association */
  playerId: string
  /** Problem indices to re-parse (0-based) */
  problemIndices: number[]
  /** Bounding boxes for each problem (must match problemIndices length) */
  boundingBoxes: BoundingBox[]
  /** Additional context for the LLM */
  additionalContext?: string
  /** Model config ID to use */
  modelConfigId?: string
}

/**
 * Output from worksheet re-parsing task
 */
export interface WorksheetReparseOutput {
  /** Number of problems successfully re-parsed */
  reparsedCount: number
  /** Indices of problems that were re-parsed */
  reparsedIndices: number[]
  /** Updated parsing result with merged data */
  updatedResult: WorksheetParsingResult
  /** Final status */
  status: ParsingStatus
}

// Schema for single problem re-parse response
const SingleProblemSchema = z.object({
  terms: z
    .array(z.number().int())
    .min(2)
    .max(7)
    .describe(
      'The terms (numbers) in this problem. First term is always positive. ' +
        'Negative numbers indicate subtraction. Example: "45 - 17 + 8" -> [45, -17, 8]'
    ),
  studentAnswer: z
    .number()
    .int()
    .nullable()
    .describe("The student's written answer. null if no answer is visible or answer box is empty."),
  format: z
    .enum(['vertical', 'linear'])
    .describe('Format: "vertical" for stacked column, "linear" for horizontal'),
  termsConfidence: z.number().min(0).max(1).describe('Confidence in terms reading (0-1)'),
  studentAnswerConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence in student answer reading (0-1)'),
})

/**
 * Build prompt for single problem parsing
 */
function buildSingleProblemPrompt(additionalContext?: string): string {
  let prompt = `You are analyzing a cropped image showing a SINGLE arithmetic problem from an abacus workbook.

Extract the following from this cropped problem image:
1. The problem terms (numbers being added/subtracted)
2. The student's written answer (if any)
3. The format (vertical or linear)
4. Your confidence in each reading

CRITICAL: MINUS SIGN DETECTION

Minus signs are SMALL but EXTREMELY IMPORTANT. Missing a minus sign completely changes the answer!

**How minus signs appear in VERTICAL problems:**
- A small horizontal dash/line to the LEFT of a number
- May appear as: − (minus), - (hyphen), or a short horizontal stroke
- Often smaller than you expect - LOOK CAREFULLY!
- Sometimes positioned slightly above or below the number's vertical center

**Example - the ONLY difference is that tiny minus sign:**
- NO minus: 45 + 17 + 8 = 70 → terms = [45, 17, 8]
- WITH minus: 45 - 17 + 8 = 36 → terms = [45, -17, 8]

**You MUST examine the LEFT side of each number for minus signs!**

IMPORTANT:
- The first term is always positive
- Negative numbers indicate subtraction (e.g., "45 - 17" has terms [45, -17])
- If no student answer is visible, set studentAnswer to null
- Be precise about handwritten digits - common confusions: 1/7, 4/9, 6/0, 5/8

CONFIDENCE GUIDELINES:
- 0.9-1.0: Clear, unambiguous reading
- 0.7-0.89: Slightly unclear but confident
- 0.5-0.69: Uncertain, could be misread
- Below 0.5: Very uncertain`

  if (additionalContext) {
    prompt += `\n\nADDITIONAL CONTEXT FROM USER:\n${additionalContext}`
  }

  return prompt
}

/**
 * Crop image to bounding box with padding using sharp (server-side).
 */
async function cropToBoundingBox(
  imageBuffer: Buffer,
  box: BoundingBox,
  padding: number = CROP_PADDING
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata()
  const imageWidth = metadata.width ?? 1
  const imageHeight = metadata.height ?? 1

  const region = calculateCropRegion(box, imageWidth, imageHeight, padding)

  return sharp(imageBuffer)
    .extract({
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
    })
    .toBuffer()
}

/**
 * Start a worksheet re-parsing background task
 */
export async function startWorksheetReparse(input: WorksheetReparseInput): Promise<string> {
  // Validate required fields
  if (!input.attachmentId) {
    throw new Error('Attachment ID is required')
  }
  if (!input.playerId) {
    throw new Error('Player ID is required')
  }
  if (!input.problemIndices || input.problemIndices.length === 0) {
    throw new Error('At least one problem index is required')
  }
  if (input.problemIndices.length !== input.boundingBoxes.length) {
    throw new Error('problemIndices and boundingBoxes must have the same length')
  }

  // Mark attachment as processing
  await db
    .update(practiceAttachments)
    .set({
      parsingStatus: 'processing',
      parsingError: null,
    })
    .where(eq(practiceAttachments.id, input.attachmentId))

  return createTask<WorksheetReparseInput, WorksheetReparseOutput>(
    'worksheet-reparse',
    input,
    async (handle, config) => {
      console.log('[WorksheetReparseTask] Handler started for attachment:', config.attachmentId)
      const {
        attachmentId,
        playerId,
        problemIndices,
        boundingBoxes,
        additionalContext,
        modelConfigId,
      } = config

      handle.setProgress(5, 'Initializing re-parser...')
      handle.emit('reparse_started', {
        attachmentId,
        problemCount: problemIndices.length,
        problemIndices,
      })

      try {
        await runReparse(handle, {
          attachmentId,
          playerId,
          problemIndices,
          boundingBoxes,
          additionalContext,
          modelConfigId,
        })
      } catch (error) {
        // Update DB with error
        const errorMessage = error instanceof Error ? error.message : String(error)
        await db
          .update(practiceAttachments)
          .set({
            parsingStatus: 'failed',
            parsingError: errorMessage,
          })
          .where(eq(practiceAttachments.id, attachmentId))
        throw error
      }
    }
  )
}

/**
 * Run the re-parsing process
 */
async function runReparse(
  handle: TaskHandle<WorksheetReparseOutput>,
  config: WorksheetReparseInput
): Promise<void> {
  const {
    attachmentId,
    playerId,
    problemIndices,
    boundingBoxes,
    additionalContext,
    modelConfigId,
  } = config

  // Get attachment record
  const attachment = await db
    .select()
    .from(practiceAttachments)
    .where(eq(practiceAttachments.id, attachmentId))
    .get()

  if (!attachment) {
    throw new Error('Attachment not found')
  }

  if (!attachment.rawParsingResult) {
    throw new Error('Attachment has not been parsed yet')
  }

  const existingResult = attachment.rawParsingResult as WorksheetParsingResult

  // Read the image file
  const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
  const filepath = join(uploadDir, attachment.filename)
  const imageBuffer = await readFile(filepath)
  const mimeType = attachment.mimeType || 'image/jpeg'

  // Resolve model config
  const modelConfig = modelConfigId ? getModelConfig(modelConfigId) : getDefaultModelConfig()

  // Build the prompt
  const prompt = buildSingleProblemPrompt(additionalContext)

  // Process each selected problem
  const reparsedProblems: Array<{
    index: number
    originalProblem: ParsedProblem
    newData: z.infer<typeof SingleProblemSchema>
  }> = []

  for (let i = 0; i < problemIndices.length; i++) {
    // Check for cancellation
    if (handle.isCancelled()) {
      handle.emit('cancelled', { reason: 'User cancelled' })
      await db
        .update(practiceAttachments)
        .set({ parsingStatus: null, parsingError: null })
        .where(eq(practiceAttachments.id, attachmentId))
      return
    }

    const problemIndex = problemIndices[i]
    const box = boundingBoxes[i]
    const originalProblem = existingResult.problems[problemIndex]

    if (!originalProblem) {
      console.warn(`[WorksheetReparseTask] Problem index ${problemIndex} not found`)
      continue
    }

    // Notify starting this problem
    const progressPercent = 10 + Math.floor((i / problemIndices.length) * 70)
    handle.setProgress(progressPercent, `Analyzing problem ${i + 1} of ${problemIndices.length}...`)
    handle.emit('problem_start', {
      problemIndex,
      problemNumber: originalProblem.problemNumber,
      currentIndex: i,
      totalProblems: problemIndices.length,
    })

    try {
      // Crop image to bounding box
      const croppedBuffer = await cropToBoundingBox(imageBuffer, box)
      const base64Cropped = croppedBuffer.toString('base64')
      const croppedDataUrl = `data:${mimeType};base64,${base64Cropped}`

      // Stream the LLM call for this problem
      const llmStream = llm.stream({
        prompt,
        images: [croppedDataUrl],
        schema: SingleProblemSchema,
        provider: 'openai',
        model: modelConfig?.model,
        reasoning: {
          effort: 'medium',
          summary: 'auto',
        },
      })

      let problemResult: z.infer<typeof SingleProblemSchema> | null = null

      for await (const event of llmStream) {
        // Check for cancellation during streaming
        if (handle.isCancelled()) {
          handle.emit('cancelled', { reason: 'User cancelled' })
          await db
            .update(practiceAttachments)
            .set({ parsingStatus: null, parsingError: null })
            .where(eq(practiceAttachments.id, attachmentId))
          return
        }

        switch (event.type) {
          case 'reasoning':
            // Only emit delta text, not accumulated
            handle.emit('reasoning', {
              problemIndex,
              text: event.text,
              summaryIndex: event.summaryIndex,
              isDelta: event.isDelta,
            })
            break

          case 'output_delta':
            handle.emit('output_delta', {
              problemIndex,
              text: event.text,
              outputIndex: event.outputIndex,
            })
            break

          case 'error':
            handle.emit('problem_error', {
              problemIndex,
              message: event.message,
              code: event.code,
            })
            break

          case 'complete':
            problemResult = event.data
            break
        }
      }

      if (problemResult) {
        reparsedProblems.push({
          index: problemIndex,
          originalProblem,
          newData: problemResult,
        })

        // Notify client this problem is done
        handle.emit('problem_complete', {
          problemIndex,
          problemNumber: originalProblem.problemNumber,
          result: problemResult,
          currentIndex: i,
          totalProblems: problemIndices.length,
        })
      }
    } catch (err) {
      console.error(`[WorksheetReparseTask] Failed to re-parse problem ${problemIndex}:`, err)
      handle.emit('problem_error', {
        problemIndex,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
      // Continue with other problems
    }
  }

  // Final cancellation check
  if (handle.isCancelled()) {
    handle.emit('cancelled', { reason: 'User cancelled' })
    await db
      .update(practiceAttachments)
      .set({ parsingStatus: null, parsingError: null })
      .where(eq(practiceAttachments.id, attachmentId))
    return
  }

  handle.setProgress(90, 'Merging results...')

  // Merge results back into existing parsing result
  const adjustedBoxMap = new Map<number, BoundingBox>()
  for (let i = 0; i < problemIndices.length; i++) {
    adjustedBoxMap.set(problemIndices[i], boundingBoxes[i])
  }

  const updatedProblems = [...existingResult.problems]
  for (const { index, originalProblem, newData } of reparsedProblems) {
    const correctAnswer = newData.terms.reduce((a, b) => a + b, 0)
    const userAdjustedBox = adjustedBoxMap.get(index) ?? originalProblem.problemBoundingBox
    updatedProblems[index] = {
      ...originalProblem,
      terms: newData.terms,
      studentAnswer: newData.studentAnswer,
      correctAnswer,
      format: newData.format,
      termsConfidence: newData.termsConfidence,
      studentAnswerConfidence: newData.studentAnswerConfidence,
      problemBoundingBox: userAdjustedBox,
    }
  }

  // Update the parsing result
  const updatedResult: WorksheetParsingResult = {
    ...existingResult,
    problems: updatedProblems,
    overallConfidence:
      updatedProblems.reduce(
        (sum, p) => sum + Math.min(p.termsConfidence, p.studentAnswerConfidence),
        0
      ) / updatedProblems.length,
    needsReview: updatedProblems.some(
      (p) => Math.min(p.termsConfidence, p.studentAnswerConfidence) < 0.7
    ),
  }

  // Save updated result to database
  const status: ParsingStatus = updatedResult.needsReview ? 'needs_review' : 'approved'
  await db
    .update(practiceAttachments)
    .set({
      rawParsingResult: updatedResult,
      confidenceScore: updatedResult.overallConfidence,
      needsReview: updatedResult.needsReview,
      parsingStatus: status,
      parsingError: null,
    })
    .where(eq(practiceAttachments.id, attachmentId))

  handle.emit('complete', {
    reparsedCount: reparsedProblems.length,
    reparsedIndices: reparsedProblems.map((p) => p.index),
    status,
  })

  handle.complete({
    reparsedCount: reparsedProblems.length,
    reparsedIndices: reparsedProblems.map((p) => p.index),
    updatedResult,
    status,
  })
}
