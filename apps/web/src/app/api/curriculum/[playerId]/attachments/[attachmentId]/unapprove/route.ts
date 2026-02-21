/**
 * API route for unapproving/reverting a processed worksheet
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/unapprove
 *   - Removes the problems from the session
 *   - Reverts the attachment to 'needs_review' state
 *   - Useful for testing and correcting mistakes
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { sessionPlans, type SlotResult } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * POST - Unapprove/revert a processed worksheet
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getUserId()
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

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if it's actually been processed
    if (!attachment.sessionCreated) {
      return NextResponse.json({ error: 'Worksheet has not been approved yet' }, { status: 400 })
    }

    // Get the session to remove problems from
    const sessionId = attachment.createdSessionId || attachment.sessionId
    const session = await db.select().from(sessionPlans).where(eq(sessionPlans.id, sessionId)).get()

    if (!session) {
      return NextResponse.json({ error: 'Associated session not found' }, { status: 404 })
    }

    // Count how many problems came from this attachment
    // We need to figure out which results to remove
    // Since we don't track which results came from which attachment,
    // we'll remove the last N results where N = number of problems in parsing result
    const parsingResult = attachment.approvedResult ?? attachment.rawParsingResult
    const problemCount = parsingResult?.problems?.length ?? 0

    if (problemCount > 0) {
      const existingResults = (session.results ?? []) as SlotResult[]

      // Remove the last N results (assumes they were added by this attachment)
      const newResults = existingResults.slice(0, -problemCount)

      // Update session
      await db
        .update(sessionPlans)
        .set({
          results: newResults,
          // If no results left, mark as in_progress
          status: newResults.length === 0 ? 'in_progress' : 'completed',
        })
        .where(eq(sessionPlans.id, sessionId))
    }

    // Revert attachment to needs_review state
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: 'needs_review',
        sessionCreated: false,
        createdSessionId: null,
        // Keep the parsing results and review progress intact
      })
      .where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({
      success: true,
      message: `Reverted worksheet. Removed ${problemCount} problems from session.`,
      problemsRemoved: problemCount,
    })
  } catch (error) {
    console.error('Error unapproving worksheet:', error)
    return NextResponse.json({ error: 'Failed to unapprove worksheet' }, { status: 500 })
  }
})
