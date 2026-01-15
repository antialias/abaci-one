/**
 * API route for listing vision recordings for a player
 *
 * GET /api/curriculum/[playerId]/recordings
 *
 * Returns list of all vision recordings for the player, sorted by start time (newest first).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { visionRecordings } from '@/db/schema'
import { getPlayerAccess, generateAuthorizationError } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

export interface PlayerRecordingItem {
  id: string
  sessionId: string
  status: string
  durationMs: number | null
  frameCount: number | null
  fileSize: number | null
  startedAt: string
  endedAt: string | null
  expiresAt: string
  videoUrl: string | null
}

export interface PlayerRecordingsResponse {
  recordings: PlayerRecordingItem[]
  totalCount: number
}

/**
 * GET - List all recordings for a player
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
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

    // Parse pagination from query params
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // Get recordings for this player, sorted by start time
    const recordings = await db.query.visionRecordings.findMany({
      where: eq(visionRecordings.playerId, playerId),
      orderBy: [desc(visionRecordings.startedAt)],
      limit,
      offset,
    })

    // Get total count
    const allRecordings = await db.query.visionRecordings.findMany({
      where: eq(visionRecordings.playerId, playerId),
      columns: { id: true },
    })
    const totalCount = allRecordings.length

    // Transform to response format
    const result: PlayerRecordingItem[] = recordings.map((recording) => ({
      id: recording.id,
      sessionId: recording.sessionId,
      status: recording.status,
      durationMs: recording.durationMs,
      frameCount: recording.frameCount,
      fileSize: recording.fileSize,
      startedAt: recording.startedAt.toISOString(),
      endedAt: recording.endedAt?.toISOString() ?? null,
      expiresAt: recording.expiresAt.toISOString(),
      videoUrl:
        recording.status === 'ready'
          ? `/api/curriculum/${playerId}/sessions/${recording.sessionId}/recording/video`
          : null,
    }))

    const response: PlayerRecordingsResponse = {
      recordings: result,
      totalCount,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching player recordings:', error)
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 })
  }
}
