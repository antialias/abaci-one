/**
 * @vitest-environment node
 *
 * Unit tests for skill-changes.ts
 *
 * Tests computeSkillChanges and formatSkillChanges functions.
 */

import { describe, it, expect, vi } from 'vitest'
import type { SkillBktResult } from '@/lib/curriculum/bkt/types'

// Mock the BKT config module
vi.mock('@/lib/curriculum/config/bkt-integration', () => ({
  BKT_THRESHOLDS: {
    strong: 0.8,
    weak: 0.5,
    confidence: 0.3,
  },
}))

// Mock the skill display name function
vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillDisplayName: (skillId: string) => `Display(${skillId})`,
}))

import { computeSkillChanges, formatSkillChanges, type SkillChanges } from '@/lib/curriculum/skill-changes'

// =============================================================================
// Helpers
// =============================================================================

function makeBktResult(
  skillId: string,
  pKnown: number,
  confidence: number = 0.5,
  opportunities: number = 20
): SkillBktResult {
  return {
    skillId,
    pKnown,
    confidence,
    uncertaintyRange: { low: pKnown - 0.1, high: pKnown + 0.1 },
    opportunities,
    successCount: Math.floor(opportunities * pKnown),
    lastPracticedAt: new Date(),
    masteryClassification: pKnown >= 0.8 ? 'strong' : pKnown < 0.5 ? 'weak' : 'developing',
  }
}

function makeBktMap(results: SkillBktResult[]): Map<string, SkillBktResult> {
  const map = new Map<string, SkillBktResult>()
  for (const r of results) {
    map.set(r.skillId, r)
  }
  return map
}

// =============================================================================
// Tests: computeSkillChanges
// =============================================================================

describe('computeSkillChanges', () => {
  it('returns no changes when skill lists are identical and no weak/mastered', () => {
    const sessionSkills = ['skill-a', 'skill-b']
    const currentSkills = ['skill-a', 'skill-b']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.6), // developing
      makeBktResult('skill-b', 0.7), // developing
    ])

    const changes = computeSkillChanges(sessionSkills, currentSkills, bktResults)

    expect(changes.hasChanges).toBe(false)
    expect(changes.newWeakSkills).toHaveLength(0)
    expect(changes.newPracticingSkills).toHaveLength(0)
    expect(changes.removedSkills).toHaveLength(0)
    expect(changes.masteredSkills).toHaveLength(0)
  })

  it('detects new practicing skills', () => {
    const sessionSkills = ['skill-a']
    const currentSkills = ['skill-a', 'skill-b', 'skill-c']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.6),
      makeBktResult('skill-b', 0.6),
      makeBktResult('skill-c', 0.6),
    ])

    const changes = computeSkillChanges(sessionSkills, currentSkills, bktResults)

    expect(changes.newPracticingSkills).toEqual(['skill-b', 'skill-c'])
    expect(changes.hasChanges).toBe(true)
  })

  it('detects removed skills', () => {
    const sessionSkills = ['skill-a', 'skill-b', 'skill-c']
    const currentSkills = ['skill-a']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.6),
    ])

    const changes = computeSkillChanges(sessionSkills, currentSkills, bktResults)

    expect(changes.removedSkills).toEqual(['skill-b', 'skill-c'])
    expect(changes.hasChanges).toBe(true)
  })

  it('detects weak skills (pKnown < 0.5 with sufficient confidence)', () => {
    const skills = ['skill-a', 'skill-b']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.3, 0.5), // weak with confidence
      makeBktResult('skill-b', 0.6, 0.5), // developing
    ])

    const changes = computeSkillChanges(skills, skills, bktResults)

    expect(changes.newWeakSkills).toHaveLength(1)
    expect(changes.newWeakSkills[0].skillId).toBe('skill-a')
    expect(changes.newWeakSkills[0].pKnown).toBe(0.3)
    expect(changes.hasChanges).toBe(true)
  })

  it('does not classify skill as weak when confidence is below threshold', () => {
    const skills = ['skill-a']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.3, 0.1), // weak but low confidence (< 0.3)
    ])

    const changes = computeSkillChanges(skills, skills, bktResults)

    expect(changes.newWeakSkills).toHaveLength(0)
  })

  it('detects mastered skills (pKnown >= 0.8 with sufficient confidence)', () => {
    const skills = ['skill-a', 'skill-b']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.85, 0.5), // strong
      makeBktResult('skill-b', 0.6, 0.5), // developing
    ])

    const changes = computeSkillChanges(skills, skills, bktResults)

    expect(changes.masteredSkills).toEqual(['skill-a'])
    expect(changes.hasChanges).toBe(true)
  })

  it('does not classify skill as mastered when confidence is insufficient', () => {
    const skills = ['skill-a']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.9, 0.1), // strong pKnown but low confidence
    ])

    const changes = computeSkillChanges(skills, skills, bktResults)

    expect(changes.masteredSkills).toHaveLength(0)
  })

  it('skips skills not found in BKT results', () => {
    const skills = ['skill-a', 'skill-b']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.6),
      // skill-b not in BKT results
    ])

    const changes = computeSkillChanges(skills, skills, bktResults)

    // skill-b has no BKT data, should be skipped
    expect(changes.newWeakSkills).toHaveLength(0)
    expect(changes.masteredSkills).toHaveLength(0)
  })

  it('sorts weak skills by pKnown ascending (weakest first)', () => {
    const skills = ['skill-a', 'skill-b', 'skill-c']
    const bktResults = makeBktMap([
      makeBktResult('skill-a', 0.4, 0.5), // weak
      makeBktResult('skill-b', 0.2, 0.5), // weaker
      makeBktResult('skill-c', 0.1, 0.5), // weakest
    ])

    const changes = computeSkillChanges(skills, skills, bktResults)

    expect(changes.newWeakSkills.map((s) => s.skillId)).toEqual([
      'skill-c',
      'skill-b',
      'skill-a',
    ])
  })

  it('handles empty skill arrays', () => {
    const changes = computeSkillChanges([], [], new Map())

    expect(changes.hasChanges).toBe(false)
    expect(changes.newWeakSkills).toHaveLength(0)
    expect(changes.newPracticingSkills).toHaveLength(0)
    expect(changes.removedSkills).toHaveLength(0)
    expect(changes.masteredSkills).toHaveLength(0)
  })

  it('handles all changes simultaneously', () => {
    const sessionSkills = ['old-skill', 'kept-skill']
    const currentSkills = ['kept-skill', 'new-skill', 'weak-skill', 'mastered-skill']
    const bktResults = makeBktMap([
      makeBktResult('kept-skill', 0.6, 0.5),
      makeBktResult('new-skill', 0.6, 0.5),
      makeBktResult('weak-skill', 0.3, 0.5),
      makeBktResult('mastered-skill', 0.9, 0.5),
    ])

    const changes = computeSkillChanges(sessionSkills, currentSkills, bktResults)

    expect(changes.hasChanges).toBe(true)
    expect(changes.newPracticingSkills).toContain('new-skill')
    expect(changes.removedSkills).toContain('old-skill')
    expect(changes.newWeakSkills.map((s) => s.skillId)).toContain('weak-skill')
    expect(changes.masteredSkills).toContain('mastered-skill')
  })
})

// =============================================================================
// Tests: formatSkillChanges
// =============================================================================

describe('formatSkillChanges', () => {
  it('returns empty array when no changes', () => {
    const changes: SkillChanges = {
      newWeakSkills: [],
      newPracticingSkills: [],
      removedSkills: [],
      masteredSkills: [],
      hasChanges: false,
    }

    expect(formatSkillChanges(changes)).toEqual([])
  })

  it('formats weak skills message', () => {
    const changes: SkillChanges = {
      newWeakSkills: [
        { skillId: 'skill-a', displayName: 'Skill A', pKnown: 0.3 },
      ],
      newPracticingSkills: [],
      removedSkills: [],
      masteredSkills: [],
      hasChanges: true,
    }

    const descriptions = formatSkillChanges(changes)
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0]).toContain('1 skill')
    expect(descriptions[0]).toContain('need attention')
    expect(descriptions[0]).toContain('Skill A')
  })

  it('formats plural weak skills correctly', () => {
    const changes: SkillChanges = {
      newWeakSkills: [
        { skillId: 'skill-a', displayName: 'Skill A', pKnown: 0.3 },
        { skillId: 'skill-b', displayName: 'Skill B', pKnown: 0.2 },
      ],
      newPracticingSkills: [],
      removedSkills: [],
      masteredSkills: [],
      hasChanges: true,
    }

    const descriptions = formatSkillChanges(changes)
    expect(descriptions[0]).toContain('2 skills')
    expect(descriptions[0]).toContain('Skill A, Skill B')
  })

  it('formats new practicing skills', () => {
    const changes: SkillChanges = {
      newWeakSkills: [],
      newPracticingSkills: ['skill-a'],
      removedSkills: [],
      masteredSkills: [],
      hasChanges: true,
    }

    const descriptions = formatSkillChanges(changes)
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0]).toContain('1 skill')
    expect(descriptions[0]).toContain('added')
    expect(descriptions[0]).toContain('Display(skill-a)')
  })

  it('formats removed skills', () => {
    const changes: SkillChanges = {
      newWeakSkills: [],
      newPracticingSkills: [],
      removedSkills: ['skill-a', 'skill-b'],
      masteredSkills: [],
      hasChanges: true,
    }

    const descriptions = formatSkillChanges(changes)
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0]).toContain('2 skills')
    expect(descriptions[0]).toContain('removed')
  })

  it('formats mastered skills', () => {
    const changes: SkillChanges = {
      newWeakSkills: [],
      newPracticingSkills: [],
      removedSkills: [],
      masteredSkills: ['skill-a'],
      hasChanges: true,
    }

    const descriptions = formatSkillChanges(changes)
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0]).toContain('1 skill')
    expect(descriptions[0]).toContain('now strong')
  })

  it('formats all change types together', () => {
    const changes: SkillChanges = {
      newWeakSkills: [{ skillId: 'w1', displayName: 'Weak 1', pKnown: 0.3 }],
      newPracticingSkills: ['new1'],
      removedSkills: ['rem1'],
      masteredSkills: ['mas1'],
      hasChanges: true,
    }

    const descriptions = formatSkillChanges(changes)
    expect(descriptions).toHaveLength(4)
  })
})
