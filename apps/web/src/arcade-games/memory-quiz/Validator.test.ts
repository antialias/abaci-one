import { describe, it, expect } from 'vitest'
import { MemoryQuizGameValidator } from './Validator'
import type { MemoryQuizState, MemoryQuizMove } from './types'

function makeBaseState(overrides: Partial<MemoryQuizState> = {}): MemoryQuizState {
  return {
    cards: [],
    quizCards: [
      { number: 42, svgComponent: null, element: null },
      { number: 99, svgComponent: null, element: null },
    ],
    correctAnswers: [42, 99],
    currentCardIndex: 2,
    displayTime: 2,
    selectedCount: 2,
    selectedDifficulty: 'easy',
    foundNumbers: [],
    guessesRemaining: 3,
    currentInput: '',
    incorrectGuesses: 0,
    activePlayers: ['player-1'],
    playerMetadata: {
      'player-1': {
        id: 'player-1',
        name: 'Alice',
        emoji: '🎮',
        userId: 'user-1',
        color: '#8b5cf6',
      },
    },
    playerScores: { 'user-1': { correct: 0, incorrect: 0 } },
    playMode: 'cooperative',
    numberFoundBy: {},
    gamePhase: 'display',
    gameStartTime: Date.now(),
    prefixAcceptanceTimeout: null,
    finishButtonsBound: false,
    wrongGuessAnimations: [],
    hasPhysicalKeyboard: null,
    testingMode: false,
    showOnScreenKeyboard: false,
    ...overrides,
  }
}

function makeJoinMove(
  overrides: Partial<MemoryQuizMove & { type: 'JOIN_GAME' }> = {}
): MemoryQuizMove {
  return {
    type: 'JOIN_GAME',
    playerId: 'player-2',
    userId: 'user-2',
    timestamp: Date.now(),
    data: {
      playerId: 'player-2',
      playerName: 'Bob',
      emoji: '🚀',
      color: '#22c55e',
      userId: 'user-2',
    },
    ...overrides,
  }
}

describe('MemoryQuizGameValidator - JOIN_GAME', () => {
  const validator = new MemoryQuizGameValidator()

  it('succeeds during display phase', () => {
    const state = makeBaseState({ gamePhase: 'display' })
    const move = makeJoinMove()

    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(true)
    const newState = result.newState as MemoryQuizState
    expect(newState.activePlayers).toContain('player-2')
    expect(newState.playerMetadata['player-2']).toEqual({
      id: 'player-2',
      name: 'Bob',
      emoji: '🚀',
      userId: 'user-2',
      color: '#22c55e',
    })
    expect(newState.playerScores['user-2']).toEqual({ correct: 0, incorrect: 0 })
  })

  it('succeeds during input phase', () => {
    const state = makeBaseState({ gamePhase: 'input' })
    const move = makeJoinMove()

    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(true)
    const newState = result.newState as MemoryQuizState
    expect(newState.activePlayers).toContain('player-2')
  })

  it('fails during results phase', () => {
    const state = makeBaseState({ gamePhase: 'results' })
    const move = makeJoinMove()

    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('results')
  })

  it('fails during setup phase', () => {
    const state = makeBaseState({ gamePhase: 'setup' })
    const move = makeJoinMove()

    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('setup')
  })

  it('fails when player is already in the game', () => {
    const state = makeBaseState({ gamePhase: 'display' })
    const move = makeJoinMove({
      playerId: 'player-1',
      userId: 'user-1',
      data: {
        playerId: 'player-1',
        playerName: 'Alice',
        emoji: '🎮',
        color: '#8b5cf6',
        userId: 'user-1',
      },
    } as any)

    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('already in the game')
  })

  it('fails when game is full (8 players)', () => {
    const players = Array.from({ length: 8 }, (_, i) => `existing-${i}`)
    const metadata: Record<string, any> = {}
    const scores: Record<string, any> = {}
    for (const p of players) {
      metadata[p] = { id: p, name: p, emoji: '🎮', userId: `user-${p}`, color: '#000' }
      scores[`user-${p}`] = { correct: 0, incorrect: 0 }
    }

    const state = makeBaseState({
      gamePhase: 'display',
      activePlayers: players,
      playerMetadata: metadata,
      playerScores: scores,
    })

    const move = makeJoinMove()
    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('full')
  })

  it('preserves existing player scores when a user already has scores', () => {
    const state = makeBaseState({
      gamePhase: 'input',
      playerScores: {
        'user-1': { correct: 3, incorrect: 1 },
        'user-2': { correct: 5, incorrect: 0 },
      },
    })

    const move = makeJoinMove()
    const result = validator.validateMove(state, move)

    expect(result.valid).toBe(true)
    const newState = result.newState as MemoryQuizState
    // Existing scores for user-2 should be preserved, not reset
    expect(newState.playerScores['user-2']).toEqual({ correct: 5, incorrect: 0 })
    // user-1 should be untouched
    expect(newState.playerScores['user-1']).toEqual({ correct: 3, incorrect: 1 })
  })
})
