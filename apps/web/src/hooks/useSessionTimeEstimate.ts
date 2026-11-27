'use client'

import { useMemo } from 'react'
import { countedTries } from '@/db/schema/session-plan-helpers'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { reportProgress } from '@/lib/curriculum/observer-report'
import type { SessionReport } from '@/lib/curriculum/session-report'

// ============================================================================
// Constants
// ============================================================================

/** Minimum samples needed for reliable statistical estimates */
export const MIN_SAMPLES_FOR_STATS = 5

/** Default time per problem in ms when not enough data (10 seconds) */
export const DEFAULT_TIME_PER_PROBLEM_MS = 10_000

// ============================================================================
// Types
// ============================================================================

export interface TimingStats {
  /** Mean response time in milliseconds */
  mean: number
  /** Standard deviation of response times */
  stdDev: number
  /** Number of samples used */
  count: number
  /** Whether we have enough data for reliable estimates */
  hasEnoughData: boolean
  /** Auto-pause threshold in milliseconds */
  threshold: number
}

export interface SessionTimeEstimate {
  /** Timing statistics from results */
  timingStats: TimingStats
  /** Number of problems remaining */
  problemsRemaining: number
  /** Total problems in session */
  totalProblems: number
  /** Number of completed problems */
  completedProblems: number
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemainingMs: number
  /** Formatted estimated time remaining (e.g., "~5 min") */
  estimatedTimeRemainingFormatted: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate mean and standard deviation from an array of numbers
 */
function calculateStats(times: number[]): {
  mean: number
  stdDev: number
  count: number
} {
  const count = times.length
  if (count === 0) return { mean: 0, stdDev: 0, count: 0 }

  const mean = times.reduce((sum, t) => sum + t, 0) / count

  if (count < 2) return { mean, stdDev: 0, count }

  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / (count - 1)
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev, count }
}

/**
 * Calculate timing stats from session results
 *
 * Can optionally filter by part type for more accurate estimates
 * when the student is working on a specific part.
 */
export function calculateTimingStats(
  allResults: SlotResult[],
  parts?: SessionPart[],
  currentPartType?: SessionPart['type']
): TimingStats {
  // Practice-only do-overs are not timing evidence
  const results = countedTries(allResults)
  let times: number[]

  if (currentPartType && parts) {
    // Filter results by part type for current-part-specific estimates
    times = results
      .filter((r) => {
        const partIndex = parts.findIndex((p) => p.partNumber === r.partNumber)
        return partIndex >= 0 && parts[partIndex].type === currentPartType
      })
      .map((r) => r.responseTimeMs)
  } else {
    // Use all results
    times = results.map((r) => r.responseTimeMs)
  }

  return timingStatsOf(times)
}

/** Mean, spread and auto-pause threshold of a list of response times. */
function timingStatsOf(times: number[]): TimingStats {
  const stats = calculateStats(times)
  const hasEnoughData = stats.count >= MIN_SAMPLES_FOR_STATS

  // Calculate auto-pause threshold: mean + 2*stdDev, clamped between 30s and 5min
  const threshold = hasEnoughData
    ? Math.max(30_000, Math.min(stats.mean + 2 * stats.stdDev, 5 * 60 * 1000))
    : 60_000 // Default 1 minute when not enough data

  return {
    ...stats,
    hasEnoughData,
    threshold,
  }
}

/**
 * Format estimated time remaining as human-readable string
 */
export function formatEstimatedTimeRemaining(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return '< 1 min'
  if (minutes === 1) return '~1 min'
  return `~${minutes} min`
}

/**
 * Calculate estimated time remaining in milliseconds
 */
export function calculateEstimatedTimeRemainingMs(
  timingStats: TimingStats,
  problemsRemaining: number
): number {
  const timePerProblem = timingStats.hasEnoughData ? timingStats.mean : DEFAULT_TIME_PER_PROBLEM_MS

  return timePerProblem * problemsRemaining
}

/**
 * Timing stats from the session report's tries (Phase 5c): every try that is
 * not practice-only (`isCountedTry`; voided tries are never listed), by its
 * effective time (`effectiveMs`, pauses taken out). With `currentPartType`,
 * only the tries of parts of that type.
 */
export function reportTimingStats(
  report: Pick<SessionReport, 'tries' | 'parts'>,
  currentPartType?: SessionPart['type']
): TimingStats {
  const times: number[] = []
  for (const row of report.tries) {
    if (row.practiceOnly || row.effectiveMs == null) continue
    if (currentPartType && report.parts[row.partIndex]?.type !== currentPartType) continue
    times.push(row.effectiveMs)
  }
  return timingStatsOf(times)
}

// ============================================================================
// Hook
// ============================================================================

export interface UseSessionTimeEstimateOptions {
  /** The session report: position (problems done of planned) and the tries' times */
  report: SessionReport | null | undefined
  /** Optional: current part type to filter stats by (for more accurate current-part estimates) */
  currentPartType?: SessionPart['type']
}

const EMPTY_REPORT_ESTIMATE: SessionTimeEstimate = {
  timingStats: timingStatsOf([]),
  problemsRemaining: 0,
  totalProblems: 0,
  completedProblems: 0,
  estimatedTimeRemainingMs: 0,
  estimatedTimeRemainingFormatted: formatEstimatedTimeRemaining(0),
}

/**
 * Hook to calculate session time estimates
 *
 * Problems done and planned are the report's (`reportProgress`: the live
 * position, else the totals); the time per problem is the student's own
 * effective response times in this session (`reportTimingStats`).
 *
 * @example
 * ```tsx
 * const { data: report } = useSessionReport(source)
 * const estimate = useSessionTimeEstimate({ report })
 *
 * return <span>{estimate.estimatedTimeRemainingFormatted} left</span>
 * ```
 */
export function useSessionTimeEstimate({
  report,
  currentPartType,
}: UseSessionTimeEstimateOptions): SessionTimeEstimate {
  return useMemo(() => getSessionTimeEstimate(report, currentPartType), [report, currentPartType])
}

/**
 * Standalone function version for use outside React components
 *
 * No report yet (still loading): nothing done, nothing planned, no estimate.
 */
export function getSessionTimeEstimate(
  report: SessionReport | null | undefined,
  currentPartType?: SessionPart['type']
): SessionTimeEstimate {
  if (!report) return EMPTY_REPORT_ESTIMATE
  const { done, total } = reportProgress(report)
  const problemsRemaining = Math.max(0, total - done)

  const timingStats = reportTimingStats(report, currentPartType)
  const estimatedTimeRemainingMs = calculateEstimatedTimeRemainingMs(timingStats, problemsRemaining)

  return {
    timingStats,
    problemsRemaining,
    totalProblems: total,
    completedProblems: done,
    estimatedTimeRemainingMs,
    estimatedTimeRemainingFormatted: formatEstimatedTimeRemaining(estimatedTimeRemainingMs),
  }
}
