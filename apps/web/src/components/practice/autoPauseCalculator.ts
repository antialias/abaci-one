/**
 * Auto-pause threshold calculation utilities
 *
 * Calculates when to auto-pause based on the student's response times.
 * Uses mean + 2*stdDev with clamping between 30s and 5 minutes.
 */

import type { SlotResult } from '@/db/schema/session-plans'
import type { ProgressiveAssistanceTimingConfig } from '@/constants/helpTiming'

// ============================================================================
// Constants
// ============================================================================

/** Default timeout when not enough samples for statistics (5 minutes) */
export const DEFAULT_PAUSE_TIMEOUT_MS = 5 * 60 * 1000

/** Minimum problems needed for statistical calculation */
export const MIN_SAMPLES_FOR_STATISTICS = 5

/** Minimum clamp for the auto-pause threshold (30 seconds) */
export const MIN_PAUSE_THRESHOLD_MS = 30_000

/** Maximum clamp for the auto-pause threshold (5 minutes) */
export const MAX_PAUSE_THRESHOLD_MS = DEFAULT_PAUSE_TIMEOUT_MS

// ============================================================================
// Types
// ============================================================================

/**
 * Auto-pause statistics for display and debugging
 */
export interface AutoPauseStats {
  /** Mean response time in milliseconds */
  meanMs: number
  /** Standard deviation of response times in milliseconds */
  stdDevMs: number
  /** Calculated threshold (mean + 2*stdDev) in milliseconds */
  thresholdMs: number
  /** Number of samples used to calculate stats */
  sampleCount: number
  /** Whether statistical calculation was used (vs default timeout) */
  usedStatistics: boolean
  /** Mean response time per complexity-cost unit (ms/cost), if complexity scaling was used */
  meanPerUnitMs?: number
  /** Complexity cost of the current problem, if available */
  currentProblemCost?: number
  /** True when complexity cost data is missing (data quality issue) */
  complexityCostMissing?: boolean
}

/**
 * Information about why a session was paused
 */
export interface PauseInfo {
  /** When the pause occurred */
  pausedAt: Date
  /** Why the session was paused */
  reason: 'manual' | 'auto-timeout' | 'teacher'
  /** Auto-pause statistics (only present for auto-timeout) */
  autoPauseStats?: AutoPauseStats
  /** Teacher's custom message (only present for teacher-initiated pause) */
  teacherMessage?: string
}

/**
 * Response time statistics
 */
export interface ResponseTimeStats {
  /** Mean response time in milliseconds */
  mean: number
  /** Standard deviation of response times in milliseconds */
  stdDev: number
  /** Number of samples */
  count: number
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Calculate mean and standard deviation of response times
 */
export function calculateResponseTimeStats(results: SlotResult[]): ResponseTimeStats {
  if (results.length === 0) {
    return { mean: 0, stdDev: 0, count: 0 }
  }

  const times = results.map((r) => r.responseTimeMs)
  const count = times.length
  const mean = times.reduce((sum, t) => sum + t, 0) / count

  if (count < 2) {
    return { mean, stdDev: 0, count }
  }

  const squaredDiffs = times.map((t) => (t - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (count - 1) // Sample std dev
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev, count }
}

/**
 * Calculate the auto-pause threshold and full stats for display.
 *
 * @returns threshold in ms and stats for debugging/display
 */
export function calculateAutoPauseInfo(results: SlotResult[]): {
  threshold: number
  stats: AutoPauseStats
} {
  const { mean, stdDev, count } = calculateResponseTimeStats(results)
  const usedStatistics = count >= MIN_SAMPLES_FOR_STATISTICS

  let threshold: number
  if (usedStatistics) {
    // Use mean + 2 standard deviations
    threshold = mean + 2 * stdDev
    // Clamp between 30 seconds and 5 minutes
    threshold = Math.max(MIN_PAUSE_THRESHOLD_MS, Math.min(threshold, MAX_PAUSE_THRESHOLD_MS))
  } else {
    threshold = DEFAULT_PAUSE_TIMEOUT_MS
  }

  return {
    threshold,
    stats: {
      meanMs: mean,
      stdDevMs: stdDev,
      thresholdMs: threshold,
      sampleCount: count,
      usedStatistics,
    },
  }
}

/**
 * Get a human-readable explanation of how the auto-pause threshold was calculated.
 * Used in the SessionOverview component to explain the timing.
 */
export function getAutoPauseExplanation(stats: AutoPauseStats): string {
  if (!stats.usedStatistics) {
    return `Default timeout (${formatMs(stats.thresholdMs)}) - need ${MIN_SAMPLES_FOR_STATISTICS}+ problems for statistical calculation`
  }

  const rawThreshold = stats.meanMs + 2 * stats.stdDevMs
  const wasClamped = rawThreshold < MIN_PAUSE_THRESHOLD_MS || rawThreshold > MAX_PAUSE_THRESHOLD_MS

  let explanation = `mean (${formatMs(stats.meanMs)}) + 2×stdDev (${formatMs(stats.stdDevMs)}) = ${formatMs(rawThreshold)}`

  if (wasClamped) {
    explanation += ` → clamped to ${formatMs(stats.thresholdMs)}`
  }

  return explanation
}

// ============================================================================
// Progressive Assistance Thresholds
// ============================================================================

/**
 * Thresholds for progressive assistance escalation.
 * All values in milliseconds.
 */
export interface ProgressiveThresholds {
  /** When to show encouragement text (based on mean response time) */
  encouragementMs: number
  /** When to offer help button (based on mean + 1σ) */
  helpOfferMs: number
  /** When to auto-pause (based on mean + 2σ) */
  autoPauseMs: number
}

/**
 * Calculate progressive assistance thresholds from historical response times.
 *
 * Uses the same statistical approach as auto-pause but with three escalation levels:
 * - Encouragement: mean response time (clamped)
 * - Help offer: mean + 1σ (clamped)
 * - Auto-pause: mean + 2σ (clamped) — same formula as existing auto-pause
 */
export function calculateProgressiveThresholds(
  results: SlotResult[],
  timing: ProgressiveAssistanceTimingConfig
): ProgressiveThresholds {
  const { mean, stdDev, count } = calculateResponseTimeStats(results)
  const hasSufficientData = count >= MIN_SAMPLES_FOR_STATISTICS

  if (!hasSufficientData) {
    return {
      encouragementMs: timing.defaultEncouragementMs,
      helpOfferMs: timing.defaultHelpOfferMs,
      autoPauseMs: DEFAULT_PAUSE_TIMEOUT_MS,
    }
  }

  return {
    encouragementMs: clamp(mean, timing.minEncouragementMs, timing.maxEncouragementMs),
    helpOfferMs: clamp(mean + stdDev, timing.minHelpOfferMs, timing.maxHelpOfferMs),
    autoPauseMs: clamp(mean + 2 * stdDev, timing.minAutoPauseMs, timing.maxAutoPauseMs),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

// ============================================================================
// Complexity-Scaled Thresholds
// ============================================================================

/**
 * Normalized response time statistics (per complexity-cost unit)
 */
export interface NormalizedResponseTimeStats {
  /** Mean response time per unit of complexity cost (ms/cost) */
  meanPerUnit: number
  /** Standard deviation per unit of complexity cost (ms/cost) */
  stdDevPerUnit: number
  /** Number of results with valid complexity costs used */
  count: number
  /** Number of results skipped due to missing or zero complexity cost */
  skippedCount: number
}

/**
 * Extract the totalComplexityCost from a problem's generation trace.
 * Returns the cost if present and > 0, otherwise null.
 *
 * Note: basic skills (directAddition, directSubtraction, etc.) have base
 * complexity 0, so their totalComplexityCost is legitimately 0/undefined.
 * This is NOT a data quality issue — use `hasGenerationTrace` to distinguish.
 */
export function getComplexityCost(
  problem: { generationTrace?: { totalComplexityCost?: number } } | null | undefined
): number | null {
  const cost = problem?.generationTrace?.totalComplexityCost
  if (cost != null && cost > 0) return cost
  return null
}

/**
 * Calculate normalized response time statistics by dividing each response time
 * by its problem's complexity cost. Results without valid complexity cost are skipped.
 */
export function calculateNormalizedResponseTimeStats(
  results: SlotResult[]
): NormalizedResponseTimeStats {
  const normalized: number[] = []
  let skippedCount = 0

  for (const r of results) {
    const cost = getComplexityCost(r.problem)
    if (cost === null) {
      skippedCount++
      continue
    }
    normalized.push(r.responseTimeMs / cost)
  }

  if (normalized.length === 0) {
    return { meanPerUnit: 0, stdDevPerUnit: 0, count: 0, skippedCount }
  }

  const count = normalized.length
  const meanPerUnit = normalized.reduce((sum, v) => sum + v, 0) / count

  if (count < 2) {
    return { meanPerUnit, stdDevPerUnit: 0, count, skippedCount }
  }

  const squaredDiffs = normalized.map((v) => (v - meanPerUnit) ** 2)
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (count - 1)
  const stdDevPerUnit = Math.sqrt(variance)

  return { meanPerUnit, stdDevPerUnit, count, skippedCount }
}

/**
 * Calculate progressive assistance thresholds scaled by the current problem's
 * complexity cost. Harder problems get proportionally more time.
 *
 * When currentProblemCost is null (missing trace/data), returns flat 5-minute defaults.
 * When fewer than MIN_SAMPLES_FOR_STATISTICS results have valid costs, returns timing defaults.
 */
export function calculateComplexityScaledThresholds(
  results: SlotResult[],
  timing: ProgressiveAssistanceTimingConfig,
  currentProblemCost: number | null
): ProgressiveThresholds {
  // Missing cost → flat defaults (data quality issue — no generation trace)
  if (currentProblemCost === null) {
    return {
      encouragementMs: DEFAULT_PAUSE_TIMEOUT_MS,
      helpOfferMs: DEFAULT_PAUSE_TIMEOUT_MS,
      autoPauseMs: DEFAULT_PAUSE_TIMEOUT_MS,
    }
  }

  const { meanPerUnit, stdDevPerUnit, count } = calculateNormalizedResponseTimeStats(results)

  // Not enough data with valid costs → timing defaults (same as flat path)
  if (count < MIN_SAMPLES_FOR_STATISTICS) {
    return {
      encouragementMs: timing.defaultEncouragementMs,
      helpOfferMs: timing.defaultHelpOfferMs,
      autoPauseMs: DEFAULT_PAUSE_TIMEOUT_MS,
    }
  }

  // Scale normalized stats back up by current problem's cost
  return {
    encouragementMs: clamp(
      meanPerUnit * currentProblemCost,
      timing.minEncouragementMs,
      timing.maxEncouragementMs
    ),
    helpOfferMs: clamp(
      (meanPerUnit + stdDevPerUnit) * currentProblemCost,
      timing.minHelpOfferMs,
      timing.maxHelpOfferMs
    ),
    autoPauseMs: clamp(
      (meanPerUnit + 2 * stdDevPerUnit) * currentProblemCost,
      timing.minAutoPauseMs,
      timing.maxAutoPauseMs
    ),
  }
}

/**
 * Format milliseconds as a human-readable time string
 */
export function formatMs(ms: number): string {
  if (ms >= 60_000) {
    const minutes = ms / 60_000
    return `${minutes.toFixed(1)}m`
  }
  const seconds = ms / 1000
  return `${seconds.toFixed(1)}s`
}
