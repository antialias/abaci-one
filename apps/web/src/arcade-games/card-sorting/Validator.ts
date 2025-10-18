import type {
  GameValidator,
  ValidationContext,
  ValidationResult,
} from '@/lib/arcade/validation/types'
import type { CardSortingConfig, CardSortingMove, CardSortingState } from './types'
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
      case 'REVEAL_NUMBERS':
        return this.validateRevealNumbers(state)
      case 'CHECK_SOLUTION':
        return this.validateCheckSolution(state)
      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)
      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)
      case 'RESUME_GAME':
        return this.validateResumeGame(state)
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
    // Must be in setup phase
    if (state.gamePhase !== 'setup') {
      return {
        valid: false,
        error: 'Can only start game from setup phase',
      }
    }

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
        selectedCards: selectedCards as typeof state.selectedCards,
        correctOrder: correctOrder as typeof state.correctOrder,
        availableCards: selectedCards as typeof state.availableCards,
        placedCards: new Array(state.cardCount).fill(null),
        numbersRevealed: false,
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

  private validateRevealNumbers(state: CardSortingState): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only reveal numbers during playing phase',
      }
    }

    // Must be enabled in config
    if (!state.showNumbers) {
      return { valid: false, error: 'Reveal numbers is not enabled' }
    }

    // Already revealed
    if (state.numbersRevealed) {
      return { valid: false, error: 'Numbers already revealed' }
    }

    return {
      valid: true,
      newState: {
        ...state,
        numbersRevealed: true,
      },
    }
  }

  private validateCheckSolution(state: CardSortingState): ValidationResult {
    // Must be in playing phase
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only check solution during playing phase',
      }
    }

    // All slots must be filled
    if (state.placedCards.some((c) => c === null)) {
      return { valid: false, error: 'Must place all cards before checking' }
    }

    // Calculate score using scoring algorithms
    const userSequence = state.placedCards.map((c) => c!.number)
    const correctSequence = state.correctOrder.map((c) => c.number)

    const scoreBreakdown = calculateScore(
      userSequence,
      correctSequence,
      state.gameStartTime || Date.now(),
      state.numbersRevealed
    )

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'results',
        gameEndTime: Date.now(),
        scoreBreakdown,
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
            showNumbers: state.showNumbers,
            timeLimit: state.timeLimit,
          }),
          originalConfig: {
            cardCount: state.cardCount,
            showNumbers: state.showNumbers,
            timeLimit: state.timeLimit,
          },
          pausedGamePhase: 'playing',
          pausedGameState: {
            selectedCards: state.selectedCards,
            availableCards: state.availableCards,
            placedCards: state.placedCards,
            gameStartTime: state.gameStartTime || Date.now(),
            numbersRevealed: state.numbersRevealed,
          },
        },
      }
    }

    // Just go to setup
    return {
      valid: true,
      newState: this.getInitialState({
        cardCount: state.cardCount,
        showNumbers: state.showNumbers,
        timeLimit: state.timeLimit,
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

      case 'showNumbers':
        if (typeof value !== 'boolean') {
          return { valid: false, error: 'showNumbers must be a boolean' }
        }
        return {
          valid: true,
          newState: {
            ...state,
            showNumbers: value,
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
        gameStartTime: state.pausedGameState.gameStartTime,
        numbersRevealed: state.pausedGameState.numbersRevealed,
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      },
    }
  }

  isGameComplete(state: CardSortingState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: CardSortingConfig): CardSortingState {
    return {
      cardCount: config.cardCount,
      showNumbers: config.showNumbers,
      timeLimit: config.timeLimit,
      gamePhase: 'setup',
      playerId: '',
      playerMetadata: {
        id: '',
        name: '',
        emoji: '',
        userId: '',
      },
      gameStartTime: null,
      gameEndTime: null,
      selectedCards: [],
      correctOrder: [],
      availableCards: [],
      placedCards: new Array(config.cardCount).fill(null),
      selectedCardId: null,
      numbersRevealed: false,
      scoreBreakdown: null,
    }
  }
}

export const cardSortingValidator = new CardSortingValidator()
