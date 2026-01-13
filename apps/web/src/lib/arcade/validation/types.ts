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
export type { CardSortingMove } from '@/arcade-games/card-sorting/types'
export type { ComplementRaceMove } from '@/arcade-games/complement-race/types'

/**
 * Re-export game-specific state types from their respective modules
 */
export type { MatchingState } from '@/arcade-games/matching/types'
export type { MemoryQuizState } from '@/arcade-games/memory-quiz/types'
export type { CardSortingState } from '@/arcade-games/card-sorting/types'
export type { ComplementRaceState } from '@/arcade-games/complement-race/types'

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
 * Options for creating practice break initial state
 */
export interface PracticeBreakOptions {
  /** Maximum duration in minutes for this game break */
  maxDurationMinutes: number
  /** Player ID who will be playing */
  playerId: string
  /** Player name for display */
  playerName?: string
}

/**
 * Base validator interface that all games must implement
 */
export interface GameValidator<TState = unknown, TMove extends GameMove = GameMove> {
  /**
   * Validate a game move and return the new state if valid
   * Can be async to support lazy-loaded dependencies (e.g., ES modules)
   * @param state Current game state
   * @param move The move to validate
   * @param context Optional validation context for authorization checks
   */
  validateMove(
    state: TState,
    move: TMove,
    context?: ValidationContext
  ): ValidationResult | Promise<ValidationResult>

  /**
   * Check if the game is in a terminal state (completed)
   */
  isGameComplete(state: TState): boolean

  /**
   * Get initial state for a new game (starts in setup phase)
   */
  getInitialState(config: unknown): TState

  /**
   * Get initial state for a practice break game.
   * Unlike getInitialState, this creates a state ready to play immediately
   * (skipping the setup phase) with pre-configured settings.
   *
   * Optional: Games that don't implement this will use getInitialState
   * with the provided config and immediately send a START_GAME move.
   *
   * @param config Partial game configuration (merged with practice break defaults)
   * @param options Practice break specific options
   * @returns Game state in 'playing' phase, ready for immediate gameplay
   */
  getInitialStateForPracticeBreak?(config: unknown, options: PracticeBreakOptions): TState
}
