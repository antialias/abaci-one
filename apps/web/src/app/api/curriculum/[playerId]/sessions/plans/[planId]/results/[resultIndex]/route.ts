import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { reviewTry } from '../../reviewTry'

/**
 * PATCH /api/curriculum/[playerId]/sessions/plans/[planId]/results/[resultIndex]
 * Review/repair a specific attempt in a session plan (#158), by its position in
 * `results`. No client of this image calls it (they use `tries/[tryId]`, §10
 * P6b1-12a); kept for open tabs on older bundles (D9), deleted in P6b1-12b.
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

  if (Number.isNaN(resultIndex) || resultIndex < 0) {
    return NextResponse.json({ error: 'Invalid result index' }, { status: 400 })
  }

  return reviewTry(request, { playerId, planId, target: { resultIndex } })
})
