/**
 * API route for approving parsed worksheet results and adding to existing session
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/approve
 *   - Approves the parsing result
 *   - Adds the parsed problems to the EXISTING session that the attachment belongs to
 *   - Does NOT create a new session - attachments are already associated with sessions
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { sessionPlans, type SlotResult } from '@/db/schema/session-plans'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { convertToSlotResults, computeParsingStats } from '@/lib/worksheet-parsing'
import { withAuth } from '@/lib/auth/withAuth'

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
    const userId = await getDbUserId()
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

    const now = new Date()

    // Add timestamps to slot results and adjust slot indices
    const existingResults = (existingSession.results ?? []) as SlotResult[]
    const startSlotIndex = existingResults.length

    const slotResultsWithTimestamps: SlotResult[] = conversionResult.slotResults.map(
      (result, idx) => ({
        ...result,
        slotIndex: startSlotIndex + idx,
        timestamp: now,
      })
    )

    // Merge new results with existing results
    const mergedResults = [...existingResults, ...slotResultsWithTimestamps]

    // Calculate updated stats
    const totalCount = mergedResults.length
    const correctCount = mergedResults.filter((r) => r.isCorrect).length

    // Update the existing session with the new problems
    await db
      .update(sessionPlans)
      .set({
        results: mergedResults,
        // Update the completed timestamp since we added new work
        completedAt: now,
        // Mark as completed if it wasn't already
        status: 'completed',
      })
      .where(eq(sessionPlans.id, existingSession.id))

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
      problemCount: slotResultsWithTimestamps.length,
      totalSessionProblems: totalCount,
      correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : null,
      skillsExercised: conversionResult.skillsExercised,
      stats,
    })
  } catch (error) {
    console.error('Error approving and adding to session:', error)
    return NextResponse.json({ error: 'Failed to approve and add to session' }, { status: 500 })
  }
})
