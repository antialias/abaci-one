/**
 * @vitest-environment node
 *
 * Complexity Budget Configuration Tests
 *
 * Tests for getComplexityBounds, PURPOSE_COMPLEXITY_BOUNDS,
 * and DEFAULT_COMPLEXITY_BUDGETS.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPLEXITY_BUDGETS,
  PURPOSE_COMPLEXITY_BOUNDS,
  getComplexityBounds,
} from '@/lib/curriculum/config/complexity-budgets'

// =============================================================================
// DEFAULT_COMPLEXITY_BUDGETS
// =============================================================================

describe('DEFAULT_COMPLEXITY_BUDGETS', () => {
  it('unlimited is Infinity', () => {
    expect(DEFAULT_COMPLEXITY_BUDGETS.unlimited).toBe(Number.POSITIVE_INFINITY)
  })

  it('useAbacus has positive budget', () => {
    expect(DEFAULT_COMPLEXITY_BUDGETS.useAbacus).toBe(12)
    expect(DEFAULT_COMPLEXITY_BUDGETS.useAbacus).toBeGreaterThan(0)
  })

  it('visualizationDefault is less than useAbacus (mental math is harder)', () => {
    expect(DEFAULT_COMPLEXITY_BUDGETS.visualizationDefault).toBeLessThan(
      DEFAULT_COMPLEXITY_BUDGETS.useAbacus
    )
  })

  it('linearDefault is between visualization and abacus', () => {
    expect(DEFAULT_COMPLEXITY_BUDGETS.linearDefault).toBeGreaterThan(
      DEFAULT_COMPLEXITY_BUDGETS.visualizationDefault
    )
    expect(DEFAULT_COMPLEXITY_BUDGETS.linearDefault).toBeLessThan(
      DEFAULT_COMPLEXITY_BUDGETS.useAbacus
    )
  })

  it('all non-unlimited values are positive', () => {
    expect(DEFAULT_COMPLEXITY_BUDGETS.useAbacus).toBeGreaterThan(0)
    expect(DEFAULT_COMPLEXITY_BUDGETS.visualizationDefault).toBeGreaterThan(0)
    expect(DEFAULT_COMPLEXITY_BUDGETS.linearDefault).toBeGreaterThan(0)
  })
})

// =============================================================================
// PURPOSE_COMPLEXITY_BOUNDS
// =============================================================================

describe('PURPOSE_COMPLEXITY_BOUNDS', () => {
  const purposes = ['focus', 'reinforce', 'review', 'challenge'] as const
  const partTypes = ['abacus', 'visualization', 'linear'] as const

  it('covers all four purposes', () => {
    for (const purpose of purposes) {
      expect(PURPOSE_COMPLEXITY_BOUNDS[purpose]).toBeDefined()
    }
  })

  it('covers all three part types for each purpose', () => {
    for (const purpose of purposes) {
      for (const partType of partTypes) {
        expect(PURPOSE_COMPLEXITY_BOUNDS[purpose][partType]).toBeDefined()
      }
    }
  })

  it('focus/reinforce/review have max budgets for all part types', () => {
    for (const purpose of ['focus', 'reinforce', 'review'] as const) {
      for (const partType of partTypes) {
        const bounds = PURPOSE_COMPLEXITY_BOUNDS[purpose][partType]
        expect(bounds.max).not.toBeNull()
        expect(bounds.max).toBeGreaterThan(0)
      }
    }
  })

  it('focus/reinforce/review have no min constraint', () => {
    for (const purpose of ['focus', 'reinforce', 'review'] as const) {
      for (const partType of partTypes) {
        expect(PURPOSE_COMPLEXITY_BOUNDS[purpose][partType].min).toBeNull()
      }
    }
  })

  it('challenge has min constraint of 1 for all part types', () => {
    for (const partType of partTypes) {
      expect(PURPOSE_COMPLEXITY_BOUNDS.challenge[partType].min).toBe(1)
    }
  })

  it('challenge has no max constraint (unlimited difficulty)', () => {
    for (const partType of partTypes) {
      expect(PURPOSE_COMPLEXITY_BOUNDS.challenge[partType].max).toBeNull()
    }
  })

  it('visualization has lower max than abacus for non-challenge purposes', () => {
    for (const purpose of ['focus', 'reinforce', 'review'] as const) {
      const visBounds = PURPOSE_COMPLEXITY_BOUNDS[purpose].visualization
      const abacusBounds = PURPOSE_COMPLEXITY_BOUNDS[purpose].abacus
      expect(visBounds.max!).toBeLessThanOrEqual(abacusBounds.max!)
    }
  })

  it('abacus and linear have same max for non-challenge purposes', () => {
    for (const purpose of ['focus', 'reinforce', 'review'] as const) {
      const abacusBounds = PURPOSE_COMPLEXITY_BOUNDS[purpose].abacus
      const linearBounds = PURPOSE_COMPLEXITY_BOUNDS[purpose].linear
      expect(abacusBounds.max).toBe(linearBounds.max)
    }
  })
})

// =============================================================================
// getComplexityBounds
// =============================================================================

describe('getComplexityBounds', () => {
  it('returns correct bounds for focus/abacus', () => {
    const result = getComplexityBounds('focus', 'abacus')
    expect(result).toEqual({ min: null, max: 7 })
  })

  it('returns correct bounds for focus/visualization', () => {
    const result = getComplexityBounds('focus', 'visualization')
    expect(result).toEqual({ min: null, max: 5 })
  })

  it('returns correct bounds for challenge/abacus', () => {
    const result = getComplexityBounds('challenge', 'abacus')
    expect(result).toEqual({ min: 1, max: null })
  })

  it('returns same bounds for reinforce and focus (same config)', () => {
    for (const partType of ['abacus', 'visualization', 'linear'] as const) {
      const focusBounds = getComplexityBounds('focus', partType)
      const reinforceBounds = getComplexityBounds('reinforce', partType)
      expect(focusBounds).toEqual(reinforceBounds)
    }
  })

  it('returns same bounds for review and focus (same config)', () => {
    for (const partType of ['abacus', 'visualization', 'linear'] as const) {
      const focusBounds = getComplexityBounds('focus', partType)
      const reviewBounds = getComplexityBounds('review', partType)
      expect(focusBounds).toEqual(reviewBounds)
    }
  })

  it('returns the config value directly from PURPOSE_COMPLEXITY_BOUNDS', () => {
    for (const purpose of ['focus', 'reinforce', 'review', 'challenge'] as const) {
      for (const partType of ['abacus', 'visualization', 'linear'] as const) {
        const result = getComplexityBounds(purpose, partType)
        expect(result).toEqual(PURPOSE_COMPLEXITY_BOUNDS[purpose][partType])
      }
    }
  })
})
