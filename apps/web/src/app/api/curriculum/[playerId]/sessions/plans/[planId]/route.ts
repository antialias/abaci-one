import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players } from '@/db/schema'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction, getStudentPresence } from '@/lib/classroom'
import {
  emitSessionEnded,
  emitSessionEndedToPlayer,
  emitSessionStarted,
  emitSessionStartedToPlayer,
} from '@/lib/classroom/socket-emitter'
import {
  acknowledgeGameBreakResults,
  abandonSessionPlan,
  approveSessionPlan,
  completePartTransition,
  completeSessionPlanEarly,
  finishGameBreak,
  getSessionPlan,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
  startSessionPlan,
  StaleFlowVersionError,
  updateSessionPlanRemoteCamera,
} from '@/lib/curriculum'
import { InvalidFlowTransitionError } from '@/lib/curriculum/session-flow'
import { getUserId } from '@/lib/viewer'

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
    flowUpdatedAt:
      plan.flowUpdatedAt instanceof Date ? plan.flowUpdatedAt.getTime() : plan.flowUpdatedAt,
    breakStartedAt:
      plan.breakStartedAt instanceof Date ? plan.breakStartedAt.getTime() : plan.breakStartedAt,
  }
}

/**
 * GET /api/curriculum/[playerId]/sessions/plans/[planId]
 * Get a specific session plan
 */
export const GET = withAuth(async (_request, { params }) => {
  const { planId } = (await params) as { playerId: string; planId: string }

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
})

/**
 * PATCH /api/curriculum/[playerId]/sessions/plans/[planId]
 * Update session plan status or record results
 *
 * Body:
 * - action: 'approve' | 'start' | 'record' | 'record_redo' | 'end_early' | 'abandon'
 *          | 'set_remote_camera' | 'part_transition_complete' | 'break_finished' | 'break_results_acked'
 * - result?: SlotResult (for 'record' action)
 * - reason?: string (for 'end_early' action)
 */
export const PATCH = withAuth(async (request, { params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    // Authorization: require 'start-session' permission (parent or teacher-present)
    const userId = await getUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      action,
      result,
      reason,
      redoContext,
      remoteCameraSessionId,
      breakFinishReason,
      breakResults,
    } = body

    let plan
    const actionStart = Date.now()

    if (action === 'record') {
      console.log('[GBTRACE][server]', 'patch-record-request', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        slotIndex: result?.slotIndex,
        isCorrect: result?.isCorrect,
      })
    } else if (action === 'record_redo') {
      console.log('[GBTRACE][server]', 'patch-record-redo-request', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        slotIndex: result?.slotIndex,
        isCorrect: result?.isCorrect,
        redoContext,
      })
    } else if (
      action === 'part_transition_complete' ||
      action === 'break_finished' ||
      action === 'break_results_acked'
    ) {
      console.log('[GBTRACE][server]', 'patch-flow-request', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        action,
        breakFinishReason: breakFinishReason ?? null,
      })
    }

    switch (action) {
      case 'approve':
        plan = await approveSessionPlan(planId)
        break

      case 'start':
        plan = await startSessionPlan(planId)
        // Emit session events to player channel (parents) and classroom channel (if present)
        await emitSessionEvents(playerId, planId, 'start')
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

      case 'record_redo':
        if (!result || !redoContext) {
          return NextResponse.json(
            {
              error: 'result and redoContext are required for record_redo action',
            },
            { status: 400 }
          )
        }
        plan = await recordRedoResult(
          planId,
          result as Omit<SlotResult, 'timestamp' | 'partNumber'>,
          redoContext as RedoContext
        )
        break

      case 'end_early':
        plan = await completeSessionPlanEarly(planId, reason)
        // Emit session events to player channel (parents) and classroom channel (if present)
        await emitSessionEvents(playerId, planId, 'end_early')
        break

      case 'abandon':
        plan = await abandonSessionPlan(planId)
        // Emit session events to player channel (parents) and classroom channel (if present)
        await emitSessionEvents(playerId, planId, 'abandon')
        break

      case 'set_remote_camera':
        // remoteCameraSessionId can be string (to set) or null (to clear)
        if (remoteCameraSessionId === undefined) {
          return NextResponse.json(
            {
              error: 'remoteCameraSessionId is required for set_remote_camera action',
            },
            { status: 400 }
          )
        }
        plan = await updateSessionPlanRemoteCamera(planId, remoteCameraSessionId)
        break

      case 'part_transition_complete':
        plan = await completePartTransition(planId)
        break

      case 'break_finished':
        if (
          breakFinishReason !== 'timeout' &&
          breakFinishReason !== 'gameFinished' &&
          breakFinishReason !== 'skipped'
        ) {
          return NextResponse.json(
            {
              error: 'breakFinishReason is required and must be timeout | gameFinished | skipped',
            },
            { status: 400 }
          )
        }
        plan = await finishGameBreak(planId, breakFinishReason, breakResults ?? null)
        break

      case 'break_results_acked':
        plan = await acknowledgeGameBreakResults(planId)
        break

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Must be: approve, start, record, record_redo, end_early, abandon, set_remote_camera, part_transition_complete, break_finished, or break_results_acked',
          },
          { status: 400 }
        )
    }

    if (action === 'record' || action === 'record_redo') {
      console.log('[GBTRACE][server]', 'patch-record-response', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        action,
        durationMs: Date.now() - actionStart,
        updatedPartIndex: plan.currentPartIndex,
        updatedSlotIndex: plan.currentSlotIndex,
        updatedStatus: plan.status,
        completedAt: plan.completedAt ? String(plan.completedAt) : null,
      })
    } else if (
      action === 'part_transition_complete' ||
      action === 'break_finished' ||
      action === 'break_results_acked'
    ) {
      console.log('[GBTRACE][server]', 'patch-flow-response', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        action,
        updatedFlowState: plan.flowState ?? null,
        updatedBreakStartedAt: plan.breakStartedAt ? String(plan.breakStartedAt) : null,
        updatedBreakReason: plan.breakReason ?? null,
      })
    }
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
    console.error('Error updating plan:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
})


/**
 * Helper to emit session socket events to both:
 * 1. Player channel (for parent observation) - ALWAYS
 * 2. Classroom channel (for teacher observation) - only if student is present
 */
async function emitSessionEvents(
  playerId: string,
  sessionId: string,
  action: 'start' | 'end_early' | 'abandon'
): Promise<void> {
  try {
    // Get player name
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })
    const playerName = player?.name ?? 'Unknown'

    // Always emit to player channel (for parents)
    if (action === 'start') {
      await emitSessionStartedToPlayer({ sessionId, playerId, playerName })
    } else {
      const reason = action === 'end_early' ? 'ended_early' : 'abandoned'
      await emitSessionEndedToPlayer({
        sessionId,
        playerId,
        playerName,
        reason,
      })
    }

    // Also emit to classroom channel if student is present
    const presence = await getStudentPresence(playerId)
    if (presence) {
      const classroomId = presence.classroomId
      if (action === 'start') {
        await emitSessionStarted({ sessionId, playerId, playerName }, classroomId)
      } else {
        const reason = action === 'end_early' ? 'ended_early' : 'abandoned'
        await emitSessionEnded({ sessionId, playerId, playerName, reason }, classroomId)
      }
    }

    // Fire-and-forget: notify subscribers (web push, email, in-app)
    if (action === 'start') {
      const baseUrl =
        process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://abaci.one'

      import('@/lib/notifications/bootstrap')
        .then(({ bootstrapChannels }) => bootstrapChannels())
        .then(() => import('@/lib/notifications/dispatcher'))
        .then(({ notifySubscribers }) =>
          notifySubscribers({
            sessionId,
            playerId,
            playerName,
            playerEmoji: player?.emoji ?? '',
            observeUrl: `${baseUrl}/practice/${playerId}/observe`,
          })
        )
        .catch((err) => {
          console.error('[Notifications] Failed to notify subscribers:', err)
        })
    }
  } catch (error) {
    // Don't fail the request if socket emission fails
    console.error('[SessionPlan] Failed to emit session event:', error)
  }
}
