import { describe, expect, it } from 'vitest'
import {
  buildFallbackSongPlan,
  resolveSongPlanValidationPolicy,
  type SongPlanCandidate,
  validateCompositionPlan,
} from '../composition-plan-validation'
import type { SongPromptInput } from '../extract-session-stats'

function makeInput(overrides: Partial<SongPromptInput> = {}): SongPromptInput {
  const base: SongPromptInput = {
    player: { name: 'Sonia', emoji: '*' },
    currentSession: {
      accuracy: 0.8,
      problemsDone: 10,
      problemsTotal: 10,
      skillsPracticed: ['Direct Addition'],
      bestCorrectStreak: 3,
      partTypes: ['Use Abacus'],
      durationMinutes: 5,
      helpUsed: false,
      totalIncorrectAttempts: 2,
      helpMoments: 0,
      retryMoments: 1,
      averageResponseSeconds: 5,
    },
    practiceDrama: {
      storyAngle: 'the 9 + 6 = 15 comeback',
      arcs: ['Comeback: 9 + 6 = 15 took 3 attempts and finished right.'],
      problemMoments: [
        {
          kind: 'comeback',
          reason: 'came back on this problem after 3 attempts',
          problem: '9 + 6 = 15',
          partType: 'Use Abacus',
          purpose: 'challenge',
          answer: 15,
          studentAnswers: [11, 15],
          attempts: 3,
          incorrectAttempts: 2,
          outcome: 'eventually_correct',
          skills: ['+6 = +10 - 4'],
          strategySteps: ['9 + 6 = 15 using +6 = +10 - 4'],
          responseSeconds: 12,
        },
      ],
      skillSpotlights: [
        {
          skill: '+6 = +10 - 4',
          attempts: 3,
          correct: 1,
          problems: 1,
          exampleProblems: ['9 + 6 = 15'],
        },
      ],
    },
    history: {
      recentSessionCount: 0,
      averageAccuracy: 0,
      trend: 'steady',
    },
  }

  return { ...base, ...overrides }
}

function makePlan(overrides: Partial<SongPlanCandidate> = {}): SongPlanCandidate {
  return {
    title: "Sonia's Practice Beat",
    positive_global_styles: ['children', 'upbeat', 'pop'],
    negative_global_styles: ['explicit', 'sad'],
    sections: [
      {
        section_name: 'Verse 1',
        positive_local_styles: ['bright'],
        negative_local_styles: [],
        duration_ms: 12_000,
        lines: ['Sonia saw nine plus six equals fifteen'],
      },
      {
        section_name: 'Chorus',
        positive_local_styles: ['catchy'],
        negative_local_styles: [],
        duration_ms: 9_000,
        lines: ['Sonia kept the rhythm bright'],
      },
      {
        section_name: 'Verse 2',
        positive_local_styles: ['warm'],
        negative_local_styles: [],
        duration_ms: 12_000,
        lines: ['Used plus six equals plus ten minus four'],
      },
      {
        section_name: 'Final Chorus',
        positive_local_styles: ['celebration'],
        negative_local_styles: [],
        duration_ms: 9_000,
        lines: ['Sonia carried on'],
      },
    ],
    ...overrides,
  }
}

function issueCodes(plan: SongPlanCandidate, input = makeInput()) {
  return validateCompositionPlan(input, plan).issues.map((issue) => issue.code)
}

describe('validateCompositionPlan', () => {
  it('rejects game-break sections when no game break exists', () => {
    const plan = makePlan({
      sections: [
        ...makePlan().sections.slice(0, 2),
        {
          section_name: 'Rap Break',
          positive_local_styles: ['spoken'],
          negative_local_styles: [],
          duration_ms: 8_000,
          lines: ['Sonia took a halftime lap'],
        },
        ...makePlan().sections.slice(2),
      ],
    })

    expect(issueCodes(plan)).toContain('unexpected_game_break_section')
  })

  it('requires concrete game details when game break evidence exists', () => {
    const input = makeInput({
      gameBreak: {
        gameName: 'Memory Lightning',
        headline: 'Fast recall round',
        highlights: ['Numbers recalled: 12, 56'],
        details: ['Best streak: 4 cards'],
        moments: ['Sonia recovered after one miss'],
        outcome: 'finished the recall board',
      },
    })

    expect(issueCodes(makePlan(), input)).toContain('missing_game_detail')

    const valid = makePlan({
      sections: [
        ...makePlan().sections,
        {
          section_name: 'Game Break',
          positive_local_styles: ['playful'],
          negative_local_styles: [],
          duration_ms: 8_000,
          lines: ['Memory Lightning called out twelve and fifty six'],
        },
      ],
    })

    expect(issueCodes(valid, input)).not.toContain('missing_game_detail')
  })

  it('requires the actual player name', () => {
    const plan = makePlan({
      sections: makePlan().sections.map((section) => ({
        ...section,
        lines: section.lines.map((line) => line.replace(/Sonia/g, 'the kid')),
      })),
    })

    expect(issueCodes(plan)).toContain('missing_player_name')
  })

  it('rejects obvious invented child names', () => {
    const plan = makePlan({
      sections: [
        {
          ...makePlan().sections[0],
          lines: ['Sonia and Jamie saw nine plus six equals fifteen'],
        },
        ...makePlan().sections.slice(1),
      ],
    })

    expect(issueCodes(plan)).toContain('invented_child_name')
  })

  it('rejects missing problem evidence and accepts singable equivalents', () => {
    const missing = makePlan({
      sections: makePlan().sections.map((section) => ({
        ...section,
        lines: section.lines.map((line) =>
          line.replace('nine plus six equals fifteen', 'a tricky one')
        ),
      })),
    })

    expect(issueCodes(missing)).toContain('missing_problem_evidence')
    expect(issueCodes(makePlan())).not.toContain('missing_problem_evidence')
  })

  it('rejects missing skill or strategy evidence', () => {
    const plan = makePlan({
      sections: makePlan().sections.map((section) => ({
        ...section,
        lines: section.lines.map((line) =>
          line.replace('Used plus six equals plus ten minus four', 'Used a careful bead plan')
        ),
      })),
    })

    expect(issueCodes(plan)).toContain('missing_skill_evidence')
  })

  it('rejects unsupported numeric claims', () => {
    const plan = makePlan({
      sections: [
        ...makePlan().sections,
        {
          section_name: 'Final Tag',
          positive_local_styles: ['bright'],
          negative_local_styles: [],
          duration_ms: 5_000,
          lines: ['Sonia scored 999 points'],
        },
      ],
    })

    expect(issueCodes(plan)).toContain('invented_numeric_claim')
  })

  it('flags over-duration plans', () => {
    const plan = makePlan({
      sections: makePlan().sections.map((section) => ({ ...section, duration_ms: 16_000 })),
    })

    expect(issueCodes(plan)).toContain('over_duration')
  })

  it('builds a fallback that validates against available evidence', () => {
    const fallback = buildFallbackSongPlan(makeInput())
    expect(validateCompositionPlan(makeInput(), fallback).issues).toEqual([])
  })
})

describe('resolveSongPlanValidationPolicy', () => {
  it('maps missing or disabled flags to off', () => {
    expect(resolveSongPlanValidationPolicy(null).mode).toBe('off')
    expect(resolveSongPlanValidationPolicy({ enabled: false, config: null }).mode).toBe('off')
  })

  it('maps enabled flag with no config to observe', () => {
    expect(resolveSongPlanValidationPolicy({ enabled: true, config: null }).mode).toBe('observe')
  })

  it('uses configured modes and repair settings', () => {
    const policy = resolveSongPlanValidationPolicy({
      enabled: true,
      config: {
        mode: 'repair',
        maxRepairAttempts: 2,
        fallbackOnFailedRepair: false,
        logPassingPlans: true,
      },
    })

    expect(policy).toEqual({
      mode: 'repair',
      maxRepairAttempts: 2,
      fallbackOnFailedRepair: false,
      logPassingPlans: true,
    })
  })

  it('safely maps invalid config to observe defaults', () => {
    const policy = resolveSongPlanValidationPolicy({
      enabled: true,
      config: '{"mode":"banana","maxRepairAttempts":"many"}',
    })

    expect(policy.mode).toBe('observe')
    expect(policy.maxRepairAttempts).toBe(0)
    expect(policy.fallbackOnFailedRepair).toBe(true)
  })
})
