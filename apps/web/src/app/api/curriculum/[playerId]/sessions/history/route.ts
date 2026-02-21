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
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

export const GET = withAuth(async (request, { params }) => {
  const routeStart = performance.now()
  const timings: Record<string, number> = {}

  try {
    const { playerId } = (await params) as { playerId: string }
    const { searchParams } = new URL(request.url)

    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 100)

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    let t = performance.now()
    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    timings.auth = performance.now() - t

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
      t = performance.now()
      // Get the cursor session's completedAt to paginate from there
      const cursorSession = await db.query.sessionPlans.findFirst({
        where: eq(sessionPlans.id, cursor),
        columns: { completedAt: true },
      })
      timings.cursorLookup = performance.now() - t

      if (cursorSession?.completedAt) {
        conditions.push(lt(sessionPlans.completedAt, cursorSession.completedAt))
      }
    }

    // Fetch limit + 1 to check if there are more
    t = performance.now()
    const sessions = await db.query.sessionPlans.findMany({
      where: and(...conditions),
      orderBy: [desc(sessionPlans.completedAt)],
      limit: limit + 1,
    })
    timings.dbQuery = performance.now() - t

    // Filter to only completed sessions and check for more
    t = performance.now()
    const completedSessions = sessions.filter((s) => s.completedAt !== null)
    const hasMore = completedSessions.length > limit
    const returnSessions = completedSessions.slice(0, limit)

    // Transform to match PracticeSession interface expected by client
    const transformedSessions = returnSessions.map((session) => {
      const results = session.results
      return {
        id: session.id,
        playerId: session.playerId,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        problemsAttempted: results.length,
        problemsCorrect: results.filter((r) => r.isCorrect).length,
        totalTimeMs: results.reduce((sum, r) => sum + (r.responseTimeMs ?? 0), 0),
        skillsUsed: [...new Set(results.flatMap((r) => r.skillsExercised ?? []))],
      }
    })
    timings.transform = performance.now() - t

    const total = performance.now() - routeStart
    console.log(
      `[PERF] /api/curriculum/.../sessions/history: ${total.toFixed(1)}ms | ` +
        `auth=${timings.auth.toFixed(1)}ms, ` +
        `db=${timings.dbQuery.toFixed(1)}ms, ` +
        `transform=${timings.transform.toFixed(1)}ms | ` +
        `sessions=${returnSessions.length}`
    )

    return NextResponse.json({
      sessions: transformedSessions,
      nextCursor: hasMore ? returnSessions[returnSessions.length - 1]?.id : null,
      hasMore,
    })
  } catch (error) {
    console.error('Error fetching session history:', error)
    return NextResponse.json({ error: 'Failed to fetch session history' }, { status: 500 })
  }
})
