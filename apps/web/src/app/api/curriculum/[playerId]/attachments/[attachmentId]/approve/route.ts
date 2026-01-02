/**
 * API route for approving parsed worksheet results and creating a practice session
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/approve
 *   - Approves the parsing result
 *   - Creates a practice session from the parsed problems
 *   - Links the session back to the attachment
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import {
  sessionPlans,
  type SessionStatus,
  type SessionPart,
  type SessionSummary,
  type SlotResult,
} from '@/db/schema/session-plans'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { convertToSlotResults, computeParsingStats } from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * POST - Approve parsing and create practice session
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

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

    // Check if already created a session
    if (attachment.sessionCreated) {
      return NextResponse.json(
        {
          error: 'Session already created from this attachment',
          sessionId: attachment.createdSessionId,
        },
        { status: 400 }
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
    const conversionResult = convertToSlotResults(parsingResult, {
      partNumber: 1,
      source: 'practice',
    })

    if (conversionResult.slotResults.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid problems to create session from',
        },
        { status: 400 }
      )
    }

    // Create the session with completed status
    const sessionId = createId()
    const now = new Date()

    // Add timestamps to slot results
    const slotResultsWithTimestamps: SlotResult[] = conversionResult.slotResults.map((result) => ({
      ...result,
      timestamp: now,
    }))

    // Calculate session summary from results
    const correctCount = slotResultsWithTimestamps.filter((r) => r.isCorrect).length
    const totalCount = slotResultsWithTimestamps.length

    // Session status for parsed worksheets
    const sessionStatus: SessionStatus = 'completed'

    // Build minimal session part (offline worksheets are single-part)
    const offlinePart: SessionPart = {
      partNumber: 1,
      type: 'abacus', // Worksheet problems are solved on physical abacus
      format: 'vertical', // Most worksheets are vertical format
      useAbacus: true, // Assume physical abacus was used
      slots: slotResultsWithTimestamps.map((result, idx) => ({
        index: idx,
        purpose: 'review' as const,
        constraints: {},
        problem: result.problem,
      })),
      estimatedMinutes: 0, // Unknown for offline work
    }

    // Build session summary
    const sessionSummary: SessionSummary = {
      focusDescription: 'Worksheet practice (offline)',
      totalProblemCount: totalCount,
      estimatedMinutes: 0,
      parts: [
        {
          partNumber: 1,
          type: 'abacus',
          description: 'Worksheet Problems',
          problemCount: totalCount,
          estimatedMinutes: 0,
        },
      ],
    }

    // Create the session
    await db.insert(sessionPlans).values({
      id: sessionId,
      playerId,
      status: sessionStatus,

      // Required setup parameters
      targetDurationMinutes: 0, // Unknown for offline
      estimatedProblemCount: totalCount,
      avgTimePerProblemSeconds: 0, // Unknown for offline

      // Plan content
      parts: [offlinePart],
      summary: sessionSummary,
      masteredSkillIds: [], // Not tracked for offline

      // Session state
      currentPartIndex: 0,
      currentSlotIndex: totalCount - 1, // Completed

      // Results
      results: slotResultsWithTimestamps,

      // Timestamps
      createdAt: now,
      approvedAt: now,
      startedAt: now,
      completedAt: now,
    })

    // Update attachment to mark session as created
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: 'approved',
        sessionCreated: true,
        createdSessionId: sessionId,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    // Compute final stats
    const stats = computeParsingStats(parsingResult)

    return NextResponse.json({
      success: true,
      sessionId,
      problemCount: totalCount,
      correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : null,
      skillsExercised: conversionResult.skillsExercised,
      stats,
    })
  } catch (error) {
    console.error('Error approving and creating session:', error)
    return NextResponse.json({ error: 'Failed to approve and create session' }, { status: 500 })
  }
}
