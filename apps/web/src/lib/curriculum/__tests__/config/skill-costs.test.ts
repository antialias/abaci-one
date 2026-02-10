/**
 * @vitest-environment node
 *
 * Skill Cost Configuration Tests
 *
 * Tests for getBaseComplexity, BASE_SKILL_COMPLEXITY,
 * ROTATION_MULTIPLIERS, and DEFAULT_BASE_COMPLEXITY.
 */

import { describe, expect, it } from 'vitest'
import {
  BASE_SKILL_COMPLEXITY,
  DEFAULT_BASE_COMPLEXITY,
  ROTATION_MULTIPLIERS,
  getBaseComplexity,
} from '@/lib/curriculum/config/skill-costs'

// =============================================================================
// ROTATION_MULTIPLIERS
// =============================================================================

describe('ROTATION_MULTIPLIERS', () => {
  it('has expected multiplier values', () => {
    expect(ROTATION_MULTIPLIERS.inRotation).toBe(3)
    expect(ROTATION_MULTIPLIERS.outOfRotation).toBe(4)
  })

  it('out-of-rotation is higher than in-rotation (more cognitive load)', () => {
    expect(ROTATION_MULTIPLIERS.outOfRotation).toBeGreaterThan(ROTATION_MULTIPLIERS.inRotation)
  })

  it('both multipliers are positive', () => {
    expect(ROTATION_MULTIPLIERS.inRotation).toBeGreaterThan(0)
    expect(ROTATION_MULTIPLIERS.outOfRotation).toBeGreaterThan(0)
  })
})

// =============================================================================
// DEFAULT_BASE_COMPLEXITY
// =============================================================================

describe('DEFAULT_BASE_COMPLEXITY', () => {
  it('is 1 (moderately complex)', () => {
    expect(DEFAULT_BASE_COMPLEXITY).toBe(1)
  })
})

// =============================================================================
// BASE_SKILL_COMPLEXITY
// =============================================================================

describe('BASE_SKILL_COMPLEXITY', () => {
  it('basic skills have complexity 0 (trivial)', () => {
    expect(BASE_SKILL_COMPLEXITY['basic.directAddition']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.directSubtraction']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.heavenBead']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.heavenBeadSubtraction']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.simpleCombinations']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.simpleCombinationsSub']).toBe(0)
  })

  it('five complement skills have complexity 1 (single substitution)', () => {
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.4=5-1']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.3=5-2']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.2=5-3']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.1=5-4']).toBe(1)
  })

  it('five complement subtraction skills have complexity 1', () => {
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-4=-5+1']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-3=-5+2']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-2=-5+3']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-1=-5+4']).toBe(1)
  })

  it('ten complement skills have complexity 2 (cross-column)', () => {
    expect(BASE_SKILL_COMPLEXITY['tenComplements.9=10-1']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.5=10-5']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.1=10-9']).toBe(2)
  })

  it('ten complement subtraction skills have complexity 2', () => {
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-9=+1-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-5=+5-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-1=+9-10']).toBe(2)
  })

  it('advanced cascading skills have complexity 3 (multi-column)', () => {
    expect(BASE_SKILL_COMPLEXITY['advanced.cascadingCarry']).toBe(3)
    expect(BASE_SKILL_COMPLEXITY['advanced.cascadingBorrow']).toBe(3)
  })

  it('complexity increases from basic → five complements → ten complements → advanced', () => {
    const basic = BASE_SKILL_COMPLEXITY['basic.directAddition']
    const fiveComp = BASE_SKILL_COMPLEXITY['fiveComplements.4=5-1']
    const tenComp = BASE_SKILL_COMPLEXITY['tenComplements.9=10-1']
    const advanced = BASE_SKILL_COMPLEXITY['advanced.cascadingCarry']

    expect(basic).toBeLessThan(fiveComp)
    expect(fiveComp).toBeLessThan(tenComp)
    expect(tenComp).toBeLessThan(advanced)
  })

  it('all complexity values are non-negative integers', () => {
    for (const [skillId, cost] of Object.entries(BASE_SKILL_COMPLEXITY)) {
      expect(cost, `${skillId} should be non-negative`).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(cost), `${skillId} should be integer`).toBe(true)
    }
  })

  it('has entries for all expected skill categories', () => {
    const categories = new Set(Object.keys(BASE_SKILL_COMPLEXITY).map((k) => k.split('.')[0]))
    expect(categories.has('basic')).toBe(true)
    expect(categories.has('fiveComplements')).toBe(true)
    expect(categories.has('fiveComplementsSub')).toBe(true)
    expect(categories.has('tenComplements')).toBe(true)
    expect(categories.has('tenComplementsSub')).toBe(true)
    expect(categories.has('advanced')).toBe(true)
  })
})

// =============================================================================
// getBaseComplexity
// =============================================================================

describe('getBaseComplexity', () => {
  it('returns correct cost for known skills', () => {
    expect(getBaseComplexity('basic.directAddition')).toBe(0)
    expect(getBaseComplexity('fiveComplements.4=5-1')).toBe(1)
    expect(getBaseComplexity('tenComplements.9=10-1')).toBe(2)
    expect(getBaseComplexity('advanced.cascadingCarry')).toBe(3)
  })

  it('returns DEFAULT_BASE_COMPLEXITY for unknown skills', () => {
    expect(getBaseComplexity('unknown.skill')).toBe(DEFAULT_BASE_COMPLEXITY)
    expect(getBaseComplexity('nonexistent.category')).toBe(DEFAULT_BASE_COMPLEXITY)
    expect(getBaseComplexity('')).toBe(DEFAULT_BASE_COMPLEXITY)
  })

  it('returns the same value as direct lookup in BASE_SKILL_COMPLEXITY', () => {
    for (const skillId of Object.keys(BASE_SKILL_COMPLEXITY)) {
      expect(getBaseComplexity(skillId)).toBe(BASE_SKILL_COMPLEXITY[skillId])
    }
  })
})
