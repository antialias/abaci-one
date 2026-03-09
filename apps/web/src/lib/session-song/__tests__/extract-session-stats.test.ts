/**
 * Tests for extractSessionStats — focused on game break extraction
 * (both full GameResult and plan-level fallback for skipped/timeout breaks).
 */

import { describe, it, expect } from 'vitest'
import { extractSessionStats } from '../extract-session-stats'
import type { SessionPlan } from '@/db/schema/session-plans'
import type { Player } from '@/db/schema/players'
import type { GameResult } from '@/db/schema/game-results'

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
    expect(stats.gameBreak!.accuracy).toBe(0.85)
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
})
