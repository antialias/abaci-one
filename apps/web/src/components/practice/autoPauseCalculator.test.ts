/**
 * Tests for auto-pause threshold calculation utilities
 */
import { describe, expect, it } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import {
  calculateResponseTimeStats,
  calculateAutoPauseInfo,
  calculateComplexityScaledThresholds,
  calculateNormalizedResponseTimeStats,
  getAutoPauseExplanation,
  getComplexityCost,
  formatMs,
  DEFAULT_PAUSE_TIMEOUT_MS,
  MIN_SAMPLES_FOR_STATISTICS,
  MIN_PAUSE_THRESHOLD_MS,
  MAX_PAUSE_THRESHOLD_MS,
} from './autoPauseCalculator'
import type { ProgressiveAssistanceTimingConfig } from '@/constants/helpTiming'

// Mirror production timing values for tests (avoids runtime import issues)
const PRODUCTION_TIMING: ProgressiveAssistanceTimingConfig = {
  defaultEncouragementMs: 15_000,
  defaultHelpOfferMs: 30_000,
  minEncouragementMs: 8_000,
  maxEncouragementMs: 45_000,
  minHelpOfferMs: 15_000,
  maxHelpOfferMs: 90_000,
  minAutoPauseMs: 30_000,
  maxAutoPauseMs: 300_000,
  wrongAnswerThreshold: 3,
  moveOnGraceMs: 12_000,
}

// Helper to create mock SlotResult with only responseTimeMs
function mockResult(responseTimeMs: number): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [1, 2], answer: 3, skillsRequired: [] },
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
  }
}

// Helper to create mock SlotResult with a complexity cost in the generation trace
function mockResultWithCost(responseTimeMs: number, totalComplexityCost: number): SlotResult {
  return {
    ...mockResult(responseTimeMs),
    problem: {
      terms: [1, 2],
      answer: 3,
      skillsRequired: [],
      generationTrace: {
        terms: [1, 2],
        answer: 3,
        steps: [],
        allSkills: [],
        totalComplexityCost,
      },
    },
  }
}

describe('autoPauseCalculator', () => {
  describe('formatMs', () => {
    it('formats milliseconds less than 60s as seconds', () => {
      expect(formatMs(1000)).toBe('1.0s')
      expect(formatMs(1500)).toBe('1.5s')
      expect(formatMs(30000)).toBe('30.0s')
      expect(formatMs(59999)).toBe('60.0s') // Just under 60s
    })

    it('formats milliseconds >= 60s as minutes', () => {
      expect(formatMs(60000)).toBe('1.0m')
      expect(formatMs(90000)).toBe('1.5m')
      expect(formatMs(120000)).toBe('2.0m')
      expect(formatMs(300000)).toBe('5.0m')
    })

    it('handles edge cases', () => {
      expect(formatMs(0)).toBe('0.0s')
      expect(formatMs(100)).toBe('0.1s')
      expect(formatMs(59999)).toBe('60.0s')
      expect(formatMs(60000)).toBe('1.0m')
    })
  })

  describe('calculateResponseTimeStats', () => {
    it('returns zeros for empty array', () => {
      const stats = calculateResponseTimeStats([])
      expect(stats).toEqual({ mean: 0, stdDev: 0, count: 0 })
    })

    it('calculates mean correctly for single sample', () => {
      const stats = calculateResponseTimeStats([mockResult(5000)])
      expect(stats.mean).toBe(5000)
      expect(stats.stdDev).toBe(0)
      expect(stats.count).toBe(1)
    })

    it('calculates mean correctly for multiple samples', () => {
      const results = [
        mockResult(1000),
        mockResult(2000),
        mockResult(3000),
        mockResult(4000),
        mockResult(5000),
      ]
      const stats = calculateResponseTimeStats(results)
      expect(stats.mean).toBe(3000) // (1+2+3+4+5)/5 = 3
      expect(stats.count).toBe(5)
    })

    it('calculates sample standard deviation correctly', () => {
      // Values: 2000, 4000, 4000, 4000, 5000, 5000, 7000, 9000
      // Mean: 5000
      // Sample variance: sum of (x-mean)^2 / (n-1)
      const results = [
        mockResult(2000),
        mockResult(4000),
        mockResult(4000),
        mockResult(4000),
        mockResult(5000),
        mockResult(5000),
        mockResult(7000),
        mockResult(9000),
      ]
      const stats = calculateResponseTimeStats(results)
      expect(stats.mean).toBe(5000)
      expect(stats.count).toBe(8)
      // Expected stdDev: sqrt(32000000/7) ≈ 2138.09
      expect(stats.stdDev).toBeCloseTo(2138.09, 0)
    })

    it('uses sample standard deviation (n-1 denominator)', () => {
      // Two samples: 0, 10000 - mean = 5000
      // Sample variance = (5000^2 + 5000^2) / 1 = 50000000
      // Sample stdDev = sqrt(50000000) ≈ 7071.07
      const results = [mockResult(0), mockResult(10000)]
      const stats = calculateResponseTimeStats(results)
      expect(stats.mean).toBe(5000)
      expect(stats.stdDev).toBeCloseTo(7071.07, 0)
    })
  })

  describe('calculateAutoPauseInfo', () => {
    it('uses default timeout with fewer than 5 samples', () => {
      const results = [mockResult(3000), mockResult(4000), mockResult(5000), mockResult(6000)]
      const { threshold, stats } = calculateAutoPauseInfo(results)

      expect(threshold).toBe(DEFAULT_PAUSE_TIMEOUT_MS)
      expect(stats.usedStatistics).toBe(false)
      expect(stats.sampleCount).toBe(4)
    })

    it('uses default timeout with 0 samples', () => {
      const { threshold, stats } = calculateAutoPauseInfo([])

      expect(threshold).toBe(DEFAULT_PAUSE_TIMEOUT_MS)
      expect(stats.usedStatistics).toBe(false)
      expect(stats.sampleCount).toBe(0)
    })

    it('uses statistical calculation with 5+ samples', () => {
      const results = [
        mockResult(3000),
        mockResult(4000),
        mockResult(5000),
        mockResult(6000),
        mockResult(7000),
      ]
      const { stats } = calculateAutoPauseInfo(results)

      expect(stats.usedStatistics).toBe(true)
      expect(stats.sampleCount).toBe(5)
    })

    it('calculates threshold as mean + 2*stdDev', () => {
      // Create samples where we know the expected stats
      // All same value = stdDev of 0, threshold = mean
      const results = Array(10)
        .fill(null)
        .map(() => mockResult(60000)) // All 60s

      const { threshold, stats } = calculateAutoPauseInfo(results)

      expect(stats.meanMs).toBe(60000)
      expect(stats.stdDevMs).toBe(0)
      // 60000 + 2*0 = 60000, but clamped to max 30s min
      expect(threshold).toBe(60000)
    })

    it('clamps threshold to minimum 30 seconds', () => {
      // Very fast response times
      const results = Array(10)
        .fill(null)
        .map(() => mockResult(1000)) // All 1s

      const { threshold, stats } = calculateAutoPauseInfo(results)

      expect(stats.meanMs).toBe(1000)
      expect(stats.stdDevMs).toBe(0)
      // 1000 + 2*0 = 1000, clamped to 30000
      expect(threshold).toBe(MIN_PAUSE_THRESHOLD_MS)
    })

    it('clamps threshold to maximum 5 minutes', () => {
      // Very slow and variable response times
      const results = [
        mockResult(200000), // 200s
        mockResult(250000), // 250s
        mockResult(300000), // 300s
        mockResult(350000), // 350s
        mockResult(400000), // 400s
      ]

      const { threshold, stats } = calculateAutoPauseInfo(results)

      expect(stats.usedStatistics).toBe(true)
      // Raw threshold would be way over 5 min
      expect(threshold).toBe(MAX_PAUSE_THRESHOLD_MS)
    })

    it('returns threshold within valid range for typical response times', () => {
      // Simulate typical student: 3-8 second responses
      const results = [
        mockResult(3000),
        mockResult(4500),
        mockResult(5000),
        mockResult(6000),
        mockResult(8000),
        mockResult(4000),
        mockResult(5500),
      ]

      const { threshold, stats } = calculateAutoPauseInfo(results)

      expect(stats.usedStatistics).toBe(true)
      expect(threshold).toBeGreaterThanOrEqual(MIN_PAUSE_THRESHOLD_MS)
      expect(threshold).toBeLessThanOrEqual(MAX_PAUSE_THRESHOLD_MS)
    })
  })

  describe('getAutoPauseExplanation', () => {
    it('explains default timeout when statistics not used', () => {
      const stats = {
        meanMs: 5000,
        stdDevMs: 1000,
        thresholdMs: DEFAULT_PAUSE_TIMEOUT_MS,
        sampleCount: 3,
        usedStatistics: false,
      }

      const explanation = getAutoPauseExplanation(stats)

      expect(explanation).toContain('Default timeout')
      expect(explanation).toContain('5.0m')
      expect(explanation).toContain(`${MIN_SAMPLES_FOR_STATISTICS}+`)
    })

    it('explains statistical calculation without clamping', () => {
      const stats = {
        meanMs: 30000,
        stdDevMs: 10000,
        thresholdMs: 50000, // mean + 2*stdDev = 50000
        sampleCount: 10,
        usedStatistics: true,
      }

      const explanation = getAutoPauseExplanation(stats)

      expect(explanation).toContain('mean (30.0s)')
      expect(explanation).toContain('2×stdDev (10.0s)')
      expect(explanation).toContain('50.0s')
      expect(explanation).not.toContain('clamped')
    })

    it('explains when threshold is clamped to minimum', () => {
      const stats = {
        meanMs: 5000,
        stdDevMs: 1000,
        thresholdMs: MIN_PAUSE_THRESHOLD_MS, // Clamped to 30s
        sampleCount: 10,
        usedStatistics: true,
      }

      const explanation = getAutoPauseExplanation(stats)

      expect(explanation).toContain('clamped')
      expect(explanation).toContain('30.0s')
    })

    it('explains when threshold is clamped to maximum', () => {
      // Raw threshold: 250000 + 2*100000 = 450000ms (7.5min) > 5min max
      const stats = {
        meanMs: 250000,
        stdDevMs: 100000,
        thresholdMs: MAX_PAUSE_THRESHOLD_MS, // Clamped to 5m
        sampleCount: 10,
        usedStatistics: true,
      }

      const explanation = getAutoPauseExplanation(stats)

      expect(explanation).toContain('clamped')
      expect(explanation).toContain('5.0m')
    })
  })

  describe('constants', () => {
    it('has correct default values', () => {
      expect(DEFAULT_PAUSE_TIMEOUT_MS).toBe(5 * 60 * 1000) // 5 minutes
      expect(MIN_SAMPLES_FOR_STATISTICS).toBe(5)
      expect(MIN_PAUSE_THRESHOLD_MS).toBe(30_000) // 30 seconds
      expect(MAX_PAUSE_THRESHOLD_MS).toBe(DEFAULT_PAUSE_TIMEOUT_MS) // 5 minutes
    })
  })

  // ==========================================================================
  // Complexity-Scaled Threshold Tests
  // ==========================================================================

  describe('getComplexityCost', () => {
    it('returns cost when generationTrace has positive totalComplexityCost', () => {
      expect(getComplexityCost({ generationTrace: { totalComplexityCost: 42 } })).toBe(42)
    })

    it('returns null when generationTrace is missing', () => {
      expect(getComplexityCost({})).toBeNull()
      expect(getComplexityCost({ generationTrace: undefined })).toBeNull()
    })

    it('returns null when totalComplexityCost is undefined', () => {
      expect(getComplexityCost({ generationTrace: {} })).toBeNull()
    })

    it('returns null when totalComplexityCost is 0', () => {
      expect(getComplexityCost({ generationTrace: { totalComplexityCost: 0 } })).toBeNull()
    })

    it('returns null for null/undefined problem', () => {
      expect(getComplexityCost(null)).toBeNull()
      expect(getComplexityCost(undefined)).toBeNull()
    })
  })

  describe('calculateNormalizedResponseTimeStats', () => {
    it('returns zeros for empty array', () => {
      const stats = calculateNormalizedResponseTimeStats([])
      expect(stats).toEqual({ meanPerUnit: 0, stdDevPerUnit: 0, count: 0, skippedCount: 0 })
    })

    it('normalizes response times by complexity cost', () => {
      // All same rate: 1000ms per unit of cost
      const results = [
        mockResultWithCost(2000, 2), // 1000 ms/cost
        mockResultWithCost(3000, 3), // 1000 ms/cost
        mockResultWithCost(5000, 5), // 1000 ms/cost
        mockResultWithCost(4000, 4), // 1000 ms/cost
        mockResultWithCost(1000, 1), // 1000 ms/cost
      ]
      const stats = calculateNormalizedResponseTimeStats(results)
      expect(stats.meanPerUnit).toBe(1000)
      expect(stats.stdDevPerUnit).toBe(0)
      expect(stats.count).toBe(5)
      expect(stats.skippedCount).toBe(0)
    })

    it('skips results without complexity cost', () => {
      const results = [
        mockResultWithCost(2000, 2), // 1000 ms/cost — included
        mockResult(5000), // no cost — skipped
        mockResultWithCost(6000, 3), // 2000 ms/cost — included
      ]
      const stats = calculateNormalizedResponseTimeStats(results)
      expect(stats.count).toBe(2)
      expect(stats.skippedCount).toBe(1)
      expect(stats.meanPerUnit).toBe(1500) // (1000 + 2000) / 2
    })

    it('returns count 0 when all results are missing cost', () => {
      const results = [mockResult(1000), mockResult(2000), mockResult(3000)]
      const stats = calculateNormalizedResponseTimeStats(results)
      expect(stats.count).toBe(0)
      expect(stats.skippedCount).toBe(3)
      expect(stats.meanPerUnit).toBe(0)
    })

    it('handles single result with cost', () => {
      const results = [mockResultWithCost(6000, 3)]
      const stats = calculateNormalizedResponseTimeStats(results)
      expect(stats.count).toBe(1)
      expect(stats.meanPerUnit).toBe(2000) // 6000/3
      expect(stats.stdDevPerUnit).toBe(0) // single sample, no stdDev
    })
  })

  describe('calculateComplexityScaledThresholds', () => {
    const timing = PRODUCTION_TIMING

    it('returns flat 5-min defaults when currentProblemCost is null', () => {
      const results = Array(10)
        .fill(null)
        .map(() => mockResultWithCost(5000, 5))
      const thresholds = calculateComplexityScaledThresholds(results, timing, null)

      expect(thresholds.encouragementMs).toBe(DEFAULT_PAUSE_TIMEOUT_MS)
      expect(thresholds.helpOfferMs).toBe(DEFAULT_PAUSE_TIMEOUT_MS)
      expect(thresholds.autoPauseMs).toBe(DEFAULT_PAUSE_TIMEOUT_MS)
    })

    it('returns timing defaults when insufficient valid data', () => {
      // Only 3 results with cost (< MIN_SAMPLES_FOR_STATISTICS)
      const results = [
        mockResultWithCost(3000, 3),
        mockResultWithCost(4000, 4),
        mockResultWithCost(5000, 5),
      ]
      const thresholds = calculateComplexityScaledThresholds(results, timing, 10)

      expect(thresholds.encouragementMs).toBe(timing.defaultEncouragementMs)
      expect(thresholds.helpOfferMs).toBe(timing.defaultHelpOfferMs)
      expect(thresholds.autoPauseMs).toBe(DEFAULT_PAUSE_TIMEOUT_MS)
    })

    it('scales thresholds proportionally to current problem cost', () => {
      // Uniform rate: 1000ms per unit of cost, stdDev = 0
      const results = [
        mockResultWithCost(2000, 2),
        mockResultWithCost(3000, 3),
        mockResultWithCost(5000, 5),
        mockResultWithCost(4000, 4),
        mockResultWithCost(1000, 1),
      ]

      const lowCost = calculateComplexityScaledThresholds(results, timing, 2)
      const highCost = calculateComplexityScaledThresholds(results, timing, 10)

      // With stdDev=0: encouragement = mean*cost = 1000*cost
      // Low cost (2): 1000*2 = 2000 → clamped to minEncouragementMs (8000)
      expect(lowCost.encouragementMs).toBe(timing.minEncouragementMs)

      // High cost (10): 1000*10 = 10000 → within [8000, 45000]
      expect(highCost.encouragementMs).toBe(10000)

      // autoPause = (mean + 2σ)*cost = 1000*cost (σ=0)
      // Low: 2000 → clamped to 30s
      expect(lowCost.autoPauseMs).toBe(MIN_PAUSE_THRESHOLD_MS)
      // High: 10000 → clamped to 30s
      expect(highCost.autoPauseMs).toBe(MIN_PAUSE_THRESHOLD_MS)
    })

    it('harder problems get longer thresholds', () => {
      // Rate: ~2000ms/cost with some variance
      const results = [
        mockResultWithCost(4000, 2), // 2000 ms/cost
        mockResultWithCost(6000, 3), // 2000 ms/cost
        mockResultWithCost(10000, 5), // 2000 ms/cost
        mockResultWithCost(8000, 4), // 2000 ms/cost
        mockResultWithCost(2000, 1), // 2000 ms/cost
      ]

      const easy = calculateComplexityScaledThresholds(results, timing, 3)
      const hard = calculateComplexityScaledThresholds(results, timing, 15)

      // encouragement: mean*cost = 2000*cost
      // easy: 2000*3 = 6000 → clamped to minEncouragementMs (8000)
      // hard: 2000*15 = 30000
      expect(easy.encouragementMs).toBeLessThanOrEqual(hard.encouragementMs)

      // helpOffer: (mean+σ)*cost = 2000*cost (σ=0)
      // easy: 2000*3 = 6000 → clamped to minHelpOfferMs (15000)
      // hard: 2000*15 = 30000
      expect(easy.helpOfferMs).toBeLessThanOrEqual(hard.helpOfferMs)
    })

    it('clamps auto-pause to 30s minimum and 5min maximum', () => {
      // Very fast rate: 100ms/cost
      const fastResults = Array(5)
        .fill(null)
        .map((_, i) => mockResultWithCost(100 * (i + 1), i + 1))
      const fastThresholds = calculateComplexityScaledThresholds(fastResults, timing, 1)
      expect(fastThresholds.autoPauseMs).toBe(MIN_PAUSE_THRESHOLD_MS)

      // Very slow rate: 50000ms/cost
      const slowResults = Array(5)
        .fill(null)
        .map((_, i) => mockResultWithCost(50000 * (i + 1), i + 1))
      const slowThresholds = calculateComplexityScaledThresholds(slowResults, timing, 20)
      expect(slowThresholds.autoPauseMs).toBe(MAX_PAUSE_THRESHOLD_MS)
    })
  })
})
