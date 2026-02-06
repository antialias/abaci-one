/**
 * API route for worksheet parsing status and cancellation
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/parse
 *   - Get current parsing status and results
 *
 * DELETE /api/curriculum/[playerId]/attachments/[attachmentId]/parse
 *   - Cancel/reset parsing status
 *
 * NOTE: POST (start parsing) has been removed. Parsing is now initiated via
 * the task-based route at /parse/task which uses the background task system
 * with Socket.IO for real-time streaming updates.
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { computeParsingStats, type WorksheetParsingResult } from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
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
