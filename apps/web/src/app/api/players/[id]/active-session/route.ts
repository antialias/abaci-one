import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sessionPlans } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { buildSessionReports } from '@/lib/curriculum/session-report-batch'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/players/[id]/active-session
 *
 * Returns the active session for a player (if any).
 * Requires 'view' permission (parent or teacher relationship).
 *
 * Active = approved or in progress and not ended (`completedAt` null: a row
 * the sweep or an end stamped is never returned, whatever its status says).
 * Every number is the session report's (Phase 4d).
 *
 * Response:
 * - { session: null } if no active session
 * - { session: { sessionId, status, outcome, startedAt, completedProblems,
 *     totalProblems, totals, rowVersion } } if active; `completedProblems` /
 *   `totalProblems` are the report's items done of planned (0 of planned
 *   before the session starts), `startedAt` null until it starts
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization: require 'view' permission (parent or teacher)
    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Find active session (started or about to start, not ended)
    const activePlan = await db.query.sessionPlans.findFirst({
      where: and(
        eq(sessionPlans.playerId, playerId),
        inArray(sessionPlans.status, ['approved', 'in_progress']),
        isNull(sessionPlans.completedAt)
      ),
      orderBy: [desc(sessionPlans.createdAt)],
    })

    if (!activePlan) {
      return NextResponse.json({ session: null })
    }

    const [report] = await buildSessionReports([activePlan])
    if (!report) {
      return NextResponse.json({ error: 'Failed to fetch active session' }, { status: 500 })
    }
    const progress = report.position?.progress ?? {
      done: 0,
      total: report.totals.plannedProblems,
    }

    return NextResponse.json({
      session: {
        sessionId: activePlan.id,
        status: activePlan.status,
        outcome: report.outcome,
        startedAt: report.startedAt != null ? new Date(report.startedAt).toISOString() : null,
        completedProblems: progress.done,
        totalProblems: progress.total,
        totals: report.totals,
        rowVersion: report.rowVersion,
      },
    })
  } catch (error) {
    console.error('Error fetching active session:', error)
    return NextResponse.json({ error: 'Failed to fetch active session' }, { status: 500 })
  }
})
