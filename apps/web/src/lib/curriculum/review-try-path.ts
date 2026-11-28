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
