/**
 * Server-side validator for matching game
 * Validates all game moves and state transitions
 */

import {
  MatchingStateSchema,
  type GameCard,
  type MatchingConfig,
  type MatchingMove,
  type MatchingState,
  type Player,
} from './types'
import { generateGameCards } from './utils/cardGeneration'
import { canFlipCard, validateMatch } from './utils/matchValidation'
import type {
  GameValidator,
  PracticeBreakOptions,
  ValidationResult,
} from '@/lib/arcade/validation/types'
import type { GameResultsReport, PlayerResult } from '@/lib/arcade/game-sdk/types'

/**
 * Format duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
}

// Default config for practice breaks (quick games)
const PRACTICE_BREAK_DEFAULTS: MatchingConfig = {
  gameType: 'abacus-numeral',
  difficulty: 6, // Fewer pairs for quick games
  turnTimer: 30,
}

export class MatchingGameValidator implements GameValidator<MatchingState, MatchingMove> {
  // Zod schema for runtime validation of state loaded from database
  stateSchema = MatchingStateSchema

  validateMove(
    state: MatchingState,
    move: MatchingMove,
    context?: { userId?: string; playerOwnership?: Record<string, string> }
  ): ValidationResult {
    switch (move.type) {
      case 'FLIP_CARD':
        return this.validateFlipCard(state, move.data.cardId, move.playerId, context)

      case 'START_GAME':
        return this.validateStartGame(
          state,
          move.data.activePlayers,
          move.data.cards,
          move.data.playerMetadata
        )

      case 'CLEAR_MISMATCH':
        return this.validateClearMismatch(state)

      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)

      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)

      case 'RESUME_GAME':
        return this.validateResumeGame(state)

      case 'HOVER_CARD':
        return this.validateHoverCard(state, move.data.cardId, move.playerId)

      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as any).type}`,
        }
    }
  }

  private validateFlipCard(
    state: MatchingState,
    cardId: string,
    playerId: string,
    context?: { userId?: string; playerOwnership?: Record<string, string> }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Cannot flip cards outside of playing phase',
      }
    }

    // Check if it's the player's turn (in multiplayer)
    if (state.activePlayers.length > 1 && state.currentPlayer !== playerId) {
      console.log('[Validator] Turn check failed:', {
        activePlayers: state.activePlayers,
        currentPlayer: state.currentPlayer,
        currentPlayerType: typeof state.currentPlayer,
        playerId,
        playerIdType: typeof playerId,
        matches: state.currentPlayer === playerId,
      })
      return {
        valid: false,
        error: 'Not your turn',
      }
    }

    // Check player ownership authorization (if context provided)
    if (context?.userId && context?.playerOwnership) {
      const playerOwner = context.playerOwnership[playerId]
      if (playerOwner && playerOwner !== context.userId) {
        console.log('[Validator] Player ownership check failed:', {
          playerId,
          playerOwner,
          requestingUserId: context.userId,
        })
        return {
          valid: false,
          error: 'You can only move your own players',
        }
      }
    }

    // Find the card
    const card = state.gameCards.find((c) => c.id === cardId)
    if (!card) {
      return {
        valid: false,
        error: 'Card not found',
      }
    }

    // Validate using existing game logic
    if (!canFlipCard(card, state.flippedCards, state.isProcessingMove)) {
      return {
        valid: false,
        error: 'Cannot flip this card',
      }
    }

    // Calculate new state
    const newFlippedCards = [...state.flippedCards, card]
    let newState = {
      ...state,
      flippedCards: newFlippedCards,
      isProcessingMove: newFlippedCards.length === 2,
      // Clear mismatch feedback when player flips a new card
      showMismatchFeedback: false,
    }

    // If two cards are flipped, check for match
    if (newFlippedCards.length === 2) {
      const [card1, card2] = newFlippedCards
      const matchResult = validateMatch(card1, card2)

      if (matchResult.isValid) {
        // Match found - update cards
        newState = {
          ...newState,
          gameCards: newState.gameCards.map((c) =>
            c.id === card1.id || c.id === card2.id
              ? { ...c, matched: true, matchedBy: state.currentPlayer }
              : c
          ),
          matchedPairs: state.matchedPairs + 1,
          scores: {
            ...state.scores,
            [state.currentPlayer]: (state.scores[state.currentPlayer] || 0) + 1,
          },
          consecutiveMatches: {
            ...state.consecutiveMatches,
            [state.currentPlayer]: (state.consecutiveMatches[state.currentPlayer] || 0) + 1,
          },
          moves: state.moves + 1,
          flippedCards: [],
          isProcessingMove: false,
        }

        // Check if game is complete
        if (newState.matchedPairs === newState.totalPairs) {
          newState = {
            ...newState,
            gamePhase: 'results',
            gameEndTime: Date.now(),
          }
        }
      } else {
        // Match failed - keep cards flipped briefly so player can see them
        // Client will handle clearing them after a delay
        const shouldSwitchPlayer = state.activePlayers.length > 1
        const nextPlayerIndex = shouldSwitchPlayer
          ? (state.activePlayers.indexOf(state.currentPlayer) + 1) % state.activePlayers.length
          : 0
        const nextPlayer = shouldSwitchPlayer
          ? state.activePlayers[nextPlayerIndex]
          : state.currentPlayer

        newState = {
          ...newState,
          currentPlayer: nextPlayer,
          consecutiveMatches: {
            ...state.consecutiveMatches,
            [state.currentPlayer]: 0,
          },
          moves: state.moves + 1,
          // Keep flippedCards so player can see both cards
          flippedCards: newFlippedCards,
          isProcessingMove: true, // Keep processing state so no more cards can be flipped
          showMismatchFeedback: true,
          // Clear hover state for the player whose turn is ending
          playerHovers: {
            ...state.playerHovers,
            [state.currentPlayer]: null,
          },
        }
      }
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateStartGame(
    state: MatchingState,
    activePlayers: Player[],
    cards?: GameCard[],
    playerMetadata?: { [playerId: string]: any }
  ): ValidationResult {
    // Allow starting a new game from any phase (for "New Game" button)

    // Must have at least one player
    if (!activePlayers || activePlayers.length === 0) {
      return {
        valid: false,
        error: 'Must have at least one player',
      }
    }

    // Use provided cards or generate new ones
    const gameCards = cards || generateGameCards(state.gameType, state.difficulty)

    const newState: MatchingState = {
      ...state,
      gameCards,
      cards: gameCards,
      activePlayers,
      playerMetadata: playerMetadata || {}, // Store player metadata for cross-user visibility
      gamePhase: 'playing',
      gameStartTime: Date.now(),
      currentPlayer: activePlayers[0],
      flippedCards: [],
      matchedPairs: 0,
      moves: 0,
      scores: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      consecutiveMatches: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      // PAUSE/RESUME: Save original config so we can detect changes
      originalConfig: {
        gameType: state.gameType,
        difficulty: state.difficulty,
        turnTimer: state.turnTimer,
      },
      // Clear any paused game state (starting fresh)
      pausedGamePhase: undefined,
      pausedGameState: undefined,
      // Clear hover state when starting new game
      playerHovers: {},
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateClearMismatch(state: MatchingState): ValidationResult {
    // Only clear if there's actually a mismatch showing
    // This prevents race conditions where CLEAR_MISMATCH arrives after cards have already been cleared
    if (!state.showMismatchFeedback || state.flippedCards.length === 0) {
      // Nothing to clear - return current state unchanged
      return {
        valid: true,
        newState: state,
      }
    }

    // Get the list of all non-current players whose hovers should be cleared
    // (They're not playing this turn, so their hovers from previous turns should not show)
    const clearedHovers = { ...state.playerHovers }
    for (const playerId of state.activePlayers) {
      // Clear hover for all players except the current player
      // This ensures only the current player's active hover shows
      if (playerId !== state.currentPlayer) {
        clearedHovers[playerId] = null
      }
    }

    // Clear mismatched cards and feedback
    return {
      valid: true,
      newState: {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false,
        // Clear hovers for non-current players when cards are cleared
        playerHovers: clearedHovers,
      },
    }
  }

  /**
   * STANDARD ARCADE PATTERN: GO_TO_SETUP
   *
   * Transitions the game back to setup phase, allowing players to reconfigure
   * the game. This is synchronized across all room members.
   *
   * Can be called from any phase (setup, playing, results).
   *
   * PAUSE/RESUME: If called from 'playing' or 'results', saves game state
   * to allow resuming later (if config unchanged).
   *
   * Pattern for all arcade games:
   * - Validates the move is allowed
   * - Sets gamePhase to 'setup'
   * - Preserves current configuration (gameType, difficulty, etc.)
   * - Saves game state for resume if coming from active game
   * - Resets game progression state (scores, cards, etc.)
   */
  private validateGoToSetup(state: MatchingState): ValidationResult {
    // Determine if we're pausing an active game (for Resume functionality)
    const isPausingGame = state.gamePhase === 'playing' || state.gamePhase === 'results'

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'setup',

        // Pause/Resume: Save game state if pausing from active game
        pausedGamePhase: isPausingGame ? state.gamePhase : undefined,
        pausedGameState: isPausingGame
          ? {
              gameCards: state.gameCards,
              currentPlayer: state.currentPlayer,
              matchedPairs: state.matchedPairs,
              moves: state.moves,
              scores: state.scores,
              activePlayers: state.activePlayers,
              playerMetadata: state.playerMetadata,
              consecutiveMatches: state.consecutiveMatches,
              gameStartTime: state.gameStartTime,
            }
          : undefined,

        // Keep originalConfig if it exists (was set when game started)
        // This allows detecting if config changed while paused

        // Reset visible game progression
        gameCards: [],
        cards: [],
        flippedCards: [],
        currentPlayer: '',
        matchedPairs: 0,
        moves: 0,
        scores: {},
        activePlayers: [],
        playerMetadata: {},
        consecutiveMatches: {},
        gameStartTime: null,
        gameEndTime: null,
        currentMoveStartTime: null,
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null,
        playerHovers: {}, // Clear hover state when returning to setup
        // Preserve configuration - players can modify in setup
        // gameType, difficulty, turnTimer stay as-is
      },
    }
  }

  /**
   * STANDARD ARCADE PATTERN: SET_CONFIG
   *
   * Updates a configuration field during setup phase. This is synchronized
   * across all room members in real-time, allowing collaborative setup.
   *
   * Pattern for all arcade games:
   * - Only allowed during setup phase
   * - Validates field name and value
   * - Updates the configuration field
   * - Other room members see the change immediately (optimistic + server validation)
   *
   * @param state Current game state
   * @param field Configuration field name
   * @param value New value for the field
   */
  private validateSetConfig(
    state: MatchingState,
    field: 'gameType' | 'difficulty' | 'turnTimer',
    value: any
  ): ValidationResult {
    // Can only change config during setup phase
    if (state.gamePhase !== 'setup') {
      return {
        valid: false,
        error: 'Cannot change configuration outside of setup phase',
      }
    }

    // Validate field-specific values
    switch (field) {
      case 'gameType':
        if (value !== 'abacus-numeral' && value !== 'complement-pairs') {
          return { valid: false, error: `Invalid gameType: ${value}` }
        }
        break

      case 'difficulty':
        if (![6, 8, 12, 15].includes(value)) {
          return { valid: false, error: `Invalid difficulty: ${value}` }
        }
        break

      case 'turnTimer':
        if (typeof value !== 'number' || value < 5 || value > 300) {
          return { valid: false, error: `Invalid turnTimer: ${value}` }
        }
        break

      default:
        return { valid: false, error: `Unknown config field: ${field}` }
    }

    // PAUSE/RESUME: If there's a paused game and config is changing,
    // clear the paused game state (can't resume anymore)
    const clearPausedGame = !!state.pausedGamePhase

    // Apply the configuration change
    return {
      valid: true,
      newState: {
        ...state,
        [field]: value,
        // Update totalPairs if difficulty changes
        ...(field === 'difficulty' ? { totalPairs: value } : {}),
        // Clear paused game if config changed
        ...(clearPausedGame
          ? {
              pausedGamePhase: undefined,
              pausedGameState: undefined,
              originalConfig: undefined,
            }
          : {}),
      },
    }
  }

  /**
   * STANDARD ARCADE PATTERN: RESUME_GAME
   *
   * Resumes a paused game if configuration hasn't changed.
   * Restores the saved game state from when GO_TO_SETUP was called.
   *
   * Pattern for all arcade games:
   * - Validates there's a paused game
   * - Validates config hasn't changed since pause
   * - Restores game state and phase
   * - Clears paused game state
   */
  private validateResumeGame(state: MatchingState): ValidationResult {
    // Must be in setup phase
    if (state.gamePhase !== 'setup') {
      return {
        valid: false,
        error: 'Can only resume from setup phase',
      }
    }

    // Must have a paused game
    if (!state.pausedGamePhase || !state.pausedGameState) {
      return {
        valid: false,
        error: 'No paused game to resume',
      }
    }

    // Config must match original (no changes while paused)
    if (state.originalConfig) {
      const configChanged =
        state.gameType !== state.originalConfig.gameType ||
        state.difficulty !== state.originalConfig.difficulty ||
        state.turnTimer !== state.originalConfig.turnTimer

      if (configChanged) {
        return {
          valid: false,
          error: 'Cannot resume - configuration has changed',
        }
      }
    }

    // Restore the paused game
    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: state.pausedGamePhase,
        gameCards: state.pausedGameState.gameCards,
        cards: state.pausedGameState.gameCards,
        currentPlayer: state.pausedGameState.currentPlayer,
        matchedPairs: state.pausedGameState.matchedPairs,
        moves: state.pausedGameState.moves,
        scores: state.pausedGameState.scores,
        activePlayers: state.pausedGameState.activePlayers,
        playerMetadata: state.pausedGameState.playerMetadata,
        consecutiveMatches: state.pausedGameState.consecutiveMatches,
        gameStartTime: state.pausedGameState.gameStartTime,
        // Clear paused state
        pausedGamePhase: undefined,
        pausedGameState: undefined,
        // Keep originalConfig for potential future pauses
      },
    }
  }

  /**
   * Validate hover state update for networked presence
   *
   * Hover moves are lightweight and always valid - they just update
   * which card a player is hovering over for UI feedback to other players.
   */
  private validateHoverCard(
    state: MatchingState,
    cardId: string | null,
    playerId: string
  ): ValidationResult {
    // Hover is always valid - it's just UI state for networked presence
    // Update the player's hover state
    return {
      valid: true,
      newState: {
        ...state,
        playerHovers: {
          ...state.playerHovers,
          [playerId]: cardId,
        },
      },
    }
  }

  isGameComplete(state: MatchingState): boolean {
    return state.gamePhase === 'results' || state.matchedPairs === state.totalPairs
  }

  getInitialState(config: MatchingConfig): MatchingState {
    // If skipSetupPhase is true, start directly in playing phase with generated cards
    if (config.skipSetupPhase) {
      const gameCards = generateGameCards(config.gameType, config.difficulty)
      return {
        cards: gameCards,
        gameCards,
        flippedCards: [],
        gameType: config.gameType,
        difficulty: config.difficulty,
        turnTimer: config.turnTimer,
        gamePhase: 'playing', // Skip setup - start playing immediately
        currentPlayer: '', // Will be set when first player joins/acts
        matchedPairs: 0,
        totalPairs: config.difficulty,
        moves: 0,
        scores: {},
        activePlayers: [],
        playerMetadata: {},
        consecutiveMatches: {},
        gameStartTime: Date.now(),
        gameEndTime: null,
        currentMoveStartTime: null,
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null,
        originalConfig: {
          gameType: config.gameType,
          difficulty: config.difficulty,
          turnTimer: config.turnTimer,
        },
        pausedGamePhase: undefined,
        pausedGameState: undefined,
        playerHovers: {},
      }
    }

    // Normal setup phase
    return {
      cards: [],
      gameCards: [],
      flippedCards: [],
      gameType: config.gameType,
      difficulty: config.difficulty,
      turnTimer: config.turnTimer,
      gamePhase: 'setup',
      currentPlayer: '',
      matchedPairs: 0,
      totalPairs: config.difficulty,
      moves: 0,
      scores: {},
      activePlayers: [],
      playerMetadata: {}, // Initialize empty player metadata
      consecutiveMatches: {},
      gameStartTime: null,
      gameEndTime: null,
      currentMoveStartTime: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: null,
      // PAUSE/RESUME: Initialize paused game fields
      originalConfig: undefined,
      pausedGamePhase: undefined,
      pausedGameState: undefined,
      // HOVER: Initialize hover state
      playerHovers: {},
    }
  }

  /**
   * Get initial state for practice break mode.
   * Skips setup phase and starts directly in 'playing' phase.
   *
   * @param config Partial config to merge with practice break defaults
   * @param options Practice break options including player info
   * @returns Game state ready to play immediately
   */
  getInitialStateForPracticeBreak(
    config: Partial<MatchingConfig>,
    options: PracticeBreakOptions
  ): MatchingState {
    // Merge with practice break defaults
    const fullConfig: MatchingConfig = {
      ...PRACTICE_BREAK_DEFAULTS,
      ...config,
    }

    // Adjust difficulty based on break duration if needed
    if (options.maxDurationMinutes <= 3 && fullConfig.difficulty > 6) {
      fullConfig.difficulty = 6 // Use fewer pairs for very short breaks
    }

    // Generate cards immediately (no setup phase)
    const gameCards = generateGameCards(fullConfig.gameType, fullConfig.difficulty)

    // Set up single player for practice break
    const playerId = options.playerId
    const playerMetadata = {
      [playerId]: {
        id: playerId,
        name: options.playerName || 'Player',
        emoji: '🎮',
        userId: playerId, // In practice break, player owns themselves
      },
    }

    return {
      cards: gameCards,
      gameCards,
      flippedCards: [],
      gameType: fullConfig.gameType,
      difficulty: fullConfig.difficulty,
      turnTimer: fullConfig.turnTimer,
      gamePhase: 'playing', // Skip setup - start playing immediately!
      currentPlayer: playerId,
      matchedPairs: 0,
      totalPairs: fullConfig.difficulty,
      moves: 0,
      scores: { [playerId]: 0 },
      activePlayers: [playerId],
      playerMetadata,
      consecutiveMatches: { [playerId]: 0 },
      gameStartTime: Date.now(),
      gameEndTime: null,
      currentMoveStartTime: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: null,
      // Save original config for pause/resume
      originalConfig: {
        gameType: fullConfig.gameType,
        difficulty: fullConfig.difficulty,
        turnTimer: fullConfig.turnTimer,
      },
      pausedGamePhase: undefined,
      pausedGameState: undefined,
      playerHovers: {},
    }
  }

  /**
   * Generate a standardized results report for the matching game.
   * Called when game completes to capture performance metrics.
   *
   * @param state The final game state (gamePhase should be 'results')
   * @param config The game configuration used
   * @returns Standardized results report for display and scoreboard
   */
  getResultsReport(state: MatchingState, config: MatchingConfig): GameResultsReport {
    const startedAt = state.gameStartTime ?? Date.now()
    const endedAt = state.gameEndTime ?? Date.now()
    const durationMs = endedAt - startedAt

    // Build player results sorted by score (winner first)
    const playerResults: PlayerResult[] = state.activePlayers
      .map((playerId) => {
        const meta = state.playerMetadata[playerId]
        const playerScore = state.scores[playerId] ?? 0

        // In single player, all moves are theirs
        // In multiplayer, we can't attribute moves per-player without additional tracking
        // So we use total moves for accuracy calculation in single-player only
        const isSinglePlayer = state.activePlayers.length === 1
        const movesForAccuracy = isSinglePlayer ? state.moves : playerScore * 2 // Assume best case for MP
        const accuracy =
          movesForAccuracy > 0 ? Math.round(((playerScore * 2) / movesForAccuracy) * 100) : 0

        return {
          playerId,
          playerName: meta?.name ?? 'Player',
          playerEmoji: meta?.emoji ?? '👤',
          userId: meta?.userId ?? playerId,
          score: playerScore,
          rank: 0, // Will be set after sorting
          isWinner: false, // Will be set after sorting
          correctCount: playerScore,
          totalAttempts: isSinglePlayer ? state.moves : undefined,
          accuracy: isSinglePlayer ? accuracy : undefined,
          bestStreak: state.consecutiveMatches[playerId] ?? 0,
        }
      })
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({ ...p, rank: idx + 1, isWinner: idx === 0 }))

    const winner = playerResults[0]
    const isSinglePlayer = playerResults.length === 1

    // Calculate overall accuracy for single-player (for headline determination)
    const overallAccuracy =
      isSinglePlayer && state.moves > 0
        ? Math.round(((state.matchedPairs * 2) / state.moves) * 100)
        : (winner?.accuracy ?? 0)

    // Determine headline and theme based on performance
    let headline = 'Game Complete!'
    let resultTheme: GameResultsReport['resultTheme'] = 'neutral'
    let celebrationType: GameResultsReport['celebrationType'] = 'none'

    if (isSinglePlayer) {
      // Single-player: base on accuracy
      if (overallAccuracy >= 100) {
        headline = 'Perfect Memory!'
        resultTheme = 'success'
        celebrationType = 'confetti'
      } else if (overallAccuracy >= 80) {
        headline = 'Great Job!'
        resultTheme = 'good'
        celebrationType = 'stars'
      } else if (overallAccuracy >= 50) {
        headline = 'Nice Work!'
        resultTheme = 'neutral'
      } else {
        headline = 'Keep Practicing!'
        resultTheme = 'needs-practice'
      }
    } else {
      // Multiplayer: winner announcement
      headline = `${winner?.playerName ?? 'Player'} Wins!`
      resultTheme = 'success'
      celebrationType = 'confetti'
    }

    // Build custom stats
    const customStats: GameResultsReport['customStats'] = [
      {
        label: 'Pairs Found',
        value: `${state.matchedPairs}/${state.totalPairs}`,
        icon: '🎯',
        highlight: state.matchedPairs === state.totalPairs,
      },
      { label: 'Total Moves', value: state.moves, icon: '👆' },
      { label: 'Time', value: formatDuration(durationMs), icon: '⏱️' },
    ]

    // Add accuracy stat for single-player
    if (isSinglePlayer) {
      customStats.push({
        label: 'Accuracy',
        value: `${overallAccuracy}%`,
        icon: '📊',
        highlight: overallAccuracy >= 80,
      })
    }

    // Add best streak if notable
    const bestStreak = Math.max(...Object.values(state.consecutiveMatches), 0)
    if (bestStreak >= 3) {
      customStats.push({
        label: 'Best Streak',
        value: bestStreak,
        icon: '🔥',
        highlight: true,
      })
    }

    // Determine difficulty label
    let difficultyLabel: string
    if (config.difficulty <= 6) {
      difficultyLabel = 'easy'
    } else if (config.difficulty <= 8) {
      difficultyLabel = 'medium'
    } else if (config.difficulty <= 12) {
      difficultyLabel = 'hard'
    } else {
      difficultyLabel = 'expert'
    }

    return {
      // Game identity
      gameName: 'matching',
      gameDisplayName: 'Matching Pairs Battle',
      gameIcon: '⚔️',

      // Session metadata
      durationMs,
      completedNormally: state.matchedPairs === state.totalPairs,
      startedAt,
      endedAt,

      // Game mode
      gameMode: isSinglePlayer ? 'single-player' : 'competitive',
      playerCount: playerResults.length,

      // Player results
      playerResults,

      // Victory conditions (for multiplayer)
      winnerId: isSinglePlayer ? null : (winner?.playerId ?? null),

      // Aggregate metrics
      itemsCompleted: state.matchedPairs,
      itemsTotal: state.totalPairs,
      completionPercent: Math.round((state.matchedPairs / state.totalPairs) * 100),

      // Leaderboard entry for universal scoreboard
      leaderboardEntry: {
        normalizedScore: isSinglePlayer ? overallAccuracy : (winner?.score ?? 0) * 10,
        category: 'memory',
        difficulty: difficultyLabel,
      },

      // Custom stats
      customStats,

      // Display hints
      headline,
      subheadline: isSinglePlayer
        ? `${state.matchedPairs} pairs in ${formatDuration(durationMs)}`
        : `Final Score: ${winner?.score ?? 0} pairs`,
      resultTheme,
      celebrationType,
    }
  }
}

// Singleton instance
export const matchingGameValidator = new MatchingGameValidator()
