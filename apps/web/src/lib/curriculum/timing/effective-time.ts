/**
 * Effective response-time resolution and Tier-1 timing classification.
 *
 * This is the single place every timing consumer resolves "how long did this
 * attempt actually take?" (`getEffectiveResponseTimeMs`) and "is this sample
 * usable?" (`classifyAttemptTiming`). Keeping the logic here guarantees the
 * session planner, the Start-Practice modals, and the review tool all agree.
 *
 * Client-safe: imports ONLY types from the schema — no db/server runtime.
 */

import type { SlotResult } from '@/db/schema/session-plans'
import { MAX_RESPONSE_TIME_CAP_MS } from './constants'

/**
 * The subset of a {@link SlotResult} needed to reason about its timing.
 *
 * A full `SlotResult` is structurally assignable, so real callers just pass
 * the whole record; the narrow shape keeps callers (and tests) from having to
 * build an entire result object.
 */
export type TimingSample = Pick<
  SlotResult,
  | 'responseTimeMs'
  | 'source'
  | 'wasIdleCapped'
  | 'responseTimeMsRaw'
  | 'capReason'
  | 'capSource'
  | 'capThresholdMs'
  | 'timingReview'
>

export type AttemptTimingTier = 'ok' | 'tier1' | 'tier2'

export type AttemptTimingReason = 'idle-capped' | 'legacy-implausible' | 'unusual-for-child'

export interface AttemptTimingClassification {
  tier: AttemptTimingTier
  reason?: AttemptTimingReason
}

/**
 * A child's own windowed timing distribution, used to detect Tier-2
 * (genuine-but-unusual, per-child) samples. Produced by
 * `computeChildTimingStats` in `pace-estimation.ts` (#157) and passed into
 * {@link classifyAttemptTiming}. `spread` is precomputed there so the
 * classifier stays arithmetic-free and both consumers agree on the formula.
 */
export interface ChildTimingStats {
  /** Median of the child's non-Tier-1 effective response times (ms). */
  median: number
  /** Median absolute deviation of those samples (ms). */
  mad: number
  /**
   * Robust spread for the Tier-2 cutoff:
   * `max(1.4826·MAD, 0.25·median, 5_000ms)` (guards a degenerate MAD of 0).
   */
  spread: number
  /** How many non-Tier-1 samples the stats were computed from. */
  cleanSampleCount: number
}

/**
 * Tier-2 thresholds (per the shared contract). A non-Tier-1 sample is Tier-2
 * when `x > median + TIER2_SPREAD_MULTIPLIER·spread`, AND
 * `x >= TIER2_ABSOLUTE_FLOOR_MS`, AND the child has at least
 * `TIER2_MIN_CLEAN_SAMPLES` clean samples. Only the slow tail is flagged.
 */
export const TIER2_SPREAD_MULTIPLIER = 3.5
export const TIER2_ABSOLUTE_FLOOR_MS = 60_000
export const TIER2_MIN_CLEAN_SAMPLES = 10

/**
 * Whether the #156 guard fired on this attempt (i.e. any capture flag is set).
 * Used to keep the legacy heuristic from double-handling guarded records.
 */
function hasTimingGuardFlags(result: TimingSample): boolean {
  return (
    result.wasIdleCapped != null ||
    result.responseTimeMsRaw != null ||
    result.capReason != null ||
    result.capSource != null ||
    result.capThresholdMs != null
  )
}

/**
 * Resolve the response time an attempt should contribute to timing estimates,
 * or `null` if it contributes no timing sample.
 *
 * Resolution order (per the shared contract):
 * 1. `timingReview.omitFromTiming` → null (adult removed the sample)
 * 2. `timingReview.adjustedResponseTimeMs != null` → that value
 *    (adult-vouched replacement; never re-classified)
 * 3. `source === 'recency-refresh'` or `responseTimeMs <= 0` → null
 *    (sentinel record / no real measurement)
 * 4. else `responseTimeMs`
 */
export function getEffectiveResponseTimeMs(result: TimingSample): number | null {
  const review = result.timingReview
  if (review?.omitFromTiming) {
    return null
  }
  if (review?.adjustedResponseTimeMs != null) {
    return review.adjustedResponseTimeMs
  }
  if (result.source === 'recency-refresh' || result.responseTimeMs <= 0) {
    return null
  }
  return result.responseTimeMs
}

/**
 * Whether the #156 guard auto-quarantined this attempt as idle-capped, i.e.
 * `responseTimeMs` is NOT the raw measurement.
 */
export function isIdleCapped(result: TimingSample): boolean {
  return result.wasIdleCapped === true
}

/**
 * Classify an attempt's timing sample.
 *
 * Tier-1 (provably broken → auto-quarantined):
 * - `wasIdleCapped === true` (any stored value) → `tier1` / `idle-capped`
 * - legacy rule: no #156 guard flags and effective time
 *   `> MAX_RESPONSE_TIME_CAP_MS` → `tier1` / `legacy-implausible`
 *
 * Tier-2 (genuine-but-unusual, per-child): only when `childStats` is supplied
 * (#157). Among non-Tier-1 samples, a value is Tier-2 when it exceeds
 * `median + TIER2_SPREAD_MULTIPLIER·spread` AND `TIER2_ABSOLUTE_FLOOR_MS`, and
 * the child has at least `TIER2_MIN_CLEAN_SAMPLES` clean samples. Tier-2 samples
 * are kept in the estimate (winsorized), never auto-excluded.
 *
 * An adult-adjusted value (`timingReview.adjustedResponseTimeMs`) re-enters as
 * `ok` and is never re-classified.
 */
export function classifyAttemptTiming(
  result: TimingSample,
  childStats?: ChildTimingStats
): AttemptTimingClassification {
  // Adult-adjusted values re-enter the estimate and are never re-classified.
  if (result.timingReview?.adjustedResponseTimeMs != null) {
    return { tier: 'ok' }
  }

  // Tier-1a: explicitly idle-capped by the #156 guard.
  if (result.wasIdleCapped === true) {
    return { tier: 'tier1', reason: 'idle-capped' }
  }

  const effective = getEffectiveResponseTimeMs(result)

  // Tier-1b: legacy pre-#156 records with no guard flags whose effective time
  // provably outran the maximum possible auto-pause clamp.
  if (
    effective != null &&
    !hasTimingGuardFlags(result) &&
    effective > MAX_RESPONSE_TIME_CAP_MS
  ) {
    return { tier: 'tier1', reason: 'legacy-implausible' }
  }

  // Tier-2: unusually slow for THIS child, judged against their own windowed
  // distribution. Requires enough clean samples for the stats to be meaningful.
  if (
    childStats != null &&
    effective != null &&
    childStats.cleanSampleCount >= TIER2_MIN_CLEAN_SAMPLES &&
    effective >= TIER2_ABSOLUTE_FLOOR_MS &&
    effective > childStats.median + TIER2_SPREAD_MULTIPLIER * childStats.spread
  ) {
    return { tier: 'tier2', reason: 'unusual-for-child' }
  }

  return { tier: 'ok' }
}

/**
 * Count how many results are Tier-1 (auto-quarantined) samples.
 */
export function countQuarantined(results: readonly TimingSample[]): number {
  let count = 0
  for (const result of results) {
    if (classifyAttemptTiming(result).tier === 'tier1') {
      count++
    }
  }
  return count
}

/**
 * Whether an adult has *resolved the timing flag* on this attempt — i.e. taken
 * an action that settles how the sample should count. A bare review stamp (e.g.
 * a mastery-only exclusion, which stamps `reviewedBy`/`reviewedAt` but touches
 * no timing field) does NOT resolve the timing flag.
 *
 * Resolved iff a `timingReview` exists AND any of:
 * - `omitFromTiming === true`        (sample dropped from timing),
 * - `adjustedResponseTimeMs != null` (adult-vouched replacement value),
 * - `timingConfirmed === true`       (adult vouched the raw value is genuine).
 *
 * Note: neither `omitFromTiming` nor `timingConfirmed` changes the classifier's
 * tier, so a raw `classifyAttemptTiming(...).tier` count is NOT resolution-aware
 * on its own — pair it with this helper via {@link countUnresolvedFlagged}.
 */
export function isFlagResolved(result: TimingSample): boolean {
  const review = result.timingReview
  if (review == null) return false
  return (
    review.omitFromTiming === true ||
    review.adjustedResponseTimeMs != null ||
    review.timingConfirmed === true
  )
}

/**
 * Count attempts still *awaiting adult review*: flagged by the classifier
 * (`tier !== 'ok'`, i.e. Tier-1 or Tier-2) AND not yet resolved via
 * {@link isFlagResolved}. This is the resolution-aware "needs review" count the
 * summary banner and the session-list badge surface, so an omitted / adjusted /
 * confirmed attempt drops out of the count and the badge disappears at zero.
 *
 * `childStats` is optional and only affects Tier-2 detection; per-session,
 * context-free callers omit it (Tier-1 needs no stats), matching how
 * `countQuarantined` classifies.
 */
export function countUnresolvedFlagged(
  results: readonly TimingSample[],
  childStats?: ChildTimingStats
): number {
  let count = 0
  for (const result of results) {
    if (classifyAttemptTiming(result, childStats).tier !== 'ok' && !isFlagResolved(result)) {
      count++
    }
  }
  return count
}
