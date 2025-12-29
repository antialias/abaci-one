'use client'

import { useMemo } from 'react'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'

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
function calculateStats(times: number[]): { mean: number; stdDev: number; count: number } {
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
  results: SlotResult[],
  parts?: SessionPart[],
  currentPartType?: SessionPart['type']
): TimingStats {
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

// ============================================================================
// Hook
// ============================================================================

export interface UseSessionTimeEstimateOptions {
  /** Session results array */
  results: SlotResult[]
  /** Session parts array */
  parts: SessionPart[]
  /** Optional: current part type to filter stats by (for more accurate current-part estimates) */
  currentPartType?: SessionPart['type']
}

/**
 * Hook to calculate session time estimates
 *
 * Provides timing statistics and estimated time remaining based on
 * the student's response times during the session.
 *
 * @example
 * ```tsx
 * const estimate = useSessionTimeEstimate({
 *   results: session.results,
 *   parts: session.parts,
 * })
 *
 * return <span>{estimate.estimatedTimeRemainingFormatted} left</span>
 * ```
 */
export function useSessionTimeEstimate({
  results,
  parts,
  currentPartType,
}: UseSessionTimeEstimateOptions): SessionTimeEstimate {
  return useMemo(() => {
    // Calculate total and completed problems
    const totalProblems = parts.reduce((sum, p) => sum + (p.slots?.length ?? 0), 0)
    const completedProblems = results.length
    const problemsRemaining = totalProblems - completedProblems

    // Calculate timing stats
    const timingStats = calculateTimingStats(results, parts, currentPartType)

    // Calculate estimated time remaining
    const estimatedTimeRemainingMs = calculateEstimatedTimeRemainingMs(
      timingStats,
      problemsRemaining
    )

    return {
      timingStats,
      problemsRemaining,
      totalProblems,
      completedProblems,
      estimatedTimeRemainingMs,
      estimatedTimeRemainingFormatted: formatEstimatedTimeRemaining(estimatedTimeRemainingMs),
    }
  }, [results, parts, currentPartType])
}

/**
 * Standalone function version for use outside React components
 *
 * Useful for computing time estimates from raw session data without hooks.
 */
export function getSessionTimeEstimate(
  results: SlotResult[],
  parts: SessionPart[],
  currentPartType?: SessionPart['type']
): SessionTimeEstimate {
  const totalProblems = parts.reduce((sum, p) => sum + (p.slots?.length ?? 0), 0)
  const completedProblems = results.length
  const problemsRemaining = totalProblems - completedProblems

  const timingStats = calculateTimingStats(results, parts, currentPartType)
  const estimatedTimeRemainingMs = calculateEstimatedTimeRemainingMs(timingStats, problemsRemaining)

  return {
    timingStats,
    problemsRemaining,
    totalProblems,
    completedProblems,
    estimatedTimeRemainingMs,
    estimatedTimeRemainingFormatted: formatEstimatedTimeRemaining(estimatedTimeRemainingMs),
  }
}
