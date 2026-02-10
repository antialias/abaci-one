import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  useSessionTimeEstimate,
  calculateTimingStats,
  formatEstimatedTimeRemaining,
  calculateEstimatedTimeRemainingMs,
  getSessionTimeEstimate,
  MIN_SAMPLES_FOR_STATS,
  DEFAULT_TIME_PER_PROBLEM_MS,
} from '../useSessionTimeEstimate'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'

// ============================================================================
// Helpers
// ============================================================================

function makeResult(responseTimeMs: number, partNumber = 1): SlotResult {
  return {
    responseTimeMs,
    partNumber,
    isCorrect: true,
    userAnswer: 5,
    timestamp: new Date().toISOString(),
    skillId: 'test-skill',
    problemId: 'p1',
    terms: [1, 2],
  } as SlotResult
}

function makePart(type: SessionPart['type'], slotCount: number, partNumber = 1): SessionPart {
  return {
    type,
    partNumber,
    slots: Array.from({ length: slotCount }, (_, i) => ({
      slotIndex: i,
      skillId: 'test-skill',
      terms: [1, 2],
      purpose: 'focus',
    })),
  } as SessionPart
}

// ============================================================================
// calculateTimingStats
// ============================================================================

describe('calculateTimingStats', () => {
  it('returns zero stats for empty results', () => {
    const stats = calculateTimingStats([])
    expect(stats.mean).toBe(0)
    expect(stats.stdDev).toBe(0)
    expect(stats.count).toBe(0)
    expect(stats.hasEnoughData).toBe(false)
    expect(stats.threshold).toBe(60_000) // default threshold when not enough data
  })

  it('calculates mean and stdDev for sufficient data', () => {
    const results = [5000, 6000, 7000, 8000, 9000].map((ms) => makeResult(ms))
    const stats = calculateTimingStats(results)

    expect(stats.count).toBe(5)
    expect(stats.mean).toBe(7000)
    expect(stats.hasEnoughData).toBe(true)
    // stdDev for [5000,6000,7000,8000,9000] with sample variance (n-1)
    // variance = (4M + 1M + 0 + 1M + 4M) / 4 = 2500000, stdDev = ~1581.14
    expect(stats.stdDev).toBeCloseTo(1581.14, 0)
  })

  it('returns hasEnoughData=false when fewer than MIN_SAMPLES_FOR_STATS', () => {
    const results = [5000, 6000].map((ms) => makeResult(ms))
    const stats = calculateTimingStats(results)
    expect(stats.count).toBe(2)
    expect(stats.hasEnoughData).toBe(false)
  })

  it('calculates threshold clamped between 30s and 5min', () => {
    // Very fast responses => threshold should clamp to 30s minimum
    const fastResults = [1000, 1000, 1000, 1000, 1000].map((ms) => makeResult(ms))
    const fastStats = calculateTimingStats(fastResults)
    expect(fastStats.threshold).toBe(30_000)

    // Very slow responses => threshold should clamp to 5min maximum
    const slowResults = [290000, 300000, 280000, 310000, 295000].map((ms) => makeResult(ms))
    const slowStats = calculateTimingStats(slowResults)
    expect(slowStats.threshold).toBe(5 * 60 * 1000)
  })

  it('filters by part type when specified', () => {
    const parts = [makePart('abacus', 3, 1), makePart('visualization', 3, 2)]

    const results = [
      makeResult(5000, 1), // abacus
      makeResult(6000, 1), // abacus
      makeResult(7000, 1), // abacus
      makeResult(10000, 2), // visualization
      makeResult(12000, 2), // visualization
      makeResult(14000, 2), // visualization
    ]

    const abacusStats = calculateTimingStats(results, parts, 'abacus')
    expect(abacusStats.count).toBe(3)
    expect(abacusStats.mean).toBe(6000)

    const vizStats = calculateTimingStats(results, parts, 'visualization')
    expect(vizStats.count).toBe(3)
    expect(vizStats.mean).toBe(12000)
  })

  it('uses all results when no part type filter specified', () => {
    const results = [5000, 10000, 15000, 20000, 25000].map((ms) => makeResult(ms))
    const stats = calculateTimingStats(results)
    expect(stats.count).toBe(5)
    expect(stats.mean).toBe(15000)
  })

  it('handles single result (stdDev = 0)', () => {
    const results = [5000].map((ms) => makeResult(ms))
    const stats = calculateTimingStats(results)
    expect(stats.count).toBe(1)
    expect(stats.mean).toBe(5000)
    expect(stats.stdDev).toBe(0)
    expect(stats.hasEnoughData).toBe(false)
  })
})

// ============================================================================
// formatEstimatedTimeRemaining
// ============================================================================

describe('formatEstimatedTimeRemaining', () => {
  it('returns "< 1 min" for less than 30 seconds', () => {
    expect(formatEstimatedTimeRemaining(20_000)).toBe('< 1 min')
  })

  it('returns "~1 min" for values close to 1 minute', () => {
    expect(formatEstimatedTimeRemaining(60_000)).toBe('~1 min')
    expect(formatEstimatedTimeRemaining(80_000)).toBe('~1 min')
  })

  it('returns "~N min" for multi-minute values', () => {
    expect(formatEstimatedTimeRemaining(5 * 60_000)).toBe('~5 min')
    expect(formatEstimatedTimeRemaining(12 * 60_000)).toBe('~12 min')
  })

  it('returns "< 1 min" for zero', () => {
    expect(formatEstimatedTimeRemaining(0)).toBe('< 1 min')
  })
})

// ============================================================================
// calculateEstimatedTimeRemainingMs
// ============================================================================

describe('calculateEstimatedTimeRemainingMs', () => {
  it('uses mean time when enough data', () => {
    const stats = {
      mean: 8000,
      stdDev: 1000,
      count: 10,
      hasEnoughData: true,
      threshold: 30_000,
    }
    expect(calculateEstimatedTimeRemainingMs(stats, 5)).toBe(40_000) // 8000 * 5
  })

  it('uses default time per problem when insufficient data', () => {
    const stats = {
      mean: 8000,
      stdDev: 0,
      count: 2,
      hasEnoughData: false,
      threshold: 60_000,
    }
    expect(calculateEstimatedTimeRemainingMs(stats, 5)).toBe(DEFAULT_TIME_PER_PROBLEM_MS * 5)
  })

  it('returns 0 when no problems remaining', () => {
    const stats = {
      mean: 8000,
      stdDev: 1000,
      count: 10,
      hasEnoughData: true,
      threshold: 30_000,
    }
    expect(calculateEstimatedTimeRemainingMs(stats, 0)).toBe(0)
  })
})

// ============================================================================
// useSessionTimeEstimate (hook)
// ============================================================================

describe('useSessionTimeEstimate', () => {
  it('calculates total/completed/remaining problems correctly', () => {
    const parts = [makePart('abacus', 5, 1), makePart('visualization', 3, 2)]
    const results = [makeResult(5000, 1), makeResult(6000, 1)]

    const { result } = renderHook(() => useSessionTimeEstimate({ results, parts }))

    expect(result.current.totalProblems).toBe(8) // 5 + 3
    expect(result.current.completedProblems).toBe(2)
    expect(result.current.problemsRemaining).toBe(6)
  })

  it('returns default time estimate when not enough data', () => {
    const parts = [makePart('abacus', 10, 1)]
    const results = [makeResult(5000, 1), makeResult(6000, 1)]

    const { result } = renderHook(() => useSessionTimeEstimate({ results, parts }))

    expect(result.current.timingStats.hasEnoughData).toBe(false)
    // 8 problems remaining * 10000ms default
    expect(result.current.estimatedTimeRemainingMs).toBe(8 * DEFAULT_TIME_PER_PROBLEM_MS)
  })

  it('uses actual timing data when enough samples', () => {
    const parts = [makePart('abacus', 10, 1)]
    const results = [4000, 5000, 6000, 7000, 8000].map((ms) => makeResult(ms, 1))

    const { result } = renderHook(() => useSessionTimeEstimate({ results, parts }))

    expect(result.current.timingStats.hasEnoughData).toBe(true)
    expect(result.current.timingStats.mean).toBe(6000)
    // 5 problems remaining * 6000ms mean
    expect(result.current.estimatedTimeRemainingMs).toBe(30_000)
  })

  it('provides formatted time remaining', () => {
    const parts = [makePart('abacus', 10, 1)]
    const results = [4000, 5000, 6000, 7000, 8000].map((ms) => makeResult(ms, 1))

    const { result } = renderHook(() => useSessionTimeEstimate({ results, parts }))

    // 30000ms rounds to 1 min => "~1 min" (Math.round(30000/60000) = 1, not 0)
    expect(result.current.estimatedTimeRemainingFormatted).toBe('~1 min')
  })

  it('handles empty results', () => {
    const parts = [makePart('abacus', 5, 1)]

    const { result } = renderHook(() => useSessionTimeEstimate({ results: [], parts }))

    expect(result.current.completedProblems).toBe(0)
    expect(result.current.problemsRemaining).toBe(5)
    expect(result.current.estimatedTimeRemainingMs).toBe(5 * DEFAULT_TIME_PER_PROBLEM_MS)
  })

  it('handles empty parts', () => {
    const { result } = renderHook(() => useSessionTimeEstimate({ results: [], parts: [] }))

    expect(result.current.totalProblems).toBe(0)
    expect(result.current.problemsRemaining).toBe(0)
    expect(result.current.estimatedTimeRemainingMs).toBe(0)
  })

  it('passes currentPartType through to calculateTimingStats', () => {
    const parts = [makePart('abacus', 5, 1), makePart('visualization', 5, 2)]
    const results = [
      makeResult(3000, 1),
      makeResult(3000, 1),
      makeResult(3000, 1),
      makeResult(3000, 1),
      makeResult(3000, 1),
      makeResult(10000, 2),
      makeResult(10000, 2),
      makeResult(10000, 2),
      makeResult(10000, 2),
      makeResult(10000, 2),
    ]

    // Without filter: mean = 6500
    const { result: allResult } = renderHook(() => useSessionTimeEstimate({ results, parts }))
    expect(allResult.current.timingStats.mean).toBe(6500)

    // With abacus filter: mean = 3000
    const { result: abacusResult } = renderHook(() =>
      useSessionTimeEstimate({ results, parts, currentPartType: 'abacus' })
    )
    expect(abacusResult.current.timingStats.mean).toBe(3000)
  })
})

// ============================================================================
// getSessionTimeEstimate (standalone function)
// ============================================================================

describe('getSessionTimeEstimate', () => {
  it('returns the same values as the hook', () => {
    const parts = [makePart('abacus', 10, 1)]
    const results = [4000, 5000, 6000, 7000, 8000].map((ms) => makeResult(ms, 1))

    const estimate = getSessionTimeEstimate(results, parts)

    expect(estimate.totalProblems).toBe(10)
    expect(estimate.completedProblems).toBe(5)
    expect(estimate.problemsRemaining).toBe(5)
    expect(estimate.timingStats.mean).toBe(6000)
    expect(estimate.estimatedTimeRemainingMs).toBe(30_000)
  })
})
