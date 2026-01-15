/**
 * API route for LLM-powered worksheet parsing
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/parse
 *   - Start parsing the attachment image
 *   - Returns immediately, polling via GET for status
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/parse
 *   - Get current parsing status and results
 */

import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import {
  parseWorksheetImage,
  computeParsingStats,
  buildWorksheetParsingPrompt,
  getModelConfig,
  getDefaultModelConfig,
  type WorksheetParsingResult,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * POST - Start parsing the attachment
 *
 * Body (optional):
 *   - modelConfigId: string - ID of the model config to use (from PARSING_MODEL_CONFIGS)
 *   - additionalContext: string - Additional context/hints for the LLM
 *   - preservedBoundingBoxes: Record<number, BoundingBox> - Bounding boxes to preserve by index
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Parse optional parameters from request body
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
      // No body or invalid JSON is fine - use defaults
    }

    // Resolve model config
    const modelConfig = modelConfigId ? getModelConfig(modelConfigId) : getDefaultModelConfig()

    // Authorization check
    const userId = await getDbUserId()
    const canParse = await canPerformAction(userId, playerId, 'start-session')
    if (!canParse) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if already processing (but allow retry if stuck for > 5 minutes)
    if (attachment.parsingStatus === 'processing') {
      const STUCK_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
      const parsedAt = attachment.parsedAt ? new Date(attachment.parsedAt).getTime() : 0
      const timeSinceUpdate = Date.now() - parsedAt

      // If recently started processing, don't allow retry
      if (parsedAt > 0 && timeSinceUpdate < STUCK_THRESHOLD_MS) {
        return NextResponse.json({
          status: 'processing',
          message: 'Parsing already in progress',
        })
      }
      // Otherwise, it's stuck - allow retry by continuing
      console.log(
        `Attachment ${attachmentId} was stuck in processing for ${Math.round(timeSinceUpdate / 1000)}s, allowing retry`
      )
    }

    // Update status to processing (set parsedAt to track when processing started)
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: 'processing',
        parsingError: null,
        parsedAt: new Date().toISOString(), // Track when processing started
      })
      .where(eq(practiceAttachments.id, attachmentId))

    // Read the image file
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    const filepath = join(uploadDir, attachment.filename)
    const imageBuffer = await readFile(filepath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = attachment.mimeType || 'image/jpeg'
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Build the prompt (capture for debugging)
    const promptOptions = additionalContext ? { additionalContext } : {}
    const promptUsed = buildWorksheetParsingPrompt(promptOptions)

    try {
      // Parse the worksheet (always uses cropped image)
      const result = await parseWorksheetImage(imageDataUrl, {
        maxRetries: 2,
        modelConfigId: modelConfig?.id,
        promptOptions,
      })

      // Check if parsing was cancelled while we were processing
      // Re-read current status from DB to see if user clicked cancel
      const currentAttachment = await db
        .select({ parsingStatus: practiceAttachments.parsingStatus })
        .from(practiceAttachments)
        .where(eq(practiceAttachments.id, attachmentId))
        .get()

      if (!currentAttachment || currentAttachment.parsingStatus !== 'processing') {
        // Parsing was cancelled (status is null) or attachment was deleted
        // Don't write results - respect the cancellation
        console.log(
          `Parsing for ${attachmentId} was cancelled (status: ${currentAttachment?.parsingStatus}), discarding results`
        )
        return NextResponse.json({
          success: false,
          cancelled: true,
          message: 'Parsing was cancelled',
        })
      }

      let parsingResult = result.data

      // Merge preserved bounding boxes from user adjustments
      // This allows the user's manual adjustments to be retained after re-parsing
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

      const stats = computeParsingStats(parsingResult)

      // Determine status based on confidence
      const status: ParsingStatus = parsingResult.needsReview ? 'needs_review' : 'approved'

      // Save results and LLM metadata to database
      await db
        .update(practiceAttachments)
        .set({
          parsingStatus: status,
          parsedAt: new Date().toISOString(),
          rawParsingResult: parsingResult,
          confidenceScore: parsingResult.overallConfidence,
          needsReview: parsingResult.needsReview,
          parsingError: null,
          // LLM metadata for debugging/transparency
          llmProvider: result.provider,
          llmModel: result.model,
          llmPromptUsed: promptUsed,
          llmRawResponse: result.rawResponse,
          llmJsonSchema: result.jsonSchema,
          llmImageSource: 'cropped',
          llmAttempts: result.attempts,
          llmPromptTokens: result.usage.promptTokens,
          llmCompletionTokens: result.usage.completionTokens,
          llmTotalTokens: result.usage.promptTokens + result.usage.completionTokens,
        })
        .where(eq(practiceAttachments.id, attachmentId))

      return NextResponse.json({
        success: true,
        status,
        result: parsingResult,
        stats,
        // LLM metadata in response
        llm: {
          provider: result.provider,
          model: result.model,
          attempts: result.attempts,
          imageSource: 'cropped',
          usage: result.usage,
        },
      })
    } catch (parseError) {
      const errorMessage =
        parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      console.error('Worksheet parsing error:', parseError)

      // Update status to failed
      await db
        .update(practiceAttachments)
        .set({
          parsingStatus: 'failed',
          parsingError: errorMessage,
        })
        .where(eq(practiceAttachments.id, attachmentId))

      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: errorMessage,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error starting parse:', error)

    // Try to mark as failed so it doesn't stay stuck in "processing"
    try {
      const { attachmentId } = await params
      if (attachmentId) {
        await db
          .update(practiceAttachments)
          .set({
            parsingStatus: 'failed',
            parsingError: error instanceof Error ? error.message : 'Failed to start parsing',
          })
          .where(eq(practiceAttachments.id, attachmentId))
      }
    } catch (updateError) {
      console.error('Failed to update attachment status:', updateError)
    }

    return NextResponse.json({ error: 'Failed to start parsing' }, { status: 500 })
  }
}

/**
 * GET - Get parsing status and results
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Build response based on status
    const response: {
      status: ParsingStatus | null
      parsedAt: string | null
      result: WorksheetParsingResult | null
      error: string | null
      needsReview: boolean
      confidenceScore: number | null
      stats?: ReturnType<typeof computeParsingStats>
      llm?: {
        provider: string | null
        model: string | null
        promptUsed: string | null
        rawResponse: string | null
        jsonSchema: string | null
        imageSource: string | null
        attempts: number | null
        usage: {
          promptTokens: number | null
          completionTokens: number | null
          totalTokens: number | null
        }
      }
    } = {
      status: attachment.parsingStatus,
      parsedAt: attachment.parsedAt,
      result: attachment.rawParsingResult,
      error: attachment.parsingError,
      needsReview: attachment.needsReview === true,
      confidenceScore: attachment.confidenceScore,
    }

    // Add stats if we have results
    if (attachment.rawParsingResult) {
      response.stats = computeParsingStats(attachment.rawParsingResult)
    }

    // Add LLM metadata if available
    if (attachment.llmProvider || attachment.llmModel) {
      response.llm = {
        provider: attachment.llmProvider,
        model: attachment.llmModel,
        promptUsed: attachment.llmPromptUsed,
        rawResponse: attachment.llmRawResponse,
        jsonSchema: attachment.llmJsonSchema,
        imageSource: attachment.llmImageSource,
        attempts: attachment.llmAttempts,
        usage: {
          promptTokens: attachment.llmPromptTokens,
          completionTokens: attachment.llmCompletionTokens,
          totalTokens: attachment.llmTotalTokens,
        },
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting parse status:', error)
    return NextResponse.json({ error: 'Failed to get parsing status' }, { status: 500 })
  }
}

/**
 * DELETE - Cancel/reset parsing status
 *
 * Allows user to cancel a stuck or in-progress parsing operation.
 * Resets the parsing status to null so they can retry.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get attachment to verify it exists and belongs to player
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment || attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Reset parsing status
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: null,
        parsedAt: null,
        parsingError: null,
        rawParsingResult: null,
        approvedResult: null,
        confidenceScore: null,
        needsReview: null,
        // Clear LLM metadata
        llmProvider: null,
        llmModel: null,
        llmPromptUsed: null,
        llmRawResponse: null,
        llmJsonSchema: null,
        llmImageSource: null,
        llmAttempts: null,
        llmPromptTokens: null,
        llmCompletionTokens: null,
        llmTotalTokens: null,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({
      success: true,
      message: 'Parsing cancelled',
    })
  } catch (error) {
    console.error('Error cancelling parse:', error)
    return NextResponse.json({ error: 'Failed to cancel parsing' }, { status: 500 })
  }
}
