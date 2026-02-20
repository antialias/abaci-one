/**
 * API route for session vision recording metadata
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/recording
 *
 * Returns recording metadata including status, duration, problem markers, and video URL.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessionPlans, visionRecordings } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import { getPlayerAccess, generateAuthorizationError } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

export interface SessionRecordingResponse {
  hasRecording: boolean
  recording?: {
    id: string
    status: string
    durationMs: number | null
    frameCount: number | null
    avgFps: number | null
    fileSize: number | null
    startedAt: string
    endedAt: string | null
    problemMarkers: Array<{
      offsetMs: number
      problemNumber: number
      partIndex: number
      eventType: 'problem-shown' | 'answer-submitted' | 'feedback-shown'
      isCorrect?: boolean
    }> | null
    processingError: string | null
    videoUrl: string | null
  }
}

/**
 * GET - Get recording metadata for a session
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { playerId, sessionId } = (await params) as { playerId: string; sessionId: string }

    if (!playerId || !sessionId) {
      return NextResponse.json({ error: 'Player ID and Session ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const access = await getPlayerAccess(userId, playerId)
    if (access.accessLevel === 'none') {
      const authError = generateAuthorizationError(access, 'view', {
        actionDescription: 'view recordings for this student',
      })
      return NextResponse.json(authError, { status: 403 })
    }

    // Verify session exists and belongs to player
    const session = await db.query.sessionPlans.findFirst({
      where: and(eq(sessionPlans.id, sessionId), eq(sessionPlans.playerId, playerId)),
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get recording for this session
    const recording = await db.query.visionRecordings.findFirst({
      where: eq(visionRecordings.sessionId, sessionId),
    })

    if (!recording) {
      const response: SessionRecordingResponse = { hasRecording: false }
      return NextResponse.json(response)
    }

    // Build video URL if recording is ready
    const videoUrl =
      recording.status === 'ready'
        ? `/api/curriculum/${playerId}/sessions/${sessionId}/recording/video`
        : null

    const response: SessionRecordingResponse = {
      hasRecording: true,
      recording: {
        id: recording.id,
        status: recording.status,
        durationMs: recording.durationMs,
        frameCount: recording.frameCount,
        avgFps: recording.avgFps,
        fileSize: recording.fileSize,
        startedAt: recording.startedAt.toISOString(),
        endedAt: recording.endedAt?.toISOString() ?? null,
        problemMarkers: recording.problemMarkers,
        processingError: recording.processingError,
        videoUrl,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching session recording:', error)
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 })
  }
})
