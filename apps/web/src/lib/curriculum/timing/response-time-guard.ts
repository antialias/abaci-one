/**
 * Response-time integrity guard (#156).
 *
 * Two pure helpers, no runtime dependencies (client- and server-safe):
 *
 * - {@link applyResponseTimeGuard} runs at the client submit seams. It caps a
 *   freshly-measured response time at the attempt's per-child auto-pause
 *   threshold and flags the sample so #157/#158 can quarantine and review it.
 * - {@link sanitizeResultTiming} is the server backstop. It runs inside the
 *   record paths and normalizes any value that exceeds the absolute 5-minute
 *   ceiling (stale PWA clients, hostile clients, clock anomalies) before it is
 *   ever stored, independent of whether the client guard ran.
 *
 * The raw measurement is NEVER discarded: whenever a guard fires it preserves
 * the original value in `responseTimeMsRaw`. Contract invariant:
 * `wasIdleCapped === true` ⇔ `responseTimeMsRaw` present.
 *
 * ## Accepted false-positive class
 *
 * A genuinely-attended attempt whose attention-adjusted delta still exceeds the
 * auto-pause threshold (e.g. real work resumed after a pause cycle) is capped
 * and flagged. This is accepted: the capped value stays roughly in this child's
 * distribution (mean + ~2σ winsorization), correctness still feeds BKT, and the
 * flag is visible and reversible via the #158 review tool.
 */

import type { SlotResult } from '@/db/schema/session-plans'
import { MAX_RESPONSE_TIME_CAP_MS } from './constants'

/**
 * The timing fields a guard may write. `responseTimeMs` is always present; the
 * rest appear only when the guard fired (spreadable straight into a SlotResult).
 */
export type ResponseTimeGuardResult = Pick<SlotResult, 'responseTimeMs'> &
  Partial<
    Pick<
      SlotResult,
      'responseTimeMsRaw' | 'wasIdleCapped' | 'capReason' | 'capThresholdMs' | 'capSource'
    >
  >

/**
 * Client-side capture-time guard.
 *
 * @param rawMs  the measured response time (elapsed − accumulated pause/hidden)
 * @param capMs  the cap to apply — the attempt's per-child `thresholds.autoPauseMs`
 *               (already prod-clamped to ≤ {@link MAX_RESPONSE_TIME_CAP_MS})
 * @param source which layer is applying the cap
 *
 * Returns a plain measurement (`{ responseTimeMs }` with no extra fields) when
 * `0 ≤ rawMs ≤ capMs`. Otherwise caps the value and sets the audit flags:
 * - `rawMs < 0` (OS clock stepped back) → `responseTimeMs: 0`, `'clock-anomaly'`
 * - `rawMs > capMs` (idle / backgrounded past the threshold) → `'idle-exceeded'`
 */
export function applyResponseTimeGuard(
  rawMs: number,
  capMs: number,
  source: 'client' | 'server'
): ResponseTimeGuardResult {
  // Negative delta: the OS clock stepped backward mid-attempt. An unflagged 0ms
  // sample would pollute the fast tail of the child's distribution, so clamp AND
  // flag it (never a silent 0).
  if (rawMs < 0) {
    return {
      responseTimeMs: 0,
      responseTimeMsRaw: rawMs,
      wasIdleCapped: true,
      capReason: 'clock-anomaly',
      capThresholdMs: capMs,
      capSource: source,
    }
  }

  // Attention-adjusted delta still outran the intended auto-pause: cap it.
  if (rawMs > capMs) {
    return {
      responseTimeMs: capMs,
      responseTimeMsRaw: rawMs,
      wasIdleCapped: true,
      capReason: 'idle-exceeded',
      capThresholdMs: capMs,
      capSource: source,
    }
  }

  // In-bounds plain measurement — no extra fields (keeps legacy row shape).
  return { responseTimeMs: rawMs }
}

/** The subset of a SlotResult {@link sanitizeResultTiming} inspects and may patch. */
export type SanitizeTimingInput = Pick<
  SlotResult,
  'responseTimeMs' | 'responseTimeMsRaw' | 'wasIdleCapped' | 'capReason' | 'capThresholdMs' | 'capSource'
>

/** A partial patch to spread over a result: `{ ...result, ...sanitizeResultTiming(result) }`. */
export type SanitizeTimingPatch = Partial<SanitizeTimingInput>

/**
 * Server-side backstop.
 *
 * Returns the fields (if any) that must change so no stored value ever exceeds
 * the absolute {@link MAX_RESPONSE_TIME_CAP_MS} ceiling. Empty object ⇒ leave the
 * result untouched. This is the independently-deployable end to unbounded
 * writes: it protects production even if a stale/hostile client never ran the
 * capture-time guard.
 *
 * Cases:
 * - `responseTimeMs > ceiling` (unflagged stale client, OR an inconsistent combo
 *   where a client set `wasIdleCapped` but left `responseTimeMs` above the
 *   ceiling): cap to the ceiling, preserve the earliest raw, flag as a
 *   server-sourced clock anomaly.
 * - client-capped values (already ≤ ceiling) pass through untouched.
 * - recency-refresh / `responseTimeMs ≤ 0` sentinels are left as-is (they carry
 *   no real measurement).
 * - a hostile `capThresholdMs` above the ceiling is clamped even when the value
 *   itself is in range.
 */
export function sanitizeResultTiming(result: SanitizeTimingInput): SanitizeTimingPatch {
  const { responseTimeMs } = result

  // Value outran the absolute ceiling → cap it server-side. Covers both an
  // unflagged stale client and a client that flagged the sample but left the
  // stored value above the ceiling (we cannot trust its cap in that case).
  if (typeof responseTimeMs === 'number' && responseTimeMs > MAX_RESPONSE_TIME_CAP_MS) {
    return {
      // Preserve the earliest raw: an existing raw is the original measurement;
      // otherwise the current (still-uncapped) value IS the raw.
      responseTimeMsRaw: result.responseTimeMsRaw ?? responseTimeMs,
      responseTimeMs: MAX_RESPONSE_TIME_CAP_MS,
      wasIdleCapped: true,
      capReason: 'clock-anomaly',
      capThresholdMs: MAX_RESPONSE_TIME_CAP_MS,
      capSource: 'server',
    }
  }

  // In-range value but a hostile / inconsistent cap threshold above the ceiling
  // → clamp just the threshold (the value itself is fine).
  if (
    typeof result.capThresholdMs === 'number' &&
    result.capThresholdMs > MAX_RESPONSE_TIME_CAP_MS
  ) {
    return { capThresholdMs: MAX_RESPONSE_TIME_CAP_MS }
  }

  return {}
}
