/**
 * The API path (under `/api/`) that reviews one try (#158) by its id:
 * `tries/[tryId]`. The id is `tryIdOf`'s: the try's stored id, else
 * `legacy:<planId>:<index>` for a row recorded before Phase 1, which the
 * route resolves the same way (`findTryIndex`). Every review client builds its
 * request here (§10 P6b1-12).
 */
export function reviewTryPath(playerId: string, planId: string, tryId: string): string {
  return `curriculum/${playerId}/sessions/plans/${planId}/tries/${encodeURIComponent(tryId)}`
}

/** How a review client names the try it edits */
export interface ReviewTryTarget {
  /** The try's id; absent only when an older server sent the attempt */
  tryId?: string
  /** The try's index in the plan's `results`, the older route's address */
  resultIndex?: number
}

/**
 * The path that reviews one flagged attempt: by its id, or by its index when
 * the attempt came from a server that predates P6b1-12 and so sent no `tryId`
 * (a pod not yet rolled, or a rollback). The new client keeps sending what the
 * old server needs for one release (D9); the index branch goes with
 * `results/[resultIndex]` (§10 P6b1-12b).
 */
export function reviewAttemptPath(
  playerId: string,
  planId: string,
  { tryId, resultIndex }: ReviewTryTarget
): string {
  if (tryId) return reviewTryPath(playerId, planId, tryId)
  if (typeof resultIndex !== 'number') {
    throw new Error('A review needs the try id or its result index')
  }
  return `curriculum/${playerId}/sessions/plans/${planId}/results/${resultIndex}`
}
