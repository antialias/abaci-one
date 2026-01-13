import { type NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players } from '@/db/schema'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { canPerformAction, getStudentPresence } from '@/lib/classroom'
import {
  emitSessionEnded,
  emitSessionEndedToPlayer,
  emitSessionStarted,
  emitSessionStartedToPlayer,
} from '@/lib/classroom/socket-emitter'
import {
  abandonSessionPlan,
  approveSessionPlan,
  completeSessionPlanEarly,
  getSessionPlan,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
  startSessionPlan,
  updateSessionPlanRemoteCamera,
} from '@/lib/curriculum'
import { getDbUserId } from '@/lib/viewer'

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
  const { playerId, planId } = await params

  try {
    // Authorization: require 'start-session' permission (parent or teacher-present)
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action, result, reason, redoContext, remoteCameraSessionId } = body

    let plan

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
            { error: 'remoteCameraSessionId is required for set_remote_camera action' },
            { status: 400 }
          )
        }
        plan = await updateSessionPlanRemoteCamera(planId, remoteCameraSessionId)
        break

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Must be: approve, start, record, record_redo, end_early, abandon, or set_remote_camera',
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
  } catch (error) {
    // Don't fail the request if socket emission fails
    console.error('[SessionPlan] Failed to emit session event:', error)
  }
}
