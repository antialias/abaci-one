/**
 * @vitest-environment node
 *
 * Tests for problem-generation.ts
 *
 * Tests the pure utility functions:
 * - parseSkillId: Parses "category.key" format
 * - enableSkill: Mutates a SkillSet to enable a skill
 * - getPrerequisiteSkills: Returns dependency chain
 * - createSkillSetForTarget: Creates a SkillSet with prerequisites
 * - createTargetSkillSet: Creates a SkillSet with only the target enabled
 * - generateRealisticProblems: Generates problems targeting a skill
 */

import { describe, expect, it } from 'vitest'
import {
  parseSkillId,
  enableSkill,
  getPrerequisiteSkills,
  createSkillSetForTarget,
  createTargetSkillSet,
  generateRealisticProblems,
} from '../problem-generation'
import { createEmptySkillSet } from '../../../types/tutorial'

// =============================================================================
// parseSkillId
// =============================================================================

describe('parseSkillId', () => {
  it('parses a valid two-part skill ID', () => {
    expect(parseSkillId('basic.directAddition')).toEqual({
      category: 'basic',
      key: 'directAddition',
    })
  })

  it('parses five complement skill IDs', () => {
    expect(parseSkillId('fiveComplements.4=5-1')).toEqual({
      category: 'fiveComplements',
      key: '4=5-1',
    })
  })

  it('parses ten complement skill IDs', () => {
    expect(parseSkillId('tenComplements.9=10-1')).toEqual({
      category: 'tenComplements',
      key: '9=10-1',
    })
  })

  it('parses five complement subtraction skill IDs', () => {
    expect(parseSkillId('fiveComplementsSub.-4=-5+1')).toEqual({
      category: 'fiveComplementsSub',
      key: '-4=-5+1',
    })
  })

  it('parses ten complement subtraction skill IDs', () => {
    expect(parseSkillId('tenComplementsSub.-9=+1-10')).toEqual({
      category: 'tenComplementsSub',
      key: '-9=+1-10',
    })
  })

  it('returns null for single-part IDs', () => {
    expect(parseSkillId('basic')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSkillId('')).toBeNull()
  })

  it('returns null for three-part IDs', () => {
    expect(parseSkillId('a.b.c')).toBeNull()
  })
})

// =============================================================================
// enableSkill
// =============================================================================

describe('enableSkill', () => {
  it('enables a basic skill', () => {
    const skillSet = createEmptySkillSet()
    expect(skillSet.basic.directAddition).toBe(false)

    enableSkill(skillSet, 'basic.directAddition')
    expect(skillSet.basic.directAddition).toBe(true)
  })

  it('enables a five complement skill', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'fiveComplements.4=5-1')
    expect(skillSet.fiveComplements['4=5-1']).toBe(true)
  })

  it('enables a ten complement skill', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'tenComplements.9=10-1')
    expect(skillSet.tenComplements['9=10-1']).toBe(true)
  })

  it('enables a five complement subtraction skill', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'fiveComplementsSub.-4=-5+1')
    expect(skillSet.fiveComplementsSub['-4=-5+1']).toBe(true)
  })

  it('enables a ten complement subtraction skill', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'tenComplementsSub.-9=+1-10')
    expect(skillSet.tenComplementsSub['-9=+1-10']).toBe(true)
  })

  it('enables an advanced skill', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'advanced.cascadingCarry')
    expect(skillSet.advanced.cascadingCarry).toBe(true)
  })

  it('does nothing for invalid skill ID format', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'invalid')

    // Nothing should have changed
    expect(skillSet.basic.directAddition).toBe(false)
  })

  it('does nothing for unknown category', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'unknown.skill')

    // Nothing should have changed
    expect(skillSet.basic.directAddition).toBe(false)
  })

  it('does nothing for unknown key in valid category', () => {
    const skillSet = createEmptySkillSet()
    enableSkill(skillSet, 'basic.unknownKey')

    // Nothing should have changed - key doesn't exist in category
    expect(skillSet.basic.directAddition).toBe(false)
  })

  it('mutates the input skillSet (not a copy)', () => {
    const skillSet = createEmptySkillSet()
    const sameRef = skillSet
    enableSkill(skillSet, 'basic.directAddition')
    expect(sameRef.basic.directAddition).toBe(true)
  })
})

// =============================================================================
// getPrerequisiteSkills
// =============================================================================

describe('getPrerequisiteSkills', () => {
  it('returns empty array for basic.directAddition (root skill)', () => {
    expect(getPrerequisiteSkills('basic.directAddition')).toEqual([])
  })

  it('returns directAddition as prerequisite for other basic skills', () => {
    const prereqs = getPrerequisiteSkills('basic.heavenBead')
    expect(prereqs).toEqual(['basic.directAddition'])
  })

  it('returns basic skills as prerequisites for fiveComplements', () => {
    const prereqs = getPrerequisiteSkills('fiveComplements.4=5-1')
    expect(prereqs).toContain('basic.directAddition')
    expect(prereqs).toContain('basic.heavenBead')
    expect(prereqs).toHaveLength(2)
  })

  it('returns full prerequisite chain for tenComplements', () => {
    const prereqs = getPrerequisiteSkills('tenComplements.9=10-1')

    // Should include basic skills and all five complement skills
    expect(prereqs).toContain('basic.directAddition')
    expect(prereqs).toContain('basic.heavenBead')
    expect(prereqs).toContain('basic.simpleCombinations')
    expect(prereqs).toContain('fiveComplements.4=5-1')
    expect(prereqs).toContain('fiveComplements.3=5-2')
    expect(prereqs).toContain('fiveComplements.2=5-3')
    expect(prereqs).toContain('fiveComplements.1=5-4')
  })

  it('returns subtraction basic skills for fiveComplementsSub', () => {
    const prereqs = getPrerequisiteSkills('fiveComplementsSub.-4=-5+1')
    expect(prereqs).toContain('basic.directSubtraction')
    expect(prereqs).toContain('basic.heavenBeadSubtraction')
    expect(prereqs).toHaveLength(2)
  })

  it('returns full subtraction prerequisite chain for tenComplementsSub', () => {
    const prereqs = getPrerequisiteSkills('tenComplementsSub.-9=+1-10')
    expect(prereqs).toContain('basic.directSubtraction')
    expect(prereqs).toContain('basic.heavenBeadSubtraction')
    expect(prereqs).toContain('basic.simpleCombinationsSub')
    expect(prereqs).toContain('fiveComplementsSub.-4=-5+1')
    expect(prereqs).toContain('fiveComplementsSub.-3=-5+2')
    expect(prereqs).toContain('fiveComplementsSub.-2=-5+3')
    expect(prereqs).toContain('fiveComplementsSub.-1=-5+4')
  })

  it('returns empty array for unknown categories', () => {
    expect(getPrerequisiteSkills('unknown.skill')).toEqual([])
  })

  it('all ten complement skills share the same prerequisites', () => {
    const prereqs1 = getPrerequisiteSkills('tenComplements.9=10-1')
    const prereqs2 = getPrerequisiteSkills('tenComplements.1=10-9')
    expect(prereqs1).toEqual(prereqs2)
  })
})

// =============================================================================
// createSkillSetForTarget
// =============================================================================

describe('createSkillSetForTarget', () => {
  it('enables only directAddition for basic.directAddition target', () => {
    const skillSet = createSkillSetForTarget('basic.directAddition')

    expect(skillSet.basic.directAddition).toBe(true)
    // Nothing else should be enabled
    expect(skillSet.basic.heavenBead).toBe(false)
    expect(skillSet.fiveComplements['4=5-1']).toBe(false)
  })

  it('enables target and prerequisites for basic.heavenBead', () => {
    const skillSet = createSkillSetForTarget('basic.heavenBead')

    expect(skillSet.basic.directAddition).toBe(true) // prerequisite
    expect(skillSet.basic.heavenBead).toBe(true) // target
    expect(skillSet.basic.simpleCombinations).toBe(false) // not needed
  })

  it('enables full prerequisite chain for fiveComplements', () => {
    const skillSet = createSkillSetForTarget('fiveComplements.4=5-1')

    expect(skillSet.basic.directAddition).toBe(true)
    expect(skillSet.basic.heavenBead).toBe(true)
    expect(skillSet.fiveComplements['4=5-1']).toBe(true)
    // Other five complements should NOT be enabled
    expect(skillSet.fiveComplements['3=5-2']).toBe(false)
  })

  it('enables extensive chain for tenComplements', () => {
    const skillSet = createSkillSetForTarget('tenComplements.9=10-1')

    // Basic prerequisites
    expect(skillSet.basic.directAddition).toBe(true)
    expect(skillSet.basic.heavenBead).toBe(true)
    expect(skillSet.basic.simpleCombinations).toBe(true)

    // All five complement prerequisites
    expect(skillSet.fiveComplements['4=5-1']).toBe(true)
    expect(skillSet.fiveComplements['3=5-2']).toBe(true)
    expect(skillSet.fiveComplements['2=5-3']).toBe(true)
    expect(skillSet.fiveComplements['1=5-4']).toBe(true)

    // The target
    expect(skillSet.tenComplements['9=10-1']).toBe(true)

    // Other ten complements should NOT be enabled
    expect(skillSet.tenComplements['8=10-2']).toBe(false)
  })
})

// =============================================================================
// createTargetSkillSet
// =============================================================================

describe('createTargetSkillSet', () => {
  it('enables only the target skill (no prerequisites)', () => {
    const skillSet = createTargetSkillSet('fiveComplements.4=5-1')

    // Only the target should be enabled
    expect(skillSet.fiveComplements!['4=5-1']).toBe(true)

    // Prerequisites should NOT be enabled
    expect(skillSet.basic!.directAddition).toBe(false)
    expect(skillSet.basic!.heavenBead).toBe(false)
  })

  it('works for basic skills', () => {
    const skillSet = createTargetSkillSet('basic.directAddition')
    expect(skillSet.basic!.directAddition).toBe(true)
    expect(skillSet.basic!.heavenBead).toBe(false)
  })
})

// =============================================================================
// generateRealisticProblems
// =============================================================================

describe('generateRealisticProblems', () => {
  it('generates the requested number of problems', () => {
    const problems = generateRealisticProblems('basic.directAddition', 5)
    expect(problems).toHaveLength(5)
  })

  it('each problem has required fields', () => {
    const problems = generateRealisticProblems('basic.directAddition', 3)

    for (const p of problems) {
      expect(p.terms).toBeDefined()
      expect(Array.isArray(p.terms)).toBe(true)
      expect(p.terms.length).toBeGreaterThanOrEqual(2)
      expect(typeof p.answer).toBe('number')
      expect(p.skillsUsed).toEqual(['basic.directAddition'])
    }
  })

  it('forces single-skill annotation on generated problems', () => {
    const problems = generateRealisticProblems('basic.directAddition', 10)

    // Each problem should have exactly the target skill, even if the
    // problem generator would have tagged it with multiple
    for (const p of problems) {
      expect(p.skillsUsed).toEqual(['basic.directAddition'])
    }
  })

  it('generates problems for five complement skills', () => {
    const problems = generateRealisticProblems('fiveComplements.4=5-1', 5)
    expect(problems).toHaveLength(5)

    for (const p of problems) {
      expect(p.skillsUsed).toEqual(['fiveComplements.4=5-1'])
      expect(typeof p.answer).toBe('number')
    }
  })

  it('synthesizes fallback problems when target skill cannot be generated enough', () => {
    // Use a very restricted maxAttempts to force the fallback path
    const problems = generateRealisticProblems('basic.directAddition', 5, 1)

    // Should still produce 5 problems (synthesized ones)
    expect(problems).toHaveLength(5)

    // Each should have the target skill
    for (const p of problems) {
      expect(p.skillsUsed).toEqual(['basic.directAddition'])
    }
  })

  it('synthesized fallback problems have valid terms and answers', () => {
    // Force fallback by using maxAttempts=1
    const problems = generateRealisticProblems('basic.directAddition', 3, 1)

    for (const p of problems) {
      expect(p.terms.length).toBeGreaterThanOrEqual(2)
      // Synthesized problems are a + b where a,b in [1,8]
      // So answer should be terms[0] + terms[1]
      const sum = p.terms.reduce((s, t) => s + t, 0)
      expect(p.answer).toBe(sum)
    }
  })

  it('generates problems with correct answer computation', () => {
    const problems = generateRealisticProblems('basic.directAddition', 10)

    for (const p of problems) {
      // The answer should match the sum/combination of terms
      const computed = p.terms.reduce((s, t) => s + t, 0)
      expect(p.answer).toBe(computed)
    }
  })

  it('handles zero count', () => {
    const problems = generateRealisticProblems('basic.directAddition', 0)
    expect(problems).toHaveLength(0)
  })
})
