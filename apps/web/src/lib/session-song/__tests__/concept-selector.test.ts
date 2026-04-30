import { describe, expect, it } from 'vitest'
import {
  resolveSongGenres,
  type SongConceptSelectionContext,
  selectSongConcept,
} from '../concept-selector'
import type {
  SongProblemMoment,
  SongPromptInput,
  SongSkillSpotlight,
} from '../extract-session-stats'

const baseMoment: SongProblemMoment = {
  kind: 'hard_problem',
  reason: 'spotlighted Direct Addition',
  problem: '2 + 3 = 5',
  partType: 'Use Abacus',
  purpose: 'focus',
  answer: 5,
  studentAnswers: [5],
  attempts: 1,
  incorrectAttempts: 0,
  outcome: 'correct',
  skills: ['Direct Addition'],
  strategySteps: ['2 + 3 = 5 using Direct Addition'],
  responseSeconds: 4,
}

const baseSkill: SongSkillSpotlight = {
  skill: 'Direct Addition',
  attempts: 1,
  correct: 1,
  problems: 1,
  exampleProblems: ['2 + 3 = 5'],
}

type SongPromptInputOverrides = Omit<
  Partial<SongPromptInput>,
  'currentSession' | 'practiceDrama' | 'history'
> & {
  currentSession?: Partial<SongPromptInput['currentSession']>
  practiceDrama?: Partial<SongPromptInput['practiceDrama']>
  history?: Partial<SongPromptInput['history']>
}

function makeInput(overrides: SongPromptInputOverrides = {}): SongPromptInput {
  const base: SongPromptInput = {
    player: { name: 'Sonia', emoji: '*' },
    currentSession: {
      accuracy: 0.8,
      problemsDone: 10,
      problemsTotal: 10,
      skillsPracticed: ['Direct Addition'],
      bestCorrectStreak: 2,
      partTypes: ['Use Abacus'],
      durationMinutes: 5,
      helpUsed: false,
      totalIncorrectAttempts: 0,
      helpMoments: 0,
      retryMoments: 0,
      averageResponseSeconds: 5,
    },
    practiceDrama: {
      storyAngle: 'the steady bead-building mission',
      arcs: [],
      problemMoments: [],
      skillSpotlights: [baseSkill],
    },
    history: {
      recentSessionCount: 0,
      averageAccuracy: 0,
      trend: 'steady',
    },
  }

  return {
    ...base,
    ...overrides,
    currentSession: {
      ...base.currentSession,
      ...overrides.currentSession,
    },
    practiceDrama: {
      ...base.practiceDrama,
      ...overrides.practiceDrama,
    },
    history: {
      ...base.history,
      ...overrides.history,
    },
  }
}

function context(
  overrides: Partial<SongConceptSelectionContext> = {}
): SongConceptSelectionContext {
  return { seed: 'player-1:plan-1', ...overrides }
}

describe('selectSongConcept', () => {
  it('selects a comeback concept with the real problem and attempt count', () => {
    const input = makeInput({
      currentSession: { retryMoments: 1, totalIncorrectAttempts: 2 },
      practiceDrama: {
        storyAngle: 'the 9 + 6 = 15 comeback',
        problemMoments: [
          {
            ...baseMoment,
            kind: 'comeback',
            reason: 'came back on this problem after 3 attempts',
            problem: '9 + 6 = 15',
            attempts: 3,
            incorrectAttempts: 2,
            outcome: 'eventually_correct',
            skills: ['+6 = +10 - 4'],
            strategySteps: ['9 + 6 = 15 using +6 = +10 - 4'],
          },
        ],
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('comeback-case-file')
    expect(concept.requiredDetails).toContain('9 + 6 = 15')
    expect(concept.requiredDetails).toContain('3 attempts')
    expect(concept.hookSeeds).toContain('+6 = +10 - 4')
  })

  it('selects a strategy concept for help breakthroughs', () => {
    const input = makeInput({
      currentSession: { helpUsed: true, helpMoments: 1 },
      practiceDrama: {
        storyAngle: 'the strategy unlock on 14 - 8 = 6',
        problemMoments: [
          {
            ...baseMoment,
            kind: 'help_breakthrough',
            reason: 'used help as a strategy instead of getting stuck',
            problem: '14 - 8 = 6',
            skills: ['-8 = +2 - 10'],
            strategySteps: ['14 - 8 = 6 using -8 = +2 - 10'],
          },
        ],
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('strategy-toolbox')
    expect(concept.requiredDetails).toContain('help was used as a strategy')
  })

  it('selects a streak concept for a strong run', () => {
    const input = makeInput({
      currentSession: { accuracy: 0.95, bestCorrectStreak: 12 },
      practiceDrama: {
        storyAngle: 'the 12-in-a-row run',
        problemMoments: [
          {
            ...baseMoment,
            kind: 'streak_peak',
            reason: 'sealed a 12-problem correct streak',
            problem: '5 + 3 = 8',
          },
        ],
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('streak-parade')
    expect(concept.requiredDetails).toContain('12 correct answers in a row')
  })

  it('selects a boss replay for hard incorrect or complex problems', () => {
    const input = makeInput({
      currentSession: { totalIncorrectAttempts: 5 },
      practiceDrama: {
        storyAngle: 'the 42 + 74 + 35 = 151 boss level',
        problemMoments: [
          {
            ...baseMoment,
            kind: 'hard_problem',
            reason: 'high-complexity problem with cost 15',
            problem: '42 + 74 + 35 = 151',
            purpose: 'challenge',
            incorrectAttempts: 2,
          },
        ],
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('boss-level-replay')
    expect(concept.requiredDetails).toContain('42 + 74 + 35 = 151')
  })

  it('selects a slow-burn lab for long response outliers', () => {
    const input = makeInput({
      practiceDrama: {
        storyAngle: 'the 59 - 37 + 34 + 50 = 106 slow burn',
        problemMoments: [
          {
            ...baseMoment,
            kind: 'slow_burn',
            reason: 'stayed with it for 41.5 seconds',
            problem: '59 - 37 + 34 + 50 = 106',
            responseSeconds: 41.5,
          },
        ],
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('slow-burn-lab')
    expect(concept.requiredDetails).toContain('41.5 seconds')
  })

  it('selects a skill terrain concept for broad skill coverage', () => {
    const skills = ['+7 = +10 - 3', '-8 = +2 - 10', '+9 = +10 - 1', '+5 = +10 - 5']
    const input = makeInput({
      currentSession: {
        skillsPracticed: [...skills, 'Direct Addition', 'Direct Subtraction'],
      },
      practiceDrama: {
        storyAngle: 'the many-skill tour',
        skillSpotlights: skills.map((skill, index) => ({
          skill,
          attempts: 2,
          correct: 2,
          problems: 2,
          exampleProblems: [`example ${index + 1}`],
        })),
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('skill-terrain-tour')
    expect(concept.requiredDetails).toContain('+7 = +10 - 3')
  })

  it('selects a side quest concept when game-break evidence is the main drama', () => {
    const input = makeInput({
      gameBreak: {
        gameName: 'Memory Lightning',
        headline: 'Remembered 5 of 6 hidden numbers',
        highlights: ['Numbers recalled: 4, 8, 15'],
        details: ['Numbers shown: 4, 8, 15, 16, 23, 42'],
        moments: ['First recalled number: 4'],
        outcome: 'kept searching after one wrong guess',
      },
    })

    const concept = selectSongConcept(input, context())

    expect(concept.id).toBe('side-quest-arcade')
    expect(concept.requiredDetails).toContain('Memory Lightning: Remembered 5 of 6 hidden numbers')
    expect(concept.gameBreakInterludeStyle).toContain('short hype break')
  })

  it('falls back to a steady-build concept when evidence is thin', () => {
    const concept = selectSongConcept(makeInput(), context())

    expect(concept.id).toBe('steady-build')
  })

  it('penalizes a recently used concept when another strong fit is available', () => {
    const input = makeInput({
      currentSession: {
        skillsPracticed: ['Direct Addition', '+4 = +5 - 1', '+3 = +5 - 2', 'Heaven Bead'],
      },
      practiceDrama: {
        storyAngle: 'the side quest skill tour',
        skillSpotlights: ['Direct Addition', '+4 = +5 - 1', '+3 = +5 - 2', 'Heaven Bead'].map(
          (skill) => ({
            skill,
            attempts: 2,
            correct: 2,
            problems: 2,
            exampleProblems: ['4 + 4 = 8'],
          })
        ),
      },
      gameBreak: {
        gameName: 'Matching Pairs',
        headline: '8 pairs found',
        highlights: ['Best Streak: 3'],
        details: [],
        moments: [],
      },
    })

    const fresh = selectSongConcept(input, context())
    const repeated = selectSongConcept(input, context({ recentConceptIds: [fresh.id] }))

    expect(fresh.id).not.toBe(repeated.id)
  })

  it('is deterministic for the same seed and evidence', () => {
    const input = makeInput({
      currentSession: { accuracy: 0.95, bestCorrectStreak: 8 },
    })

    expect(selectSongConcept(input, context({ seed: 'same-seed' }))).toEqual(
      selectSongConcept(input, context({ seed: 'same-seed' }))
    )
  })
})

describe('resolveSongGenres', () => {
  it('respects a specific parent genre preference', () => {
    const concept = selectSongConcept(makeInput(), context())

    expect(resolveSongGenres('folk, hip-hop', concept, context())).toBe('folk, hip-hop')
  })

  it('returns a deterministic concept-aware shuffle mix', () => {
    const concept = selectSongConcept(
      makeInput({
        gameBreak: {
          gameName: 'Type Racer Jr.',
          headline: 'Clean typing sprint',
          highlights: [],
          details: ['Words typed: cat, moon, rocket'],
          moments: ['No mistakes on rocket'],
        },
      }),
      context()
    )

    const first = resolveSongGenres('shuffle', concept, context({ seed: 'genre-seed' }))
    const second = resolveSongGenres('shuffle', concept, context({ seed: 'genre-seed' }))

    expect(first).toBe(second)
    expect(first.split(', ').length).toBeGreaterThanOrEqual(2)
    expect(first.split(', ').length).toBeLessThanOrEqual(3)
    expect(first.split(', ').some((genre) => concept.recommendedGenres.includes(genre))).toBe(true)
  })
})
