import { describe, it, expect, beforeEach } from 'vitest'
import { MatchingGameValidator } from './Validator'
import type { MatchingState, MatchingConfig, MatchingMove, GameCard, PlayerMetadata } from './types'

// Helper to cast ValidationResult.newState to MatchingState
const asState = (newState: unknown) => newState as MatchingState | undefined

describe('MatchingGameValidator', () => {
  let validator: MatchingGameValidator

  beforeEach(() => {
    validator = new MatchingGameValidator()
  })

  // ============================================================================
  // Test Helpers
  // ============================================================================

  const createGameCard = (id: string, number: number, matched = false): GameCard => ({
    id,
    type: 'number',
    number,
    matched,
    matchedBy: undefined,
  })

  const createBaseState = (overrides: Partial<MatchingState> = {}): MatchingState => ({
    cards: [],
    gameCards: [],
    flippedCards: [],
    gameType: 'abacus-numeral',
    difficulty: 6,
    turnTimer: 30,
    gamePhase: 'playing',
    currentPlayer: 'player-1',
    matchedPairs: 0,
    totalPairs: 6,
    moves: 0,
    scores: { 'player-1': 0 },
    activePlayers: ['player-1'],
    playerMetadata: {
      'player-1': {
        id: 'player-1',
        name: 'Test Player',
        emoji: '🎮',
        userId: 'user-1',
      },
    },
    consecutiveMatches: { 'player-1': 0 },
    gameStartTime: Date.now() - 60000,
    gameEndTime: null,
    currentMoveStartTime: null,
    celebrationAnimations: [],
    isProcessingMove: false,
    showMismatchFeedback: false,
    lastMatchedPair: null,
    playerHovers: {},
    ...overrides,
  })

  const createBaseConfig = (overrides: Partial<MatchingConfig> = {}): MatchingConfig => ({
    gameType: 'abacus-numeral',
    difficulty: 6,
    turnTimer: 30,
    ...overrides,
  })

  const createFlipCardMove = (cardId: string, playerId = 'player-1'): MatchingMove => ({
    type: 'FLIP_CARD',
    playerId,
    userId: 'user-1',
    timestamp: Date.now(),
    data: { cardId },
  })

  // ============================================================================
  // getResultsReport Tests
  // ============================================================================

  describe('getResultsReport', () => {
    describe('single-player results', () => {
      it('generates correct report for perfect game (100% accuracy)', () => {
        const state = createBaseState({
          gamePhase: 'results',
          matchedPairs: 6,
          totalPairs: 6,
          moves: 12, // Minimum possible moves for 6 pairs (2 moves per pair)
          scores: { 'player-1': 6 },
          consecutiveMatches: { 'player-1': 4 },
          gameStartTime: Date.now() - 45000,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        expect(report.gameName).toBe('matching')
        expect(report.gameDisplayName).toBe('Matching Pairs Battle')
        expect(report.gameIcon).toBe('⚔️')
        expect(report.gameMode).toBe('single-player')
        expect(report.playerCount).toBe(1)
        expect(report.completedNormally).toBe(true)
        expect(report.itemsCompleted).toBe(6)
        expect(report.itemsTotal).toBe(6)
        expect(report.completionPercent).toBe(100)

        // Perfect accuracy (12 moves for 6 pairs = 100%)
        expect(report.headline).toBe('Perfect Memory!')
        expect(report.resultTheme).toBe('success')
        expect(report.celebrationType).toBe('confetti')

        // Player results
        expect(report.playerResults).toHaveLength(1)
        expect(report.playerResults[0].playerId).toBe('player-1')
        expect(report.playerResults[0].score).toBe(6)
        expect(report.playerResults[0].rank).toBe(1)
        expect(report.playerResults[0].isWinner).toBe(true)
        expect(report.playerResults[0].accuracy).toBe(100)
      })

      it('generates correct report for good performance (80%+ accuracy)', () => {
        const state = createBaseState({
          gamePhase: 'results',
          matchedPairs: 6,
          totalPairs: 6,
          moves: 15, // 12/15 = 80% accuracy
          scores: { 'player-1': 6 },
          consecutiveMatches: { 'player-1': 2 },
          gameStartTime: Date.now() - 60000,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        expect(report.headline).toBe('Great Job!')
        expect(report.resultTheme).toBe('good')
        expect(report.celebrationType).toBe('stars')
        expect(report.playerResults[0].accuracy).toBe(80)
      })

      it('generates correct report for neutral performance (50-79% accuracy)', () => {
        const state = createBaseState({
          gamePhase: 'results',
          matchedPairs: 6,
          totalPairs: 6,
          moves: 18, // 12/18 = 67% accuracy
          scores: { 'player-1': 6 },
          consecutiveMatches: { 'player-1': 1 },
          gameStartTime: Date.now() - 90000,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        expect(report.headline).toBe('Nice Work!')
        expect(report.resultTheme).toBe('neutral')
        expect(report.celebrationType).toBe('none')
        expect(report.playerResults[0].accuracy).toBe(67)
      })

      it('generates correct report for needs-practice performance (<50% accuracy)', () => {
        const state = createBaseState({
          gamePhase: 'results',
          matchedPairs: 6,
          totalPairs: 6,
          moves: 30, // 12/30 = 40% accuracy
          scores: { 'player-1': 6 },
          consecutiveMatches: { 'player-1': 0 },
          gameStartTime: Date.now() - 120000,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        expect(report.headline).toBe('Keep Practicing!')
        expect(report.resultTheme).toBe('needs-practice')
        expect(report.celebrationType).toBe('none')
        expect(report.playerResults[0].accuracy).toBe(40)
      })

      it('generates correct report for incomplete game', () => {
        const state = createBaseState({
          gamePhase: 'results',
          matchedPairs: 3,
          totalPairs: 6,
          moves: 10,
          scores: { 'player-1': 3 },
          gameStartTime: Date.now() - 60000,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        expect(report.completedNormally).toBe(false)
        expect(report.itemsCompleted).toBe(3)
        expect(report.itemsTotal).toBe(6)
        expect(report.completionPercent).toBe(50)
      })
    })

    describe('multiplayer results', () => {
      it('generates correct report with winner announcement', () => {
        const state = createBaseState({
          gamePhase: 'results',
          matchedPairs: 6,
          totalPairs: 6,
          moves: 12,
          scores: { 'player-1': 4, 'player-2': 2 },
          activePlayers: ['player-1', 'player-2'],
          playerMetadata: {
            'player-1': {
              id: 'player-1',
              name: 'Alice',
              emoji: '🌟',
              userId: 'user-1',
            },
            'player-2': {
              id: 'player-2',
              name: 'Bob',
              emoji: '🚀',
              userId: 'user-2',
            },
          },
          consecutiveMatches: { 'player-1': 3, 'player-2': 1 },
          gameStartTime: Date.now() - 90000,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        expect(report.gameMode).toBe('competitive')
        expect(report.playerCount).toBe(2)
        expect(report.headline).toBe('Alice Wins!')
        expect(report.resultTheme).toBe('success')
        expect(report.celebrationType).toBe('confetti')
        expect(report.winnerId).toBe('player-1')

        // Player results sorted by score
        expect(report.playerResults).toHaveLength(2)
        expect(report.playerResults[0].playerId).toBe('player-1')
        expect(report.playerResults[0].score).toBe(4)
        expect(report.playerResults[0].rank).toBe(1)
        expect(report.playerResults[0].isWinner).toBe(true)
        expect(report.playerResults[0].playerName).toBe('Alice')

        expect(report.playerResults[1].playerId).toBe('player-2')
        expect(report.playerResults[1].score).toBe(2)
        expect(report.playerResults[1].rank).toBe(2)
        expect(report.playerResults[1].isWinner).toBe(false)
        expect(report.playerResults[1].playerName).toBe('Bob')
      })
    })

    describe('difficulty levels', () => {
      it('reports easy difficulty for 6 pairs', () => {
        const state = createBaseState({ difficulty: 6 })
        const config = createBaseConfig({ difficulty: 6 })

        const report = validator.getResultsReport(state, config)

        expect(report.leaderboardEntry?.difficulty).toBe('easy')
      })

      it('reports medium difficulty for 8 pairs', () => {
        const state = createBaseState({ difficulty: 8, totalPairs: 8 })
        const config = createBaseConfig({ difficulty: 8 })

        const report = validator.getResultsReport(state, config)

        expect(report.leaderboardEntry?.difficulty).toBe('medium')
      })

      it('reports hard difficulty for 12 pairs', () => {
        const state = createBaseState({ difficulty: 12, totalPairs: 12 })
        const config = createBaseConfig({ difficulty: 12 })

        const report = validator.getResultsReport(state, config)

        expect(report.leaderboardEntry?.difficulty).toBe('hard')
      })

      it('reports expert difficulty for 15 pairs', () => {
        const state = createBaseState({ difficulty: 15, totalPairs: 15 })
        const config = createBaseConfig({ difficulty: 15 })

        const report = validator.getResultsReport(state, config)

        expect(report.leaderboardEntry?.difficulty).toBe('expert')
      })
    })

    describe('custom stats', () => {
      it('includes highlighted pairs found stat when complete', () => {
        const state = createBaseState({
          matchedPairs: 6,
          totalPairs: 6,
          moves: 12,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        const pairsFoundStat = report.customStats?.find((s) => s.label === 'Pairs Found')
        expect(pairsFoundStat).toBeDefined()
        expect(pairsFoundStat?.value).toBe('6/6')
        expect(pairsFoundStat?.highlight).toBe(true)
      })

      it('does not highlight pairs found stat when incomplete', () => {
        const state = createBaseState({
          matchedPairs: 3,
          totalPairs: 6,
          moves: 10,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        const pairsFoundStat = report.customStats?.find((s) => s.label === 'Pairs Found')
        expect(pairsFoundStat?.highlight).toBe(false)
      })

      it('includes best streak stat when streak >= 3', () => {
        const state = createBaseState({
          matchedPairs: 6,
          totalPairs: 6,
          moves: 12,
          consecutiveMatches: { 'player-1': 5 },
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        const streakStat = report.customStats?.find((s) => s.label === 'Best Streak')
        expect(streakStat).toBeDefined()
        expect(streakStat?.value).toBe(5)
        expect(streakStat?.highlight).toBe(true)
      })

      it('does not include streak stat when streak < 3', () => {
        const state = createBaseState({
          matchedPairs: 6,
          totalPairs: 6,
          moves: 12,
          consecutiveMatches: { 'player-1': 2 },
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        const streakStat = report.customStats?.find((s) => s.label === 'Best Streak')
        expect(streakStat).toBeUndefined()
      })

      it('includes accuracy stat for single-player', () => {
        const state = createBaseState({
          matchedPairs: 6,
          totalPairs: 6,
          moves: 12,
          gameEndTime: Date.now(),
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        const accuracyStat = report.customStats?.find((s) => s.label === 'Accuracy')
        expect(accuracyStat).toBeDefined()
        expect(accuracyStat?.value).toBe('100%')
      })
    })

    describe('duration calculation', () => {
      it('calculates duration correctly', () => {
        const startTime = Date.now() - 120000 // 2 minutes ago
        const endTime = Date.now()
        const state = createBaseState({
          gameStartTime: startTime,
          gameEndTime: endTime,
        })
        const config = createBaseConfig()

        const report = validator.getResultsReport(state, config)

        // Should be approximately 120000ms (2 minutes)
        expect(report.durationMs).toBeGreaterThanOrEqual(119000)
        expect(report.durationMs).toBeLessThanOrEqual(121000)
        expect(report.startedAt).toBe(startTime)
        expect(report.endedAt).toBe(endTime)
      })
    })
  })

  // ============================================================================
  // validateFlipCard Tests
  // ============================================================================

  describe('validateFlipCard', () => {
    it('rejects flip when game is not in playing phase', () => {
      const gameCards = [createGameCard('card-1', 5), createGameCard('card-2', 5)]
      const state = createBaseState({
        gamePhase: 'setup',
        gameCards,
      })
      const move = createFlipCardMove('card-1')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot flip cards outside of playing phase')
    })

    it("rejects flip when it is not the player's turn (multiplayer)", () => {
      const gameCards = [createGameCard('card-1', 5), createGameCard('card-2', 5)]
      const state = createBaseState({
        gameCards,
        activePlayers: ['player-1', 'player-2'],
        currentPlayer: 'player-1',
      })
      const move = createFlipCardMove('card-1', 'player-2') // Wrong player

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Not your turn')
    })

    it("allows flip when it is the player's turn (multiplayer)", () => {
      const gameCards = [createGameCard('card-1', 5), createGameCard('card-2', 5)]
      const state = createBaseState({
        gameCards,
        activePlayers: ['player-1', 'player-2'],
        currentPlayer: 'player-1',
      })
      const move = createFlipCardMove('card-1', 'player-1')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
    })

    it('rejects flip when player ownership fails authorization check', () => {
      const gameCards = [createGameCard('card-1', 5), createGameCard('card-2', 5)]
      const state = createBaseState({ gameCards })
      const move = createFlipCardMove('card-1', 'player-1')

      // Context indicates different user owns this player
      const result = validator.validateMove(state, move, {
        userId: 'user-2', // Different user
        playerOwnership: { 'player-1': 'user-1' }, // player-1 owned by user-1
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('You can only move your own players')
    })

    it('allows flip when player ownership matches', () => {
      const gameCards = [createGameCard('card-1', 5), createGameCard('card-2', 5)]
      const state = createBaseState({ gameCards })
      const move = createFlipCardMove('card-1', 'player-1')

      const result = validator.validateMove(state, move, {
        userId: 'user-1',
        playerOwnership: { 'player-1': 'user-1' },
      })

      expect(result.valid).toBe(true)
    })

    it('rejects flip when card is not found', () => {
      const gameCards = [createGameCard('card-1', 5)]
      const state = createBaseState({ gameCards })
      const move = createFlipCardMove('non-existent-card')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Card not found')
    })

    it('rejects flip when card is already matched', () => {
      const gameCards = [createGameCard('card-1', 5, true)]
      const state = createBaseState({ gameCards })
      const move = createFlipCardMove('card-1')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot flip this card')
    })

    it('rejects flip when card is already flipped', () => {
      const card = createGameCard('card-1', 5)
      const gameCards = [card, createGameCard('card-2', 5)]
      const state = createBaseState({
        gameCards,
        flippedCards: [card],
      })
      const move = createFlipCardMove('card-1')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot flip this card')
    })

    it('rejects flip when two cards are already flipped', () => {
      const card1 = createGameCard('card-1', 5)
      const card2 = createGameCard('card-2', 3)
      const card3 = createGameCard('card-3', 7)
      const gameCards = [card1, card2, card3]
      const state = createBaseState({
        gameCards,
        flippedCards: [card1, card2],
        isProcessingMove: true,
      })
      const move = createFlipCardMove('card-3')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot flip this card')
    })

    it('rejects flip when isProcessingMove is true', () => {
      const gameCards = [createGameCard('card-1', 5)]
      const state = createBaseState({
        gameCards,
        isProcessingMove: true,
      })
      const move = createFlipCardMove('card-1')

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot flip this card')
    })

    describe('match detection', () => {
      it('detects a match when flipping second card with same number', () => {
        const card1 = createGameCard('card-1', 5)
        card1.type = 'number'
        const card2 = createGameCard('card-2', 5)
        card2.type = 'abacus'
        const gameCards = [card1, card2]
        const state = createBaseState({
          gameCards,
          flippedCards: [card1],
          totalPairs: 1,
        })
        const move = createFlipCardMove('card-2')

        const result = validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.matchedPairs).toBe(1)
        expect(asState(result.newState)?.scores['player-1']).toBe(1)
        expect(asState(result.newState)?.consecutiveMatches['player-1']).toBe(1)
      })

      it('detects game completion when last pair is matched', () => {
        const card1 = createGameCard('card-1', 5)
        card1.type = 'number'
        const card2 = createGameCard('card-2', 5)
        card2.type = 'abacus'
        const gameCards = [card1, card2]
        const state = createBaseState({
          gameCards,
          flippedCards: [card1],
          totalPairs: 1,
          matchedPairs: 0,
        })
        const move = createFlipCardMove('card-2')

        const result = validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.gamePhase).toBe('results')
        expect(asState(result.newState)?.gameEndTime).toBeDefined()
      })

      it('switches player on mismatch in multiplayer', () => {
        const card1 = createGameCard('card-1', 5)
        card1.type = 'number'
        const card2 = createGameCard('card-2', 7) // Different number = mismatch
        card2.type = 'number'
        const gameCards = [card1, card2]
        const state = createBaseState({
          gameCards,
          flippedCards: [card1],
          activePlayers: ['player-1', 'player-2'],
          currentPlayer: 'player-1',
          consecutiveMatches: { 'player-1': 2, 'player-2': 0 },
        })
        const move = createFlipCardMove('card-2', 'player-1')

        const result = validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.currentPlayer).toBe('player-2')
        expect(asState(result.newState)?.showMismatchFeedback).toBe(true)
        expect(asState(result.newState)?.consecutiveMatches['player-1']).toBe(0) // Reset streak
      })
    })
  })

  // ============================================================================
  // getInitialStateForPracticeBreak Tests
  // ============================================================================

  describe('getInitialStateForPracticeBreak', () => {
    it('creates state in playing phase (skips setup)', () => {
      const state = validator.getInitialStateForPracticeBreak(
        {},
        { playerId: 'student-1', playerName: 'Sonia', maxDurationMinutes: 5 }
      )

      expect(state.gamePhase).toBe('playing')
      expect(state.gameCards.length).toBeGreaterThan(0)
    })

    it('sets up single player with correct ID', () => {
      const state = validator.getInitialStateForPracticeBreak(
        {},
        { playerId: 'student-1', playerName: 'Sonia', maxDurationMinutes: 5 }
      )

      expect(state.activePlayers).toEqual(['student-1'])
      expect(state.currentPlayer).toBe('student-1')
      expect(state.scores['student-1']).toBe(0)
    })

    it('sets up player metadata', () => {
      const state = validator.getInitialStateForPracticeBreak(
        {},
        { playerId: 'student-1', playerName: 'Sonia', maxDurationMinutes: 5 }
      )

      expect(state.playerMetadata['student-1']).toBeDefined()
      expect(state.playerMetadata['student-1'].name).toBe('Sonia')
      expect(state.playerMetadata['student-1'].id).toBe('student-1')
      expect(state.playerMetadata['student-1'].userId).toBe('student-1')
    })

    it('uses default player name when not provided', () => {
      const state = validator.getInitialStateForPracticeBreak(
        {},
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )

      expect(state.playerMetadata['student-1'].name).toBe('Player')
    })

    it('applies practice break defaults', () => {
      const state = validator.getInitialStateForPracticeBreak(
        {}, // No config overrides
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )

      expect(state.gameType).toBe('abacus-numeral')
      expect(state.difficulty).toBe(6)
      expect(state.turnTimer).toBe(30)
    })

    it('allows config overrides', () => {
      const state = validator.getInitialStateForPracticeBreak(
        { gameType: 'complement-pairs', difficulty: 8 },
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )

      expect(state.gameType).toBe('complement-pairs')
      expect(state.difficulty).toBe(8)
    })

    it('reduces difficulty for very short breaks', () => {
      const state = validator.getInitialStateForPracticeBreak(
        { difficulty: 12 }, // Would normally be 12
        { playerId: 'student-1', maxDurationMinutes: 2 } // Very short break
      )

      expect(state.difficulty).toBe(6) // Reduced to 6 for short breaks
    })

    it('keeps difficulty if break is long enough', () => {
      const state = validator.getInitialStateForPracticeBreak(
        { difficulty: 12 },
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )

      expect(state.difficulty).toBe(12)
    })

    it('generates correct number of cards for difficulty', () => {
      const state = validator.getInitialStateForPracticeBreak(
        { difficulty: 8 },
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )

      // 8 pairs = 16 cards
      expect(state.gameCards.length).toBe(16)
      expect(state.totalPairs).toBe(8)
    })

    it('sets gameStartTime', () => {
      const before = Date.now()
      const state = validator.getInitialStateForPracticeBreak(
        {},
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )
      const after = Date.now()

      expect(state.gameStartTime).toBeGreaterThanOrEqual(before)
      expect(state.gameStartTime).toBeLessThanOrEqual(after)
    })

    it('initializes game state correctly', () => {
      const state = validator.getInitialStateForPracticeBreak(
        {},
        { playerId: 'student-1', maxDurationMinutes: 5 }
      )

      expect(state.matchedPairs).toBe(0)
      expect(state.moves).toBe(0)
      expect(state.flippedCards).toEqual([])
      expect(state.isProcessingMove).toBe(false)
      expect(state.showMismatchFeedback).toBe(false)
    })
  })

  // ============================================================================
  // getInitialState Tests
  // ============================================================================

  describe('getInitialState', () => {
    it('creates state in setup phase by default', () => {
      const config = createBaseConfig()
      const state = validator.getInitialState(config)

      expect(state.gamePhase).toBe('setup')
      expect(state.gameCards).toEqual([])
    })

    it('skips setup when skipSetupPhase is true', () => {
      const config = createBaseConfig({ skipSetupPhase: true })
      const state = validator.getInitialState(config)

      expect(state.gamePhase).toBe('playing')
      expect(state.gameCards.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // CLEAR_MISMATCH Tests
  // ============================================================================

  describe('validateClearMismatch', () => {
    it('clears mismatch state when there is a mismatch showing', () => {
      const card1 = createGameCard('card-1', 5)
      const card2 = createGameCard('card-2', 7)
      const state = createBaseState({
        flippedCards: [card1, card2],
        showMismatchFeedback: true,
        isProcessingMove: true,
      })
      const move: MatchingMove = {
        type: 'CLEAR_MISMATCH',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.flippedCards).toEqual([])
      expect(asState(result.newState)?.showMismatchFeedback).toBe(false)
      expect(asState(result.newState)?.isProcessingMove).toBe(false)
    })

    it('does nothing when no mismatch is showing', () => {
      const state = createBaseState({
        flippedCards: [],
        showMismatchFeedback: false,
      })
      const move: MatchingMove = {
        type: 'CLEAR_MISMATCH',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(result.newState).toEqual(state) // State unchanged
    })
  })

  // ============================================================================
  // GO_TO_SETUP Tests
  // ============================================================================

  describe('validateGoToSetup', () => {
    it('transitions from playing to setup', () => {
      const state = createBaseState({ gamePhase: 'playing' })
      const move: MatchingMove = {
        type: 'GO_TO_SETUP',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.gamePhase).toBe('setup')
    })

    it('saves game state for pause/resume when coming from playing', () => {
      const gameCards = [createGameCard('card-1', 5)]
      const state = createBaseState({
        gamePhase: 'playing',
        gameCards,
        matchedPairs: 3,
        moves: 10,
        scores: { 'player-1': 3 },
      })
      const move: MatchingMove = {
        type: 'GO_TO_SETUP',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.pausedGamePhase).toBe('playing')
      expect(asState(result.newState)?.pausedGameState?.matchedPairs).toBe(3)
      expect(asState(result.newState)?.pausedGameState?.moves).toBe(10)
    })

    it('resets visible game state', () => {
      const state = createBaseState({
        gamePhase: 'playing',
        matchedPairs: 3,
        moves: 10,
      })
      const move: MatchingMove = {
        type: 'GO_TO_SETUP',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.gameCards).toEqual([])
      expect(asState(result.newState)?.matchedPairs).toBe(0)
      expect(asState(result.newState)?.moves).toBe(0)
      expect(asState(result.newState)?.activePlayers).toEqual([])
    })
  })

  // ============================================================================
  // SET_CONFIG Tests
  // ============================================================================

  describe('validateSetConfig', () => {
    it('allows setting config during setup phase', () => {
      const state = createBaseState({ gamePhase: 'setup' })
      const move: MatchingMove = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'difficulty', value: 8 },
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.difficulty).toBe(8)
      expect(asState(result.newState)?.totalPairs).toBe(8)
    })

    it('rejects config changes during playing phase', () => {
      const state = createBaseState({ gamePhase: 'playing' })
      const move: MatchingMove = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'difficulty', value: 8 },
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot change configuration outside of setup phase')
    })

    it('validates gameType values', () => {
      const state = createBaseState({ gamePhase: 'setup' })

      // Valid gameType
      let move: MatchingMove = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'gameType', value: 'complement-pairs' },
      }
      let result = validator.validateMove(state, move)
      expect(result.valid).toBe(true)

      // Invalid gameType
      move = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'gameType', value: 'invalid-type' },
      }
      result = validator.validateMove(state, move)
      expect(result.valid).toBe(false)
    })

    it('validates difficulty values', () => {
      const state = createBaseState({ gamePhase: 'setup' })

      // Valid difficulty
      let move: MatchingMove = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'difficulty', value: 12 },
      }
      let result = validator.validateMove(state, move)
      expect(result.valid).toBe(true)

      // Invalid difficulty
      move = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'difficulty', value: 10 },
      }
      result = validator.validateMove(state, move)
      expect(result.valid).toBe(false)
    })

    it('clears paused game when config changes', () => {
      const state = createBaseState({
        gamePhase: 'setup',
        pausedGamePhase: 'playing',
        pausedGameState: { matchedPairs: 3 } as any,
        originalConfig: {
          gameType: 'abacus-numeral',
          difficulty: 6,
          turnTimer: 30,
        },
      })
      const move: MatchingMove = {
        type: 'SET_CONFIG',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: { field: 'difficulty', value: 8 },
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.pausedGamePhase).toBeUndefined()
      expect(asState(result.newState)?.pausedGameState).toBeUndefined()
    })
  })

  // ============================================================================
  // RESUME_GAME Tests
  // ============================================================================

  describe('validateResumeGame', () => {
    it('resumes paused game when config unchanged', () => {
      const gameCards = [createGameCard('card-1', 5)]
      const state = createBaseState({
        gamePhase: 'setup',
        pausedGamePhase: 'playing',
        pausedGameState: {
          gameCards,
          currentPlayer: 'player-1',
          matchedPairs: 3,
          moves: 10,
          scores: { 'player-1': 3 },
          activePlayers: ['player-1'],
          playerMetadata: {},
          consecutiveMatches: { 'player-1': 2 },
          gameStartTime: Date.now() - 60000,
        },
        originalConfig: {
          gameType: 'abacus-numeral',
          difficulty: 6,
          turnTimer: 30,
        },
      })
      const move: MatchingMove = {
        type: 'RESUME_GAME',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(true)
      expect(asState(result.newState)?.gamePhase).toBe('playing')
      expect(asState(result.newState)?.matchedPairs).toBe(3)
      expect(asState(result.newState)?.moves).toBe(10)
    })

    it('rejects resume when no paused game', () => {
      const state = createBaseState({ gamePhase: 'setup' })
      const move: MatchingMove = {
        type: 'RESUME_GAME',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('No paused game to resume')
    })

    it('rejects resume when config has changed', () => {
      const state = createBaseState({
        gamePhase: 'setup',
        difficulty: 8, // Changed from original
        pausedGamePhase: 'playing',
        pausedGameState: { matchedPairs: 3 } as any,
        originalConfig: {
          gameType: 'abacus-numeral',
          difficulty: 6, // Original was 6
          turnTimer: 30,
        },
      })
      const move: MatchingMove = {
        type: 'RESUME_GAME',
        playerId: 'player-1',
        userId: 'user-1',
        timestamp: Date.now(),
        data: {},
      }

      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Cannot resume - configuration has changed')
    })
  })

  // ============================================================================
  // isGameComplete Tests
  // ============================================================================

  describe('isGameComplete', () => {
    it('returns true when gamePhase is results', () => {
      const state = createBaseState({ gamePhase: 'results' })
      expect(validator.isGameComplete(state)).toBe(true)
    })

    it('returns true when all pairs are matched', () => {
      const state = createBaseState({
        gamePhase: 'playing',
        matchedPairs: 6,
        totalPairs: 6,
      })
      expect(validator.isGameComplete(state)).toBe(true)
    })

    it('returns false when game is ongoing', () => {
      const state = createBaseState({
        gamePhase: 'playing',
        matchedPairs: 3,
        totalPairs: 6,
      })
      expect(validator.isGameComplete(state)).toBe(false)
    })
  })
})
