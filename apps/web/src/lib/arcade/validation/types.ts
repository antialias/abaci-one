/**
 * Isomorphic game validation types
 * Used on both client and server for arcade session validation
 */

import type { MemoryPairsState } from '@/app/games/matching/context/types'
import type { SorobanQuizState } from '@/app/arcade/memory-quiz/types'

/**
 * Game name type - auto-derived from validator registry
 * @deprecated Import from '@/lib/arcade/validators' instead
 */
export type { GameName } from '../validators'

export interface ValidationResult {
  valid: boolean
  error?: string
  newState?: unknown
}

/**
 * Sentinel value for team moves where no specific player can be identified
 * Used in free-for-all games where all of a user's players act as a team
 */
export const TEAM_MOVE = '__TEAM__' as const
export type TeamMoveSentinel = typeof TEAM_MOVE

export interface GameMove {
  type: string
  playerId: string | TeamMoveSentinel // Individual player (turn-based) or __TEAM__ (free-for-all)
  userId: string // Room member/viewer who made the move
  timestamp: number
  data: unknown
}

// Matching game specific moves
export interface MatchingFlipCardMove extends GameMove {
  type: 'FLIP_CARD'
  data: {
    cardId: string
  }
}

export interface MatchingStartGameMove extends GameMove {
  type: 'START_GAME'
  data: {
    activePlayers: string[] // Player IDs (UUIDs)
    cards?: any[] // GameCard type from context
    playerMetadata?: { [playerId: string]: any } // Player metadata for cross-user visibility
  }
}

export interface MatchingClearMismatchMove extends GameMove {
  type: 'CLEAR_MISMATCH'
  data: Record<string, never>
}

// Standard setup moves - pattern for all arcade games
export interface MatchingGoToSetupMove extends GameMove {
  type: 'GO_TO_SETUP'
  data: Record<string, never>
}

export interface MatchingSetConfigMove extends GameMove {
  type: 'SET_CONFIG'
  data: {
    field: 'gameType' | 'difficulty' | 'turnTimer'
    value: any
  }
}

export interface MatchingResumeGameMove extends GameMove {
  type: 'RESUME_GAME'
  data: Record<string, never>
}

export interface MatchingHoverCardMove extends GameMove {
  type: 'HOVER_CARD'
  data: {
    cardId: string | null // null when mouse leaves card
  }
}

export type MatchingGameMove =
  | MatchingFlipCardMove
  | MatchingStartGameMove
  | MatchingClearMismatchMove
  | MatchingGoToSetupMove
  | MatchingSetConfigMove
  | MatchingResumeGameMove
  | MatchingHoverCardMove

// Memory Quiz game specific moves
export interface MemoryQuizStartQuizMove extends GameMove {
  type: 'START_QUIZ'
  data: {
    quizCards: any[] // QuizCard type from memory-quiz types
  }
}

export interface MemoryQuizNextCardMove extends GameMove {
  type: 'NEXT_CARD'
  data: Record<string, never>
}

export interface MemoryQuizShowInputPhaseMove extends GameMove {
  type: 'SHOW_INPUT_PHASE'
  data: Record<string, never>
}

export interface MemoryQuizAcceptNumberMove extends GameMove {
  type: 'ACCEPT_NUMBER'
  data: {
    number: number
  }
}

export interface MemoryQuizRejectNumberMove extends GameMove {
  type: 'REJECT_NUMBER'
  data: Record<string, never>
}

export interface MemoryQuizSetInputMove extends GameMove {
  type: 'SET_INPUT'
  data: {
    input: string
  }
}

export interface MemoryQuizShowResultsMove extends GameMove {
  type: 'SHOW_RESULTS'
  data: Record<string, never>
}

export interface MemoryQuizResetQuizMove extends GameMove {
  type: 'RESET_QUIZ'
  data: Record<string, never>
}

export interface MemoryQuizSetConfigMove extends GameMove {
  type: 'SET_CONFIG'
  data: {
    field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode'
    value: any
  }
}

export type MemoryQuizGameMove =
  | MemoryQuizStartQuizMove
  | MemoryQuizNextCardMove
  | MemoryQuizShowInputPhaseMove
  | MemoryQuizAcceptNumberMove
  | MemoryQuizRejectNumberMove
  | MemoryQuizSetInputMove
  | MemoryQuizShowResultsMove
  | MemoryQuizResetQuizMove
  | MemoryQuizSetConfigMove

// Generic game state union
export type GameState = MemoryPairsState | SorobanQuizState // Add other game states as union later

/**
 * Validation context for authorization checks
 */
export interface ValidationContext {
  userId?: string
  playerOwnership?: Record<string, string> // playerId -> userId mapping
}

/**
 * Base validator interface that all games must implement
 */
export interface GameValidator<TState = unknown, TMove extends GameMove = GameMove> {
  /**
   * Validate a game move and return the new state if valid
   * @param state Current game state
   * @param move The move to validate
   * @param context Optional validation context for authorization checks
   */
  validateMove(state: TState, move: TMove, context?: ValidationContext): ValidationResult

  /**
   * Check if the game is in a terminal state (completed)
   */
  isGameComplete(state: TState): boolean

  /**
   * Get initial state for a new game
   */
  getInitialState(config: unknown): TState
}
