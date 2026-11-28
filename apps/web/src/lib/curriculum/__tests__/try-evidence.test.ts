/**
 * `evidenceSkillsOf` (practice-kinds plan K1b): the skills a row is
 * evidence of, for every reader. A plan's own row (`SkillsPanel`,
 * `progress-manager`) carries no resolved `mode`, so its presentation's mode
 * is resolved here: a presentation that counts toward no mode is no evidence.
 */

import { describe, expect, it, vi } from 'vitest'
import { evidenceSkillsOf } from '@/lib/curriculum/try-evidence'

vi.mock('@/lib/curriculum/parts/presentations', () => ({
  // 'shown' stands for a presentation whose tries are not evidence (masteryMode null)
  masteryModeOf: (id: string) => (id === 'shown' ? null : id),
}))

const A = 'basic.directAddition'

describe('evidenceSkillsOf', () => {
  it('reads evidence.skills over skillsExercised', () => {
    expect(
      evidenceSkillsOf({ evidence: { skills: [A], presentation: 'abacus' }, skillsExercised: [] })
    ).toEqual([A])
  })

  it('a stamped null is evidence of nothing', () => {
    expect(evidenceSkillsOf({ evidence: null, skillsExercised: [A] })).toEqual([])
  })

  it('a row without the field reads skillsExercised (amendment A4)', () => {
    expect(evidenceSkillsOf({ skillsExercised: [A] })).toEqual([A])
  })

  it("a plan row (no mode) resolves its presentation's mode: none means no evidence", () => {
    expect(evidenceSkillsOf({ evidence: { skills: [A], presentation: 'shown' } })).toEqual([])
    expect(evidenceSkillsOf({ evidence: { skills: [A], presentation: 'abacus' } })).toEqual([A])
  })

  it('a history row carries its resolved mode, which decides', () => {
    expect(
      evidenceSkillsOf({ evidence: { skills: [A], presentation: 'shown' }, mode: 'abacus' })
    ).toEqual([A])
    expect(
      evidenceSkillsOf({ evidence: { skills: [A], presentation: 'abacus' }, mode: null })
    ).toEqual([])
  })
})
