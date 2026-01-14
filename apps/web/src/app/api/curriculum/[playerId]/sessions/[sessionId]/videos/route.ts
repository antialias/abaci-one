/**
 * API route for listing per-problem vision recording videos for a session
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/videos
 *
 * Returns a list of available problem videos for the session.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { and, eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { sessionPlans, visionProblemVideos } from '@/db/schema'
import { getPlayerAccess, generateAuthorizationError } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string; sessionId: string }>
}

/**
 * GET - List available problem videos for a session
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, sessionId } = await params

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

    // Get all problem videos for this session
    const videos = await db.query.visionProblemVideos.findMany({
      where: eq(visionProblemVideos.sessionId, sessionId),
      orderBy: [asc(visionProblemVideos.problemNumber)],
    })

    // Transform to response format
    const videoList = videos.map((video) => ({
      problemNumber: video.problemNumber,
      partIndex: video.partIndex,
      status: video.status,
      durationMs: video.durationMs,
      fileSize: video.fileSize,
      isCorrect: video.isCorrect,
      startedAt: video.startedAt,
      endedAt: video.endedAt,
      processingError: video.processingError,
    }))

    return NextResponse.json({ videos: videoList })
  } catch (error) {
    console.error('Error listing session videos:', error)
    return NextResponse.json({ error: 'Failed to list videos' }, { status: 500 })
  }
}
