/**
 * @vitest-environment node
 *
 * Tests for formatting.ts
 *
 * Tests the exported functions:
 * - formatTuningHistory: Formats tuning rounds into human-readable text
 * - formatActualOutcomes: Formats BKT results into a summary
 */

import { describe, expect, it } from 'vitest'
import { formatTuningHistory, formatActualOutcomes } from '../formatting'
import type { TuningRound, TestStudentProfile } from '../types'
import type { SkillBktResult } from '../../curriculum/bkt'

/**
 * Helper to create a properly typed SkillBktResult with sensible defaults
 */
function createSkillResult(
  skillId: string,
  pKnown: number,
  masteryClassification: 'weak' | 'developing' | 'strong' | null
): SkillBktResult {
  return {
    skillId,
    pKnown,
    confidence: 0.9,
    uncertaintyRange: { low: pKnown - 0.1, high: pKnown + 0.1 },
    opportunities: 20,
    successCount: Math.round(pKnown * 20),
    lastPracticedAt: new Date(),
    masteryClassification: masteryClassification as SkillBktResult['masteryClassification'],
  }
}

// =============================================================================
// formatTuningHistory
// =============================================================================

describe('formatTuningHistory', () => {
  it('returns empty string for empty history', () => {
    expect(formatTuningHistory([])).toBe('')
  })

  it('returns empty string for single-round history (no tuning needed)', () => {
    const history: TuningRound[] = [
      {
        round: 1,
        classifications: { weak: 2, developing: 3, strong: 5 },
        success: true,
        failureReasons: [],
        adjustmentsApplied: [],
      },
    ]
    expect(formatTuningHistory(history)).toBe('')
  })

  it('formats multi-round tuning history with failure and success', () => {
    const history: TuningRound[] = [
      {
        round: 1,
        classifications: { weak: 1, developing: 4, strong: 5 },
        success: false,
        failureReasons: ['Need at least 2 weak skills, got 1'],
        adjustmentsApplied: ['Increased problems for weak skills'],
      },
      {
        round: 2,
        classifications: { weak: 2, developing: 3, strong: 5 },
        success: true,
        failureReasons: [],
        adjustmentsApplied: [],
      },
    ]

    const result = formatTuningHistory(history)

    expect(result).toContain('TUNING HISTORY')
    expect(result).toContain('Round 1')
    expect(result).toContain('Round 2')
    expect(result).toContain('Failed')
    expect(result).toContain('Success')
    expect(result).toContain('Need at least 2 weak skills, got 1')
    expect(result).toContain('Increased problems for weak skills')
  })

  it('includes classification counts in each round', () => {
    const history: TuningRound[] = [
      {
        round: 1,
        classifications: { weak: 3, developing: 2, strong: 4 },
        success: false,
        failureReasons: ['test'],
        adjustmentsApplied: [],
      },
      {
        round: 2,
        classifications: { weak: 2, developing: 3, strong: 4 },
        success: true,
        failureReasons: [],
        adjustmentsApplied: [],
      },
    ]

    const result = formatTuningHistory(history)

    expect(result).toContain('3 weak')
    expect(result).toContain('2 developing')
    expect(result).toContain('4 strong')
  })

  it('shows multiple failure reasons', () => {
    const history: TuningRound[] = [
      {
        round: 1,
        classifications: { weak: 0, developing: 0, strong: 10 },
        success: false,
        failureReasons: ['Need at least 2 weak', 'Need at least 3 developing'],
        adjustmentsApplied: ['adjustment1'],
      },
      {
        round: 2,
        classifications: { weak: 2, developing: 3, strong: 5 },
        success: true,
        failureReasons: [],
        adjustmentsApplied: [],
      },
    ]

    const result = formatTuningHistory(history)

    expect(result).toContain('Need at least 2 weak')
    expect(result).toContain('Need at least 3 developing')
  })

  it('does not show adjustments section when none applied', () => {
    const history: TuningRound[] = [
      {
        round: 1,
        classifications: { weak: 1, developing: 1, strong: 1 },
        success: false,
        failureReasons: ['test reason'],
        adjustmentsApplied: [],
      },
      {
        round: 2,
        classifications: { weak: 2, developing: 2, strong: 2 },
        success: true,
        failureReasons: [],
        adjustmentsApplied: [],
      },
    ]

    const result = formatTuningHistory(history)

    // Should NOT contain "Adjustments applied" since none were applied
    expect(result).not.toContain('Adjustments applied')
  })
})

// =============================================================================
// formatActualOutcomes
// =============================================================================

describe('formatActualOutcomes', () => {
  function createProfile(overrides: Partial<TestStudentProfile> = {}): TestStudentProfile {
    return {
      name: 'Test Student',
      emoji: '🧑‍🎓',
      color: 'blue',
      category: 'bkt',
      description: 'A test student profile',
      intentionNotes: 'For testing',
      practicingSkills: ['basic.directAddition', 'basic.heavenBead'],
      skillHistory: [],
      currentPhaseId: 'phase-1',
      ...overrides,
    }
  }

  it('includes ACTUAL OUTCOMES header', () => {
    const bktResult = { skills: [] }
    const profile = createProfile()

    const result = formatActualOutcomes(bktResult, profile)

    expect(result).toContain('ACTUAL OUTCOMES')
  })

  it('shows classification counts', () => {
    const bktResult = {
      skills: [
        createSkillResult('skill1', 0.3, 'weak'),
        createSkillResult('skill2', 0.6, 'developing'),
        createSkillResult('skill3', 0.9, 'strong'),
        createSkillResult('skill4', 0.95, 'strong'),
      ],
    }

    const result = formatActualOutcomes(bktResult, createProfile())

    expect(result).toContain('Weak: 1')
    expect(result).toContain('Developing: 1')
    expect(result).toContain('Strong: 2')
  })

  it('lists weak skills with pKnown percentages', () => {
    const bktResult = {
      skills: [createSkillResult('basic.directAddition', 0.25, 'weak')],
    }

    const result = formatActualOutcomes(bktResult, createProfile())

    expect(result).toContain('Weak Skills')
    expect(result).toContain('basic.directAddition')
    expect(result).toContain('25%')
  })

  it('lists developing skills with pKnown percentages', () => {
    const bktResult = {
      skills: [createSkillResult('basic.heavenBead', 0.65, 'developing')],
    }

    const result = formatActualOutcomes(bktResult, createProfile())

    expect(result).toContain('Developing Skills')
    expect(result).toContain('basic.heavenBead')
    expect(result).toContain('65%')
  })

  it('lists strong skills with pKnown percentages', () => {
    const bktResult = {
      skills: [createSkillResult('fiveComplements.4=5-1', 0.92, 'strong')],
    }

    const result = formatActualOutcomes(bktResult, createProfile())

    expect(result).toContain('Strong Skills')
    expect(result).toContain('fiveComplements.4=5-1')
    expect(result).toContain('92%')
  })

  it('shows expected vs actual session mode when profile has expectedSessionMode', () => {
    const bktResult = {
      skills: [createSkillResult('skill1', 0.2, 'weak')],
    }

    const profile = createProfile({
      expectedSessionMode: 'remediation',
    })

    const result = formatActualOutcomes(bktResult, profile)

    expect(result).toContain('Expected Session Mode: REMEDIATION')
    expect(result).toContain('Actual Session Mode: REMEDIATION')
  })

  it('shows mismatch indicator when actual mode differs from expected', () => {
    const bktResult = {
      skills: [
        createSkillResult('skill1', 0.9, 'strong'),
        createSkillResult('skill2', 0.85, 'strong'),
      ],
    }

    const profile = createProfile({
      expectedSessionMode: 'remediation',
      practicingSkills: ['skill1', 'skill2'],
    })

    const result = formatActualOutcomes(bktResult, profile)

    expect(result).toContain('Expected Session Mode: REMEDIATION')
    // All strong + count matches practicing skills -> progression
    expect(result).toContain('PROGRESSION')
  })

  it('does not show session mode section when expectedSessionMode is absent', () => {
    const bktResult = {
      skills: [createSkillResult('skill1', 0.5, 'developing')],
    }

    const profile = createProfile({ expectedSessionMode: undefined })

    const result = formatActualOutcomes(bktResult, profile)

    expect(result).not.toContain('Expected Session Mode')
  })

  it('includes generation timestamp', () => {
    const bktResult = { skills: [] }
    const result = formatActualOutcomes(bktResult, createProfile())

    expect(result).toContain('Generated:')
  })

  it('includes tuning history when provided', () => {
    const bktResult = { skills: [] }
    const tuningHistory: TuningRound[] = [
      {
        round: 1,
        classifications: { weak: 0, developing: 0, strong: 0 },
        success: false,
        failureReasons: ['test failure'],
        adjustmentsApplied: [],
      },
      {
        round: 2,
        classifications: { weak: 1, developing: 1, strong: 1 },
        success: true,
        failureReasons: [],
        adjustmentsApplied: [],
      },
    ]

    const result = formatActualOutcomes(bktResult, createProfile(), tuningHistory)

    expect(result).toContain('TUNING HISTORY')
    expect(result).toContain('test failure')
  })

  it('does not include tuning history section when tuning is empty', () => {
    const bktResult = { skills: [] }
    const result = formatActualOutcomes(bktResult, createProfile(), [])

    // When empty, formatTuningHistory returns '' and the section shouldn't appear
    // Actually the code checks tuningHistory.length > 0 before including it
    expect(result).not.toContain('TUNING HISTORY')
  })

  it('skips sections that have zero skills', () => {
    const bktResult = {
      skills: [createSkillResult('skill1', 0.9, 'strong')],
    }

    const result = formatActualOutcomes(bktResult, createProfile())

    // Should not include "Weak Skills" or "Developing Skills" sections
    expect(result).not.toContain('Weak Skills')
    expect(result).not.toContain('Developing Skills')
    expect(result).toContain('Strong Skills')
  })

  it('handles skills without masteryClassification gracefully', () => {
    // Use type assertion since MasteryClassification doesn't include null,
    // but the runtime code handles it gracefully
    const bktResult = {
      skills: [createSkillResult('skill1', 0.5, null)],
    }

    const result = formatActualOutcomes(bktResult, createProfile())

    // Should still produce output without crashing
    expect(result).toContain('ACTUAL OUTCOMES')
    expect(result).toContain('Weak: 0')
    expect(result).toContain('Developing: 0')
    expect(result).toContain('Strong: 0')
  })
})
