import { NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/classroom'
import {
  type ApplySlotResultReviewParams,
  applySlotResultReview,
  parseSlotResultReviewAction,
  SessionReviewError,
} from '@/lib/curriculum'
import { WriteContentionError } from '@/lib/curriculum/row-cas'
import { getUserId } from '@/lib/viewer'

const toMs = (d: Date | null | undefined) => (d instanceof Date ? d.getTime() : d)

/**
 * Review/repair one try (#158), addressed by `tryId` (`tries/[tryId]`) or by
 * its position in `results` (`results/[resultIndex]`, kept until Phase 6).
 * Both routes share this so they answer identically.
 */
export async function reviewTry(
  request: Request,
  { playerId, planId, target }: Pick<ApplySlotResultReviewParams, 'playerId' | 'planId' | 'target'>
): Promise<NextResponse> {
  try {
    // Authorization: require 'repair-data' permission (parent or teacher-present)
    const userId = await getUserId()
    const canModify = await canPerformAction(userId, playerId, 'repair-data')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const action = parseSlotResultReviewAction(await request.json())

    // Ownership (plan.playerId === playerId) is enforced inside the domain call.
    const updatedPlan = await applySlotResultReview({
      planId,
      playerId,
      target,
      reviewerUserId: userId,
      action,
    })

    return NextResponse.json({
      plan: {
        ...updatedPlan,
        createdAt: toMs(updatedPlan.createdAt),
        approvedAt: toMs(updatedPlan.approvedAt),
        startedAt: toMs(updatedPlan.startedAt),
        completedAt: toMs(updatedPlan.completedAt),
        deletedAt: toMs(updatedPlan.deletedAt),
      },
    })
  } catch (error) {
    if (error instanceof SessionReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof WriteContentionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error('Error updating result:', error)
    return NextResponse.json({ error: 'Failed to update result' }, { status: 500 })
  }
}
