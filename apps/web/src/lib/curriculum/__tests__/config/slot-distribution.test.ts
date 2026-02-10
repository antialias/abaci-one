/**
 * @vitest-environment node
 *
 * Slot Distribution Configuration Tests
 *
 * Tests for PURPOSE_WEIGHTS, CHALLENGE_RATIO_BY_PART_TYPE, PART_TIME_WEIGHTS,
 * TERM_COUNT_RANGES, and getTermCountRange.
 */

import { describe, expect, it } from 'vitest'
import {
  PURPOSE_WEIGHTS,
  CHALLENGE_RATIO_BY_PART_TYPE,
  PART_TIME_WEIGHTS,
  TERM_COUNT_RANGES,
  getTermCountRange,
} from '@/lib/curriculum/config/slot-distribution'

// =============================================================================
// PURPOSE_WEIGHTS
// =============================================================================

describe('PURPOSE_WEIGHTS', () => {
  it('has expected weight values', () => {
    expect(PURPOSE_WEIGHTS.focus).toBe(0.6)
    expect(PURPOSE_WEIGHTS.reinforce).toBe(0.2)
    expect(PURPOSE_WEIGHTS.review).toBe(0.15)
  })

  it('weights sum to 0.95 (remaining 0.05 is implicit challenge allocation)', () => {
    const sum = PURPOSE_WEIGHTS.focus + PURPOSE_WEIGHTS.reinforce + PURPOSE_WEIGHTS.review
    expect(sum).toBeCloseTo(0.95, 10)
  })

  it('focus has the highest weight', () => {
    expect(PURPOSE_WEIGHTS.focus).toBeGreaterThan(PURPOSE_WEIGHTS.reinforce)
    expect(PURPOSE_WEIGHTS.focus).toBeGreaterThan(PURPOSE_WEIGHTS.review)
  })

  it('reinforce has higher weight than review', () => {
    expect(PURPOSE_WEIGHTS.reinforce).toBeGreaterThan(PURPOSE_WEIGHTS.review)
  })

  it('all weights are positive', () => {
    expect(PURPOSE_WEIGHTS.focus).toBeGreaterThan(0)
    expect(PURPOSE_WEIGHTS.reinforce).toBeGreaterThan(0)
    expect(PURPOSE_WEIGHTS.review).toBeGreaterThan(0)
  })
})

// =============================================================================
// CHALLENGE_RATIO_BY_PART_TYPE
// =============================================================================

describe('CHALLENGE_RATIO_BY_PART_TYPE', () => {
  it('has expected ratios', () => {
    expect(CHALLENGE_RATIO_BY_PART_TYPE.abacus).toBe(0.25)
    expect(CHALLENGE_RATIO_BY_PART_TYPE.visualization).toBe(0.15)
    expect(CHALLENGE_RATIO_BY_PART_TYPE.linear).toBe(0.2)
  })

  it('abacus has highest challenge ratio (physical tool reduces cognitive load)', () => {
    expect(CHALLENGE_RATIO_BY_PART_TYPE.abacus).toBeGreaterThan(
      CHALLENGE_RATIO_BY_PART_TYPE.visualization
    )
    expect(CHALLENGE_RATIO_BY_PART_TYPE.abacus).toBeGreaterThan(CHALLENGE_RATIO_BY_PART_TYPE.linear)
  })

  it('visualization has lowest challenge ratio (mental math is harder)', () => {
    expect(CHALLENGE_RATIO_BY_PART_TYPE.visualization).toBeLessThan(
      CHALLENGE_RATIO_BY_PART_TYPE.abacus
    )
    expect(CHALLENGE_RATIO_BY_PART_TYPE.visualization).toBeLessThan(
      CHALLENGE_RATIO_BY_PART_TYPE.linear
    )
  })

  it('all ratios are between 0 and 1', () => {
    for (const ratio of Object.values(CHALLENGE_RATIO_BY_PART_TYPE)) {
      expect(ratio).toBeGreaterThan(0)
      expect(ratio).toBeLessThan(1)
    }
  })
})

// =============================================================================
// PART_TIME_WEIGHTS
// =============================================================================

describe('PART_TIME_WEIGHTS', () => {
  it('has expected weight values', () => {
    expect(PART_TIME_WEIGHTS.abacus).toBe(0.5)
    expect(PART_TIME_WEIGHTS.visualization).toBe(0.3)
    expect(PART_TIME_WEIGHTS.linear).toBe(0.2)
  })

  it('weights sum to 1.0', () => {
    const sum =
      PART_TIME_WEIGHTS.abacus + PART_TIME_WEIGHTS.visualization + PART_TIME_WEIGHTS.linear
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it('abacus gets the most time (where new skills are built)', () => {
    expect(PART_TIME_WEIGHTS.abacus).toBeGreaterThan(PART_TIME_WEIGHTS.visualization)
    expect(PART_TIME_WEIGHTS.abacus).toBeGreaterThan(PART_TIME_WEIGHTS.linear)
  })

  it('all weights are positive', () => {
    for (const weight of Object.values(PART_TIME_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// TERM_COUNT_RANGES
// =============================================================================

describe('TERM_COUNT_RANGES', () => {
  it('has explicit range for abacus', () => {
    expect(TERM_COUNT_RANGES.abacus).toEqual({ min: 3, max: 6 })
  })

  it('has null for visualization (derives from abacus)', () => {
    expect(TERM_COUNT_RANGES.visualization).toBeNull()
  })

  it('has null for linear (derives from abacus)', () => {
    expect(TERM_COUNT_RANGES.linear).toBeNull()
  })

  it('abacus range has min <= max', () => {
    const range = TERM_COUNT_RANGES.abacus!
    expect(range.min).toBeLessThanOrEqual(range.max)
  })

  it('abacus range has min >= 2 (at least two terms needed for a problem)', () => {
    expect(TERM_COUNT_RANGES.abacus!.min).toBeGreaterThanOrEqual(2)
  })
})

// =============================================================================
// getTermCountRange
// =============================================================================

describe('getTermCountRange', () => {
  it('returns abacus range directly', () => {
    const result = getTermCountRange('abacus')
    expect(result).toEqual({ min: 3, max: 6 })
  })

  it('returns derived visualization range (75% of abacus)', () => {
    const result = getTermCountRange('visualization')
    // abacus = {3, 6}, 75% = {2.25, 4.5} → floor = {2, 4}, max(2,) max(3,)
    expect(result.min).toBe(Math.max(2, Math.floor(3 * 0.75))) // 2
    expect(result.max).toBe(Math.max(3, Math.floor(6 * 0.75))) // 4
  })

  it('returns linear range (same as abacus)', () => {
    const result = getTermCountRange('linear')
    expect(result).toEqual({ min: 3, max: 6 })
  })

  it('always returns min >= 2 for visualization', () => {
    const result = getTermCountRange('visualization')
    expect(result.min).toBeGreaterThanOrEqual(2)
  })

  it('always returns max >= 3 for visualization', () => {
    const result = getTermCountRange('visualization')
    expect(result.max).toBeGreaterThanOrEqual(3)
  })

  it('returns min <= max for all part types', () => {
    for (const partType of ['abacus', 'visualization', 'linear'] as const) {
      const result = getTermCountRange(partType)
      expect(result.min).toBeLessThanOrEqual(result.max)
    }
  })
})
