/**
 * Tests for extractSessionStats — focused on game break extraction
 * (a full GameResult, and the machine's break record for skipped/timeout breaks).
 */

import { describe, expect, it } from 'vitest'
import type { GameResult } from '@/db/schema/game-results'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { extractSessionStats } from '../extract-session-stats'

// ============================================================================
// Minimal fixtures
// ============================================================================

const minimalPlan = {
  id: 'plan-1',
  parts: [{ type: 'addition', slots: [{}] }],
  results: [{ isCorrect: true, hadHelp: false, skillsExercised: ['addition'] }],
  targetDurationMinutes: 5,
} as unknown as SessionPlan

const minimalPlayer = {
  name: 'Sonia',
  emoji: '🌟',
} as unknown as Player

// ============================================================================
// Game break tests
// ============================================================================

describe('extractSessionStats — game break', () => {
  it('returns no gameBreaks when no result and no fallback', () => {
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [])
    expect(stats.gameBreaks).toBeUndefined()
  })

  it('returns no gameBreakss when there are no game results and no fallback', () => {
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], [])
    expect(stats.gameBreaks).toBeUndefined()
  })

  it('extracts game break from full GameResult with report', () => {
    const gameResult = {
      accuracy: 0.85,
      fullReport: {
        gameDisplayName: 'Memory Match',
        headline: 'Great memory!',
        customStats: [
          { label: 'Pairs Found', value: '8/10', highlight: true },
          { label: 'Time', value: '1:23', highlight: true },
          { label: 'Moves', value: '18', highlight: false },
        ],
      },
    } as unknown as GameResult

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], [gameResult])

    expect(stats.gameBreaks).toHaveLength(1)
    expect(stats.gameBreaks![0].gameName).toBe('Memory Match')
    expect(stats.gameBreaks![0].headline).toBe('Great memory!')
    expect(stats.gameBreaks![0].accuracy).toBe(85)
    expect(stats.gameBreaks![0].highlights).toEqual(['Pairs Found: 8/10', 'Time: 1:23'])
  })

  it('reads a played break from its game result even when the legacy break columns name another', () => {
    const gameResult = {
      accuracy: 0.9,
      fullReport: {
        gameDisplayName: 'Memory Match',
        headline: 'Perfect!',
        customStats: [],
      },
    } as unknown as GameResult
    const plan = {
      ...minimalPlan,
      breakSelectedGame: 'number-bonds',
      breakReason: 'skipped',
    } as unknown as SessionPlan

    const stats = extractSessionStats(plan, minimalPlayer, [], [gameResult])

    expect(stats.gameBreaks?.map((gb) => [gb.gameName, gb.headline])).toEqual([
      ['Memory Match', 'Perfect!'],
    ])
  })

  /** A plan whose machine list holds one closed break (Phase 3a on). */
  function planWithBreak(game: string | null, reason: 'skipped' | 'timeout' | null) {
    return {
      ...minimalPlan,
      breaks: [
        {
          breakIndex: 0,
          afterPartIndex: 0,
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-01-01T00:01:00.000Z',
          game,
          reason,
          results: null,
        },
      ],
    } as unknown as SessionPlan
  }

  it('names a skipped break from its record', () => {
    const stats = extractSessionStats(
      planWithBreak('matching-pairs', 'skipped'),
      minimalPlayer,
      [],
      []
    )

    expect(stats.gameBreaks).toHaveLength(1)
    expect(stats.gameBreaks![0].gameName).toBe('matching-pairs')
    expect(stats.gameBreaks![0].headline).toBe('Played matching-pairs (ended early)')
    expect(stats.gameBreaks![0].highlights).toEqual([])
    expect(stats.gameBreaks![0].accuracy).toBeUndefined()
  })

  it('names a timed-out break from its record', () => {
    const stats = extractSessionStats(
      planWithBreak('number-bonds', 'timeout'),
      minimalPlayer,
      [],
      []
    )

    expect(stats.gameBreaks).toHaveLength(1)
    expect(stats.gameBreaks![0].gameName).toBe('number-bonds')
    expect(stats.gameBreaks![0].headline).toBe('Played number-bonds (timed out)')
  })

  it('leaves out a break whose kid never chose a game', () => {
    const stats = extractSessionStats(planWithBreak(null, 'skipped'), minimalPlayer, [], [])

    expect(stats.gameBreaks).toBeUndefined()
  })

  it('names a break with no reason as played', () => {
    const stats = extractSessionStats(planWithBreak('some-game', null), minimalPlayer, [], [])

    expect(stats.gameBreaks).toHaveLength(1)
    expect(stats.gameBreaks![0].headline).toBe('Played some-game (played)')
  })

  it('does not read the legacy break columns for a row without records or results (Phase 6b-0, §10 P6b-4)', () => {
    const plan = {
      ...minimalPlan,
      breakSelectedGame: 'matching-pairs',
      breakReason: 'skipped',
      breakResults: { gameName: 'matching-pairs', endedAt: 1 },
    } as unknown as SessionPlan

    expect(extractSessionStats(plan, minimalPlayer, [], []).gameBreaks).toBeUndefined()
  })

  it('includes song-specific game break details when a game reports them', () => {
    const gameResult = {
      accuracy: 92,
      fullReport: {
        gameDisplayName: 'Type Racer Jr.',
        headline: 'Clean typing sprint!',
        customStats: [{ label: 'Stars', value: '9', highlight: true }],
        playerResults: [{ playerName: 'Sonia', score: 9, accuracy: 92 }],
        songContext: {
          summary: 'Typed five animal words before the timer.',
          details: ['Words typed: cat, moon, rocket'],
          dramaticMoments: ['No mistakes on rocket'],
          strategyNotes: ['Slowed down for the double-o in moon'],
          outcome: 'finished with a clean final word',
        },
      },
    } as unknown as GameResult

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], [gameResult])

    expect(stats.gameBreaks![0].details).toContain('Typed five animal words before the timer.')
    expect(stats.gameBreaks![0].details).toContain('Words typed: cat, moon, rocket')
    expect(stats.gameBreaks![0].moments).toContain('No mistakes on rocket')
    expect(stats.gameBreaks![0].moments).toContain('Slowed down for the double-o in moon')
    expect(stats.gameBreaks![0].outcome).toBe('finished with a clean final word')
  })

  it('names every break, in the order given (played_at), with an arc each (Phase 3b)', () => {
    const memory = {
      accuracy: 80,
      fullReport: { gameDisplayName: 'Memory Match', headline: 'Great memory!', customStats: [] },
    } as unknown as GameResult
    const racer = {
      accuracy: 95,
      fullReport: { gameDisplayName: 'Type Racer Jr.', headline: 'Fast fingers!', customStats: [] },
    } as unknown as GameResult
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], [memory, racer])

    expect(stats.gameBreaks?.map((gb) => [gb.gameName, gb.headline, gb.accuracy])).toEqual([
      ['Memory Match', 'Great memory!', 80],
      ['Type Racer Jr.', 'Fast fingers!', 95],
    ])
    expect(stats.practiceDrama.arcs).toEqual(
      expect.arrayContaining([
        'Side quest: Memory Match - Great memory!.',
        'Side quest: Type Racer Jr. - Fast fingers!.',
      ])
    )
    expect(stats.practiceDrama.storyAngle).toBe(
      'practice quest with Memory Match and Type Racer Jr. side quests'
    )
  })

  it('names a break stored twice (same game, same end) once', () => {
    const row = {
      gameName: 'memory-match',
      accuracy: 80,
      playedAt: new Date(1_700_000_000_000),
      fullReport: {
        gameName: 'memory-match',
        gameDisplayName: 'Memory Match',
        headline: 'Great memory!',
        endedAt: 1_700_000_000_000,
        customStats: [],
      },
    } as unknown as GameResult
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], [row, { ...row }])
    expect(stats.gameBreaks?.map((gb) => gb.gameName)).toEqual(['Memory Match'])
    expect(stats.practiceDrama.storyAngle).toBe('practice quest with a Memory Match side quest')
  })

  it('keeps the one-break story angle and arc unchanged', () => {
    const memory = {
      accuracy: 80,
      fullReport: { gameDisplayName: 'Memory Match', headline: 'Great memory!', customStats: [] },
    } as unknown as GameResult
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], [memory])
    expect(stats.practiceDrama.storyAngle).toBe('practice quest with a Memory Match side quest')
    expect(stats.practiceDrama.arcs).toEqual(['Side quest: Memory Match - Great memory!.'])
  })
})

// ============================================================================
// Core stats tests (basic sanity)
// ============================================================================

describe('extractSessionStats — core fields', () => {
  it('populates player info', () => {
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [])
    expect(stats.player.name).toBe('Sonia')
    expect(stats.player.emoji).toBe('🌟')
  })

  it('computes history trend as steady with no recent sessions', () => {
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [])
    expect(stats.history.trend).toBe('steady')
    expect(stats.history.recentSessionCount).toBe(0)
  })

  it('detects improving trend', () => {
    const sessions = [
      // newest first
      { accuracy: 0.9 },
      { accuracy: 0.9 },
      { accuracy: 0.9 },
      { accuracy: 0.5 },
      { accuracy: 0.5 },
      { accuracy: 0.5 },
    ]
    const stats = extractSessionStats(minimalPlan, minimalPlayer, sessions)
    expect(stats.history.trend).toBe('improving')
  })

  it('detects declining trend', () => {
    const sessions = [
      // newest first
      { accuracy: 0.5 },
      { accuracy: 0.5 },
      { accuracy: 0.5 },
      { accuracy: 0.9 },
      { accuracy: 0.9 },
      { accuracy: 0.9 },
    ]
    const stats = extractSessionStats(minimalPlan, minimalPlayer, sessions)
    expect(stats.history.trend).toBe('declining')
  })

  it('surfaces dramatic problem details for song lyrics', () => {
    const problem = {
      terms: [9, 6],
      answer: 15,
      skillsRequired: ['tenComplements.6=10-4'],
      generationTrace: {
        terms: [9, 6],
        answer: 15,
        allSkills: ['tenComplements.6=10-4'],
        totalComplexityCost: 5,
        steps: [
          {
            stepNumber: 1,
            operation: '0 + 9 = 9',
            accumulatedBefore: 0,
            termAdded: 9,
            accumulatedAfter: 9,
            skillsUsed: [],
            explanation: 'Start with 9',
          },
          {
            stepNumber: 2,
            operation: '9 + 6 = 15',
            accumulatedBefore: 9,
            termAdded: 6,
            accumulatedAfter: 15,
            skillsUsed: ['tenComplements.6=10-4'],
            explanation: 'Use ten complement',
          },
        ],
      },
    }

    const dramaticPlan = {
      id: 'plan-drama',
      parts: [
        {
          partNumber: 1,
          type: 'abacus',
          format: 'vertical',
          useAbacus: true,
          estimatedMinutes: 5,
          slots: [
            {
              slotId: 'slot-hard',
              index: 0,
              purpose: 'challenge',
              constraints: {},
              problem,
            },
          ],
        },
      ],
      results: [
        {
          slotId: 'slot-hard',
          partNumber: 1,
          slotIndex: 0,
          problem,
          studentAnswer: 15,
          isCorrect: true,
          responseTimeMs: 12000,
          skillsExercised: ['tenComplements.6=10-4'],
          usedOnScreenAbacus: false,
          hadHelp: true,
          incorrectAttempts: 2,
          timestamp: new Date(),
        },
      ],
      targetDurationMinutes: 5,
    } as unknown as SessionPlan

    const stats = extractSessionStats(dramaticPlan, minimalPlayer, [])
    const moment = stats.practiceDrama.problemMoments[0]

    expect(stats.practiceDrama.storyAngle).toContain('9 + 6 = 15')
    expect(stats.currentSession.totalIncorrectAttempts).toBe(2)
    expect(stats.currentSession.helpMoments).toBe(1)
    expect(moment.problem).toBe('9 + 6 = 15')
    expect(moment.outcome).toBe('eventually_correct')
    expect(moment.attempts).toBe(3)
    expect(moment.skills).toContain('+6 = +10 - 4')
    expect(moment.strategySteps[0]).toContain('9 + 6 = 15')
    expect(stats.practiceDrama.skillSpotlights[0].skill).toBe('+6 = +10 - 4')
  })
})

// ============================================================================
// Legacy try fields (Phase 6a): a problem's retry rounds read through the
// normalizer, so rows written without the legacy fields pick the same moments
// ============================================================================

describe('extractSessionStats - rows without legacy fields', () => {
  const problemOf = (a: number) => ({ terms: [a, 1], answer: a + 1, skillsRequired: ['addition'] })

  function planWith(results: Record<string, unknown>[]): SessionPlan {
    return {
      id: 'plan-legacy',
      parts: [
        {
          partNumber: 1,
          type: 'abacus',
          format: 'vertical',
          useAbacus: true,
          estimatedMinutes: 5,
          slots: [0, 1].map((i) => ({
            slotId: `s${i}`,
            index: i,
            purpose: 'focus',
            constraints: {},
            problem: problemOf(i + 2),
          })),
        },
      ],
      results: results.map((over, i) => ({
        partNumber: 1,
        problem: problemOf(i + 2),
        studentAnswer: i + 3,
        isCorrect: true,
        responseTimeMs: 3000,
        skillsExercised: ['addition'],
        usedOnScreenAbacus: false,
        hadHelp: false,
        incorrectAttempts: 0,
        timestamp: new Date('2026-11-01T10:00:00Z'),
        ...over,
      })),
      targetDurationMinutes: 5,
    } as unknown as SessionPlan
  }

  const written = [
    {
      slotId: 's0',
      slotIndex: 0,
      kind: 'first',
      round: 0,
      practiceOnly: false,
      isRetry: false,
      epochNumber: 0,
      originalSlotIndex: 0,
    },
    {
      slotId: 's1',
      slotIndex: 1,
      kind: 'first',
      round: 0,
      practiceOnly: false,
      isRetry: false,
      epochNumber: 0,
      originalSlotIndex: 1,
    },
  ]
  const strip = ({
    isRetry: _r,
    epochNumber: _e,
    isManualRedo: _m,
    originalSlotIndex: _o,
    ...rest
  }: Record<string, unknown>) => rest

  it('picks the same problem moments with or without the fields', () => {
    const withFields = extractSessionStats(planWith(written), minimalPlayer, [])
    const without = extractSessionStats(planWith(written.map(strip)), minimalPlayer, [])
    expect(without.practiceDrama).toEqual(withFields.practiceDrama)
    // Each problem has a retry round (0) and so a moment of its own, as before
    expect(withFields.practiceDrama.problemMoments).toHaveLength(2)
  })

  it('a row from before the retry system has no retry round (one fallback moment, as before)', () => {
    const legacy = written.map(({ slotId, slotIndex }) => ({ slotId, slotIndex }))
    expect(
      extractSessionStats(planWith(legacy), minimalPlayer, []).practiceDrama.problemMoments
    ).toHaveLength(1)
  })
})
