/**
 * Isomorphic game validation types
 * Used on both client and server for arcade session validation
 */

import type { MemoryPairsState } from "@/app/games/matching/context/types";

export type GameName = "matching" | "memory-quiz" | "complement-race";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  newState?: unknown;
}

export interface GameMove {
  type: string;
  playerId: string;
  timestamp: number;
  data: unknown;
}

// Matching game specific moves
export interface MatchingFlipCardMove extends GameMove {
  type: "FLIP_CARD";
  data: {
    cardId: string;
  };
}

export interface MatchingStartGameMove extends GameMove {
  type: "START_GAME";
  data: {
    activePlayers: string[]; // Player IDs (UUIDs)
    cards?: any[]; // GameCard type from context
    playerMetadata?: { [playerId: string]: any }; // Player metadata for cross-user visibility
  };
}

export interface MatchingClearMismatchMove extends GameMove {
  type: "CLEAR_MISMATCH";
  data: Record<string, never>;
}

// Standard setup moves - pattern for all arcade games
export interface MatchingGoToSetupMove extends GameMove {
  type: "GO_TO_SETUP";
  data: Record<string, never>;
}

export interface MatchingSetConfigMove extends GameMove {
  type: "SET_CONFIG";
  data: {
    field: "gameType" | "difficulty" | "turnTimer";
    value: any;
  };
}

export interface MatchingResumeGameMove extends GameMove {
  type: "RESUME_GAME";
  data: Record<string, never>;
}

export interface MatchingHoverCardMove extends GameMove {
  type: "HOVER_CARD";
  data: {
    cardId: string | null; // null when mouse leaves card
  };
}

export type MatchingGameMove =
  | MatchingFlipCardMove
  | MatchingStartGameMove
  | MatchingClearMismatchMove
  | MatchingGoToSetupMove
  | MatchingSetConfigMove
  | MatchingResumeGameMove
  | MatchingHoverCardMove;

// Generic game state union
export type GameState = MemoryPairsState; // Add other game states as union later

/**
 * Validation context for authorization checks
 */
export interface ValidationContext {
  userId?: string;
  playerOwnership?: Record<string, string>; // playerId -> userId mapping
}

/**
 * Base validator interface that all games must implement
 */
export interface GameValidator<
  TState = unknown,
  TMove extends GameMove = GameMove,
> {
  /**
   * Validate a game move and return the new state if valid
   * @param state Current game state
   * @param move The move to validate
   * @param context Optional validation context for authorization checks
   */
  validateMove(
    state: TState,
    move: TMove,
    context?: ValidationContext,
  ): ValidationResult;

  /**
   * Check if the game is in a terminal state (completed)
   */
  isGameComplete(state: TState): boolean;

  /**
   * Get initial state for a new game
   */
  getInitialState(config: unknown): TState;
}
