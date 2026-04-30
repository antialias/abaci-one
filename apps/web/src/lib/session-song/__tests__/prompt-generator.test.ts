import { describe, expect, it } from 'vitest'
import type { SongPromptInput } from '../extract-session-stats'
import { buildSongUserPrompt } from '../prompt-generator'

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

describe('buildSongUserPrompt', () => {
  it('includes selected song concept details when provided', () => {
    const prompt = buildSongUserPrompt(
      makeInput({
        songConcept: {
          id: 'comeback-case-file',
          title: 'Comeback Case File',
          lens: 'a detective replay of the solved problem',
          fitReason: '9 + 6 = 15 was solved after 3 attempts',
          hookSeeds: ['9 + 6 = 15', '3 attempts', '+6 = +10 - 4'],
          requiredDetails: ['9 + 6 = 15', '3 attempts'],
          recommendedGenres: ['electro-swing', 'hip-hop'],
          avoid: ['invented problems or scores'],
        },
      })
    )

    expect(prompt).toContain('Song concept:')
    expect(prompt).toContain('Concept: Comeback Case File (comeback-case-file)')
    expect(prompt).toContain('Lens: a detective replay of the solved problem')
    expect(prompt).toContain('Hook seeds: 9 + 6 = 15 | 3 attempts | +6 = +10 - 4')
    expect(prompt).toContain('Must use factual details: 9 + 6 = 15 | 3 attempts')
  })

  it('still builds a usable prompt when no concept has been selected', () => {
    const prompt = buildSongUserPrompt(makeInput())

    expect(prompt).toContain('Practice drama:')
    expect(prompt).toContain('Specific problem moments:')
    expect(prompt).not.toContain('Song concept:')
  })
})
