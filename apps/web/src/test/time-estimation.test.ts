/**
 * @vitest-environment node
 *
 * Unit tests for time estimation utilities.
 *
 * Tests all exported functions from time-estimation.ts including
 * seconds-per-term calculation, problem time estimation, session planning,
 * complexity-weighted estimation, and profile generation.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSecondsPerTerm,
  calculateSecondsPerTermFromSessions,
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
  PART_TYPE_MULTIPLIERS,
  SKILL_COMPLEXITY_WEIGHTS,
} from '@/lib/curriculum/time-estimation'
import type { SlotResult } from '@/db/schema/session-plans'

// =============================================================================
// Helpers
// =============================================================================

function makeSlotResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [1, 2, 3], answer: 6, skillsRequired: ['add.direct'] },
    studentAnswer: 6,
    isCorrect: true,
    responseTimeMs: 9000, // 3 terms at 3 sec/term
    skillsExercised: ['add.direct'],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

function makeResults(count: number, sptSeconds: number, termsPerProblem: number = 3): SlotResult[] {
  return Array.from({ length: count }, (_, i) =>
    makeSlotResult({
      slotIndex: i,
      problem: {
        terms: Array.from({ length: termsPerProblem }, (_, j) => j + 1),
        answer: 0,
        skillsRequired: ['add.direct'],
      },
      responseTimeMs: sptSeconds * termsPerProblem * 1000,
    })
  )
}

// =============================================================================
// Tests: calculateSecondsPerTerm
// =============================================================================

describe('calculateSecondsPerTerm', () => {
  it('returns null when not enough results (default minResults=5)', () => {
    const results = makeResults(4, 5)
    expect(calculateSecondsPerTerm(results)).toBeNull()
  })

  it('returns null with zero valid results', () => {
    expect(calculateSecondsPerTerm([])).toBeNull()
  })

  it('returns null when custom minResults not met', () => {
    const results = makeResults(8, 5)
    expect(calculateSecondsPerTerm(results, { minResults: 10 })).toBeNull()
  })

  it('calculates correct SPT with enough results', () => {
    const results = makeResults(10, 5) // 5 sec/term
    const spt = calculateSecondsPerTerm(results)
    expect(spt).toBeCloseTo(5)
  })

  it('clamps to min seconds per term', () => {
    const results = makeResults(10, 1) // 1 sec/term, below min of 3
    const spt = calculateSecondsPerTerm(results)
    expect(spt).toBe(TIME_ESTIMATION_DEFAULTS.minSecondsPerTerm)
  })

  it('clamps to max seconds per term', () => {
    const results = makeResults(10, 50) // 50 sec/term, above max of 30
    const spt = calculateSecondsPerTerm(results)
    expect(spt).toBe(TIME_ESTIMATION_DEFAULTS.maxSecondsPerTerm)
  })

  it('filters out results with zero responseTimeMs', () => {
    const validResults = makeResults(5, 5)
    const invalidResults = makeResults(3, 0).map((r) => ({
      ...r,
      responseTimeMs: 0,
    }))
    const all = [...validResults, ...invalidResults]
    const spt = calculateSecondsPerTerm(all)
    expect(spt).toBeCloseTo(5)
  })

  it('filters out results with empty terms array', () => {
    const validResults = makeResults(5, 5)
    const invalidResults = [
      makeSlotResult({
        problem: { terms: [], answer: 0, skillsRequired: [] },
        responseTimeMs: 5000,
      }),
    ]
    const all = [...validResults, ...invalidResults]
    const spt = calculateSecondsPerTerm(all)
    expect(spt).toBeCloseTo(5)
  })

  it('excludes outliers when 10+ results', () => {
    // 10 normal results at 5 sec/term + 1 extreme outlier at 100 sec/term
    const normalResults = makeResults(10, 5)
    const outlier = makeSlotResult({
      slotIndex: 10,
      responseTimeMs: 300000, // 100 sec/term for 3 terms
    })
    const all = [...normalResults, outlier]
    const spt = calculateSecondsPerTerm(all)
    // Without outlier exclusion, mean would be higher
    // With exclusion (>3 std dev removed), result should be close to 5
    expect(spt).toBeCloseTo(5, 0)
  })

  it('does not exclude outliers when fewer than 10 results', () => {
    const results = makeResults(6, 5)
    // Add one result that would be considered an outlier with more data
    results.push(
      makeSlotResult({
        slotIndex: 6,
        responseTimeMs: 60000, // 20 sec/term for 3 terms
      })
    )
    const spt = calculateSecondsPerTerm(results)
    // Should include the "outlier" since we have < 10 results
    expect(spt).not.toBeNull()
    expect(spt!).toBeGreaterThan(5)
  })

  it('does not exclude outliers when excludeOutliers is false', () => {
    const normalResults = makeResults(10, 5)
    const outlier = makeSlotResult({
      slotIndex: 10,
      responseTimeMs: 90000, // 30 sec/term for 3 terms
    })
    const all = [...normalResults, outlier]
    const sptWithExclusion = calculateSecondsPerTerm(all, { excludeOutliers: true })
    const sptWithoutExclusion = calculateSecondsPerTerm(all, { excludeOutliers: false })
    // Without exclusion, the mean should be higher
    expect(sptWithoutExclusion!).toBeGreaterThanOrEqual(sptWithExclusion!)
  })
})

// =============================================================================
// Tests: calculateSecondsPerTermFromSessions
// =============================================================================

describe('calculateSecondsPerTermFromSessions', () => {
  it('returns null with no sessions', () => {
    expect(calculateSecondsPerTermFromSessions([])).toBeNull()
  })

  it('aggregates results from multiple sessions', () => {
    const sessions = [
      { results: makeResults(3, 5) },
      { results: makeResults(3, 5) },
    ]
    // Total 6 results, need 5 minimum
    const spt = calculateSecondsPerTermFromSessions(sessions)
    expect(spt).toBeCloseTo(5)
  })

  it('returns null when total results across sessions is insufficient', () => {
    const sessions = [
      { results: makeResults(2, 5) },
      { results: makeResults(2, 5) },
    ]
    // 4 total results, need 5
    expect(calculateSecondsPerTermFromSessions(sessions)).toBeNull()
  })
})

// =============================================================================
// Tests: estimateProblemTimeMs
// =============================================================================

describe('estimateProblemTimeMs', () => {
  it('calculates time with default modifier', () => {
    const problem = { terms: [1, 2, 3] }
    const spt = 5
    // time = (3 * 5 + 2) * 1.0 * 1000 = 17000ms
    expect(estimateProblemTimeMs(problem, spt)).toBe(17000)
  })

  it('applies abacus modifier (1.0)', () => {
    const problem = { terms: [1, 2] }
    const spt = 4
    // time = (2 * 4 + 2) * 1.0 * 1000 = 10000ms
    expect(estimateProblemTimeMs(problem, spt, 'abacus')).toBe(10000)
  })

  it('applies visualization modifier (1.3)', () => {
    const problem = { terms: [1, 2] }
    const spt = 4
    // time = (2 * 4 + 2) * 1.3 * 1000 = 13000ms
    expect(estimateProblemTimeMs(problem, spt, 'visualization')).toBe(13000)
  })

  it('applies linear modifier (0.85)', () => {
    const problem = { terms: [1, 2] }
    const spt = 4
    // time = (2 * 4 + 2) * 0.85 * 1000 = 8500ms
    expect(estimateProblemTimeMs(problem, spt, 'linear')).toBe(8500)
  })

  it('handles single term', () => {
    const problem = { terms: [5] }
    const spt = 10
    // time = (1 * 10 + 2) * 1.0 * 1000 = 12000ms
    expect(estimateProblemTimeMs(problem, spt)).toBe(12000)
  })

  it('handles zero terms', () => {
    const problem = { terms: [] as number[] }
    const spt = 10
    // time = (0 * 10 + 2) * 1.0 * 1000 = 2000ms (just overhead)
    expect(estimateProblemTimeMs(problem, spt)).toBe(2000)
  })
})

// =============================================================================
// Tests: estimateProblemTimeSeconds
// =============================================================================

describe('estimateProblemTimeSeconds', () => {
  it('returns milliseconds / 1000', () => {
    const problem = { terms: [1, 2, 3] }
    const spt = 5
    expect(estimateProblemTimeSeconds(problem, spt)).toBe(17)
  })
})

// =============================================================================
// Tests: estimateSessionProblemCount
// =============================================================================

describe('estimateSessionProblemCount', () => {
  it('calculates problem count for given duration', () => {
    // 10 minutes = 600 seconds
    // (3 * 8 + 2) * 1.0 = 26 seconds per problem
    // 600 / 26 = 23.07 → floor to 23
    const count = estimateSessionProblemCount(10)
    expect(count).toBe(23)
  })

  it('uses custom SPT and terms per problem', () => {
    // 5 minutes = 300 seconds
    // (2 * 5 + 2) * 1.0 = 12 seconds per problem
    // 300 / 12 = 25
    const count = estimateSessionProblemCount(5, 2, 5)
    expect(count).toBe(25)
  })

  it('applies part type modifier', () => {
    // 10 min = 600 seconds
    // (3 * 8 + 2) * 1.3 = 33.8 seconds per problem (visualization)
    // 600 / 33.8 = 17.75 → floor to 17
    const count = estimateSessionProblemCount(10, 3, 8, 'visualization')
    expect(count).toBe(17)
  })

  it('enforces minimum problems per part', () => {
    // Very short duration: 0.1 minutes = 6 seconds
    const count = estimateSessionProblemCount(0.1)
    expect(count).toBe(TIME_ESTIMATION_DEFAULTS.minProblemsPerPart)
  })

  it('returns min problems for zero duration', () => {
    const count = estimateSessionProblemCount(0)
    expect(count).toBe(TIME_ESTIMATION_DEFAULTS.minProblemsPerPart)
  })
})

// =============================================================================
// Tests: estimateSessionDurationMinutes
// =============================================================================

describe('estimateSessionDurationMinutes', () => {
  it('calculates duration from problem count', () => {
    // 20 problems, 3 terms/problem, 8 spt
    // (3 * 8 + 2) = 26 seconds per problem
    // 20 * 26 / 60 = 8.67 → round to 9
    const duration = estimateSessionDurationMinutes(20)
    expect(duration).toBe(9)
  })

  it('returns 0 for zero problems', () => {
    expect(estimateSessionDurationMinutes(0)).toBe(0)
  })

  it('uses custom values', () => {
    // 10 problems, 5 terms/problem, 4 spt
    // (5 * 4 + 2) = 22 seconds per problem
    // 10 * 22 / 60 = 3.67 → round to 4
    const duration = estimateSessionDurationMinutes(10, 5, 4)
    expect(duration).toBe(4)
  })
})

// =============================================================================
// Tests: convertSptToSecondsPerProblem
// =============================================================================

describe('convertSptToSecondsPerProblem', () => {
  it('converts SPT to seconds per problem with default terms', () => {
    // 5 * 3 + 2 = 17
    expect(convertSptToSecondsPerProblem(5)).toBe(17)
  })

  it('converts SPT to seconds per problem with custom terms', () => {
    // 5 * 4 + 2 = 22
    expect(convertSptToSecondsPerProblem(5, 4)).toBe(22)
  })

  it('handles zero SPT', () => {
    // 0 * 3 + 2 = 2
    expect(convertSptToSecondsPerProblem(0)).toBe(2)
  })
})

// =============================================================================
// Tests: convertSecondsPerProblemToSpt
// =============================================================================

describe('convertSecondsPerProblemToSpt', () => {
  it('converts seconds per problem to SPT', () => {
    // (17 - 2) / 3 = 5
    expect(convertSecondsPerProblemToSpt(17)).toBe(5)
  })

  it('handles seconds less than overhead (clamps to 0)', () => {
    // (1 - 2) → max(0, -1) = 0, so 0 / 3 = 0
    expect(convertSecondsPerProblemToSpt(1)).toBe(0)
  })

  it('handles zero seconds per problem', () => {
    expect(convertSecondsPerProblemToSpt(0)).toBe(0)
  })

  it('roundtrips with convertSptToSecondsPerProblem', () => {
    const originalSpt = 6
    const spp = convertSptToSecondsPerProblem(originalSpt)
    const recoveredSpt = convertSecondsPerProblemToSpt(spp)
    expect(recoveredSpt).toBeCloseTo(originalSpt)
  })
})

// =============================================================================
// Tests: calculateProblemComplexityUnits
// =============================================================================

describe('calculateProblemComplexityUnits', () => {
  it('returns 1 for empty skills array', () => {
    expect(calculateProblemComplexityUnits([])).toBe(1)
  })

  it('returns correct weight for exact skill match', () => {
    expect(calculateProblemComplexityUnits(['add.direct'])).toBe(1.0)
    expect(calculateProblemComplexityUnits(['add.five'])).toBe(1.5)
    expect(calculateProblemComplexityUnits(['sub.ten'])).toBe(2.0)
  })

  it('sums weights for multiple skills', () => {
    // add.direct (1.0) + add.five (1.5) = 2.5
    expect(calculateProblemComplexityUnits(['add.direct', 'add.five'])).toBe(2.5)
  })

  it('handles partial matches (e.g., add.+5.direct)', () => {
    // "add.+5.direct" → operation=add, technique=direct → partialKey = "add.direct" = 1.0
    expect(calculateProblemComplexityUnits(['add.+5.direct'])).toBe(1.0)
  })

  it('defaults to 1.0 for unknown skills', () => {
    expect(calculateProblemComplexityUnits(['unknown.skill'])).toBe(1.0)
  })

  it('handles carry and borrow skills', () => {
    expect(calculateProblemComplexityUnits(['carry'])).toBe(1.5)
    expect(calculateProblemComplexityUnits(['borrow'])).toBe(1.5)
  })
})

// =============================================================================
// Tests: calculateSecondsPerComplexityUnit
// =============================================================================

describe('calculateSecondsPerComplexityUnit', () => {
  it('returns null with fewer than 10 valid results', () => {
    const results = Array.from({ length: 9 }, (_, i) =>
      makeSlotResult({
        slotIndex: i,
        responseTimeMs: 5000,
        problem: { terms: [1, 2], answer: 3, skillsRequired: ['add.direct'] },
      })
    )
    expect(calculateSecondsPerComplexityUnit(results)).toBeNull()
  })

  it('returns null for results without skillsRequired', () => {
    const results = Array.from({ length: 15 }, (_, i) =>
      makeSlotResult({
        slotIndex: i,
        responseTimeMs: 5000,
        problem: { terms: [1, 2], answer: 3, skillsRequired: [] },
      })
    )
    expect(calculateSecondsPerComplexityUnit(results)).toBeNull()
  })

  it('calculates SPCU from valid results', () => {
    // Each result: 5000ms = 5 seconds, skill = 'add.direct' (complexity = 1.0)
    // SPCU = 5 / 1.0 = 5
    const results = Array.from({ length: 15 }, (_, i) =>
      makeSlotResult({
        slotIndex: i,
        responseTimeMs: 5000,
        problem: { terms: [1, 2], answer: 3, skillsRequired: ['add.direct'] },
      })
    )
    const spcu = calculateSecondsPerComplexityUnit(results)
    expect(spcu).toBeCloseTo(5)
  })

  it('clamps to minimum 2', () => {
    // 500ms = 0.5 seconds, complexity 1.0 → ratio = 0.5, clamped to 2
    const results = Array.from({ length: 15 }, (_, i) =>
      makeSlotResult({
        slotIndex: i,
        responseTimeMs: 500,
        problem: { terms: [1, 2], answer: 3, skillsRequired: ['add.direct'] },
      })
    )
    expect(calculateSecondsPerComplexityUnit(results)).toBe(2)
  })

  it('clamps to maximum 15', () => {
    // 100000ms = 100 seconds, complexity 1.0 → ratio = 100, clamped to 15
    const results = Array.from({ length: 15 }, (_, i) =>
      makeSlotResult({
        slotIndex: i,
        responseTimeMs: 100000,
        problem: { terms: [1, 2], answer: 3, skillsRequired: ['add.direct'] },
      })
    )
    expect(calculateSecondsPerComplexityUnit(results)).toBe(15)
  })
})

// =============================================================================
// Tests: getTimeEstimationProfile
// =============================================================================

describe('getTimeEstimationProfile', () => {
  it('returns default profile with insufficient data', () => {
    const profile = getTimeEstimationProfile([])

    expect(profile.isDefault).toBe(true)
    expect(profile.sampleSize).toBe(0)
    expect(profile.secondsPerTerm).toBe(TIME_ESTIMATION_DEFAULTS.secondsPerTerm)
    expect(profile.secondsPerComplexityUnit).toBeNull()
    expect(profile.secondsPerProblem).toBe(
      convertSptToSecondsPerProblem(TIME_ESTIMATION_DEFAULTS.secondsPerTerm)
    )
  })

  it('returns calculated profile with enough data', () => {
    const results = makeResults(10, 5) // 5 sec/term
    const profile = getTimeEstimationProfile(results)

    expect(profile.isDefault).toBe(false)
    expect(profile.sampleSize).toBe(10)
    expect(profile.secondsPerTerm).toBeCloseTo(5)
    expect(profile.secondsPerProblem).toBe(convertSptToSecondsPerProblem(5))
  })

  it('includes SPCU when enough skill-tagged results', () => {
    // Need 10+ results with skillsRequired for SPCU
    const results = Array.from({ length: 15 }, (_, i) =>
      makeSlotResult({
        slotIndex: i,
        responseTimeMs: 6000,
        problem: { terms: [1, 2], answer: 3, skillsRequired: ['add.direct'] },
      })
    )
    const profile = getTimeEstimationProfile(results)

    expect(profile.secondsPerComplexityUnit).not.toBeNull()
  })
})

// =============================================================================
// Tests: Constants
// =============================================================================

describe('constants', () => {
  it('TIME_ESTIMATION_DEFAULTS has expected values', () => {
    expect(TIME_ESTIMATION_DEFAULTS.secondsPerTerm).toBe(8)
    expect(TIME_ESTIMATION_DEFAULTS.minSecondsPerTerm).toBe(3)
    expect(TIME_ESTIMATION_DEFAULTS.maxSecondsPerTerm).toBe(30)
    expect(TIME_ESTIMATION_DEFAULTS.problemOverheadSeconds).toBe(2)
    expect(TIME_ESTIMATION_DEFAULTS.minProblemsPerPart).toBe(2)
  })

  it('PART_TYPE_MULTIPLIERS has expected values', () => {
    expect(PART_TYPE_MULTIPLIERS.abacus).toBe(1.0)
    expect(PART_TYPE_MULTIPLIERS.visualization).toBe(1.3)
    expect(PART_TYPE_MULTIPLIERS.linear).toBe(0.85)
  })

  it('SKILL_COMPLEXITY_WEIGHTS has expected keys', () => {
    expect(SKILL_COMPLEXITY_WEIGHTS['add.direct']).toBe(1.0)
    expect(SKILL_COMPLEXITY_WEIGHTS['sub.direct']).toBe(1.0)
    expect(SKILL_COMPLEXITY_WEIGHTS['add.five']).toBe(1.5)
    expect(SKILL_COMPLEXITY_WEIGHTS['sub.five']).toBe(1.5)
    expect(SKILL_COMPLEXITY_WEIGHTS['add.ten']).toBe(2.0)
    expect(SKILL_COMPLEXITY_WEIGHTS['sub.ten']).toBe(2.0)
    expect(SKILL_COMPLEXITY_WEIGHTS['carry']).toBe(1.5)
    expect(SKILL_COMPLEXITY_WEIGHTS['borrow']).toBe(1.5)
  })
})
