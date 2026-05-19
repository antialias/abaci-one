/**
 * Privacy-projection tests for `projectSharedSong` — the pure core of the
 * `getSharedSong` boundary (DB reads stripped away, so no mocking needed).
 *
 * Asserts the toggle gating and, critically, that no raw `promptInput`
 * internals (studentAnswers, strategySteps, skillSpotlights, …) ever appear in
 * the projected payload regardless of which toggles are on.
 */

import { describe, expect, it } from 'vitest'
import type { SongShareVisibility } from '@/db/schema/song-shares'
import { projectSharedSong } from '../getSharedSong'

const LLM_OUTPUT = {
  title: 'Detective Fern’s Comeback Case File: 313!',
  plan: {
    positive_global_styles: ['kids pop', 'upbeat'],
    negative_global_styles: ['sad'],
    sections: [
      {
        section_name: 'Verse 1',
        lines: ['Cracked it wide, hit that 313!', 'I worked 56 - 28 + 66 - 18 = 76, came back!'],
        positive_local_styles: [],
        negative_local_styles: [],
        duration_ms: 20000,
      },
      {
        section_name: 'Chorus',
        lines: ['Clue by clue, you cracked it true', 'Five in a row, watch you go!'],
        positive_local_styles: [],
        negative_local_styles: [],
        duration_ms: 15000,
      },
    ],
  },
}

const PROMPT_INPUT = {
  player: { name: 'Fern Q.', emoji: '🐯', age: 9 },
  currentSession: {
    accuracy: 0.86,
    problemsDone: 18,
    problemsTotal: 20,
    bestCorrectStreak: 5,
    skillsPracticed: ['basic.directAddition', 'fiveComplements.plusFour'],
  },
  practiceDrama: {
    storyAngle: 'the 72 + 76 - 25 + 69 + 50 + 71 = 313 comeback',
    arcs: [
      'Comeback: 72 + 76 - 25 + 69 + 50 + 71 = 313 took 2 attempts and finished right.',
      'Streak: 5 correct answers in a row.',
      'Boss problem: carried complexity cost 11.5.',
      'Side quest: Type Racer Jr. - Great Typing!.',
    ],
    problemMoments: [
      {
        kind: 'comeback',
        reason: 'came back after 2 attempts',
        problem: '56 - 28 + 66 - 18 = 76',
        partType: 'Use Abacus',
        answer: 76,
        studentAnswers: [2, 76],
        attempts: 2,
        incorrectAttempts: 1,
        outcome: 'eventually_correct',
        skills: ['Heaven Bead (5)'],
        strategySteps: ['0 + 56 = 56 using Heaven Bead (5)'],
      },
    ],
    skillSpotlights: [
      { skill: '-8 = +2 - 10', attempts: 4, correct: 3, problems: 3, exampleProblems: ['1 + 2 = 3'] },
    ],
  },
  gameBreak: { gameName: 'Type Racer Jr.', headline: 'Great Typing!' },
}

const ALL_OFF: SongShareVisibility = {
  showAge: false,
  showAccuracy: false,
  showProblemDetail: false,
  showStreakSkills: false,
}

const baseInput = (visibility: SongShareVisibility) => ({
  visibility,
  llmOutput: LLM_OUTPUT,
  promptInput: PROMPT_INPUT,
  playerName: 'Fern Q.',
  playerEmoji: '🐯',
  songId: 'song-123',
  createdAt: 1_700_000_000_000,
})

describe('projectSharedSong — gating', () => {
  it('default (all toggles off): no stats, no annotations, always-shown fields only', () => {
    const p = projectSharedSong(baseInput(ALL_OFF))
    expect(p.stats).toEqual({})
    expect(p.song.title).toBe('Detective Fern’s Comeback Case File: 313!')
    expect(p.song.styles).toEqual(['kids pop', 'upbeat'])
    expect(p.song.audioPath).toBe('/api/audio/songs/song-123')
    for (const s of p.song.sections) expect(s.annotations).toBeUndefined()
  })

  it('showProblemDetail: story, highlights, and lyric annotations appear', () => {
    const p = projectSharedSong(baseInput({ ...ALL_OFF, showProblemDetail: true }))
    expect(p.stats.storyAngle).toContain('313 comeback')
    expect(p.stats.highlights).toHaveLength(3) // arcs capped at 3
    const allNotes = p.song.sections.flatMap((s) => s.annotations ?? [])
    expect(allNotes).toContain('Fern bounced back on this one.')
    expect(allNotes.some((n) => n.includes('built around Fern'))).toBe(true)
    // The note must NOT echo the equation (it's already on the lyric line).
    expect(allNotes.some((n) => n.includes('56 - 28 + 66 - 18 = 76'))).toBe(false)
  })

  it('showStreakSkills: streak + formatted skills, no accuracy/age', () => {
    const p = projectSharedSong(baseInput({ ...ALL_OFF, showStreakSkills: true }))
    expect(p.stats.bestCorrectStreak).toBe(5)
    expect(p.stats.skills).toEqual(['Direct Addition', 'Plus Four'])
    expect(p.stats.accuracyPct).toBeUndefined()
    expect(p.stats.age).toBeUndefined()
  })

  it('showAccuracy / showAge gate independently', () => {
    const acc = projectSharedSong(baseInput({ ...ALL_OFF, showAccuracy: true }))
    expect(acc.stats.accuracyPct).toBe(86)
    expect(acc.stats.problemsDone).toBe(18)
    expect(acc.stats.problemsTotal).toBe(20)
    expect(acc.stats.age).toBeUndefined()

    const age = projectSharedSong(baseInput({ ...ALL_OFF, showAge: true }))
    expect(age.stats.age).toBe(9)
    expect(age.stats.accuracyPct).toBeUndefined()
  })
})

describe('projectSharedSong — privacy boundary', () => {
  it('never leaks raw promptInput internals, even with every toggle on', () => {
    const p = projectSharedSong(
      baseInput({
        showAge: true,
        showAccuracy: true,
        showProblemDetail: true,
        showStreakSkills: true,
      })
    )
    const serialized = JSON.stringify(p)
    for (const forbidden of [
      'studentAnswers',
      'strategySteps',
      'skillSpotlights',
      'incorrectAttempts',
      'problemMoments',
      'promptInput',
      'exampleProblems',
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
    expect(p).not.toHaveProperty('promptInput')
  })

  it('degrades gracefully on a pre-practiceDrama row', () => {
    const p = projectSharedSong({
      ...baseInput({ ...ALL_OFF, showProblemDetail: true, showStreakSkills: true }),
      promptInput: { player: { name: 'Old' }, currentSession: { accuracy: 0.5 } },
    })
    expect(p.stats.storyAngle).toBeUndefined()
    expect(p.stats.highlights).toBeUndefined()
    for (const s of p.song.sections) expect(s.annotations).toBeUndefined()
  })
})
