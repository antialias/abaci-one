/**
 * API route for approving parsed worksheet results and adding to existing session
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/approve
 *   - Approves the parsing result
 *   - Adds the parsed problems to the EXISTING session that the attachment belongs to
 *   - Does NOT create a new session - attachments are already associated with sessions
 */

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { summarizeTries } from '@/db/schema/session-plan-helpers'
import { mintTryId } from '@/db/schema/session-plan-normalize'
import { type SlotResult, sessionPlans } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { WriteContentionError } from '@/lib/curriculum/row-cas'
import { approveWorksheetTries } from '@/lib/curriculum/session-planner'
import { getUserId } from '@/lib/viewer'
import { computeParsingStats, convertToSlotResults } from '@/lib/worksheet-parsing'

/**
 * POST - Approve parsing and add problems to existing session
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getUserId()
    const canApprove = await canPerformAction(userId, playerId, 'start-session')
    if (!canApprove) {
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

    // Check if already processed
    if (attachment.sessionCreated) {
      return NextResponse.json(
        {
          error: 'Problems from this worksheet already added to session',
        },
        { status: 400 }
      )
    }

    // Get the existing session that this attachment belongs to
    const existingSession = await db
      .select()
      .from(sessionPlans)
      .where(eq(sessionPlans.id, attachment.sessionId))
      .get()

    if (!existingSession) {
      return NextResponse.json(
        {
          error: 'Associated session not found',
        },
        { status: 404 }
      )
    }

    // Get the parsing result to convert (prefer approved result, fall back to raw)
    const parsingResult = attachment.approvedResult ?? attachment.rawParsingResult
    if (!parsingResult) {
      return NextResponse.json(
        {
          error: 'No parsing results available. Parse the worksheet first.',
        },
        { status: 400 }
      )
    }

    // Convert to slot results
    // Always use part 1 for offline worksheets - slot indices track individual problems
    const conversionResult = convertToSlotResults(parsingResult, {
      partNumber: 1,
      source: 'practice',
    })

    if (conversionResult.slotResults.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid problems to add to session',
        },
        { status: 400 }
      )
    }

    // Append the worksheet's tries and complete the session in one machine
    // event (WORKSHEET_APPROVED), CAS-written: status, flowState and
    // completedAt move together. Each try gets its own id and names this
    // attachment, so unapproval can void exactly these tries.
    const now = new Date()
    const updatedSession = await approveWorksheetTries(existingSession.id, (plan) => {
      const existingResults = (plan.results ?? []) as SlotResult[]
      // Already approved (a double submit raced past the attachment check)
      if (existingResults.some((r) => r.attachmentId === attachmentId && !r.voided)) return []
      const startSlotIndex = existingResults.length
      return conversionResult.slotResults.map((result, idx) => ({
        ...result,
        tryId: mintTryId(),
        attachmentId,
        slotIndex: startSlotIndex + idx,
        timestamp: now,
      }))
    })
    const addedCount = updatedSession.results.filter(
      (r) => r.attachmentId === attachmentId && !r.voided
    ).length

    // Calculate updated stats
    const { completed: totalCount, correct: correctCount } = summarizeTries(updatedSession.results)

    // Update attachment to mark as processed
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: 'approved',
        sessionCreated: true,
        createdSessionId: existingSession.id, // Reference to the session we added to
      })
      .where(eq(practiceAttachments.id, attachmentId))

    // Compute final stats
    const stats = computeParsingStats(parsingResult)

    return NextResponse.json({
      success: true,
      sessionId: existingSession.id,
      problemCount: addedCount,
      totalSessionProblems: totalCount,
      correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : null,
      skillsExercised: conversionResult.skillsExercised,
      stats,
    })
  } catch (error) {
    if (error instanceof WriteContentionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error('Error approving and adding to session:', error)
    return NextResponse.json({ error: 'Failed to approve and add to session' }, { status: 500 })
  }
})
