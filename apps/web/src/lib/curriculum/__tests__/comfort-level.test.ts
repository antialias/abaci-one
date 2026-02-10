import { describe, it, expect } from 'vitest'
import { computeComfortLevel, applyTermCountOverride } from '../comfort-level'
import type { SkillBktResult } from '../bkt/types'

// ============================================================================
// Helper factories
// ============================================================================

function makeBktResult(skillId: string, pKnown: number, confidence: number): SkillBktResult {
  return {
    skillId,
    pKnown,
    confidence,
    uncertaintyRange: { low: pKnown - 0.1, high: pKnown + 0.1 },
    opportunities: 10,
    successCount: 8,
    classification: 'developing' as const,
    lastPracticedAt: new Date(),
    daysSinceLastPractice: 1,
    params: { pInit: 0.3, pLearn: 0.1, pSlip: 0.1, pGuess: 0.2 },
  } as SkillBktResult
}

function makeSessionMode(type: 'remediation' | 'progression' | 'maintenance') {
  if (type === 'remediation') {
    return { type: 'remediation' as const, weakSkills: [], focusDescription: '', skillCount: 0 }
  }
  if (type === 'progression') {
    return {
      type: 'progression' as const,
      nextSkill: { skillId: 'x', displayName: 'x' },
      phase: 'basic-addition' as any,
      focusDescription: '',
      skillCount: 0,
    }
  }
  return { type: 'maintenance' as const, focusDescription: '', skillCount: 0 }
}

// ============================================================================
// computeComfortLevel
// ============================================================================

describe('computeComfortLevel', () => {
  // --------------------------------------------------------------------------
  // No BKT data (conservative default)
  // --------------------------------------------------------------------------
  describe('when no BKT data is available', () => {
    it('returns conservative default 0.3 when bktResults is undefined', () => {
      const result = computeComfortLevel(undefined, ['skill-a'], makeSessionMode('maintenance'))
      expect(result.comfortLevel).toBe(0.3)
      expect(result.factors.avgMastery).toBeNull()
    })

    it('returns conservative default 0.3 when bktResults map is empty', () => {
      const result = computeComfortLevel(new Map(), ['skill-a'], makeSessionMode('maintenance'))
      expect(result.comfortLevel).toBe(0.3)
      expect(result.factors.avgMastery).toBeNull()
    })

    it('returns 0.3 when bktResults has data but none matches practicing skills', () => {
      const bkt = new Map([['unrelated-skill', makeBktResult('unrelated-skill', 0.9, 0.8)]])
      const result = computeComfortLevel(
        bkt,
        ['skill-a', 'skill-b'],
        makeSessionMode('maintenance')
      )
      expect(result.comfortLevel).toBe(0.3)
      expect(result.factors.avgMastery).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // Mode multipliers
  // --------------------------------------------------------------------------
  describe('mode multipliers', () => {
    it('applies remediation multiplier (0.6)', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.8, 1.0)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('remediation'))

      // avgMastery = 0.8 * 1.0 / 1.0 = 0.8
      // comfort = 0.8 * 0.6 + skillCountBonus
      expect(result.factors.modeMultiplier).toBe(0.6)
      expect(result.factors.sessionMode).toBe('remediation')
      const skillCountBonus = Math.min(0.15, Math.log(2) / 20)
      expect(result.comfortLevel).toBeCloseTo(0.8 * 0.6 + skillCountBonus)
    })

    it('applies progression multiplier (0.85)', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.8, 1.0)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('progression'))

      expect(result.factors.modeMultiplier).toBe(0.85)
      expect(result.factors.sessionMode).toBe('progression')
      const skillCountBonus = Math.min(0.15, Math.log(2) / 20)
      expect(result.comfortLevel).toBeCloseTo(0.8 * 0.85 + skillCountBonus)
    })

    it('applies maintenance multiplier (1.0)', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.8, 1.0)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('maintenance'))

      expect(result.factors.modeMultiplier).toBe(1.0)
      expect(result.factors.sessionMode).toBe('maintenance')
      const skillCountBonus = Math.min(0.15, Math.log(2) / 20)
      expect(result.comfortLevel).toBeCloseTo(0.8 * 1.0 + skillCountBonus)
    })
  })

  // --------------------------------------------------------------------------
  // Confidence-weighted average mastery
  // --------------------------------------------------------------------------
  describe('confidence-weighted averaging', () => {
    it('uses confidence as weight for the average', () => {
      const bkt = new Map([
        ['s1', makeBktResult('s1', 0.9, 0.5)], // high mastery, low confidence
        ['s2', makeBktResult('s2', 0.3, 1.0)], // low mastery, high confidence
      ])
      const result = computeComfortLevel(bkt, ['s1', 's2'], makeSessionMode('maintenance'))

      // weighted avg = (0.9*0.5 + 0.3*1.0) / (0.5 + 1.0) = 0.75 / 1.5 = 0.5
      expect(result.factors.avgMastery).toBeCloseTo(0.5)
    })

    it('ignores skills not in practicingSkillIds', () => {
      const bkt = new Map([
        ['s1', makeBktResult('s1', 0.9, 1.0)],
        ['s2', makeBktResult('s2', 0.1, 1.0)], // not in practicing list
      ])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('maintenance'))

      // Only s1 is considered
      expect(result.factors.avgMastery).toBeCloseTo(0.9)
    })

    it('handles single skill correctly', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.7, 0.8)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('maintenance'))

      // weighted avg = (0.7 * 0.8) / 0.8 = 0.7
      expect(result.factors.avgMastery).toBeCloseTo(0.7)
    })
  })

  // --------------------------------------------------------------------------
  // Skill count bonus
  // --------------------------------------------------------------------------
  describe('skill count bonus', () => {
    it('computes bonus as min(0.15, log(count+1)/20)', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.5, 1.0)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('maintenance'))
      const expected = Math.min(0.15, Math.log(2) / 20)
      expect(result.factors.skillCountBonus).toBeCloseTo(expected)
    })

    it('caps skill count bonus at 0.15', () => {
      // Need a large number of skills to exceed 0.15
      // log(n+1)/20 > 0.15 → log(n+1) > 3 → n+1 > e^3 ≈ 20 → n > 19
      const skills = Array.from({ length: 50 }, (_, i) => `s${i}`)
      const bkt = new Map(skills.map((s) => [s, makeBktResult(s, 0.5, 1.0)]))
      const result = computeComfortLevel(bkt, skills, makeSessionMode('maintenance'))
      expect(result.factors.skillCountBonus).toBe(0.15)
    })

    it('gives zero bonus when empty array of skills', () => {
      // log(0+1)/20 = log(1)/20 = 0
      const result = computeComfortLevel(undefined, [], makeSessionMode('maintenance'))
      expect(result.factors.skillCountBonus).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Clamping to [0, 1]
  // --------------------------------------------------------------------------
  describe('clamping', () => {
    it('clamps to 1.0 when computed value exceeds 1', () => {
      // pKnown=1.0, confidence=1.0, maintenance (mult=1.0), many skills
      const skills = Array.from({ length: 30 }, (_, i) => `s${i}`)
      const bkt = new Map(skills.map((s) => [s, makeBktResult(s, 1.0, 1.0)]))
      const result = computeComfortLevel(bkt, skills, makeSessionMode('maintenance'))

      // 1.0 * 1.0 + 0.15 = 1.15 → clamp to 1.0
      expect(result.comfortLevel).toBe(1.0)
    })

    it('never returns negative comfort level', () => {
      // All skills with pKnown=0, remediation mode (0.6 mult)
      const bkt = new Map([['s1', makeBktResult('s1', 0.0, 1.0)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('remediation'))

      // 0.0 * 0.6 + small bonus = small positive
      expect(result.comfortLevel).toBeGreaterThanOrEqual(0)
    })
  })

  // --------------------------------------------------------------------------
  // Factors structure
  // --------------------------------------------------------------------------
  describe('factors', () => {
    it('returns all expected factor fields', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.7, 0.9)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('progression'))

      expect(result.factors).toHaveProperty('avgMastery')
      expect(result.factors).toHaveProperty('sessionMode')
      expect(result.factors).toHaveProperty('modeMultiplier')
      expect(result.factors).toHaveProperty('skillCountBonus')
      expect(typeof result.factors.avgMastery).toBe('number')
      expect(result.factors.sessionMode).toBe('progression')
      expect(typeof result.factors.modeMultiplier).toBe('number')
      expect(typeof result.factors.skillCountBonus).toBe('number')
    })
  })

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles practicing skills list with no matching BKT entries', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.8, 1.0)]])
      const result = computeComfortLevel(bkt, ['s999'], makeSessionMode('maintenance'))
      // No matching skills → avgMastery null → conservative default 0.3
      expect(result.comfortLevel).toBe(0.3)
    })

    it('handles zero confidence correctly', () => {
      const bkt = new Map([['s1', makeBktResult('s1', 0.8, 0.0)]])
      const result = computeComfortLevel(bkt, ['s1'], makeSessionMode('maintenance'))
      // Zero confidence → totalWeight = 0 → avgMastery null → 0.3
      expect(result.comfortLevel).toBe(0.3)
      expect(result.factors.avgMastery).toBeNull()
    })
  })
})

// ============================================================================
// applyTermCountOverride
// ============================================================================

describe('applyTermCountOverride', () => {
  // --------------------------------------------------------------------------
  // No override
  // --------------------------------------------------------------------------
  describe('when override is null or undefined', () => {
    it('returns computed range unchanged when override is null', () => {
      const computed = { min: 3, max: 6 }
      expect(applyTermCountOverride(computed, null)).toEqual({ min: 3, max: 6 })
    })

    it('returns computed range unchanged when override is undefined', () => {
      const computed = { min: 3, max: 6 }
      expect(applyTermCountOverride(computed, undefined)).toEqual({ min: 3, max: 6 })
    })
  })

  // --------------------------------------------------------------------------
  // Override acts as ceiling
  // --------------------------------------------------------------------------
  describe('override ceiling behavior', () => {
    it('caps max to override max when computed max exceeds it', () => {
      const computed = { min: 3, max: 8 }
      const override = { min: 2, max: 5 }
      const result = applyTermCountOverride(computed, override)
      expect(result.max).toBe(5)
    })

    it('does not raise computed max when override max is higher', () => {
      const computed = { min: 3, max: 5 }
      const override = { min: 2, max: 10 }
      const result = applyTermCountOverride(computed, override)
      expect(result.max).toBe(5)
    })

    it('caps computed min to override max', () => {
      const computed = { min: 6, max: 8 }
      const override = { min: 2, max: 4 }
      const result = applyTermCountOverride(computed, override)
      // finalMin = min(6, 4) = 4, finalMax = min(8, 4) = 4
      // min = max(2, min(4, 4)) = 4, max = max(2, 4) = 4
      expect(result.min).toBe(4)
      expect(result.max).toBe(4)
    })
  })

  // --------------------------------------------------------------------------
  // Floor of 2
  // --------------------------------------------------------------------------
  describe('minimum floor of 2', () => {
    it('ensures min is at least 2', () => {
      const computed = { min: 1, max: 3 }
      const override = { min: 1, max: 3 }
      const result = applyTermCountOverride(computed, override)
      expect(result.min).toBeGreaterThanOrEqual(2)
    })

    it('ensures max is at least 2', () => {
      const computed = { min: 1, max: 1 }
      const override = { min: 1, max: 1 }
      const result = applyTermCountOverride(computed, override)
      expect(result.max).toBeGreaterThanOrEqual(2)
    })

    it('ensures min <= max when override forces low values', () => {
      const computed = { min: 3, max: 4 }
      const override = { min: 1, max: 2 }
      const result = applyTermCountOverride(computed, override)
      expect(result.min).toBeLessThanOrEqual(result.max)
      expect(result.min).toBeGreaterThanOrEqual(2)
      expect(result.max).toBeGreaterThanOrEqual(2)
    })
  })

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles identical computed and override ranges', () => {
      const computed = { min: 3, max: 6 }
      const override = { min: 3, max: 6 }
      const result = applyTermCountOverride(computed, override)
      expect(result).toEqual({ min: 3, max: 6 })
    })

    it('handles override with min=0 max=0', () => {
      const computed = { min: 3, max: 6 }
      const override = { min: 0, max: 0 }
      const result = applyTermCountOverride(computed, override)
      // Floors apply: both become 2
      expect(result.min).toBe(2)
      expect(result.max).toBe(2)
    })

    it('handles very large computed ranges', () => {
      const computed = { min: 2, max: 100 }
      const override = { min: 3, max: 5 }
      const result = applyTermCountOverride(computed, override)
      expect(result.max).toBe(5)
      expect(result.min).toBeLessThanOrEqual(result.max)
    })
  })
})
