/**
 * @vitest-environment node
 *
 * Term Count Scaling Unit Tests
 *
 * Tests for the dynamic term count system that adjusts problem length
 * based on student mastery (comfort level).
 */

import { describe, expect, it } from 'vitest'
import type { SkillBktResult } from '@/lib/curriculum/bkt'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import {
  computeTermCountRange,
  TERM_COUNT_SCALING,
} from '@/lib/curriculum/config/term-count-scaling'
import { computeComfortLevel, applyTermCountOverride } from '@/lib/curriculum/comfort-level'

// =============================================================================
// Helpers
// =============================================================================

function createBktResult(skillId: string, pKnown: number, confidence: number): SkillBktResult {
  return {
    skillId,
    pKnown,
    confidence,
    uncertaintyRange: { low: pKnown - 0.1, high: pKnown + 0.1 },
    opportunities: 10,
    successCount: Math.round(pKnown * 10),
    lastPracticedAt: new Date(),
    masteryClassification: pKnown >= 0.8 ? 'strong' : pKnown >= 0.5 ? 'developing' : 'weak',
  }
}

function createSessionMode(type: 'remediation' | 'progression' | 'maintenance'): SessionMode {
  if (type === 'remediation') {
    return {
      type: 'remediation',
      weakSkills: [],
      focusDescription: 'Remediation',
    }
  }
  if (type === 'progression') {
    return {
      type: 'progression',
      nextSkill: { id: 'basic.+1', name: 'Add 1', category: 'basic' },
      phase: {
        id: 'L1.add.+1.direct',
        level: 'L1',
        operation: 'addition',
        description: 'Direct +1',
        skillsIntroduced: ['basic.+1'],
        prerequisitePhases: [],
        criteria: { minAccuracy: 0.8, minProblems: 10 },
      },
      tutorialRequired: false,
      skipCount: 0,
      focusDescription: 'Progression',
      canSkipTutorial: false,
    }
  }
  return {
    type: 'maintenance',
    focusDescription: 'Maintenance',
    skillCount: 5,
  }
}

// =============================================================================
// computeTermCountRange
// =============================================================================

describe('computeTermCountRange', () => {
  it('returns floor values at comfort level 0', () => {
    expect(computeTermCountRange('abacus', 0)).toEqual({ min: 2, max: 3 })
    expect(computeTermCountRange('visualization', 0)).toEqual({ min: 2, max: 2 })
    expect(computeTermCountRange('linear', 0)).toEqual({ min: 2, max: 3 })
  })

  it('returns ceiling values at comfort level 1', () => {
    expect(computeTermCountRange('abacus', 1)).toEqual({ min: 4, max: 8 })
    expect(computeTermCountRange('visualization', 1)).toEqual({ min: 3, max: 6 })
    expect(computeTermCountRange('linear', 1)).toEqual({ min: 4, max: 8 })
  })

  it('interpolates at comfort level 0.5', () => {
    const abacus = computeTermCountRange('abacus', 0.5)
    // floor.min=2, ceiling.min=4 → lerp = 3
    // floor.max=3, ceiling.max=8 → lerp = 5.5 → rounds to 6
    expect(abacus.min).toBe(3)
    expect(abacus.max).toBe(6)

    const vis = computeTermCountRange('visualization', 0.5)
    // floor.min=2, ceiling.min=3 → lerp = 2.5 → rounds to 3
    // floor.max=2, ceiling.max=6 → lerp = 4
    expect(vis.min).toBe(3)
    expect(vis.max).toBe(4)
  })

  it('clamps comfort below 0 to 0', () => {
    expect(computeTermCountRange('abacus', -0.5)).toEqual({ min: 2, max: 3 })
  })

  it('clamps comfort above 1 to 1', () => {
    expect(computeTermCountRange('abacus', 1.5)).toEqual({ min: 4, max: 8 })
  })

  it('ensures min <= max for all comfort levels', () => {
    for (const partType of ['abacus', 'visualization', 'linear'] as const) {
      for (let comfort = 0; comfort <= 1; comfort += 0.1) {
        const range = computeTermCountRange(partType, comfort)
        expect(range.min).toBeLessThanOrEqual(range.max)
        expect(range.min).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('returns integer values', () => {
    for (let comfort = 0; comfort <= 1; comfort += 0.07) {
      const range = computeTermCountRange('abacus', comfort)
      expect(Number.isInteger(range.min)).toBe(true)
      expect(Number.isInteger(range.max)).toBe(true)
    }
  })
})

// =============================================================================
// computeComfortLevel
// =============================================================================

describe('computeComfortLevel', () => {
  it('returns conservative default when no BKT data', () => {
    const result = computeComfortLevel(undefined, ['basic.+1'], createSessionMode('maintenance'))
    expect(result.comfortLevel).toBe(0.3)
    expect(result.factors.avgMastery).toBeNull()
  })

  it('returns conservative default when BKT map is empty', () => {
    const result = computeComfortLevel(new Map(), ['basic.+1'], createSessionMode('maintenance'))
    expect(result.comfortLevel).toBe(0.3)
    expect(result.factors.avgMastery).toBeNull()
  })

  it('returns conservative default when no practicing skills have BKT data', () => {
    const bkt = new Map([['basic.+2', createBktResult('basic.+2', 0.9, 0.8)]])
    // practicing skill is +1 but BKT only has +2
    const result = computeComfortLevel(bkt, ['basic.+1'], createSessionMode('maintenance'))
    expect(result.comfortLevel).toBe(0.3)
    expect(result.factors.avgMastery).toBeNull()
  })

  it('computes high comfort for mastered skills in maintenance mode', () => {
    const bkt = new Map([
      ['basic.+1', createBktResult('basic.+1', 0.9, 0.8)],
      ['basic.+2', createBktResult('basic.+2', 0.85, 0.9)],
    ])
    const result = computeComfortLevel(
      bkt,
      ['basic.+1', 'basic.+2'],
      createSessionMode('maintenance')
    )
    // avgMastery ≈ (0.9*0.8 + 0.85*0.9) / (0.8+0.9) ≈ 0.874
    // modeMultiplier = 1.0, skillCountBonus = log(3)/20 ≈ 0.055
    // comfort ≈ 0.874 * 1.0 + 0.055 ≈ 0.929
    expect(result.comfortLevel).toBeGreaterThan(0.85)
    expect(result.comfortLevel).toBeLessThanOrEqual(1.0)
    expect(result.factors.avgMastery).not.toBeNull()
    expect(result.factors.modeMultiplier).toBe(1.0)
    expect(result.factors.sessionMode).toBe('maintenance')
  })

  it('reduces comfort for remediation mode', () => {
    const bkt = new Map([['basic.+1', createBktResult('basic.+1', 0.5, 0.7)]])
    const maintenance = computeComfortLevel(bkt, ['basic.+1'], createSessionMode('maintenance'))
    const remediation = computeComfortLevel(bkt, ['basic.+1'], createSessionMode('remediation'))
    expect(remediation.comfortLevel).toBeLessThan(maintenance.comfortLevel)
    expect(remediation.factors.modeMultiplier).toBe(0.6)
  })

  it('reduces comfort for progression mode', () => {
    const bkt = new Map([['basic.+1', createBktResult('basic.+1', 0.7, 0.8)]])
    const maintenance = computeComfortLevel(bkt, ['basic.+1'], createSessionMode('maintenance'))
    const progression = computeComfortLevel(bkt, ['basic.+1'], createSessionMode('progression'))
    expect(progression.comfortLevel).toBeLessThan(maintenance.comfortLevel)
    expect(progression.factors.modeMultiplier).toBe(0.85)
  })

  it('gives skill count bonus for more skills', () => {
    const bkt = new Map([
      ['basic.+1', createBktResult('basic.+1', 0.7, 0.8)],
      ['basic.+2', createBktResult('basic.+2', 0.7, 0.8)],
      ['basic.+3', createBktResult('basic.+3', 0.7, 0.8)],
      ['basic.+4', createBktResult('basic.+4', 0.7, 0.8)],
      ['basic.+5', createBktResult('basic.+5', 0.7, 0.8)],
    ])
    const fewSkills = computeComfortLevel(bkt, ['basic.+1'], createSessionMode('maintenance'))
    const manySkills = computeComfortLevel(
      bkt,
      ['basic.+1', 'basic.+2', 'basic.+3', 'basic.+4', 'basic.+5'],
      createSessionMode('maintenance')
    )
    expect(manySkills.factors.skillCountBonus).toBeGreaterThan(fewSkills.factors.skillCountBonus)
  })

  it('clamps comfort to [0, 1]', () => {
    // Very high mastery + many skills could push above 1
    const bkt = new Map<string, SkillBktResult>()
    const skills: string[] = []
    for (let i = 1; i <= 20; i++) {
      const id = `basic.+${i}`
      bkt.set(id, createBktResult(id, 0.99, 0.99))
      skills.push(id)
    }
    const result = computeComfortLevel(bkt, skills, createSessionMode('maintenance'))
    expect(result.comfortLevel).toBeLessThanOrEqual(1.0)
    expect(result.comfortLevel).toBeGreaterThanOrEqual(0)
  })

  it('weights by BKT confidence', () => {
    // One high-confidence strong skill, one low-confidence weak skill
    const bkt = new Map([
      ['basic.+1', createBktResult('basic.+1', 0.9, 0.9)], // strong, high confidence
      ['basic.+2', createBktResult('basic.+2', 0.2, 0.1)], // weak, low confidence
    ])
    const result = computeComfortLevel(
      bkt,
      ['basic.+1', 'basic.+2'],
      createSessionMode('maintenance')
    )
    // The strong skill should dominate due to higher confidence weight
    expect(result.factors.avgMastery).toBeGreaterThan(0.7)
  })
})

// =============================================================================
// applyTermCountOverride
// =============================================================================

describe('applyTermCountOverride', () => {
  it('returns computed range when no override', () => {
    expect(applyTermCountOverride({ min: 3, max: 7 }, null)).toEqual({ min: 3, max: 7 })
    expect(applyTermCountOverride({ min: 3, max: 7 }, undefined)).toEqual({ min: 3, max: 7 })
  })

  it('caps max when override is lower', () => {
    const result = applyTermCountOverride({ min: 3, max: 7 }, { min: 3, max: 5 })
    expect(result.max).toBe(5)
  })

  it('caps min when it would exceed override max', () => {
    const result = applyTermCountOverride({ min: 4, max: 8 }, { min: 2, max: 3 })
    expect(result.min).toBeLessThanOrEqual(result.max)
    expect(result.max).toBe(3)
  })

  it('does not raise computed range', () => {
    // Override is higher than computed — should not raise
    const result = applyTermCountOverride({ min: 2, max: 4 }, { min: 3, max: 8 })
    expect(result.max).toBe(4) // stays at computed max
    expect(result.min).toBe(2)
  })

  it('ensures min >= 2 always', () => {
    const result = applyTermCountOverride({ min: 2, max: 5 }, { min: 1, max: 2 })
    expect(result.min).toBeGreaterThanOrEqual(2)
    expect(result.max).toBeGreaterThanOrEqual(2)
  })

  it('handles override that constrains both ends', () => {
    const result = applyTermCountOverride({ min: 3, max: 7 }, { min: 2, max: 4 })
    expect(result.min).toBe(3) // min stays (doesn't exceed override.max=4)
    expect(result.max).toBe(4) // capped at override.max
  })
})

// =============================================================================
// Integration: Full Pipeline
// =============================================================================

describe('integration: comfort → range → override', () => {
  it('new student with no data gets moderate range', () => {
    const { comfortLevel } = computeComfortLevel(
      undefined,
      ['basic.+1'],
      createSessionMode('maintenance')
    )
    expect(comfortLevel).toBe(0.3)

    const abacus = computeTermCountRange('abacus', comfortLevel)
    // At 0.3: min = round(2 + 2*0.3) = round(2.6) = 3
    //         max = round(3 + 5*0.3) = round(4.5) = 5 (rounding to nearest)
    expect(abacus.min).toBeGreaterThanOrEqual(2)
    expect(abacus.max).toBeGreaterThanOrEqual(abacus.min)
    expect(abacus.max).toBeLessThanOrEqual(6)
  })

  it('weak student in remediation gets short problems', () => {
    const bkt = new Map([['basic.+1', createBktResult('basic.+1', 0.3, 0.7)]])
    const { comfortLevel } = computeComfortLevel(
      bkt,
      ['basic.+1'],
      createSessionMode('remediation')
    )
    // pKnown=0.3, modeMultiplier=0.6, bonus≈0.035
    // comfort ≈ 0.3 * 0.6 + 0.035 ≈ 0.215
    expect(comfortLevel).toBeLessThan(0.3)

    const abacus = computeTermCountRange('abacus', comfortLevel)
    expect(abacus.min).toBe(2)
    expect(abacus.max).toBeLessThanOrEqual(4)
  })

  it('strong student gets longer problems', () => {
    const bkt = new Map([
      ['basic.+1', createBktResult('basic.+1', 0.9, 0.9)],
      ['basic.+2', createBktResult('basic.+2', 0.85, 0.85)],
      ['basic.+3', createBktResult('basic.+3', 0.88, 0.88)],
    ])
    const { comfortLevel } = computeComfortLevel(
      bkt,
      ['basic.+1', 'basic.+2', 'basic.+3'],
      createSessionMode('maintenance')
    )
    expect(comfortLevel).toBeGreaterThan(0.7)

    const abacus = computeTermCountRange('abacus', comfortLevel)
    expect(abacus.min).toBeGreaterThanOrEqual(3)
    expect(abacus.max).toBeGreaterThanOrEqual(6)
  })

  it('parent override caps strong student', () => {
    const bkt = new Map([['basic.+1', createBktResult('basic.+1', 0.9, 0.9)]])
    const { comfortLevel } = computeComfortLevel(
      bkt,
      ['basic.+1'],
      createSessionMode('maintenance')
    )
    const dynamicRange = computeTermCountRange('abacus', comfortLevel)
    const finalRange = applyTermCountOverride(dynamicRange, { min: 3, max: 5 })

    expect(finalRange.max).toBeLessThanOrEqual(5)
  })

  it('matches expected numeric examples from plan', () => {
    // Developing student (pKnown ~0.6, progression mode)
    const bkt = new Map([
      ['basic.+1', createBktResult('basic.+1', 0.6, 0.7)],
      ['basic.+2', createBktResult('basic.+2', 0.6, 0.7)],
    ])
    const { comfortLevel } = computeComfortLevel(
      bkt,
      ['basic.+1', 'basic.+2'],
      createSessionMode('progression')
    )
    // Expect comfort around 0.5 (0.6 * 0.85 + bonus)
    expect(comfortLevel).toBeGreaterThan(0.4)
    expect(comfortLevel).toBeLessThan(0.7)

    const abacus = computeTermCountRange('abacus', comfortLevel)
    // Should be in the 3-6 range area
    expect(abacus.min).toBeGreaterThanOrEqual(2)
    expect(abacus.max).toBeGreaterThanOrEqual(4)
    expect(abacus.max).toBeLessThanOrEqual(7)
  })
})

// =============================================================================
// TERM_COUNT_SCALING config validation
// =============================================================================

describe('TERM_COUNT_SCALING config', () => {
  it('has valid ranges for all part types', () => {
    for (const [partType, scaling] of Object.entries(TERM_COUNT_SCALING)) {
      expect(scaling.floor.min).toBeLessThanOrEqual(scaling.floor.max)
      expect(scaling.ceiling.min).toBeLessThanOrEqual(scaling.ceiling.max)
      expect(scaling.floor.min).toBeGreaterThanOrEqual(2)
      expect(scaling.ceiling.min).toBeGreaterThanOrEqual(2)
      // Ceiling should be >= floor
      expect(scaling.ceiling.max).toBeGreaterThanOrEqual(scaling.floor.max)
    }
  })

  it('visualization has lower ranges than abacus', () => {
    // Mental math is harder, so visualization should have fewer terms
    expect(TERM_COUNT_SCALING.visualization.ceiling.max).toBeLessThanOrEqual(
      TERM_COUNT_SCALING.abacus.ceiling.max
    )
  })
})
