/**
 * SSE streaming route for selective problem re-parsing
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/parse-selected/stream
 *   - Re-parse specific problems with streaming events
 *   - Includes reasoning summaries for each problem
 *
 * Events sent:
 *   - problem_start: Starting to parse a specific problem
 *   - reasoning: Model's reasoning for current problem
 *   - output_delta: Partial structured output for current problem
 *   - problem_complete: Finished parsing a specific problem
 *   - complete: All problems finished, merged result
 *   - error: Error occurred
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { z } from 'zod'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { llm } from '@/lib/llm'
import {
  type ParsedProblem,
  type BoundingBox,
  type WorksheetParsingResult,
  getModelConfig,
  getDefaultModelConfig,
  calculateCropRegion,
  CROP_PADDING,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
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

// Request body schema
const RequestBodySchema = z.object({
  problemIndices: z.array(z.number().int().min(0)).min(1).max(20),
  boundingBoxes: z.array(
    z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
  ),
  additionalContext: z.string().optional(),
  modelConfigId: z.string().optional(),
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

⚠️ **CRITICAL: MINUS SIGN DETECTION** ⚠️

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
 * POST - Stream re-parsing of selected problems
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { playerId, attachmentId } = await params

  if (!playerId || !attachmentId) {
    return new Response(JSON.stringify({ error: 'Player ID and Attachment ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let body: z.infer<typeof RequestBodySchema>
  try {
    const rawBody = await request.json()
    body = RequestBodySchema.parse(rawBody)
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        details: err instanceof Error ? err.message : 'Unknown',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const { problemIndices, boundingBoxes, additionalContext, modelConfigId } = body

  if (problemIndices.length !== boundingBoxes.length) {
    return new Response(
      JSON.stringify({
        error: 'problemIndices and boundingBoxes must have the same length',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve model config
  const modelConfig = modelConfigId ? getModelConfig(modelConfigId) : getDefaultModelConfig()

  // Authorization check
  const userId = await getDbUserId()
  const canParse = await canPerformAction(userId, playerId, 'start-session')
  if (!canParse) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get attachment record
  const attachment = await db
    .select()
    .from(practiceAttachments)
    .where(eq(practiceAttachments.id, attachmentId))
    .get()

  if (!attachment) {
    return new Response(JSON.stringify({ error: 'Attachment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (attachment.playerId !== playerId) {
    return new Response(JSON.stringify({ error: 'Attachment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Must have existing parsing result to merge into
  if (!attachment.rawParsingResult) {
    return new Response(JSON.stringify({ error: 'Attachment has not been parsed yet' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const existingResult = attachment.rawParsingResult as WorksheetParsingResult

  // Set status to processing
  await db
    .update(practiceAttachments)
    .set({ parsingStatus: 'processing' })
    .where(eq(practiceAttachments.id, attachmentId))

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Read the image file
        const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
        const filepath = join(uploadDir, attachment.filename)
        const imageBuffer = await readFile(filepath)
        const mimeType = attachment.mimeType || 'image/jpeg'

        // Build the prompt
        const prompt = buildSingleProblemPrompt(additionalContext)

        // Process each selected problem
        const reparsedProblems: Array<{
          index: number
          originalProblem: ParsedProblem
          newData: z.infer<typeof SingleProblemSchema>
        }> = []

        for (let i = 0; i < problemIndices.length; i++) {
          const problemIndex = problemIndices[i]
          const box = boundingBoxes[i]
          const originalProblem = existingResult.problems[problemIndex]

          if (!originalProblem) {
            console.warn(`Problem index ${problemIndex} not found in existing result`)
            continue
          }

          // Check if cancelled
          const currentStatus = await db
            .select({ parsingStatus: practiceAttachments.parsingStatus })
            .from(practiceAttachments)
            .where(eq(practiceAttachments.id, attachmentId))
            .get()

          if (!currentStatus || currentStatus.parsingStatus !== 'processing') {
            sendEvent('cancelled', { message: 'Re-parsing was cancelled' })
            return
          }

          // Notify client we're starting this problem
          sendEvent('problem_start', {
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
              switch (event.type) {
                case 'reasoning':
                  sendEvent('reasoning', {
                    problemIndex,
                    text: event.text,
                    summaryIndex: event.summaryIndex,
                    isDelta: event.isDelta,
                  })
                  break

                case 'output_delta':
                  sendEvent('output_delta', {
                    problemIndex,
                    text: event.text,
                    outputIndex: event.outputIndex,
                  })
                  break

                case 'error':
                  sendEvent('problem_error', {
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
              sendEvent('problem_complete', {
                problemIndex,
                problemNumber: originalProblem.problemNumber,
                result: problemResult,
                currentIndex: i,
                totalProblems: problemIndices.length,
              })
            }
          } catch (err) {
            console.error(`Failed to re-parse problem ${problemIndex}:`, err)
            sendEvent('problem_error', {
              problemIndex,
              message: err instanceof Error ? err.message : 'Unknown error',
            })
            // Continue with other problems
          }
        }

        // Check if cancelled before saving
        const finalStatus = await db
          .select({ parsingStatus: practiceAttachments.parsingStatus })
          .from(practiceAttachments)
          .where(eq(practiceAttachments.id, attachmentId))
          .get()

        if (!finalStatus || finalStatus.parsingStatus !== 'processing') {
          sendEvent('cancelled', { message: 'Re-parsing was cancelled' })
          return
        }

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
          })
          .where(eq(practiceAttachments.id, attachmentId))

        // Send complete event with merged result
        sendEvent('complete', {
          success: true,
          reparsedCount: reparsedProblems.length,
          reparsedIndices: reparsedProblems.map((p) => p.index),
          updatedResult,
          status,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Streaming re-parse error:', error)

        // Update DB with error
        await db
          .update(practiceAttachments)
          .set({
            parsingStatus: 'failed',
            parsingError: errorMessage,
          })
          .where(eq(practiceAttachments.id, attachmentId))

        sendEvent('error', { message: errorMessage })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
