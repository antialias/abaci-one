import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import type { SessionPlan } from '@/db/schema/session-plans'
import { applySessionFlowEvent, StaleFlowVersionError } from '@/lib/curriculum/session-planner'
import { InvalidFlowTransitionError, type SessionFlowEvent } from '@/lib/curriculum/session-flow'
import { getUserId } from '@/lib/viewer'

function serializePlan(plan: SessionPlan) {
  return {
    ...plan,
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.getTime() : plan.createdAt,
    approvedAt: plan.approvedAt instanceof Date ? plan.approvedAt.getTime() : plan.approvedAt,
    startedAt: plan.startedAt instanceof Date ? plan.startedAt.getTime() : plan.startedAt,
    completedAt: plan.completedAt instanceof Date ? plan.completedAt.getTime() : plan.completedAt,
    flowUpdatedAt:
      plan.flowUpdatedAt instanceof Date ? plan.flowUpdatedAt.getTime() : plan.flowUpdatedAt,
    breakStartedAt:
      plan.breakStartedAt instanceof Date ? plan.breakStartedAt.getTime() : plan.breakStartedAt,
  }
}

/**
 * POST /api/curriculum/[playerId]/sessions/plans/[planId]/flow-events
 * Apply a server-side flow event with optional optimistic concurrency.
 */
export const POST = withAuth(async (request, { params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    const userId = await getUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { event, expectedFlowVersion } = body as {
      event?: SessionFlowEvent
      expectedFlowVersion?: number
    }

    if (!event?.type) {
      return NextResponse.json(
        {
          error: 'event is required',
          code: 'MISSING_EVENT',
        },
        { status: 400 }
      )
    }

    const plan = await applySessionFlowEvent(planId, event, expectedFlowVersion)
    return NextResponse.json({ plan: serializePlan(plan) })
  } catch (error) {
    if (error instanceof InvalidFlowTransitionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INVALID_FLOW_TRANSITION',
          flowState: error.state,
          eventType: error.eventType,
        },
        { status: 409 }
      )
    }
    if (error instanceof StaleFlowVersionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'STALE_FLOW_VERSION',
          expectedFlowVersion: error.expectedFlowVersion,
          actualFlowVersion: error.actualFlowVersion,
        },
        { status: 409 }
      )
    }

    console.error('Error applying flow event:', error)
    return NextResponse.json({ error: 'Failed to apply flow event' }, { status: 500 })
  }
})
