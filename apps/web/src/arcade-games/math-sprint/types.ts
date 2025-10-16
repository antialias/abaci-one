/**
 * Math Sprint Game Types
 *
 * A free-for-all game where players race to solve math problems.
 * Demonstrates the TEAM_MOVE pattern (no specific turn owner).
 */

import type { GameConfig, GameMove, GameState } from '@/lib/arcade/game-sdk'

/**
 * Difficulty levels for math problems
 */
export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * Math operation types
 */
export type Operation = 'addition' | 'subtraction' | 'multiplication'

/**
 * Game configuration (persisted to database)
 */
export interface MathSprintConfig extends GameConfig {
  difficulty: Difficulty
  questionsPerRound: number
  timePerQuestion: number // seconds
}

/**
 * A math question
 */
export interface Question {
  id: string
  operand1: number
  operand2: number
  operation: Operation
  correctAnswer: number
  displayText: string // e.g., "5 + 3 = ?"
}

/**
 * Player answer submission
 */
export interface Answer {
  playerId: string
  answer: number
  timestamp: number
  correct: boolean
}

/**
 * Game state (synchronized across all clients)
 */
export interface MathSprintState extends GameState {
  gamePhase: 'setup' | 'playing' | 'results'
  activePlayers: string[]
  playerMetadata: Record<string, { name: string; emoji: string; color: string; userId: string }>

  // Configuration
  difficulty: Difficulty
  questionsPerRound: number
  timePerQuestion: number

  // Game progress
  currentQuestionIndex: number
  questions: Question[]

  // Scoring
  scores: Record<string, number> // playerId -> score
  correctAnswersCount: Record<string, number> // playerId -> count

  // Current question state
  answers: Answer[] // All answers for current question
  questionStartTime: number // Timestamp when question was shown
  questionAnswered: boolean // True if someone got it right
  winnerId: string | null // Winner of current question (first correct)
}

/**
 * Move types for Math Sprint
 */
export type MathSprintMove =
  | StartGameMove
  | SubmitAnswerMove
  | NextQuestionMove
  | ResetGameMove
  | SetConfigMove

export interface StartGameMove extends GameMove {
  type: 'START_GAME'
  data: {
    activePlayers: string[]
    playerMetadata: Record<string, unknown>
  }
}

export interface SubmitAnswerMove extends GameMove {
  type: 'SUBMIT_ANSWER'
  data: {
    answer: number
  }
}

export interface NextQuestionMove extends GameMove {
  type: 'NEXT_QUESTION'
  data: Record<string, never>
}

export interface ResetGameMove extends GameMove {
  type: 'RESET_GAME'
  data: Record<string, never>
}

export interface SetConfigMove extends GameMove {
  type: 'SET_CONFIG'
  data: {
    field: 'difficulty' | 'questionsPerRound' | 'timePerQuestion'
    value: Difficulty | number
  }
}
