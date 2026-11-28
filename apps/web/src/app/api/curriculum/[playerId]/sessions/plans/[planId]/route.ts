import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { players } from '@/db/schema'
import type { SlotResultSubmission } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { emitSessionStartedToPlayer } from '@/lib/classroom/socket-emitter'
import {
  abandonSessionPlan,
  acknowledgeGameBreakResults,
  approveSessionPlan,
  completePartTransition,
  completeSessionPlanEarly,
  finishGameBreak,
  getSessionPlan,
  type RedoContext,
  recordTry,
  restoreSessionPlan,
  SessionReviewError,
  SlotResultMismatchError,
  StaleFlowVersionError,
  softDeleteSessionPlan,
  startSessionPlan,
  type TrySubmission,
  type TryVerdict,
  UnknownKindError,
  updateSessionPlanRemoteCamera,
} from '@/lib/curriculum'
import { arithmeticCursorSlotIndex } from '@/lib/curriculum/parts/arithmetic/session-view'
import { serializePlan } from '@/lib/curriculum/plan-wire'
import {
  MalformedDoOverError,
  MalformedTrySubmissionError,
  NotPracticingError,
  type RedoSubmission,
} from '@/lib/curriculum/record-try'
import { WriteContentionError } from '@/lib/curriculum/row-cas'
import { InvalidFlowTransitionError } from '@/lib/curriculum/session-flow'
import { getUserId } from '@/lib/viewer'

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
 * - action: 'approve' | 'start' | 'record' | 'record_redo' | 'record_try' | 'end_early'
 *          | 'abandon' | 'set_remote_camera' | 'part_transition_complete' | 'break_finished'
 *          | 'break_results_acked'
 * - result?: the try (legacy or K2 superset body for 'record'/'record_redo'; a
 *   `TrySubmission` for 'record_try')
 * - reason?: string (for 'end_early' action)
 *
 * The three try actions go through one recorder, `recordTry`, and answer
 * `{ plan, try }`: `try` is the verdict the server stored (`tryId`,
 * `isCorrect`, `outcome`; for a duplicate, the row already stored). Old
 * bundles read `plan` only (practice-kinds K2, amendment A11).
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

    // Ownership: the plan must belong to the player in the path. Without this,
    // authorization was evaluated against a player the plan may not belong to.
    const ownedPlan = await getSessionPlan(planId)
    if (!ownedPlan || ownedPlan.playerId !== playerId) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
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
    let recordedTry: TryVerdict | null | undefined
    const actionStart = Date.now()

    if (action === 'record') {
      console.log('[GBTRACE][server]', 'patch-record-request', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        slotIndex: result?.slotIndex,
      })
    } else if (action === 'record_redo') {
      console.log('[GBTRACE][server]', 'patch-record-redo-request', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        slotIndex: result?.slotIndex,
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
        await emitSessionStartedEvents(playerId, planId)
        break

      case 'record':
        if (!result) {
          return NextResponse.json(
            { error: 'result is required for record action' },
            { status: 400 }
          )
        }
        // Idempotent by result.tryId; the server stamps kind/round/practiceOnly/weight
        // and judges the try (the body's isCorrect is not stored)
        ;({ plan, try: recordedTry } = await recordTry(planId, {
          action: 'record',
          result: result as SlotResultSubmission,
        }))
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
        // Every do-over is recorded; a do-over of a problem already answered
        // correctly is stamped practiceOnly (weight 0). redoContext.originalWasCorrect
        // is ignored: the server derives it from the item's tries.
        ;({ plan, try: recordedTry } = await recordTry(planId, {
          action: 'record_redo',
          result: result as RedoSubmission,
          redoContext: redoContext as RedoContext,
        }))
        break

      case 'record_try':
        // The envelope (practice-kinds §1.3); the client sends it from K4
        if (!result) {
          return NextResponse.json(
            { error: 'result is required for record_try action' },
            { status: 400 }
          )
        }
        ;({ plan, try: recordedTry } = await recordTry(planId, result as TrySubmission))
        break

      case 'end_early':
        // `session-ended` goes out from the commit path (row-cas, Phase 4a)
        plan = await completeSessionPlanEarly(planId, reason)
        break

      case 'abandon':
        // `session-ended` goes out from the commit path (row-cas, Phase 4a)
        plan = await abandonSessionPlan(planId)
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

      case 'restore':
        // Restore a soft-deleted session to its prior status (#158).
        plan = await restoreSessionPlan({ planId, playerId })
        break

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Must be: approve, start, record, record_redo, record_try, end_early, abandon, set_remote_camera, part_transition_complete, break_finished, break_results_acked, or restore',
          },
          { status: 400 }
        )
    }

    if (action === 'record' || action === 'record_redo' || action === 'record_try') {
      console.log('[GBTRACE][server]', 'patch-record-response', {
        ts: new Date().toISOString(),
        playerId,
        planId,
        action,
        durationMs: Date.now() - actionStart,
        updatedPartIndex: plan.currentPartIndex,
        updatedSlotIndex: arithmeticCursorSlotIndex(plan),
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
        updatedFlowUpdatedAt: plan.flowUpdatedAt ? String(plan.flowUpdatedAt) : null,
      })
    }
    return NextResponse.json(
      recordedTry === undefined
        ? { plan: serializePlan(plan) }
        : { plan: serializePlan(plan), try: recordedTry }
    )
  } catch (error) {
    if (error instanceof SessionReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
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
    if (error instanceof NotPracticingError) {
      // A try while a transition or break owns the next step: nothing recorded;
      // the client applies this plan (Phase 3c)
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          flowState: error.plan.flowState,
          plan: serializePlan(error.plan),
        },
        { status: 409 }
      )
    }
    if (error instanceof UnknownKindError) {
      // A part this image does not know: nothing recorded; the client resyncs (K2, R14)
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    if (error instanceof MalformedTrySubmissionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof MalformedDoOverError) {
      return NextResponse.json({ error: error.message, code: 'MALFORMED_DO_OVER' }, { status: 400 })
    }
    if (error instanceof SlotResultMismatchError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'SLOT_MISMATCH',
          // why it was refused (K2, additive: old bundles key on the code)
          reason: error.reason,
          submittedSlotId: error.submittedSlotId,
          expectedSlotId: error.expectedSlotId,
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
    if (error instanceof WriteContentionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error('Error updating plan:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
})

/**
 * DELETE /api/curriculum/[playerId]/sessions/plans/[planId]
 * Soft-delete a finished session (#158). Status → 'deleted', prior status
 * preserved for restore. Requires 'repair-data' (parent or teacher-present)
 * and plan ownership (enforced inside softDeleteSessionPlan).
 */
export const DELETE = withAuth(async (_request, { params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    const userId = await getUserId()
    const canDelete = await canPerformAction(userId, playerId, 'repair-data')
    if (!canDelete) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const plan = await softDeleteSessionPlan({ planId, playerId, deletedByUserId: userId })
    return NextResponse.json({ plan: serializePlan(plan) })
  } catch (error) {
    if (error instanceof SessionReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error deleting plan:', error)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
})

/**
 * Emit the session-started event to the player channel (for parent
 * observation). The teachers' rooms hear every start from the row write's
 * commit path (`session-report-server.ts`, Phase 4d), for every classroom
 * the student is enrolled in.
 *
 * Ends are not emitted here: every end (natural completion included) emits
 * `session-ended` from the row write's commit path (`session-report-server.ts`).
 */
async function emitSessionStartedEvents(playerId: string, sessionId: string): Promise<void> {
  try {
    // Get player name
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })
    const playerName = player?.name ?? 'Unknown'

    // Always emit to player channel (for parents)
    await emitSessionStartedToPlayer({ sessionId, playerId, playerName })

    // Fire-and-forget: notify subscribers (web push, email, in-app)
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
  } catch (error) {
    // Don't fail the request if socket emission fails
    console.error('[SessionPlan] Failed to emit session event:', error)
  }
}
