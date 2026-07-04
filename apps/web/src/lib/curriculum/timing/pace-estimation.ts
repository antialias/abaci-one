/**
 * Outlier-aware pace estimator (#157).
 *
 * The single, pure statistic behind every "how many problems fit in N minutes?"
 * decision. It pools per-problem timings across the student's recent session
 * window, classifies each attempt per-child into ok / Tier-1 / Tier-2 (via the
 * shared classifier in `effective-time.ts`), and returns a robust
 * **winsorized mean** clamped to a sanity ceiling, alongside a UX payload of
 * flag counts and affected sessions.
 *
 * Design (see the #157 plan / shared contract):
 * - Tier-1 (provably broken) samples are auto-excluded. This is what un-caps a
 *   player poisoned by legacy > 5-minute measurements with zero DB repair — the
 *   classification happens here, at read time.
 * - Tier-2 (genuine-but-unusual, per-child) samples are KEPT in the estimate,
 *   winsorized at `min(tier2CutoffMs, TIER2_WINSOR_CEILING_MS)` so their
 *   influence is bounded but never silently dropped.
 * - The final average is clamped to `[MIN_SECONDS_PER_PROBLEM,
 *   MAX_SECONDS_PER_PROBLEM]` and rounded to an integer.
 * - Fewer than `MIN_CLEAN_SAMPLES` usable samples → `isDefault: true` and the
 *   caller-supplied default is returned.
 *
 * Client-safe: imports ONLY types from the schema plus the sibling timing
 * helpers and pure config constants — no db/server runtime.
 */

import {
  classifyAttemptTiming,
  getEffectiveResponseTimeMs,
  TIER2_SPREAD_MULTIPLIER,
  type AttemptTimingTier,
  type ChildTimingStats,
  type TimingSample,
} from './effective-time'
// Import from the leaf constants module (not the config barrel) to keep this
// module client-safe — the barrel re-exports comfort-level helpers we don't need.
import {
  DEFAULT_SECONDS_PER_PROBLEM,
  MAX_SECONDS_PER_PROBLEM,
  MIN_SECONDS_PER_PROBLEM,
} from '../config/session-timing'

// ============================================================================
// Constants
// ============================================================================

/** Scale factor turning MAD into a normal-consistent standard-deviation estimate. */
const MAD_TO_SIGMA = 1.4826
/** Floor for the robust spread as a fraction of the median (guards small medians). */
const SPREAD_MEDIAN_FRACTION = 0.25
/** Absolute floor for the robust spread (guards a degenerate MAD of 0). */
const SPREAD_MIN_MS = 5_000

/**
 * Ceiling a Tier-2 sample is winsorized to (2 minutes). Combined with the
 * per-child cutoff via `min(cutoff, ceiling)` so an extreme distribution can't
 * let the cutoff itself run away.
 */
const TIER2_WINSOR_CEILING_MS = 120_000

/**
 * Minimum usable (non-Tier-1) samples before we trust the estimate. Below this
 * the assessment is `isDefault` and callers fall back to their default pace.
 */
const MIN_CLEAN_SAMPLES = 5

// ============================================================================
// Types
// ============================================================================

/**
 * One attempt fed to the estimator, with just enough session context to report
 * which sessions were affected. `sample` carries the timing fields the shared
 * classifier reads; a full `SlotResult` is structurally assignable.
 */
export interface TimedAttempt {
  sessionId: string
  completedAt: string | null
  /** Number of terms in the problem (for per-term normalization); 0 if unknown. */
  termCount: number
  sample: TimingSample
}

/** A session that contains at least one Tier-1 or Tier-2 attempt. */
export interface AffectedSession {
  sessionId: string
  completedAt: string | null
  /** Tier-1 + Tier-2 attempts in this session. */
  flaggedCount: number
  /** Slowest flagged effective time in this session, in seconds. */
  worstSeconds: number
}

/**
 * The pace statistic and its decision-point UX payload. Produced ONLY by
 * `getPaceAssessment` (progress-manager) so every consumer agrees.
 */
export interface PaceAssessment {
  /** Winsorized mean seconds per problem, integer, clamped to the sanity band. */
  avgSecondsPerProblem: number
  /** Winsorized mean seconds per term, or null when no term-count data exists. */
  secondsPerTerm: number | null
  /**
   * What the estimate would become if the Tier-2 flags were repaired away
   * (ok-only mean). Powers the "~M problems if repaired" preview; null when
   * there is nothing to preview (no Tier-2) or too few ok samples.
   */
  secondsPerProblemExcludingFlagged: number | null
  /** Usable samples that went into the estimate (ok + Tier-2). */
  sampleCount: number
  /** True when there were too few usable samples; `avgSecondsPerProblem` is the default. */
  isDefault: boolean
  tier1Count: number
  tier2Count: number
  /** Flagged (Tier-1/Tier-2) attempts with no `timingReview` yet. */
  unresolvedCount: number
  /** Sessions containing flagged attempts, worst (slowest) first. */
  affectedSessions: AffectedSession[]
  /** Number of sessions in the window the assessment was computed over. */
  windowSessionCount: number
}

export interface AssessPaceOptions {
  /** Default seconds per problem baked into `avgSecondsPerProblem` when `isDefault`. */
  defaultSecondsPerProblem?: number
}

// ============================================================================
// Statistics
// ============================================================================

/** Median of a numeric array (returns 0 for empty input). */
function median(values: readonly number[]): number {
  const n = values.length
  if (n === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = n >> 1
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Compute a child's robust windowed timing stats from their non-Tier-1
 * effective response times (ms). `spread` bakes in the contract formula
 * `max(1.4826·MAD, 0.25·median, 5_000ms)` so the classifier stays arithmetic-free.
 */
export function computeChildTimingStats(cleanEffectiveMs: readonly number[]): ChildTimingStats {
  const cleanSampleCount = cleanEffectiveMs.length
  if (cleanSampleCount === 0) {
    return { median: 0, mad: 0, spread: 0, cleanSampleCount: 0 }
  }
  const med = median(cleanEffectiveMs)
  const mad = median(cleanEffectiveMs.map((x) => Math.abs(x - med)))
  const spread = Math.max(MAD_TO_SIGMA * mad, SPREAD_MEDIAN_FRACTION * med, SPREAD_MIN_MS)
  return { median: med, mad, spread, cleanSampleCount }
}

function clampSecondsPerProblem(seconds: number): number {
  return Math.min(MAX_SECONDS_PER_PROBLEM, Math.max(MIN_SECONDS_PER_PROBLEM, Math.round(seconds)))
}

// ============================================================================
// Assessment
// ============================================================================

interface ClassifiedAttempt {
  attempt: TimedAttempt
  effectiveMs: number | null
  tier: AttemptTimingTier
  /** Value contributed to the estimate (winsorized for Tier-2); null if excluded. */
  estimateMs: number | null
}

/**
 * Assess a student's pace from a flat list of windowed attempts.
 *
 * Two passes: (1) Tier-1 classification (no child stats needed) yields the
 * clean distribution; (2) Tier-2 classification against that distribution.
 * Tier-1 is excluded, Tier-2 winsorized, ok kept as-is.
 */
export function assessPace(
  attempts: readonly TimedAttempt[],
  windowSessionCount: number,
  options: AssessPaceOptions = {}
): PaceAssessment {
  const defaultSeconds = options.defaultSecondsPerProblem ?? DEFAULT_SECONDS_PER_PROBLEM

  // Pass 1: effective times + Tier-1 classification.
  const effectiveByAttempt = attempts.map((attempt) => getEffectiveResponseTimeMs(attempt.sample))
  const tier1Flags = attempts.map((attempt) => classifyAttemptTiming(attempt.sample).tier === 'tier1')

  // Clean (non-Tier-1, measured) samples define the child's distribution.
  const cleanEffectiveMs: number[] = []
  for (let i = 0; i < attempts.length; i++) {
    if (!tier1Flags[i] && effectiveByAttempt[i] != null) {
      cleanEffectiveMs.push(effectiveByAttempt[i] as number)
    }
  }
  const childStats = computeChildTimingStats(cleanEffectiveMs)
  const tier2CutoffMs = childStats.median + TIER2_SPREAD_MULTIPLIER * childStats.spread
  const winsorCeilingMs = Math.min(tier2CutoffMs, TIER2_WINSOR_CEILING_MS)

  // Pass 2: full classification (Tier-2 needs child stats) + estimate value.
  const classified: ClassifiedAttempt[] = attempts.map((attempt, i) => {
    const effectiveMs = effectiveByAttempt[i]
    const tier = classifyAttemptTiming(attempt.sample, childStats).tier
    let estimateMs: number | null = null
    if (tier !== 'tier1' && effectiveMs != null) {
      estimateMs = tier === 'tier2' ? Math.min(effectiveMs, winsorCeilingMs) : effectiveMs
    }
    return { attempt, effectiveMs, tier, estimateMs }
  })

  // Aggregate counts and affected sessions.
  let tier1Count = 0
  let tier2Count = 0
  let unresolvedCount = 0
  const affectedBySession = new Map<string, AffectedSession>()

  for (const item of classified) {
    if (item.tier === 'ok') continue
    if (item.tier === 'tier1') tier1Count++
    else tier2Count++

    // Unresolved = flagged with no review at all (omit/adjust/confirm all resolve).
    if (item.attempt.sample.timingReview == null) unresolvedCount++

    const { sessionId, completedAt } = item.attempt
    const flaggedSeconds = item.effectiveMs != null ? item.effectiveMs / 1000 : 0
    const existing = affectedBySession.get(sessionId)
    if (existing) {
      existing.flaggedCount++
      existing.worstSeconds = Math.max(existing.worstSeconds, flaggedSeconds)
    } else {
      affectedBySession.set(sessionId, {
        sessionId,
        completedAt,
        flaggedCount: 1,
        worstSeconds: flaggedSeconds,
      })
    }
  }

  const affectedSessions = [...affectedBySession.values()].sort(
    (a, b) => b.worstSeconds - a.worstSeconds
  )

  // Estimate samples: ok (raw) + Tier-2 (winsorized).
  const estimateSamples: number[] = []
  const okSamples: number[] = []
  let termSecondsSum = 0
  let termSampleCount = 0
  for (const item of classified) {
    if (item.estimateMs == null) continue
    estimateSamples.push(item.estimateMs)
    if (item.tier === 'ok') okSamples.push(item.estimateMs)
    if (item.attempt.termCount > 0) {
      termSecondsSum += item.estimateMs / 1000 / item.attempt.termCount
      termSampleCount++
    }
  }

  const sampleCount = estimateSamples.length
  const isDefault = sampleCount < MIN_CLEAN_SAMPLES

  const mean = (values: readonly number[]): number =>
    values.reduce((sum, v) => sum + v, 0) / values.length

  const avgSecondsPerProblem = isDefault
    ? clampSecondsPerProblem(defaultSeconds)
    : clampSecondsPerProblem(mean(estimateSamples) / 1000)

  const secondsPerTerm = termSampleCount > 0 ? termSecondsSum / termSampleCount : null

  // "If repaired" preview: ok-only mean. Only meaningful when Tier-2 exists and
  // enough ok samples remain to trust it.
  const secondsPerProblemExcludingFlagged =
    tier2Count > 0 && okSamples.length >= MIN_CLEAN_SAMPLES
      ? clampSecondsPerProblem(mean(okSamples) / 1000)
      : null

  return {
    avgSecondsPerProblem,
    secondsPerTerm,
    secondsPerProblemExcludingFlagged,
    sampleCount,
    isDefault,
    tier1Count,
    tier2Count,
    unresolvedCount,
    affectedSessions,
    windowSessionCount,
  }
}
