/**
 * Tests for extractSessionStats — focused on game break extraction
 * (both full GameResult and plan-level fallback for skipped/timeout breaks).
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
  it('returns no gameBreak when no result and no fallback', () => {
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [])
    expect(stats.gameBreak).toBeUndefined()
  })

  it('returns no gameBreak when gameBreakResult is null and no fallback', () => {
    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], null)
    expect(stats.gameBreak).toBeUndefined()
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

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], gameResult)

    expect(stats.gameBreak).toBeDefined()
    expect(stats.gameBreak!.gameName).toBe('Memory Match')
    expect(stats.gameBreak!.headline).toBe('Great memory!')
    expect(stats.gameBreak!.accuracy).toBe(85)
    expect(stats.gameBreak!.highlights).toEqual(['Pairs Found: 8/10', 'Time: 1:23'])
  })

  it('prefers full GameResult over plan fallback when both exist', () => {
    const gameResult = {
      accuracy: 0.9,
      fullReport: {
        gameDisplayName: 'Memory Match',
        headline: 'Perfect!',
        customStats: [],
      },
    } as unknown as GameResult

    const fallback = {
      breakSelectedGame: 'memory-match',
      breakReason: 'gameFinished' as const,
    }

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], gameResult, fallback)

    expect(stats.gameBreak!.gameName).toBe('Memory Match')
    expect(stats.gameBreak!.headline).toBe('Perfect!')
  })

  it('uses plan fallback when gameBreakResult is null (skipped break)', () => {
    const fallback = {
      breakSelectedGame: 'matching-pairs',
      breakReason: 'skipped' as const,
    }

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], null, fallback)

    expect(stats.gameBreak).toBeDefined()
    expect(stats.gameBreak!.gameName).toBe('matching-pairs')
    expect(stats.gameBreak!.headline).toBe('Played matching-pairs (ended early)')
    expect(stats.gameBreak!.highlights).toEqual([])
    expect(stats.gameBreak!.accuracy).toBeUndefined()
  })

  it('uses plan fallback when gameBreakResult is null (timeout break)', () => {
    const fallback = {
      breakSelectedGame: 'number-bonds',
      breakReason: 'timeout' as const,
    }

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], null, fallback)

    expect(stats.gameBreak).toBeDefined()
    expect(stats.gameBreak!.gameName).toBe('number-bonds')
    expect(stats.gameBreak!.headline).toBe('Played number-bonds (timed out)')
  })

  it('uses plan fallback when GameResult has no fullReport', () => {
    const gameResult = {
      accuracy: null,
      fullReport: null,
    } as unknown as GameResult

    const fallback = {
      breakSelectedGame: 'memory-match',
      breakReason: 'skipped' as const,
    }

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], gameResult, fallback)

    expect(stats.gameBreak).toBeDefined()
    expect(stats.gameBreak!.gameName).toBe('memory-match')
    expect(stats.gameBreak!.headline).toBe('Played memory-match (ended early)')
  })

  it('returns no gameBreak when fallback has null breakSelectedGame', () => {
    const fallback = {
      breakSelectedGame: null,
      breakReason: 'skipped' as const,
    }

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], null, fallback)

    expect(stats.gameBreak).toBeUndefined()
  })

  it('handles fallback with null breakReason gracefully', () => {
    const fallback = {
      breakSelectedGame: 'some-game',
      breakReason: null,
    }

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], null, fallback)

    expect(stats.gameBreak).toBeDefined()
    expect(stats.gameBreak!.headline).toBe('Played some-game (played)')
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

    const stats = extractSessionStats(minimalPlan, minimalPlayer, [], gameResult)

    expect(stats.gameBreak!.details).toContain('Typed five animal words before the timer.')
    expect(stats.gameBreak!.details).toContain('Words typed: cat, moon, rocket')
    expect(stats.gameBreak!.moments).toContain('No mistakes on rocket')
    expect(stats.gameBreak!.moments).toContain('Slowed down for the double-o in moon')
    expect(stats.gameBreak!.outcome).toBe('finished with a clean final word')
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
      { accuracy: 0.5 },
      { accuracy: 0.5 },
      { accuracy: 0.5 },
      { accuracy: 0.9 },
      { accuracy: 0.9 },
      { accuracy: 0.9 },
    ]
    const stats = extractSessionStats(minimalPlan, minimalPlayer, sessions)
    expect(stats.history.trend).toBe('improving')
  })

  it('detects declining trend', () => {
    const sessions = [
      { accuracy: 0.9 },
      { accuracy: 0.9 },
      { accuracy: 0.9 },
      { accuracy: 0.5 },
      { accuracy: 0.5 },
      { accuracy: 0.5 },
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
