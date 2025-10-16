/**
 * Isomorphic game validation types
 * Used on both client and server for arcade session validation
 */

import type { MemoryPairsState } from '@/arcade-games/matching/types'
import type { MemoryQuizState as SorobanQuizState } from '@/arcade-games/memory-quiz/types'

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

/**
 * Re-export game-specific move types from their respective modules
 * This maintains a single source of truth (game types) while providing
 * convenient access for validation code.
 */
export type { MatchingMove } from '@/arcade-games/matching/types'
export type { MemoryQuizMove } from '@/arcade-games/memory-quiz/types'
export type { NumberGuesserMove } from '@/arcade-games/number-guesser/types'
export type { MathSprintMove } from '@/arcade-games/math-sprint/types'

/**
 * Re-export game-specific state types from their respective modules
 */
export type { MatchingState } from '@/arcade-games/matching/types'
export type { MemoryQuizState } from '@/arcade-games/memory-quiz/types'
export type { NumberGuesserState } from '@/arcade-games/number-guesser/types'
export type { MathSprintState } from '@/arcade-games/math-sprint/types'

// Generic game state union (for backwards compatibility)
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
