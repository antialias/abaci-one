/**
 * API route for unapproving/reverting a processed worksheet
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/unapprove
 *   - Voids the worksheet's tries in the session (they stay, counted nowhere)
 *   - Reverts the attachment to 'needs_review' state
 *   - Useful for testing and correcting mistakes
 */

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { tryIdOf } from '@/db/schema/session-plan-normalize'
import { type SlotResult, sessionPlans } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { WriteContentionError } from '@/lib/curriculum/row-cas'
import { unapproveWorksheetTries } from '@/lib/curriculum/session-planner'
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

    // Void this attachment's tries (never remove them: `results` is
    // append-only from Phase 3a, §3.3) in one machine event
    // (WORKSHEET_UNAPPROVED), CAS-written, so status, flowState and
    // completedAt stay consistent. Tries approved from Phase 3a on name their
    // attachment: once any row ever carried this attachmentId, voided or not,
    // only its unvoided tagged rows are voided, which may be none, so a
    // double-click, a retry, or a CAS re-read after another unapprove won is a
    // no-op. Only an approval from before Phase 3a (no row carries the id)
    // falls back to the old rule: the last N untagged, unvoided tries
    // (N = its problem count).
    const parsingResult = attachment.approvedResult ?? attachment.rawParsingResult
    const problemCount = parsingResult?.problems?.length ?? 0
    let voidedCount = 0

    const tryIdsOf = (plan: typeof session): string[] => {
      const results = (plan.results ?? []) as SlotResult[]
      const indexed = results.map((r, i) => ({ r, i }))
      const everTagged = results.some((r) => r.attachmentId === attachmentId)
      const picked = everTagged
        ? indexed.filter(({ r }) => r.attachmentId === attachmentId && !r.voided)
        : problemCount > 0
          ? indexed
              .filter(({ r }) => !r.voided && r.attachmentId === undefined)
              .slice(-problemCount)
          : []
      voidedCount = picked.length
      return picked.map(({ r, i }) => tryIdOf(r, i, plan.id))
    }

    if (tryIdsOf(session).length > 0) {
      await unapproveWorksheetTries(sessionId, tryIdsOf)
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
      message: `Reverted worksheet. Removed ${voidedCount} problems from session.`,
      problemsRemoved: voidedCount,
    })
  } catch (error) {
    if (error instanceof WriteContentionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error('Error unapproving worksheet:', error)
    return NextResponse.json({ error: 'Failed to unapprove worksheet' }, { status: 500 })
  }
})
