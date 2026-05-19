/**
 * Annotation-engine unit tests.
 *
 * The headline cases here are the regressions for the loose-matching bug:
 * a bare answer (or single shared term) appearing in a lyric must NOT attach
 * a problem-moment — only the moment's *full expression* does — and a numeric
 * player handle must not leak digits into number matching.
 */

import { describe, expect, it } from 'vitest'
import type {
  SongProblemMoment,
  SongSkillSpotlight,
} from '@/lib/session-song/extract-session-stats'
import { type AnnotateFacts, annotateSections } from '../annotate'
import type { ParsedSongSection } from '../songPlan'

const section = (name: string, lines: string[]): ParsedSongSection => ({
  name,
  lines,
  localStyles: [],
  negativeLocalStyles: [],
  durationMs: 0,
})

const comeback: SongProblemMoment = {
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
  strategySteps: ['0 + 56 = 56'],
}

const boss: SongProblemMoment = {
  kind: 'hard_problem',
  reason: 'highest complexity problem',
  problem: '23 + 1 + 10 + 10 = 44',
  partType: 'Use Abacus',
  answer: 44,
  studentAnswers: [44],
  attempts: 1,
  incorrectAttempts: 0,
  outcome: 'correct',
  skills: ['Direct Addition (1-4)'],
  strategySteps: [],
}

const SECTIONS: ParsedSongSection[] = [
  section('Verse 1', ['Detective work, here we go', 'I solved 56 - 28 + 66 - 18 = 76, you know!']),
  section('Chorus', ['That 76 feeling, five in a row']), // bare answer only — must NOT match
  section('Bridge', ['Cracked the 313 case wide open']),
  section('Rap Break: Type Racer Side Quest', ['Fingers flying, watch me go']),
  section('Outro', ['Still on 313, encore time']),
  section('Boss Verse', ['Boss mix: 23+1+10+10=44—won!']), // spacing/dash variance
]

const FULL_FACTS: AnnotateFacts = {
  playerName: 'Fern',
  problemMoments: [comeback, boss],
  storyAngle: 'the 313 comeback',
  gameBreak: { gameName: 'Type Racer Jr.', headline: 'Great Typing!' },
  skillSpotlights: [
    { skill: 'Direct Addition (1-4)', attempts: 4, correct: 4, problems: 4, exampleProblems: [] },
  ],
}

describe('annotateSections — strict problem matching', () => {
  it('attaches a moment only on a FULL-expression match, and does not echo the equation', () => {
    const out = annotateSections(SECTIONS, FULL_FACTS)
    const v1 = out[0].annotations ?? []
    expect(v1).toContain('Fern bounced back on this one.')
    expect(v1.some((n) => n.includes('56 - 28 + 66 - 18 = 76'))).toBe(false)
  })

  it('does NOT attach a moment when only the bare answer appears (the bug)', () => {
    const out = annotateSections(SECTIONS, FULL_FACTS)
    // "That 76 feeling" contains 76 but not the full expression.
    expect(out[1]).toBe(SECTIONS[1])
    expect(out[1].annotations).toBeUndefined()
  })

  it('matches across spacing/dash differences (23+1+10+10=44 vs "23 + 1 + 10 + 10 = 44")', () => {
    const out = annotateSections(SECTIONS, FULL_FACTS)
    const bossVerse = out[5].annotations ?? []
    expect(bossVerse).toContain("The session's toughest problem — and Fern got it.")
  })

  it('attaches at most one problem-moment note per section', () => {
    const dupFacts: AnnotateFacts = {
      playerName: 'Fern',
      problemMoments: [comeback, { ...comeback, kind: 'finale' }],
    }
    const out = annotateSections(
      [section('V', ['twice: 56 - 28 + 66 - 18 = 76 and again 56 - 28 + 66 - 18 = 76'])],
      dupFacts
    )
    expect((out[0].annotations ?? []).length).toBe(1)
  })
})

describe('annotateSections — story / game / skill', () => {
  it('emits the story note once total, where the signature number appears', () => {
    const out = annotateSections(SECTIONS, FULL_FACTS)
    const storyNotes = out
      .flatMap((s) => s.annotations ?? [])
      .filter((n) => n.startsWith('The whole song is built around'))
    expect(storyNotes).toHaveLength(1)
    expect(out[2].annotations ?? []).toContain(storyNotes[0]) // Bridge (first 313)
    expect(out[4].annotations ?? []).not.toContain(storyNotes[0]) // Outro (later 313)
  })

  it('gives a game-break shout-out from the section name', () => {
    const out = annotateSections(SECTIONS, FULL_FACTS)
    expect(out[3].annotations ?? []).toContain(
      'A shout-out to the Type Racer Jr. break Fern earned.'
    )
  })

  it('attaches a skill note when the display skill is literally in the lyric', () => {
    const out = annotateSections(
      [section('Hook', ['Direct Addition (1-4), smooth move'])],
      { playerName: 'Fern', skillSpotlights: FULL_FACTS.skillSpotlights }
    )
    expect(out[0].annotations ?? []).toContain('This part leans on Direct Addition (1-4).')
  })

  it('caps total annotations per section at two', () => {
    const out = annotateSections(SECTIONS, FULL_FACTS)
    for (const s of out) expect((s.annotations ?? []).length).toBeLessThanOrEqual(2)
  })
})

describe('annotateSections — robustness', () => {
  it('does not leak a numeric player handle into number matching', () => {
    const lone = [section('V', ['Player44 takes the mic'])]
    const out = annotateSections(lone, {
      playerName: 'Player44',
      storyAngle: 'the 44 run', // would false-match if "44" from the handle leaked
    })
    // No story note → section returned by identity, unchanged.
    expect(out[0]).toBe(lone[0])
    expect(out[0].annotations).toBeUndefined()
  })

  it('returns the input array untouched when no facts are gated in', () => {
    const out = annotateSections(SECTIONS, { playerName: 'Fern' })
    expect(out).toBe(SECTIONS)
  })

  it('degrades without throwing on malformed/absent practiceDrama', () => {
    expect(() =>
      annotateSections(SECTIONS, {
        playerName: 'Fern',
        problemMoments: undefined,
        skillSpotlights: 'nope' as unknown as SongSkillSpotlight[],
        storyAngle: '',
      })
    ).not.toThrow()
    const out = annotateSections(SECTIONS, {
      playerName: 'Fern',
      skillSpotlights: 'nope' as unknown as SongSkillSpotlight[],
    })
    expect(out).toBe(SECTIONS)
  })

  it('handles empty sections input', () => {
    expect(annotateSections([], FULL_FACTS)).toEqual([])
  })
})
