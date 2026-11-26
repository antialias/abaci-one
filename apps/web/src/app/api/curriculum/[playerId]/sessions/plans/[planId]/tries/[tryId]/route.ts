import { withAuth } from '@/lib/auth/withAuth'
import { reviewTry } from '../../reviewTry'

/**
 * PATCH /api/curriculum/[playerId]/sessions/plans/[planId]/tries/[tryId]
 * Review/repair one try (#158) by its `tryId`. A row recorded before Phase 1
 * has no stored id; it is addressed as `legacy:<planId>:<index>`, the id
 * `normalizeTry` gives it. Same actions and answer as `results/[resultIndex]`.
 */
export const PATCH = withAuth(async (request, { params }) => {
  const { playerId, planId, tryId } = (await params) as {
    playerId: string
    planId: string
    tryId: string
  }
  return reviewTry(request, { playerId, planId, target: { tryId: decodeURIComponent(tryId) } })
})
