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
  type WorksheetParsingResult,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * POST - Start parsing the attachment
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

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

    // Check if already processing
    if (attachment.parsingStatus === 'processing') {
      return NextResponse.json({
        status: 'processing',
        message: 'Parsing already in progress',
      })
    }

    // Update status to processing
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: 'processing',
        parsingError: null,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    // Read the image file
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    const filepath = join(uploadDir, attachment.filename)
    const imageBuffer = await readFile(filepath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = attachment.mimeType || 'image/jpeg'
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    try {
      // Parse the worksheet
      const result = await parseWorksheetImage(imageDataUrl, {
        maxRetries: 2,
      })

      const parsingResult = result.data
      const stats = computeParsingStats(parsingResult)

      // Determine status based on confidence
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
        })
        .where(eq(practiceAttachments.id, attachmentId))

      return NextResponse.json({
        success: true,
        status,
        result: parsingResult,
        stats,
        attempts: result.attempts,
        usage: result.usage,
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

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting parse status:', error)
    return NextResponse.json({ error: 'Failed to get parsing status' }, { status: 500 })
  }
}
