import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getSessionPlan } from '@/lib/curriculum/session-planner'
import { loadSessionReport } from '@/lib/curriculum/session-report-server'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/curriculum/[playerId]/sessions/plans/[planId]/report
 *
 * The session report (session architecture §4, Phase 4a): the one set of
 * numbers every view of the session shows. Requires `view` on the player and
 * the plan to be the player's.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    const userId = await getUserId()
    if (!(await canPerformAction(userId, playerId, 'view'))) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const plan = await getSessionPlan(planId)
    if (!plan || plan.playerId !== playerId || plan.status === 'deleted') {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ report: await loadSessionReport(plan) })
  } catch (error) {
    console.error('Error building session report:', error)
    return NextResponse.json({ error: 'Failed to build session report' }, { status: 500 })
  }
})
