/**
 * API route for reviewing and correcting parsed worksheet results
 *
 * PATCH /api/curriculum/[playerId]/attachments/[attachmentId]/review
 *   - Submit user corrections to parsed problems
 *   - Updates the parsing result with corrections
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import {
  applyCorrections,
  computeParsingStats,
  ProblemCorrectionSchema,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * Request body schema for corrections
 */
const ReviewRequestSchema = z.object({
  corrections: z.array(ProblemCorrectionSchema).min(1),
  markAsReviewed: z.boolean().default(false),
})

/**
 * PATCH - Submit corrections to parsed problems
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canReview = await canPerformAction(userId, playerId, 'start-session')
    if (!canReview) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const parseResult = ReviewRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { corrections, markAsReviewed } = parseResult.data

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

    // Check if we have parsing results to correct
    if (!attachment.rawParsingResult) {
      return NextResponse.json(
        {
          error: 'No parsing results to correct. Parse the worksheet first.',
        },
        { status: 400 }
      )
    }

    // Apply corrections to the raw result
    const correctedResult = applyCorrections(
      attachment.rawParsingResult,
      corrections.map((c) => ({
        problemNumber: c.problemNumber,
        correctedTerms: c.correctedTerms ?? undefined,
        correctedStudentAnswer: c.correctedStudentAnswer ?? undefined,
        shouldExclude: c.shouldExclude,
      }))
    )

    // Compute new stats
    const stats = computeParsingStats(correctedResult)

    // Determine new status
    let newStatus: ParsingStatus = attachment.parsingStatus ?? 'needs_review'
    if (markAsReviewed) {
      // If user explicitly marks as reviewed, set to approved
      newStatus = 'approved'
    } else if (!correctedResult.needsReview) {
      // If all problems now have high confidence, auto-approve
      newStatus = 'approved'
    } else {
      // Still needs review
      newStatus = 'needs_review'
    }

    // Update database - store corrected result as approved result
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: newStatus,
        approvedResult: correctedResult,
        confidenceScore: correctedResult.overallConfidence,
        needsReview: correctedResult.needsReview,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({
      success: true,
      status: newStatus,
      result: correctedResult,
      stats,
      correctionsApplied: corrections.length,
    })
  } catch (error) {
    console.error('Error applying corrections:', error)
    return NextResponse.json({ error: 'Failed to apply corrections' }, { status: 500 })
  }
}
