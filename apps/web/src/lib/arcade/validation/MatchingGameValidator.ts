/**
 * Server-side validator for matching game
 * Validates all game moves and state transitions
 */

import type {
  Difficulty,
  GameCard,
  GameType,
  MemoryPairsState,
  Player,
} from '@/app/games/matching/context/types'
import { generateGameCards } from '@/app/games/matching/utils/cardGeneration'
import { canFlipCard, validateMatch } from '@/app/games/matching/utils/matchValidation'
import type { GameValidator, MatchingGameMove, ValidationResult } from './types'

export class MatchingGameValidator implements GameValidator<MemoryPairsState, MatchingGameMove> {
  validateMove(state: MemoryPairsState, move: MatchingGameMove): ValidationResult {
    switch (move.type) {
      case 'FLIP_CARD':
        return this.validateFlipCard(state, move.data.cardId, move.playerId)

      case 'START_GAME':
        return this.validateStartGame(state, move.data.activePlayers, move.data.cards)

      case 'CLEAR_MISMATCH':
        return this.validateClearMismatch(state)

      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as any).type}`,
        }
    }
  }

  private validateFlipCard(
    state: MemoryPairsState,
    cardId: string,
    playerId: string
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
        }
      }
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateStartGame(
    state: MemoryPairsState,
    activePlayers: Player[],
    cards?: GameCard[]
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

    const newState: MemoryPairsState = {
      ...state,
      gameCards,
      cards: gameCards,
      activePlayers,
      gamePhase: 'playing',
      gameStartTime: Date.now(),
      currentPlayer: activePlayers[0],
      flippedCards: [],
      matchedPairs: 0,
      moves: 0,
      scores: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      consecutiveMatches: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateClearMismatch(state: MemoryPairsState): ValidationResult {
    // Clear mismatched cards and feedback
    return {
      valid: true,
      newState: {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false,
      },
    }
  }

  isGameComplete(state: MemoryPairsState): boolean {
    return state.gamePhase === 'results' || state.matchedPairs === state.totalPairs
  }

  getInitialState(config: {
    difficulty: Difficulty
    gameType: GameType
    turnTimer: number
  }): MemoryPairsState {
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
      consecutiveMatches: {},
      gameStartTime: null,
      gameEndTime: null,
      currentMoveStartTime: null,
      timerInterval: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: null,
    }
  }
}

// Singleton instance
export const matchingGameValidator = new MatchingGameValidator()
