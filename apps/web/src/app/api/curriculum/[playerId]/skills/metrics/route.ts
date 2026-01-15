/**
 * API route for skill metrics
 *
 * GET /api/curriculum/[playerId]/skills/metrics
 * Returns computed skill metrics for scoreboard display.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { canPerformAction } from '@/lib/classroom'
import { computeStudentSkillMetrics } from '@/lib/curriculum/skill-metrics'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * GET /api/curriculum/[playerId]/skills/metrics
 * Get computed skill metrics for a player.
 *
 * These metrics are computed on-the-fly from session results:
 * - Overall mastery (weighted average of pKnown)
 * - Category breakdown (basic, fiveComplements, etc.)
 * - Normalized response time (seconds per term)
 * - Accuracy trends
 * - Progress metrics (improvement rate, streak, problem counts)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { playerId } = await params

  try {
    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get problem results for BKT computation (last 100 sessions for comprehensive history)
    const results = await getRecentSessionResults(playerId, 100)

    // Get session plans for streak calculation
    const sessions = await db.query.sessionPlans.findMany({
      where: and(
        eq(schema.sessionPlans.playerId, playerId),
        inArray(schema.sessionPlans.status, ['completed', 'abandoned'])
      ),
      orderBy: [desc(schema.sessionPlans.completedAt)],
      limit: 100,
    })

    // Compute metrics
    const metrics = computeStudentSkillMetrics(results, sessions)

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching skill metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch skill metrics' }, { status: 500 })
  }
}
