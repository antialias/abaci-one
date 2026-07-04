import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import {
  applySlotResultReview,
  SessionReviewError,
  type SlotResultReviewAction,
  type SlotReviewScope,
} from '@/lib/curriculum'
import { getUserId } from '@/lib/viewer'

const VALID_SCOPES: readonly SlotReviewScope[] = ['timing', 'mastery', 'both']

/**
 * Translate a request body into a typed {@link SlotResultReviewAction}.
 * Throws {@link SessionReviewError} (400) on anything unrecognized so the route
 * surfaces a clean validation error.
 */
function parseReviewAction(body: unknown): SlotResultReviewAction {
  const { action, scope, adjustedResponseTimeMs } = (body ?? {}) as {
    action?: string
    scope?: string
    adjustedResponseTimeMs?: unknown
  }

  switch (action) {
    case 'mark_correct':
    case 'clear_time':
    case 'confirm_timing':
    case 'unconfirm_timing':
      return { action }

    case 'exclude':
    case 'include': {
      if (scope !== undefined && !VALID_SCOPES.includes(scope as SlotReviewScope)) {
        throw new SessionReviewError('Invalid scope. Must be: timing, mastery, or both', 400)
      }
      return { action, scope: scope as SlotReviewScope | undefined }
    }

    case 'set_time': {
      if (typeof adjustedResponseTimeMs !== 'number' || !Number.isFinite(adjustedResponseTimeMs)) {
        throw new SessionReviewError('adjustedResponseTimeMs (number) is required for set_time', 400)
      }
      return { action, adjustedResponseTimeMs }
    }

    default:
      throw new SessionReviewError(
        'Invalid action. Must be: mark_correct, exclude, include, set_time, clear_time, confirm_timing, or unconfirm_timing',
        400
      )
  }
}

/**
 * PATCH /api/curriculum/[playerId]/sessions/plans/[planId]/results/[resultIndex]
 * Review/repair a specific attempt in a session plan (#158).
 *
 * Actions:
 * - mark_correct: change an incorrect result to correct (teacher-corrected)
 * - exclude / include: toggle exclusion, scoped `timing | mastery | both`
 *   (default `mastery` — backward compatible with the pre-#158 body)
 * - set_time / clear_time: set or clear an adult-entered `adjustedResponseTimeMs`
 * - confirm_timing / unconfirm_timing: vouch a flagged value is genuine
 */
export const PATCH = withAuth(async (request, { params }) => {
  const {
    playerId,
    planId,
    resultIndex: resultIndexStr,
  } = (await params) as { playerId: string; planId: string; resultIndex: string }
  const resultIndex = parseInt(resultIndexStr, 10)

  if (isNaN(resultIndex) || resultIndex < 0) {
    return NextResponse.json({ error: 'Invalid result index' }, { status: 400 })
  }

  try {
    // Authorization: require 'repair-data' permission (parent or teacher-present)
    const userId = await getUserId()
    const canModify = await canPerformAction(userId, playerId, 'repair-data')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const action = parseReviewAction(body)

    // Ownership (plan.playerId === playerId) is enforced inside the domain call.
    const updatedPlan = await applySlotResultReview({
      planId,
      playerId,
      resultIndex,
      reviewerUserId: userId,
      action,
    })

    return NextResponse.json({
      plan: {
        ...updatedPlan,
        createdAt:
          updatedPlan.createdAt instanceof Date
            ? updatedPlan.createdAt.getTime()
            : updatedPlan.createdAt,
        approvedAt:
          updatedPlan.approvedAt instanceof Date
            ? updatedPlan.approvedAt.getTime()
            : updatedPlan.approvedAt,
        startedAt:
          updatedPlan.startedAt instanceof Date
            ? updatedPlan.startedAt.getTime()
            : updatedPlan.startedAt,
        completedAt:
          updatedPlan.completedAt instanceof Date
            ? updatedPlan.completedAt.getTime()
            : updatedPlan.completedAt,
        deletedAt:
          updatedPlan.deletedAt instanceof Date
            ? updatedPlan.deletedAt.getTime()
            : updatedPlan.deletedAt,
      },
    })
  } catch (error) {
    if (error instanceof SessionReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error updating result:', error)
    return NextResponse.json({ error: 'Failed to update result' }, { status: 500 })
  }
})
