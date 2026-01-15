/**
 * API route for worksheet review progress
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/review-progress
 *   - Get current review progress for resumable reviews
 *
 * PATCH /api/curriculum/[playerId]/attachments/[attachmentId]/review-progress
 *   - Update review progress (save position, mark problems reviewed)
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/review-progress
 *   - Initialize review progress when starting a new review
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import {
  type ReviewProgress,
  type WorksheetParsingResult,
  type ParsedProblem,
  createInitialReviewProgress,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

// Confidence threshold for auto-approval
const AUTO_APPROVE_THRESHOLD = 0.85

/**
 * Count problems that should be auto-approved based on confidence
 */
function countAutoApprovedProblems(problems: ParsedProblem[]): number {
  return problems.filter((p) => {
    const minConfidence = Math.min(p.termsConfidence, p.studentAnswerConfidence)
    return minConfidence >= AUTO_APPROVE_THRESHOLD && !p.excluded
  }).length
}

/**
 * Initialize review progress for a parsed worksheet
 */
function initializeReviewProgress(parsingResult: WorksheetParsingResult): {
  reviewProgress: ReviewProgress
  updatedProblems: ParsedProblem[]
} {
  const problems = parsingResult.problems
  let autoApprovedCount = 0

  // Mark high-confidence problems as auto-approved
  const updatedProblems = problems.map((problem) => {
    const minConfidence = Math.min(problem.termsConfidence, problem.studentAnswerConfidence)
    if (minConfidence >= AUTO_APPROVE_THRESHOLD && !problem.excluded) {
      autoApprovedCount++
      return {
        ...problem,
        reviewStatus: 'approved' as const,
        reviewedAt: new Date().toISOString(),
      }
    }
    return {
      ...problem,
      reviewStatus: 'pending' as const,
      reviewedAt: null,
    }
  })

  const reviewProgress = createInitialReviewProgress(problems.length, autoApprovedCount)

  return { reviewProgress, updatedProblems }
}

/**
 * GET - Get current review progress
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

    if (!attachment || attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // If no parsing result, can't have review progress
    if (!attachment.rawParsingResult) {
      return NextResponse.json({ error: 'Attachment has not been parsed' }, { status: 400 })
    }

    // Return existing review progress or create default
    const reviewProgress =
      attachment.reviewProgress ??
      createInitialReviewProgress(
        attachment.rawParsingResult.problems.length,
        countAutoApprovedProblems(attachment.rawParsingResult.problems)
      )

    return NextResponse.json({
      reviewProgress,
      problems: attachment.rawParsingResult.problems,
      totalProblems: attachment.rawParsingResult.problems.length,
    })
  } catch (error) {
    console.error('Error getting review progress:', error)
    return NextResponse.json({ error: 'Failed to get review progress' }, { status: 500 })
  }
}

/**
 * POST - Initialize review progress (start a new review)
 */
export async function POST(_request: Request, { params }: RouteParams) {
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

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment || attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (!attachment.rawParsingResult) {
      return NextResponse.json({ error: 'Attachment has not been parsed' }, { status: 400 })
    }

    // Initialize review progress
    const { reviewProgress, updatedProblems } = initializeReviewProgress(
      attachment.rawParsingResult
    )

    // Update the parsing result with review status on each problem
    const updatedParsingResult: WorksheetParsingResult = {
      ...attachment.rawParsingResult,
      problems: updatedProblems,
    }

    // Save to database
    await db
      .update(practiceAttachments)
      .set({
        reviewProgress,
        rawParsingResult: updatedParsingResult,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({
      success: true,
      reviewProgress,
      problems: updatedProblems,
      message:
        reviewProgress.autoApprovedCount > 0
          ? `${reviewProgress.autoApprovedCount} problems auto-approved, ${reviewProgress.flaggedCount} need review`
          : `${updatedProblems.length} problems ready for review`,
    })
  } catch (error) {
    console.error('Error initializing review progress:', error)
    return NextResponse.json({ error: 'Failed to initialize review progress' }, { status: 500 })
  }
}

// Schema for PATCH request
const UpdateReviewProgressSchema = z.object({
  // Update overall progress
  currentIndex: z.number().int().min(0).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),

  // Update a specific problem's review status
  problemUpdate: z
    .object({
      index: z.number().int().min(0),
      reviewStatus: z.enum(['pending', 'approved', 'corrected', 'flagged']),
    })
    .optional(),
})

/**
 * PATCH - Update review progress
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Parse request body
    let body: z.infer<typeof UpdateReviewProgressSchema>
    try {
      const rawBody = await request.json()
      body = UpdateReviewProgressSchema.parse(rawBody)
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: err instanceof Error ? err.message : 'Unknown',
        },
        { status: 400 }
      )
    }

    // Authorization check
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment || attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (!attachment.rawParsingResult) {
      return NextResponse.json({ error: 'Attachment has not been parsed' }, { status: 400 })
    }

    // Get current review progress or initialize
    let reviewProgress: ReviewProgress =
      attachment.reviewProgress ??
      createInitialReviewProgress(
        attachment.rawParsingResult.problems.length,
        countAutoApprovedProblems(attachment.rawParsingResult.problems)
      )
    let parsingResult = attachment.rawParsingResult

    // Apply updates
    const now = new Date().toISOString()

    // Update current index if provided
    if (body.currentIndex !== undefined) {
      reviewProgress = {
        ...reviewProgress,
        currentIndex: body.currentIndex,
        lastReviewedAt: now,
      }
    }

    // Update status if provided
    if (body.status !== undefined) {
      reviewProgress = {
        ...reviewProgress,
        status: body.status,
        lastReviewedAt: now,
      }
    }

    // Update a specific problem's review status
    if (body.problemUpdate) {
      const { index, reviewStatus } = body.problemUpdate
      if (index < 0 || index >= parsingResult.problems.length) {
        return NextResponse.json({ error: 'Invalid problem index' }, { status: 400 })
      }

      const oldStatus = parsingResult.problems[index].reviewStatus ?? 'pending'

      // Update the problem
      parsingResult = {
        ...parsingResult,
        problems: parsingResult.problems.map((p, i) =>
          i === index ? { ...p, reviewStatus, reviewedAt: now } : p
        ),
      }

      // Update counts based on status change
      if (oldStatus !== reviewStatus) {
        // Decrement old count
        if (oldStatus === 'pending' || oldStatus === 'flagged') {
          reviewProgress = {
            ...reviewProgress,
            flaggedCount: Math.max(0, reviewProgress.flaggedCount - 1),
          }
        } else if (oldStatus === 'approved') {
          reviewProgress = {
            ...reviewProgress,
            manuallyReviewedCount: Math.max(0, reviewProgress.manuallyReviewedCount - 1),
          }
        } else if (oldStatus === 'corrected') {
          reviewProgress = {
            ...reviewProgress,
            correctedCount: Math.max(0, reviewProgress.correctedCount - 1),
          }
        }

        // Increment new count
        if (reviewStatus === 'pending' || reviewStatus === 'flagged') {
          reviewProgress = {
            ...reviewProgress,
            flaggedCount: reviewProgress.flaggedCount + 1,
          }
        } else if (reviewStatus === 'approved') {
          reviewProgress = {
            ...reviewProgress,
            manuallyReviewedCount: reviewProgress.manuallyReviewedCount + 1,
          }
        } else if (reviewStatus === 'corrected') {
          reviewProgress = {
            ...reviewProgress,
            correctedCount: reviewProgress.correctedCount + 1,
          }
        }
      }

      reviewProgress = {
        ...reviewProgress,
        lastReviewedAt: now,
        status: 'in_progress',
      }

      // Check if all problems are reviewed
      const allReviewed = parsingResult.problems.every(
        (p) => p.reviewStatus === 'approved' || p.reviewStatus === 'corrected' || p.excluded
      )
      if (allReviewed) {
        reviewProgress = { ...reviewProgress, status: 'completed' }
      }
    }

    // Save to database
    await db
      .update(practiceAttachments)
      .set({
        reviewProgress,
        rawParsingResult: parsingResult,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({
      success: true,
      reviewProgress,
      problems: parsingResult.problems,
    })
  } catch (error) {
    console.error('Error updating review progress:', error)
    return NextResponse.json({ error: 'Failed to update review progress' }, { status: 500 })
  }
}
