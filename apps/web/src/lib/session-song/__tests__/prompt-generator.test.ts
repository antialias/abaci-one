import { describe, expect, it } from 'vitest'
import type { SongPromptInput } from '../extract-session-stats'
import { buildSongUserPrompt, summarizeRecentSongs } from '../prompt-generator'

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

const MEMORY_BREAK = {
  gameName: 'Memory Lightning',
  headline: 'Fast recall round',
  accuracy: 90,
  highlights: ['Numbers recalled: 12'],
  details: [],
  moments: ['Recovered after one miss'],
}
const MATCHING_BREAK = {
  gameName: 'Matching Pairs',
  headline: 'Board cleared',
  highlights: ['Pairs found: 8'],
  details: [],
  moments: [],
}

describe('buildSongUserPrompt — game breaks (Phase 3b)', () => {
  it('gives no game-break evidence without a break', () => {
    expect(buildSongUserPrompt(makeInput())).not.toContain('Game break evidence')
  })

  it('renders one break as before, from a stored pre-3b input too', () => {
    const expected =
      '\n\nGame break evidence:\n- Played Memory Lightning: Fast recall round | 90% accuracy | Numbers recalled: 12 | moment: Recovered after one miss'
    const fresh = buildSongUserPrompt(makeInput({ gameBreaks: [MEMORY_BREAK] }))
    const stored = buildSongUserPrompt(makeInput({ gameBreak: MEMORY_BREAK }))
    expect(fresh).toContain(expected)
    expect(stored).toBe(fresh)
  })

  it('names both games of a two-break session, in the order played', () => {
    const prompt = buildSongUserPrompt(makeInput({ gameBreaks: [MEMORY_BREAK, MATCHING_BREAK] }))
    expect(prompt).toContain(
      'Game break evidence (2 breaks, in the order played):\n- Played Memory Lightning: Fast recall round'
    )
    expect(prompt.indexOf('- Played Memory Lightning')).toBeLessThan(
      prompt.indexOf('- Played Matching Pairs: Board cleared | Pairs found: 8')
    )
  })
})

describe('buildSongUserPrompt', () => {
  it("lists the kid's recent songs and asks for something unlike them", () => {
    const prompt = buildSongUserPrompt(
      makeInput({
        recentSongs: [
          {
            title: "Sonia's Comeback Case File",
            styles: ['children', 'electro-swing'],
            hook: ['Case file open', 'clue by clue'],
          },
        ],
      })
    )

    expect(prompt).toContain('Make yours unlike all of them')
    expect(prompt).toContain(
      '- "Sonia\'s Comeback Case File" | sound: children, electro-swing | hook: Case file open / clue by clue'
    )
  })

  it('says so when the kid has no earlier songs', () => {
    const prompt = buildSongUserPrompt(makeInput())

    expect(prompt).toContain('This kid has no earlier songs yet.')
    expect(prompt).toContain('Specific problem moments:')
  })

  it('offers the standout moment without making it the story', () => {
    const prompt = buildSongUserPrompt(makeInput())

    expect(prompt).toContain('One standout moment (use it or not): the 9 + 6 = 15 comeback')
    expect(prompt).not.toContain('Song concept')
  })
})

describe('summarizeRecentSongs', () => {
  it('takes the title, sound, and chorus lines from stored songs', () => {
    const summaries = summarizeRecentSongs([
      {
        title: 'Nine Plus Six Express',
        plan: {
          positive_global_styles: ['children', 'bluegrass'],
          negative_global_styles: ['sad'],
          sections: [
            { section_name: 'Verse 1', lines: ['All aboard'] },
            { section_name: 'Chorus', lines: ['Choo choo', 'nine plus six', 'fifteen!', 'again'] },
          ],
        },
      },
    ])

    expect(summaries).toEqual([
      {
        title: 'Nine Plus Six Express',
        styles: ['children', 'bluegrass'],
        hook: ['Choo choo', 'nine plus six', 'fifteen!'],
      },
    ])
  })

  it('uses the first section when there is no chorus, and skips unreadable rows', () => {
    const summaries = summarizeRecentSongs([
      null,
      { title: 42 },
      {
        title: 'Lullaby for Ten',
        plan: { sections: [{ section_name: 'Opening', lines: ['Hush'] }] },
      },
    ])

    expect(summaries).toEqual([{ title: 'Lullaby for Ten', styles: [], hook: ['Hush'] }])
  })
})
