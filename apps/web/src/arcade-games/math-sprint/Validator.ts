/**
 * Math Sprint Validator
 *
 * Server-side validation for Math Sprint game.
 * Generates questions, validates answers, awards points.
 */

import type { GameValidator, ValidationResult } from '@/lib/arcade/game-sdk'
import type {
  Difficulty,
  MathSprintConfig,
  MathSprintMove,
  MathSprintState,
  Operation,
  Question,
} from './types'

export class MathSprintValidator implements GameValidator<MathSprintState, MathSprintMove> {
  /**
   * Validate a game move
   */
  validateMove(
    state: MathSprintState,
    move: MathSprintMove,
    context?: { userId?: string }
  ): ValidationResult {
    switch (move.type) {
      case 'START_GAME':
        return this.validateStartGame(state, move.data.activePlayers, move.data.playerMetadata)

      case 'SUBMIT_ANSWER':
        return this.validateSubmitAnswer(
          state,
          move.playerId,
          Number(move.data.answer),
          move.timestamp
        )

      case 'NEXT_QUESTION':
        return this.validateNextQuestion(state)

      case 'RESET_GAME':
        return this.validateResetGame(state)

      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)

      default:
        return { valid: false, error: 'Unknown move type' }
    }
  }

  /**
   * Check if game is complete
   */
  isGameComplete(state: MathSprintState): boolean {
    return state.gamePhase === 'results'
  }

  /**
   * Get initial state for new game
   */
  getInitialState(config: unknown): MathSprintState {
    const { difficulty, questionsPerRound, timePerQuestion } = config as MathSprintConfig

    return {
      gamePhase: 'setup',
      activePlayers: [],
      playerMetadata: {},
      difficulty: difficulty || 'medium',
      questionsPerRound: questionsPerRound || 10,
      timePerQuestion: timePerQuestion || 30,
      currentQuestionIndex: 0,
      questions: [],
      scores: {},
      correctAnswersCount: {},
      answers: [],
      questionStartTime: 0,
      questionAnswered: false,
      winnerId: null,
    }
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private validateStartGame(
    state: MathSprintState,
    activePlayers: string[],
    playerMetadata: Record<string, any>
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Game already started' }
    }

    if (activePlayers.length < 2) {
      return { valid: false, error: 'Need at least 2 players' }
    }

    // Generate questions
    const questions = this.generateQuestions(state.difficulty, state.questionsPerRound)

    const newState: MathSprintState = {
      ...state,
      gamePhase: 'playing',
      activePlayers,
      playerMetadata,
      questions,
      currentQuestionIndex: 0,
      scores: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      correctAnswersCount: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      answers: [],
      questionStartTime: Date.now(),
      questionAnswered: false,
      winnerId: null,
    }

    return { valid: true, newState }
  }

  private validateSubmitAnswer(
    state: MathSprintState,
    playerId: string,
    answer: number,
    timestamp: number
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Game not in progress' }
    }

    if (!state.activePlayers.includes(playerId)) {
      return { valid: false, error: 'Player not in game' }
    }

    if (state.questionAnswered) {
      return { valid: false, error: 'Question already answered correctly' }
    }

    // Check if player already answered this question
    const alreadyAnswered = state.answers.some((a) => a.playerId === playerId)
    if (alreadyAnswered) {
      return { valid: false, error: 'You already answered this question' }
    }

    const currentQuestion = state.questions[state.currentQuestionIndex]
    const correct = answer === currentQuestion.correctAnswer

    const answerRecord = {
      playerId,
      answer,
      timestamp,
      correct,
    }

    const newAnswers = [...state.answers, answerRecord]
    let newState = { ...state, answers: newAnswers }

    // If correct, award points and mark question as answered
    if (correct) {
      newState = {
        ...newState,
        questionAnswered: true,
        winnerId: playerId,
        scores: {
          ...state.scores,
          [playerId]: state.scores[playerId] + 10,
        },
        correctAnswersCount: {
          ...state.correctAnswersCount,
          [playerId]: state.correctAnswersCount[playerId] + 1,
        },
      }
    }

    return { valid: true, newState }
  }

  private validateNextQuestion(state: MathSprintState): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Game not in progress' }
    }

    if (!state.questionAnswered) {
      return { valid: false, error: 'Current question not answered yet' }
    }

    const isLastQuestion = state.currentQuestionIndex >= state.questions.length - 1

    if (isLastQuestion) {
      // Game complete, go to results
      const newState: MathSprintState = {
        ...state,
        gamePhase: 'results',
      }
      return { valid: true, newState }
    }

    // Move to next question
    const newState: MathSprintState = {
      ...state,
      currentQuestionIndex: state.currentQuestionIndex + 1,
      answers: [],
      questionStartTime: Date.now(),
      questionAnswered: false,
      winnerId: null,
    }

    return { valid: true, newState }
  }

  private validateResetGame(state: MathSprintState): ValidationResult {
    const newState = this.getInitialState({
      difficulty: state.difficulty,
      questionsPerRound: state.questionsPerRound,
      timePerQuestion: state.timePerQuestion,
    })

    return { valid: true, newState }
  }

  private validateSetConfig(state: MathSprintState, field: string, value: any): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Cannot change config during game' }
    }

    const newState = {
      ...state,
      [field]: value,
    }

    return { valid: true, newState }
  }

  // ============================================================================
  // Question Generation
  // ============================================================================

  private generateQuestions(difficulty: Difficulty, count: number): Question[] {
    const questions: Question[] = []

    for (let i = 0; i < count; i++) {
      const operation = this.randomOperation()
      const question = this.generateQuestion(difficulty, operation, `q-${i}`)
      questions.push(question)
    }

    return questions
  }

  private generateQuestion(difficulty: Difficulty, operation: Operation, id: string): Question {
    let operand1: number
    let operand2: number
    let correctAnswer: number

    switch (difficulty) {
      case 'easy':
        operand1 = this.randomInt(1, 10)
        operand2 = this.randomInt(1, 10)
        break
      case 'medium':
        operand1 = this.randomInt(10, 50)
        operand2 = this.randomInt(1, 20)
        break
      case 'hard':
        operand1 = this.randomInt(10, 100)
        operand2 = this.randomInt(10, 50)
        break
    }

    switch (operation) {
      case 'addition':
        correctAnswer = operand1 + operand2
        break
      case 'subtraction':
        // Ensure positive result
        if (operand1 < operand2) {
          ;[operand1, operand2] = [operand2, operand1]
        }
        correctAnswer = operand1 - operand2
        break
      case 'multiplication':
        // Smaller numbers for multiplication
        if (difficulty === 'hard') {
          operand1 = this.randomInt(2, 20)
          operand2 = this.randomInt(2, 12)
        } else {
          operand1 = this.randomInt(2, 10)
          operand2 = this.randomInt(2, 10)
        }
        correctAnswer = operand1 * operand2
        break
    }

    const operationSymbol = this.getOperationSymbol(operation)
    const displayText = `${operand1} ${operationSymbol} ${operand2} = ?`

    return {
      id,
      operand1,
      operand2,
      operation,
      correctAnswer,
      displayText,
    }
  }

  private randomOperation(): Operation {
    const operations: Operation[] = ['addition', 'subtraction', 'multiplication']
    return operations[Math.floor(Math.random() * operations.length)]
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private getOperationSymbol(operation: Operation): string {
    switch (operation) {
      case 'addition':
        return '+'
      case 'subtraction':
        return '−'
      case 'multiplication':
        return '×'
    }
  }
}

export const mathSprintValidator = new MathSprintValidator()
