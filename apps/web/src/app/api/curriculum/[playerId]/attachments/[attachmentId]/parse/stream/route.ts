/**
 * SSE streaming route for LLM-powered worksheet parsing
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/parse/stream
 *   - Start parsing and stream events via SSE
 *   - Includes reasoning summaries and progress
 *
 * Events sent:
 *   - started: Parsing has begun
 *   - reasoning: Model's reasoning summary (thinking process)
 *   - output_delta: Partial structured output
 *   - complete: Final validated result
 *   - error: Error occurred
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import {
  streamParseWorksheetImage,
  computeParsingStats,
  buildWorksheetParsingPrompt,
  getModelConfig,
  getDefaultModelConfig,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * POST - Start streaming parsing of the attachment
 *
 * Returns a Server-Sent Events stream with parsing progress.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { playerId, attachmentId } = await params

  if (!playerId || !attachmentId) {
    return new Response(JSON.stringify({ error: 'Player ID and Attachment ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

  // Parse request body
  let modelConfigId: string | undefined
  let additionalContext: string | undefined
  let preservedBoundingBoxes:
    | Record<number, { x: number; y: number; width: number; height: number }>
    | undefined
  try {
    const body = await request.json()
    modelConfigId = body?.modelConfigId
    additionalContext = body?.additionalContext
    preservedBoundingBoxes = body?.preservedBoundingBoxes
  } catch {
    // No body or invalid JSON is fine
  }

  // Resolve model config
  const modelConfig = modelConfigId ? getModelConfig(modelConfigId) : getDefaultModelConfig()

  // Update status to processing
  await db
    .update(practiceAttachments)
    .set({
      parsingStatus: 'processing',
      parsingError: null,
      parsedAt: new Date().toISOString(),
    })
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
        const base64Image = imageBuffer.toString('base64')
        const mimeType = attachment.mimeType || 'image/jpeg'
        const imageDataUrl = `data:${mimeType};base64,${base64Image}`

        // Build prompt for debugging
        const promptOptions = additionalContext ? { additionalContext } : {}
        const promptUsed = buildWorksheetParsingPrompt(promptOptions)

        // Stream the parsing
        const parseStream = streamParseWorksheetImage(imageDataUrl, {
          modelConfigId: modelConfig?.id,
          promptOptions,
        })

        let finalResult: Awaited<ReturnType<typeof computeParsingStats>> | null = null
        let parsingResult: Parameters<typeof computeParsingStats>[0] | null = null
        let usage: {
          promptTokens: number
          completionTokens: number
          reasoningTokens?: number
        } | null = null

        for await (const event of parseStream) {
          // Forward events to client
          switch (event.type) {
            case 'progress':
              sendEvent('progress', {
                stage: event.stage,
                message: event.message,
              })
              break

            case 'started':
              sendEvent('started', {
                responseId: event.responseId,
              })
              break

            case 'reasoning':
              sendEvent('reasoning', {
                text: event.text,
                summaryIndex: event.summaryIndex,
                isDelta: event.isDelta,
              })
              break

            case 'output_delta':
              sendEvent('output_delta', {
                text: event.text,
                outputIndex: event.outputIndex,
              })
              break

            case 'error':
              sendEvent('error', {
                message: event.message,
                code: event.code,
              })
              // Update DB with error
              await db
                .update(practiceAttachments)
                .set({
                  parsingStatus: 'failed',
                  parsingError: event.message,
                })
                .where(eq(practiceAttachments.id, attachmentId))
              break

            case 'complete': {
              parsingResult = event.data
              usage = event.usage

              // Merge preserved bounding boxes
              if (preservedBoundingBoxes && Object.keys(preservedBoundingBoxes).length > 0) {
                parsingResult = {
                  ...parsingResult,
                  problems: parsingResult.problems.map((problem, index) => {
                    const preservedBox = preservedBoundingBoxes[index]
                    if (preservedBox) {
                      return {
                        ...problem,
                        problemBoundingBox: preservedBox,
                      }
                    }
                    return problem
                  }),
                }
              }

              finalResult = computeParsingStats(parsingResult)
              const status: ParsingStatus = parsingResult.needsReview ? 'needs_review' : 'approved'

              // Save results to database
              await db
                .update(practiceAttachments)
                .set({
                  parsingStatus: status,
                  parsedAt: new Date().toISOString(),
                  rawParsingResult: parsingResult,
                  confidenceScore: parsingResult.overallConfidence,
                  needsReview: parsingResult.needsReview,
                  parsingError: null,
                  // LLM metadata
                  llmProvider: 'openai',
                  llmModel: modelConfig?.model ?? 'gpt-5.2',
                  llmPromptUsed: promptUsed,
                  llmRawResponse: event.rawResponse,
                  llmJsonSchema: null, // Not available in streaming mode
                  llmImageSource: 'cropped',
                  llmAttempts: 1, // Streaming doesn't retry
                  llmPromptTokens: usage?.promptTokens ?? 0,
                  llmCompletionTokens: usage?.completionTokens ?? 0,
                  llmTotalTokens: (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0),
                })
                .where(eq(practiceAttachments.id, attachmentId))

              // Send complete event with full result
              sendEvent('complete', {
                status,
                result: parsingResult,
                stats: finalResult,
                usage,
              })
              break
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Streaming parse error:', error)

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
