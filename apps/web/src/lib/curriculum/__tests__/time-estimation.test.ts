import { describe, it, expect } from 'vitest'
import {
  calculateSecondsPerTerm,
  estimateProblemTimeMs,
  estimateProblemTimeSeconds,
  estimateSessionProblemCount,
  estimateSessionDurationMinutes,
  convertSptToSecondsPerProblem,
  convertSecondsPerProblemToSpt,
  calculateProblemComplexityUnits,
  calculateSecondsPerComplexityUnit,
  getTimeEstimationProfile,
  TIME_ESTIMATION_DEFAULTS,
} from '../time-estimation'

// Helper to create a mock SlotResult
function mockResult(
  responseTimeMs: number,
  termCount: number,
  skillsRequired: string[] = []
) {
  return {
    responseTimeMs,
    problem: {
      terms: Array.from({ length: termCount }, (_, i) => i + 1),
      skillsRequired,
    },
  } as any
}

// ============================================================================
// calculateSecondsPerTerm
// ============================================================================

describe('calculateSecondsPerTerm', () => {
  it('returns null with insufficient results', () => {
    const results = [mockResult(3000, 3)]
    expect(calculateSecondsPerTerm(results)).toBeNull()
  })

  it('calculates average SPT from valid results', () => {
    // 5 results, each 3000ms for 3 terms = 1s/term
    const results = Array.from({ length: 5 }, () => mockResult(3000, 3))
    const spt = calculateSecondsPerTerm(results)
    expect(spt).toBeCloseTo(3, 0) // clamped to min of 3
  })

  it('clamps to minimum SPT', () => {
    // Very fast: 300ms for 3 terms = 0.1s/term → clamps to 3
    const results = Array.from({ length: 5 }, () => mockResult(300, 3))
    expect(calculateSecondsPerTerm(results)).toBe(TIME_ESTIMATION_DEFAULTS.minSecondsPerTerm)
  })

  it('clamps to maximum SPT', () => {
    // Very slow: 300s for 3 terms = 100s/term → clamps to 30
    const results = Array.from({ length: 5 }, () => mockResult(300_000, 3))
    expect(calculateSecondsPerTerm(results)).toBe(TIME_ESTIMATION_DEFAULTS.maxSecondsPerTerm)
  })

  it('filters out results with zero response time', () => {
    const results = [
      ...Array.from({ length: 5 }, () => mockResult(6000, 3)), // 2s/term
      mockResult(0, 3), // invalid
    ]
    const spt = calculateSecondsPerTerm(results)
    expect(spt).toBeCloseTo(3, 0) // clamped to min
  })

  it('respects custom minResults', () => {
    const results = Array.from({ length: 3 }, () => mockResult(9000, 3))
    expect(calculateSecondsPerTerm(results, { minResults: 3 })).toBe(3)
    expect(calculateSecondsPerTerm(results, { minResults: 5 })).toBeNull()
  })

  it('excludes outliers when enabled and >= 10 results', () => {
    const results = [
      ...Array.from({ length: 12 }, () => mockResult(9000, 3)), // 3s/term
      mockResult(900_000, 3), // extreme outlier
    ]
    const withOutliers = calculateSecondsPerTerm(results, { excludeOutliers: false })
    const withoutOutliers = calculateSecondsPerTerm(results, { excludeOutliers: true })
    // Without outlier exclusion, the extreme value shifts the average up significantly
    expect(withoutOutliers!).toBeLessThan(withOutliers!)
  })
})

// ============================================================================
// estimateProblemTimeMs / estimateProblemTimeSeconds
// ============================================================================

describe('estimateProblemTimeMs', () => {
  it('calculates time based on terms and SPT', () => {
    // 3 terms × 5 spt + 2s overhead = 17s = 17000ms
    const time = estimateProblemTimeMs({ terms: [1, 2, 3] }, 5)
    expect(time).toBe(17000)
  })

  it('applies part type multiplier', () => {
    const base = estimateProblemTimeMs({ terms: [1, 2, 3] }, 5)
    const viz = estimateProblemTimeMs({ terms: [1, 2, 3] }, 5, 'visualization')
    expect(viz).toBeGreaterThan(base)
  })

  it('linear is faster than abacus', () => {
    const abacus = estimateProblemTimeMs({ terms: [1, 2, 3] }, 5, 'abacus')
    const linear = estimateProblemTimeMs({ terms: [1, 2, 3] }, 5, 'linear')
    expect(linear).toBeLessThan(abacus)
  })
})

describe('estimateProblemTimeSeconds', () => {
  it('returns milliseconds / 1000', () => {
    const ms = estimateProblemTimeMs({ terms: [1, 2] }, 5)
    const sec = estimateProblemTimeSeconds({ terms: [1, 2] }, 5)
    expect(sec).toBe(ms / 1000)
  })
})

// ============================================================================
// Session Planning Functions
// ============================================================================

describe('estimateSessionProblemCount', () => {
  it('calculates problem count for given duration', () => {
    // 5 min = 300s, 3 terms × 8 spt + 2 overhead = 26s/problem → ~11 problems
    const count = estimateSessionProblemCount(5)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(100)
  })

  it('enforces minimum problems per part', () => {
    // Very short session
    const count = estimateSessionProblemCount(0.01)
    expect(count).toBeGreaterThanOrEqual(TIME_ESTIMATION_DEFAULTS.minProblemsPerPart)
  })

  it('applies part type modifier', () => {
    const base = estimateSessionProblemCount(10, 3, 8)
    const viz = estimateSessionProblemCount(10, 3, 8, 'visualization')
    expect(viz).toBeLessThanOrEqual(base) // visualization is slower → fewer problems
  })
})

describe('estimateSessionDurationMinutes', () => {
  it('returns duration in minutes', () => {
    const duration = estimateSessionDurationMinutes(10, 3, 8)
    expect(duration).toBeGreaterThan(0)
  })

  it('is inversely related to estimateSessionProblemCount', () => {
    const count = estimateSessionProblemCount(5)
    const duration = estimateSessionDurationMinutes(count)
    // Should be approximately 5 minutes (within rounding)
    expect(duration).toBeGreaterThanOrEqual(4)
    expect(duration).toBeLessThanOrEqual(6)
  })
})

describe('convertSptToSecondsPerProblem', () => {
  it('converts with default 3 terms', () => {
    // 5 spt × 3 terms + 2 overhead = 17
    expect(convertSptToSecondsPerProblem(5)).toBe(17)
  })

  it('converts with custom term count', () => {
    // 5 spt × 5 terms + 2 overhead = 27
    expect(convertSptToSecondsPerProblem(5, 5)).toBe(27)
  })
})

describe('convertSecondsPerProblemToSpt', () => {
  it('is inverse of convertSptToSecondsPerProblem', () => {
    const spt = 6
    const spp = convertSptToSecondsPerProblem(spt)
    const backToSpt = convertSecondsPerProblemToSpt(spp)
    expect(backToSpt).toBeCloseTo(spt, 1)
  })

  it('handles very small values (floor at 0)', () => {
    expect(convertSecondsPerProblemToSpt(0)).toBe(0)
    expect(convertSecondsPerProblemToSpt(1)).toBe(0) // less than overhead
  })
})

// ============================================================================
// Complexity-Weighted Estimation
// ============================================================================

describe('calculateProblemComplexityUnits', () => {
  it('returns 1 for empty skills', () => {
    expect(calculateProblemComplexityUnits([])).toBe(1)
  })

  it('uses exact match weights', () => {
    expect(calculateProblemComplexityUnits(['add.direct'])).toBe(1.0)
    expect(calculateProblemComplexityUnits(['add.five'])).toBe(1.5)
    expect(calculateProblemComplexityUnits(['add.ten'])).toBe(2.0)
  })

  it('sums multiple skills', () => {
    expect(calculateProblemComplexityUnits(['add.direct', 'add.five'])).toBe(2.5)
  })

  it('uses partial match for dotted skill IDs', () => {
    // "add.+5.direct" → operation=add, technique=direct → "add.direct" = 1.0
    expect(calculateProblemComplexityUnits(['add.+5.direct'])).toBe(1.0)
  })

  it('defaults to 1.0 for unknown skills', () => {
    expect(calculateProblemComplexityUnits(['something.unknown'])).toBe(1.0)
  })
})

describe('calculateSecondsPerComplexityUnit', () => {
  it('returns null with insufficient results', () => {
    const results = Array.from({ length: 5 }, () =>
      mockResult(3000, 3, ['add.direct'])
    )
    expect(calculateSecondsPerComplexityUnit(results)).toBeNull()
  })

  it('calculates SPCU from sufficient results', () => {
    const results = Array.from({ length: 12 }, () =>
      mockResult(5000, 3, ['add.direct'])
    )
    const spcu = calculateSecondsPerComplexityUnit(results)
    expect(spcu).not.toBeNull()
    expect(spcu!).toBeGreaterThanOrEqual(2)
    expect(spcu!).toBeLessThanOrEqual(15)
  })
})

// ============================================================================
// getTimeEstimationProfile
// ============================================================================

describe('getTimeEstimationProfile', () => {
  it('returns default profile when no data', () => {
    const profile = getTimeEstimationProfile([])
    expect(profile.isDefault).toBe(true)
    expect(profile.secondsPerTerm).toBe(TIME_ESTIMATION_DEFAULTS.secondsPerTerm)
    expect(profile.sampleSize).toBe(0)
  })

  it('returns calculated profile with enough data', () => {
    const results = Array.from({ length: 10 }, () => mockResult(30_000, 3))
    const profile = getTimeEstimationProfile(results)
    expect(profile.isDefault).toBe(false)
    expect(profile.sampleSize).toBe(10)
    expect(profile.secondsPerTerm).toBeGreaterThan(0)
    expect(profile.secondsPerProblem).toBeGreaterThan(0)
  })
})
