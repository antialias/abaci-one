/**
 * API route for paginated session history with cursor-based pagination
 *
 * GET /api/curriculum/[playerId]/sessions/history
 *   Query params:
 *   - cursor: Session ID to start after (optional, for pagination)
 *   - limit: Number of sessions to return (default: 20, max: 100)
 *
 * Response:
 *   {
 *     sessions: PracticeSession[],
 *     nextCursor: string | null,  // ID of last session, null if no more
 *     hasMore: boolean
 *   }
 */

import { NextResponse } from 'next/server'
import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { sessionPlans } from '@/db/schema/session-plans'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)

    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 100)

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Build query conditions
    const conditions = [
      eq(sessionPlans.playerId, playerId),
      // Only include completed sessions
      // completedAt is not null check done via ordering
    ]

    // If cursor provided, get sessions older than the cursor session
    if (cursor) {
      // Get the cursor session's completedAt to paginate from there
      const cursorSession = await db.query.sessionPlans.findFirst({
        where: eq(sessionPlans.id, cursor),
        columns: { completedAt: true },
      })

      if (cursorSession?.completedAt) {
        conditions.push(lt(sessionPlans.completedAt, cursorSession.completedAt))
      }
    }

    // Fetch limit + 1 to check if there are more
    const sessions = await db.query.sessionPlans.findMany({
      where: and(...conditions),
      orderBy: [desc(sessionPlans.completedAt)],
      limit: limit + 1,
    })

    // Filter to only completed sessions and check for more
    const completedSessions = sessions.filter((s) => s.completedAt !== null)
    const hasMore = completedSessions.length > limit
    const returnSessions = completedSessions.slice(0, limit)

    // Transform to match PracticeSession interface expected by client
    const transformedSessions = returnSessions.map((session) => ({
      id: session.id,
      playerId: session.playerId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      problemsAttempted: (JSON.parse(session.results) as unknown[]).length,
      problemsCorrect: (JSON.parse(session.results) as Array<{ isCorrect: boolean }>).filter(
        (r) => r.isCorrect
      ).length,
      totalTimeMs: (JSON.parse(session.results) as Array<{ responseTimeMs?: number }>).reduce(
        (sum, r) => sum + (r.responseTimeMs ?? 0),
        0
      ),
      skillsUsed: [
        ...new Set(
          (JSON.parse(session.results) as Array<{ skillsExercised?: string[] }>).flatMap(
            (r) => r.skillsExercised ?? []
          )
        ),
      ],
    }))

    return NextResponse.json({
      sessions: transformedSessions,
      nextCursor: hasMore ? returnSessions[returnSessions.length - 1]?.id : null,
      hasMore,
    })
  } catch (error) {
    console.error('Error fetching session history:', error)
    return NextResponse.json({ error: 'Failed to fetch session history' }, { status: 500 })
  }
}
