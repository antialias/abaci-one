import { type NextRequest, NextResponse } from 'next/server'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import {
  abandonSessionPlan,
  approveSessionPlan,
  completeSessionPlanEarly,
  getSessionPlan,
  recordSlotResult,
  startSessionPlan,
} from '@/lib/curriculum'

interface RouteParams {
  params: Promise<{ playerId: string; planId: string }>
}

/**
 * Serialize a SessionPlan for JSON response.
 * Converts Date objects to timestamps (milliseconds) for consistent client handling.
 */
function serializePlan(plan: SessionPlan) {
  return {
    ...plan,
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.getTime() : plan.createdAt,
    approvedAt: plan.approvedAt instanceof Date ? plan.approvedAt.getTime() : plan.approvedAt,
    startedAt: plan.startedAt instanceof Date ? plan.startedAt.getTime() : plan.startedAt,
    completedAt: plan.completedAt instanceof Date ? plan.completedAt.getTime() : plan.completedAt,
  }
}

/**
 * GET /api/curriculum/[playerId]/sessions/plans/[planId]
 * Get a specific session plan
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await getSessionPlan(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    return NextResponse.json({ plan: serializePlan(plan) })
  } catch (error) {
    console.error('Error fetching plan:', error)
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
  }
}

/**
 * PATCH /api/curriculum/[playerId]/sessions/plans/[planId]
 * Update session plan status or record results
 *
 * Body:
 * - action: 'approve' | 'start' | 'record' | 'end_early' | 'abandon'
 * - result?: SlotResult (for 'record' action)
 * - reason?: string (for 'end_early' action)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const body = await request.json()
    const { action, result, reason } = body

    let plan

    switch (action) {
      case 'approve':
        plan = await approveSessionPlan(planId)
        break

      case 'start':
        plan = await startSessionPlan(planId)
        break

      case 'record':
        if (!result) {
          return NextResponse.json(
            { error: 'result is required for record action' },
            { status: 400 }
          )
        }
        plan = await recordSlotResult(planId, result as Omit<SlotResult, 'timestamp'>)
        break

      case 'end_early':
        plan = await completeSessionPlanEarly(planId, reason)
        break

      case 'abandon':
        plan = await abandonSessionPlan(planId)
        break

      default:
        return NextResponse.json(
          {
            error: 'Invalid action. Must be: approve, start, record, end_early, or abandon',
          },
          { status: 400 }
        )
    }

    return NextResponse.json({ plan: serializePlan(plan) })
  } catch (error) {
    console.error('Error updating plan:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}
