import type {
  GameValidator,
  ValidationContext,
  ValidationResult,
} from '@/lib/arcade/validation/types'
import type { CardSortingConfig, CardSortingMove, CardSortingState, CardPosition } from './types'
import { calculateScore } from './utils/scoringAlgorithm'
import { placeCardAtPosition, insertCardAtPosition, removeCardAtPosition } from './utils/validation'

export class CardSortingValidator implements GameValidator<CardSortingState, CardSortingMove> {
  validateMove(
    state: CardSortingState,
    move: CardSortingMove,
    context: ValidationContext
  ): ValidationResult {
    switch (move.type) {
      case 'START_GAME':
        return this.validateStartGame(state, move.data, move.playerId)
      case 'PLACE_CARD':
        return this.validatePlaceCard(state, move.data.cardId, move.data.position)
      case 'INSERT_CARD':
        return this.validateInsertCard(state, move.data.cardId, move.data.insertPosition)
      case 'REMOVE_CARD':
        return this.validateRemoveCard(state, move.data.position)
      case 'CHECK_SOLUTION':
        return this.validateCheckSolution(state, move.data.finalSequence)
      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)
      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)
      case 'RESUME_GAME':
        return this.validateResumeGame(state)
      case 'UPDATE_CARD_POSITIONS':
        return this.validateUpdateCardPositions(state, move.data.positions)
      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as CardSortingMove).type}`,
        }
    }
  }

  private validateStartGame(
    state: CardSortingState,
    data: { playerMetadata: unknown; selectedCards: unknown },
    playerId: string
  ): ValidationResult {
    // Allow starting a new game from any phase (for "Play Again" button)

    // Validate selectedCards
    if (!Array.isArray(data.selectedCards)) {
      return { valid: false, error: 'selectedCards must be an array' }
    }

    if (data.selectedCards.length !== state.cardCount) {
      return {
        valid: false,
        error: `Must provide exactly ${state.cardCount} cards`,
      }
    }

    const selectedCards = data.selectedCards as unknown[]

    // Create correct order (sorted)
    const correctOrder = [...selectedCards].sort((a: unknown, b: unknown) => {
      const cardA = a as { number: number }
      const cardB = b as { number: number }
      return cardA.number - cardB.number
    })

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'playing',
        playerId,
        playerMetadata: data.playerMetadata,
        gameStartTime: Date.now(),
        gameEndTime: null,
        selectedCards: selectedCards as typeof state.selectedCards,
        correctOrder: correctOrder as typeof state.correctOrder,
        availableCards: selectedCards as typeof state.availableCards,
        placedCards: new Array(state.cardCount).fill(null),
        cardPositions: [], // Will be set by first position update
        scoreBreakdown: null,
      },
    }
  }

  private validatePlaceCard(
    state: CardSortingState,
    cardId: string,
    position: number
  ): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only place cards during playing phase' }
    }

    // Card must exist in availableCards
    const card = state.availableCards.find((c) => c.id === cardId)
    if (!card) {
      return { valid: false, error: 'Card not found in available cards' }
    }

    // Position must be valid (0 to cardCount-1)
    if (position < 0 || position >= state.cardCount) {
      return {
        valid: false,
        error: `Invalid position: must be between 0 and ${state.cardCount - 1}`,
      }
    }

    // Place the card using utility function (simple replacement)
    const { placedCards: newPlaced, replacedCard } = placeCardAtPosition(
      state.placedCards,
      card,
      position
    )

    // Remove card from available
    let newAvailable = state.availableCards.filter((c) => c.id !== cardId)

    // If slot was occupied, add replaced card back to available
    if (replacedCard) {
      newAvailable = [...newAvailable, replacedCard]
    }

    return {
      valid: true,
      newState: {
        ...state,
        availableCards: newAvailable,
        placedCards: newPlaced,
      },
    }
  }

  private validateInsertCard(
    state: CardSortingState,
    cardId: string,
    insertPosition: number
  ): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only insert cards during playing phase' }
    }

    // Card must exist in availableCards
    const card = state.availableCards.find((c) => c.id === cardId)
    if (!card) {
      return { valid: false, error: 'Card not found in available cards' }
    }

    // Position must be valid (0 to cardCount, inclusive - can insert after last position)
    if (insertPosition < 0 || insertPosition > state.cardCount) {
      return {
        valid: false,
        error: `Invalid insert position: must be between 0 and ${state.cardCount}`,
      }
    }

    // Insert the card using utility function (with shift and compact)
    const { placedCards: newPlaced, excessCards } = insertCardAtPosition(
      state.placedCards,
      card,
      insertPosition,
      state.cardCount
    )

    // Remove card from available
    let newAvailable = state.availableCards.filter((c) => c.id !== cardId)

    // Add any excess cards back to available (shouldn't normally happen)
    if (excessCards.length > 0) {
      newAvailable = [...newAvailable, ...excessCards]
    }

    return {
      valid: true,
      newState: {
        ...state,
        availableCards: newAvailable,
        placedCards: newPlaced,
      },
    }
  }

  private validateRemoveCard(state: CardSortingState, position: number): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only remove cards during playing phase',
      }
    }

    // Position must be valid
    if (position < 0 || position >= state.cardCount) {
      return {
        valid: false,
        error: `Invalid position: must be between 0 and ${state.cardCount - 1}`,
      }
    }

    // Card must exist at position
    if (state.placedCards[position] === null) {
      return { valid: false, error: 'No card at this position' }
    }

    // Remove the card using utility function
    const { placedCards: newPlaced, removedCard } = removeCardAtPosition(
      state.placedCards,
      position
    )

    if (!removedCard) {
      return { valid: false, error: 'Failed to remove card' }
    }

    // Add back to available
    const newAvailable = [...state.availableCards, removedCard]

    return {
      valid: true,
      newState: {
        ...state,
        availableCards: newAvailable,
        placedCards: newPlaced,
      },
    }
  }

  private validateCheckSolution(
    state: CardSortingState,
    finalSequence?: typeof state.selectedCards
  ): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only check solution during playing phase',
      }
    }

    // Use finalSequence if provided, otherwise use placedCards
    const userCards =
      finalSequence ||
      state.placedCards.filter((c): c is (typeof state.selectedCards)[0] => c !== null)

    // Must have all cards
    if (userCards.length !== state.cardCount) {
      return { valid: false, error: 'Must place all cards before checking' }
    }

    // Calculate score using scoring algorithms
    const userSequence = userCards.map((c) => c.number)
    const correctSequence = state.correctOrder.map((c) => c.number)

    const scoreBreakdown = calculateScore(
      userSequence,
      correctSequence,
      state.gameStartTime || Date.now()
    )

    // If finalSequence was provided, update placedCards with it
    const newPlacedCards = finalSequence
      ? [...userCards, ...new Array(state.cardCount - userCards.length).fill(null)]
      : state.placedCards

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'results',
        gameEndTime: Date.now(),
        scoreBreakdown,
        placedCards: newPlacedCards,
        availableCards: [], // All cards are now placed
      },
    }
  }

  private validateGoToSetup(state: CardSortingState): ValidationResult {
    // Save current game state for resume (if in playing phase)
    if (state.gamePhase === 'playing') {
      return {
        valid: true,
        newState: {
          ...this.getInitialState({
            cardCount: state.cardCount,
            timeLimit: state.timeLimit,
            gameMode: state.gameMode,
          }),
          originalConfig: {
            cardCount: state.cardCount,
            timeLimit: state.timeLimit,
            gameMode: state.gameMode,
          },
          pausedGamePhase: 'playing',
          pausedGameState: {
            selectedCards: state.selectedCards,
            availableCards: state.availableCards,
            placedCards: state.placedCards,
            cardPositions: state.cardPositions,
            gameStartTime: state.gameStartTime || Date.now(),
          },
        },
      }
    }

    // Just go to setup
    return {
      valid: true,
      newState: this.getInitialState({
        cardCount: state.cardCount,
        timeLimit: state.timeLimit,
        gameMode: state.gameMode,
      }),
    }
  }

  private validateSetConfig(
    state: CardSortingState,
    field: string,
    value: unknown
  ): ValidationResult {
    // Must be in setup phase
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change config in setup phase' }
    }

    // Validate field and value
    switch (field) {
      case 'cardCount':
        if (![5, 8, 12, 15].includes(value as number)) {
          return { valid: false, error: 'cardCount must be 5, 8, 12, or 15' }
        }
        return {
          valid: true,
          newState: {
            ...state,
            cardCount: value as 5 | 8 | 12 | 15,
            placedCards: new Array(value as number).fill(null),
            // Clear pause state if config changed
            pausedGamePhase: undefined,
            pausedGameState: undefined,
          },
        }

      case 'timeLimit':
        if (value !== null && (typeof value !== 'number' || value < 30)) {
          return {
            valid: false,
            error: 'timeLimit must be null or a number >= 30',
          }
        }
        return {
          valid: true,
          newState: {
            ...state,
            timeLimit: value as number | null,
            // Clear pause state if config changed
            pausedGamePhase: undefined,
            pausedGameState: undefined,
          },
        }

      case 'gameMode':
        if (!['solo', 'collaborative', 'competitive', 'relay'].includes(value as string)) {
          return {
            valid: false,
            error: 'gameMode must be solo, collaborative, competitive, or relay',
          }
        }
        return {
          valid: true,
          newState: {
            ...state,
            gameMode: value as 'solo' | 'collaborative' | 'competitive' | 'relay',
            // Clear pause state if config changed
            pausedGamePhase: undefined,
            pausedGameState: undefined,
          },
        }

      default:
        return { valid: false, error: `Unknown config field: ${field}` }
    }
  }

  private validateResumeGame(state: CardSortingState): ValidationResult {
    // Must be in setup phase
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only resume from setup phase' }
    }

    // Must have paused game state
    if (!state.pausedGamePhase || !state.pausedGameState) {
      return { valid: false, error: 'No paused game to resume' }
    }

    // Restore paused state
    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: state.pausedGamePhase,
        selectedCards: state.pausedGameState.selectedCards,
        correctOrder: [...state.pausedGameState.selectedCards].sort((a, b) => a.number - b.number),
        availableCards: state.pausedGameState.availableCards,
        placedCards: state.pausedGameState.placedCards,
        cardPositions: state.pausedGameState.cardPositions,
        gameStartTime: state.pausedGameState.gameStartTime,
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      },
    }
  }

  private validateUpdateCardPositions(
    state: CardSortingState,
    positions: CardPosition[]
  ): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only update positions during playing phase' }
    }

    // Validate positions array
    if (!Array.isArray(positions)) {
      return { valid: false, error: 'positions must be an array' }
    }

    // Basic validation of position values
    for (const pos of positions) {
      if (typeof pos.x !== 'number' || pos.x < 0 || pos.x > 100) {
        return { valid: false, error: 'x must be between 0 and 100' }
      }
      if (typeof pos.y !== 'number' || pos.y < 0 || pos.y > 100) {
        return { valid: false, error: 'y must be between 0 and 100' }
      }
      if (typeof pos.rotation !== 'number') {
        return { valid: false, error: 'rotation must be a number' }
      }
      if (typeof pos.zIndex !== 'number') {
        return { valid: false, error: 'zIndex must be a number' }
      }
      if (typeof pos.cardId !== 'string') {
        return { valid: false, error: 'cardId must be a string' }
      }
    }

    return {
      valid: true,
      newState: {
        ...state,
        cardPositions: positions,
      },
    }
  }

  isGameComplete(state: CardSortingState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: CardSortingConfig): CardSortingState {
    return {
      cardCount: config.cardCount,
      timeLimit: config.timeLimit,
      gameMode: config.gameMode,
      gamePhase: 'setup',
      playerId: '',
      playerMetadata: {
        id: '',
        name: '',
        emoji: '',
        userId: '',
      },
      activePlayers: [],
      allPlayerMetadata: new Map(),
      gameStartTime: null,
      gameEndTime: null,
      selectedCards: [],
      correctOrder: [],
      availableCards: [],
      placedCards: new Array(config.cardCount).fill(null),
      cardPositions: [],
      cursorPositions: new Map(),
      selectedCardId: null,
      scoreBreakdown: null,
    }
  }
}

export const cardSortingValidator = new CardSortingValidator()
