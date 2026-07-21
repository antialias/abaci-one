/**
 * Per-connection ring throttle (Phase 2a, #8.4).
 *
 * The service may ring in bursts (phase flurries, retries). Since a ring is
 * only a hint to re-read, collapsing a burst to one emit per ~250ms loses
 * nothing — the re-read sees the latest state either way, and the sanctioned
 * safety-net poll covers anything dropped.
 *
 * In-memory and therefore per-replica: with 3 app pods a burst can emit up to
 * 3× instead of 1×. That's an over-notification bound, not a correctness
 * issue, so it stays simple. Size is bounded by the number of connections
 * (small, per-user rows).
 */

export const RING_MIN_INTERVAL_MS = 250

const lastRingAt = new Map<string, number>()

/**
 * Claim the right to emit for this connection. Returns false when a ring
 * landed within the min interval — the caller should ack the ring but skip
 * the emit.
 */
export function claimRingSlot(
  connectionId: string,
  now: number = Date.now(),
  minIntervalMs: number = RING_MIN_INTERVAL_MS
): boolean {
  const last = lastRingAt.get(connectionId)
  if (last !== undefined && now - last < minIntervalMs) return false
  lastRingAt.set(connectionId, now)
  return true
}

/** Test hook — clears throttle state between cases. */
export function resetRingThrottle(): void {
  lastRingAt.clear()
}
