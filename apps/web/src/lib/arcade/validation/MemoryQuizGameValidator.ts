/**
 * Server-side validator for memory-quiz game
 * Validates all game moves and state transitions
 */

import type { DifficultyLevel, SorobanQuizState } from '@/app/arcade/memory-quiz/types'
import type {
  GameValidator,
  MemoryQuizGameMove,
  MemoryQuizSetConfigMove,
  ValidationResult,
} from './types'

export class MemoryQuizGameValidator
  implements GameValidator<SorobanQuizState, MemoryQuizGameMove>
{
  validateMove(
    state: SorobanQuizState,
    move: MemoryQuizGameMove,
    context?: { userId?: string; playerOwnership?: Record<string, string> }
  ): ValidationResult {
    switch (move.type) {
      case 'START_QUIZ':
        return this.validateStartQuiz(state, move.data)

      case 'NEXT_CARD':
        return this.validateNextCard(state)

      case 'SHOW_INPUT_PHASE':
        return this.validateShowInputPhase(state)

      case 'ACCEPT_NUMBER':
        return this.validateAcceptNumber(state, move.data.number)

      case 'REJECT_NUMBER':
        return this.validateRejectNumber(state)

      case 'SET_INPUT':
        return this.validateSetInput(state, move.data.input)

      case 'SHOW_RESULTS':
        return this.validateShowResults(state)

      case 'RESET_QUIZ':
        return this.validateResetQuiz(state)

      case 'SET_CONFIG': {
        const configMove = move as MemoryQuizSetConfigMove
        return this.validateSetConfig(state, configMove.data.field, configMove.data.value)
      }

      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as any).type}`,
        }
    }
  }

  private validateStartQuiz(state: SorobanQuizState, data: any): ValidationResult {
    // Can start quiz from setup or results phase
    if (state.gamePhase !== 'setup' && state.gamePhase !== 'results') {
      return {
        valid: false,
        error: 'Can only start quiz from setup or results phase',
      }
    }

    // Accept either numbers array (from network) or quizCards (from client)
    const numbers = data.numbers || data.quizCards?.map((c: any) => c.number)

    if (!numbers || numbers.length === 0) {
      return {
        valid: false,
        error: 'Quiz numbers are required',
      }
    }

    // Create minimal quiz cards from numbers (server-side doesn't need React components)
    const quizCards = numbers.map((number: number) => ({
      number,
      svgComponent: null, // Not needed server-side
      element: null,
    }))

    const newState: SorobanQuizState = {
      ...state,
      quizCards,
      correctAnswers: numbers,
      currentCardIndex: 0,
      foundNumbers: [],
      guessesRemaining: numbers.length + Math.floor(numbers.length / 2),
      gamePhase: 'display',
      incorrectGuesses: 0,
      currentInput: '',
      wrongGuessAnimations: [],
      prefixAcceptanceTimeout: null,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateNextCard(state: SorobanQuizState): ValidationResult {
    // Must be in display phase
    if (state.gamePhase !== 'display') {
      return {
        valid: false,
        error: 'NEXT_CARD only valid in display phase',
      }
    }

    const newState: SorobanQuizState = {
      ...state,
      currentCardIndex: state.currentCardIndex + 1,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateShowInputPhase(state: SorobanQuizState): ValidationResult {
    // Must have shown all cards
    if (state.currentCardIndex < state.quizCards.length) {
      return {
        valid: false,
        error: 'All cards must be shown before input phase',
      }
    }

    const newState: SorobanQuizState = {
      ...state,
      gamePhase: 'input',
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateAcceptNumber(state: SorobanQuizState, number: number): ValidationResult {
    // Must be in input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'ACCEPT_NUMBER only valid in input phase',
      }
    }

    // Number must be in correct answers
    console.log('[MemoryQuizValidator] Checking number:', {
      number,
      correctAnswers: state.correctAnswers,
      includes: state.correctAnswers.includes(number),
    })

    if (!state.correctAnswers.includes(number)) {
      return {
        valid: false,
        error: 'Number is not a correct answer',
      }
    }

    // Number must not be already found
    if (state.foundNumbers.includes(number)) {
      return {
        valid: false,
        error: 'Number already found',
      }
    }

    const newState: SorobanQuizState = {
      ...state,
      foundNumbers: [...state.foundNumbers, number],
      currentInput: '',
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateRejectNumber(state: SorobanQuizState): ValidationResult {
    // Must be in input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'REJECT_NUMBER only valid in input phase',
      }
    }

    // Must have guesses remaining
    if (state.guessesRemaining <= 0) {
      return {
        valid: false,
        error: 'No guesses remaining',
      }
    }

    const newState: SorobanQuizState = {
      ...state,
      guessesRemaining: state.guessesRemaining - 1,
      incorrectGuesses: state.incorrectGuesses + 1,
      currentInput: '',
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateSetInput(state: SorobanQuizState, input: string): ValidationResult {
    // Must be in input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'SET_INPUT only valid in input phase',
      }
    }

    // Input must be numeric
    if (input && !/^\d+$/.test(input)) {
      return {
        valid: false,
        error: 'Input must be numeric',
      }
    }

    const newState: SorobanQuizState = {
      ...state,
      currentInput: input,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateShowResults(state: SorobanQuizState): ValidationResult {
    // Can show results from input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'SHOW_RESULTS only valid from input phase',
      }
    }

    const newState: SorobanQuizState = {
      ...state,
      gamePhase: 'results',
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateResetQuiz(state: SorobanQuizState): ValidationResult {
    // Can reset from any phase
    const newState: SorobanQuizState = {
      ...state,
      gamePhase: 'setup',
      quizCards: [],
      correctAnswers: [],
      currentCardIndex: 0,
      foundNumbers: [],
      guessesRemaining: 0,
      currentInput: '',
      incorrectGuesses: 0,
      wrongGuessAnimations: [],
      prefixAcceptanceTimeout: null,
      finishButtonsBound: false,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateSetConfig(
    state: SorobanQuizState,
    field: 'selectedCount' | 'displayTime' | 'selectedDifficulty',
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
      case 'selectedCount':
        if (![2, 5, 8, 12, 15].includes(value)) {
          return { valid: false, error: `Invalid selectedCount: ${value}` }
        }
        break

      case 'displayTime':
        if (typeof value !== 'number' || value < 0.5 || value > 10) {
          return { valid: false, error: `Invalid displayTime: ${value}` }
        }
        break

      case 'selectedDifficulty':
        if (!['beginner', 'easy', 'medium', 'hard', 'expert'].includes(value)) {
          return { valid: false, error: `Invalid selectedDifficulty: ${value}` }
        }
        break

      default:
        return { valid: false, error: `Unknown config field: ${field}` }
    }

    // Apply the configuration change
    return {
      valid: true,
      newState: {
        ...state,
        [field]: value,
      },
    }
  }

  isGameComplete(state: SorobanQuizState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: {
    selectedCount: number
    displayTime: number
    selectedDifficulty: DifficultyLevel
  }): SorobanQuizState {
    return {
      cards: [],
      quizCards: [],
      correctAnswers: [],
      currentCardIndex: 0,
      displayTime: config.displayTime,
      selectedCount: config.selectedCount,
      selectedDifficulty: config.selectedDifficulty,
      foundNumbers: [],
      guessesRemaining: 0,
      currentInput: '',
      incorrectGuesses: 0,
      gamePhase: 'setup',
      prefixAcceptanceTimeout: null,
      finishButtonsBound: false,
      wrongGuessAnimations: [],
      hasPhysicalKeyboard: null,
      testingMode: false,
      showOnScreenKeyboard: false,
    }
  }
}

// Singleton instance
export const memoryQuizGameValidator = new MemoryQuizGameValidator()
