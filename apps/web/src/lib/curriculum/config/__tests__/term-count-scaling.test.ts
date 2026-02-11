import { describe, it, expect, vi } from 'vitest'

// Mock the db schema import to avoid drizzle-orm/sqlite-core dependency
vi.mock('@/db/schema/session-plans', () => ({
  // SessionPartType is just a type alias, but we need the module to resolve
}))

import {
  computeTermCountRange,
  TERM_COUNT_SCALING,
  type TermCountExplanation,
} from '../term-count-scaling'

// ============================================================================
// TERM_COUNT_SCALING configuration
// ============================================================================

describe('TERM_COUNT_SCALING configuration', () => {
  it('has entries for abacus, visualization, and linear', () => {
    expect(TERM_COUNT_SCALING).toHaveProperty('abacus')
    expect(TERM_COUNT_SCALING).toHaveProperty('visualization')
    expect(TERM_COUNT_SCALING).toHaveProperty('linear')
  })

  it('has floor.min <= floor.max for all part types', () => {
    for (const [, scaling] of Object.entries(TERM_COUNT_SCALING)) {
      expect(scaling.floor.min).toBeLessThanOrEqual(scaling.floor.max)
    }
  })

  it('has ceiling.min <= ceiling.max for all part types', () => {
    for (const [, scaling] of Object.entries(TERM_COUNT_SCALING)) {
      expect(scaling.ceiling.min).toBeLessThanOrEqual(scaling.ceiling.max)
    }
  })

  it('has floor <= ceiling for both min and max', () => {
    for (const [, scaling] of Object.entries(TERM_COUNT_SCALING)) {
      expect(scaling.floor.min).toBeLessThanOrEqual(scaling.ceiling.min)
      expect(scaling.floor.max).toBeLessThanOrEqual(scaling.ceiling.max)
    }
  })

  it('has all values >= 2', () => {
    for (const [, scaling] of Object.entries(TERM_COUNT_SCALING)) {
      expect(scaling.floor.min).toBeGreaterThanOrEqual(2)
      expect(scaling.floor.max).toBeGreaterThanOrEqual(2)
      expect(scaling.ceiling.min).toBeGreaterThanOrEqual(2)
      expect(scaling.ceiling.max).toBeGreaterThanOrEqual(2)
    }
  })

  it('has specific abacus values', () => {
    expect(TERM_COUNT_SCALING.abacus).toEqual({
      floor: { min: 2, max: 3 },
      ceiling: { min: 4, max: 8 },
    })
  })

  it('has specific visualization values', () => {
    expect(TERM_COUNT_SCALING.visualization).toEqual({
      floor: { min: 2, max: 2 },
      ceiling: { min: 4, max: 8 },
    })
  })

  it('has specific linear values', () => {
    expect(TERM_COUNT_SCALING.linear).toEqual({
      floor: { min: 2, max: 2 },
      ceiling: { min: 4, max: 8 },
    })
  })
})

// ============================================================================
// computeTermCountRange
// ============================================================================

describe('computeTermCountRange', () => {
  // --------------------------------------------------------------------------
  // Comfort level 0 (struggling student → floor)
  // --------------------------------------------------------------------------
  describe('at comfort level 0 (floor)', () => {
    it('returns floor for abacus', () => {
      const result = computeTermCountRange('abacus', 0)
      expect(result).toEqual({ min: 2, max: 3 })
    })

    it('returns floor for visualization', () => {
      const result = computeTermCountRange('visualization', 0)
      expect(result).toEqual({ min: 2, max: 2 })
    })

    it('returns floor for linear', () => {
      const result = computeTermCountRange('linear', 0)
      expect(result).toEqual({ min: 2, max: 2 })
    })
  })

  // --------------------------------------------------------------------------
  // Comfort level 1 (mastered student → ceiling)
  // --------------------------------------------------------------------------
  describe('at comfort level 1 (ceiling)', () => {
    it('returns ceiling for abacus', () => {
      const result = computeTermCountRange('abacus', 1)
      expect(result).toEqual({ min: 4, max: 8 })
    })

    it('returns ceiling for visualization', () => {
      const result = computeTermCountRange('visualization', 1)
      expect(result).toEqual({ min: 4, max: 8 })
    })

    it('returns ceiling for linear', () => {
      const result = computeTermCountRange('linear', 1)
      expect(result).toEqual({ min: 4, max: 8 })
    })
  })

  // --------------------------------------------------------------------------
  // Comfort level 0.5 (midpoint)
  // --------------------------------------------------------------------------
  describe('at comfort level 0.5 (midpoint)', () => {
    it('returns interpolated range for abacus', () => {
      const result = computeTermCountRange('abacus', 0.5)
      // min: round(2 + (4-2)*0.5) = round(3) = 3
      // max: round(3 + (8-3)*0.5) = round(5.5) = 6 (rounding)
      expect(result.min).toBe(3)
      expect(result.max).toBe(Math.round(3 + (8 - 3) * 0.5))
    })

    it('returns interpolated range for visualization', () => {
      const result = computeTermCountRange('visualization', 0.5)
      // min: round(2 + (4-2)*0.5) = round(3) = 3
      // max: round(2 + (8-2)*0.5) = round(5) = 5
      expect(result.min).toBe(3)
      expect(result.max).toBe(5)
    })

    it('ensures min <= max at midpoint', () => {
      for (const partType of ['abacus', 'visualization', 'linear'] as const) {
        const result = computeTermCountRange(partType, 0.5)
        expect(result.min).toBeLessThanOrEqual(result.max)
      }
    })
  })

  // --------------------------------------------------------------------------
  // Linear interpolation
  // --------------------------------------------------------------------------
  describe('linear interpolation', () => {
    it('increases monotonically as comfort increases (abacus)', () => {
      let prevMin = 0
      let prevMax = 0
      for (let c = 0; c <= 1; c += 0.1) {
        const result = computeTermCountRange('abacus', c)
        expect(result.min).toBeGreaterThanOrEqual(prevMin)
        expect(result.max).toBeGreaterThanOrEqual(prevMax)
        prevMin = result.min
        prevMax = result.max
      }
    })

    it('increases monotonically as comfort increases (visualization)', () => {
      let prevMin = 0
      let prevMax = 0
      for (let c = 0; c <= 1; c += 0.1) {
        const result = computeTermCountRange('visualization', c)
        expect(result.min).toBeGreaterThanOrEqual(prevMin)
        expect(result.max).toBeGreaterThanOrEqual(prevMax)
        prevMin = result.min
        prevMax = result.max
      }
    })
  })

  // --------------------------------------------------------------------------
  // Clamping of comfort level
  // --------------------------------------------------------------------------
  describe('comfort level clamping', () => {
    it('clamps negative comfort to 0 (returns floor)', () => {
      const result = computeTermCountRange('abacus', -0.5)
      const floor = computeTermCountRange('abacus', 0)
      expect(result).toEqual(floor)
    })

    it('clamps comfort > 1 to 1 (returns ceiling)', () => {
      const result = computeTermCountRange('abacus', 1.5)
      const ceiling = computeTermCountRange('abacus', 1)
      expect(result).toEqual(ceiling)
    })

    it('clamps very negative comfort to floor', () => {
      const result = computeTermCountRange('linear', -100)
      const floor = computeTermCountRange('linear', 0)
      expect(result).toEqual(floor)
    })

    it('clamps very high comfort to ceiling', () => {
      const result = computeTermCountRange('linear', 100)
      const ceiling = computeTermCountRange('linear', 1)
      expect(result).toEqual(ceiling)
    })
  })

  // --------------------------------------------------------------------------
  // Invariants
  // --------------------------------------------------------------------------
  describe('invariants', () => {
    it('always returns min >= 2', () => {
      for (const partType of ['abacus', 'visualization', 'linear'] as const) {
        for (let c = 0; c <= 1; c += 0.05) {
          const result = computeTermCountRange(partType, c)
          expect(result.min).toBeGreaterThanOrEqual(2)
        }
      }
    })

    it('always returns max >= min', () => {
      for (const partType of ['abacus', 'visualization', 'linear'] as const) {
        for (let c = 0; c <= 1; c += 0.05) {
          const result = computeTermCountRange(partType, c)
          expect(result.max).toBeGreaterThanOrEqual(result.min)
        }
      }
    })

    it('always returns integer values', () => {
      for (const partType of ['abacus', 'visualization', 'linear'] as const) {
        for (let c = 0; c <= 1; c += 0.07) {
          const result = computeTermCountRange(partType, c)
          expect(Number.isInteger(result.min)).toBe(true)
          expect(Number.isInteger(result.max)).toBe(true)
        }
      }
    })
  })

  // --------------------------------------------------------------------------
  // Specific comfort values
  // --------------------------------------------------------------------------
  describe('specific comfort values', () => {
    it('comfort 0.25 for abacus', () => {
      const result = computeTermCountRange('abacus', 0.25)
      // min: round(2 + 2*0.25) = round(2.5) = 3
      // max: round(3 + 5*0.25) = round(4.25) = 4
      expect(result.min).toBe(Math.round(2 + 2 * 0.25))
      expect(result.max).toBe(Math.round(3 + 5 * 0.25))
    })

    it('comfort 0.75 for abacus', () => {
      const result = computeTermCountRange('abacus', 0.75)
      // min: round(2 + 2*0.75) = round(3.5) = 4
      // max: round(3 + 5*0.75) = round(6.75) = 7
      expect(result.min).toBe(Math.round(2 + 2 * 0.75))
      expect(result.max).toBe(Math.round(3 + 5 * 0.75))
    })

    it('comfort 0.1 for visualization', () => {
      const result = computeTermCountRange('visualization', 0.1)
      // min: round(2 + 2*0.1) = round(2.2) = 2
      // max: round(2 + 6*0.1) = round(2.6) = 3
      expect(result.min).toBe(Math.round(2 + 2 * 0.1))
      expect(result.max).toBe(Math.round(2 + 6 * 0.1))
    })
  })
})
