/**
 * Matching Pairs Battle - Type Definitions
 *
 * SDK-compatible types for the matching game.
 */

import type { GameConfig, GameState } from "@/lib/arcade/game-sdk/types";

// ============================================================================
// Core Types
// ============================================================================

export type GameMode = "single" | "multiplayer";
export type GameType = "abacus-numeral" | "complement-pairs";
export type GamePhase = "setup" | "playing" | "results";
export type CardType = "abacus" | "number" | "complement";
export type Difficulty = 6 | 8 | 12 | 15; // Number of pairs
export type Player = string; // Player ID (UUID)
export type TargetSum = 5 | 10 | 20;

// ============================================================================
// Game Configuration (SDK-compatible)
// ============================================================================

/**
 * Configuration for matching game
 * Extends GameConfig for SDK compatibility
 */
export interface MatchingConfig extends GameConfig {
  gameType: GameType;
  difficulty: Difficulty;
  turnTimer: number;
}

// ============================================================================
// Game Entities
// ============================================================================

export interface GameCard {
  id: string;
  type: CardType;
  number: number;
  complement?: number; // For complement pairs
  targetSum?: TargetSum; // For complement pairs
  matched: boolean;
  matchedBy?: Player; // For two-player mode
  element?: HTMLElement | null; // For animations
}

export interface PlayerMetadata {
  id: string; // Player ID (UUID)
  name: string;
  emoji: string;
  userId: string; // Which user owns this player
  color?: string;
}

export interface PlayerScore {
  [playerId: string]: number;
}

export interface CelebrationAnimation {
  id: string;
  type: "match" | "win" | "confetti";
  x: number;
  y: number;
  timestamp: number;
}

export interface GameStatistics {
  totalMoves: number;
  matchedPairs: number;
  totalPairs: number;
  gameTime: number;
  accuracy: number; // Percentage of successful matches
  averageTimePerMove: number;
}

// ============================================================================
// Game State (SDK-compatible)
// ============================================================================

/**
 * Main game state for matching pairs battle
 * Extends GameState for SDK compatibility
 */
export interface MatchingState extends GameState {
  // Core game data
  cards: GameCard[];
  gameCards: GameCard[];
  flippedCards: GameCard[];

  // Game configuration
  gameType: GameType;
  difficulty: Difficulty;
  turnTimer: number; // Seconds for turn timer

  // Game progression
  gamePhase: GamePhase;
  currentPlayer: Player;
  matchedPairs: number;
  totalPairs: number;
  moves: number;
  scores: PlayerScore;
  activePlayers: Player[]; // Track active player IDs
  playerMetadata: Record<string, PlayerMetadata>; // Player metadata for cross-user visibility
  consecutiveMatches: Record<string, number>; // Track consecutive matches per player

  // Timing
  gameStartTime: number | null;
  gameEndTime: number | null;
  currentMoveStartTime: number | null;
  timerInterval: NodeJS.Timeout | null;

  // UI state
  celebrationAnimations: CelebrationAnimation[];
  isProcessingMove: boolean;
  showMismatchFeedback: boolean;
  lastMatchedPair: [string, string] | null;

  // PAUSE/RESUME: Paused game state
  originalConfig?: {
    gameType: GameType;
    difficulty: Difficulty;
    turnTimer: number;
  };
  pausedGamePhase?: GamePhase;
  pausedGameState?: {
    gameCards: GameCard[];
    currentPlayer: Player;
    matchedPairs: number;
    moves: number;
    scores: PlayerScore;
    activePlayers: Player[];
    playerMetadata: Record<string, PlayerMetadata>;
    consecutiveMatches: Record<string, number>;
    gameStartTime: number | null;
  };

  // HOVER: Networked hover state
  playerHovers: Record<string, string | null>; // playerId -> cardId (or null if not hovering)
}

// For backwards compatibility with existing code
export type MemoryPairsState = MatchingState;

// ============================================================================
// Context Value
// ============================================================================

/**
 * Context value for the matching game provider
 * Exposes state and action creators to components
 */
export interface MatchingContextValue {
  state: MatchingState & { gameMode: GameMode };
  dispatch: React.Dispatch<any>; // Deprecated - use action creators instead

  // Computed values
  isGameActive: boolean;
  canFlipCard: (cardId: string) => boolean;
  currentGameStatistics: GameStatistics;
  gameMode: GameMode;
  activePlayers: Player[];

  // Pause/Resume
  hasConfigChanged: boolean;
  canResumeGame: boolean;

  // Actions
  startGame: () => void;
  flipCard: (cardId: string) => void;
  resetGame: () => void;
  setGameType: (type: GameType) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setTurnTimer: (timer: number) => void;
  goToSetup: () => void;
  resumeGame: () => void;
  hoverCard: (cardId: string | null) => void;
  exitSession: () => void;
}

// ============================================================================
// Game Moves (SDK-compatible)
// ============================================================================

/**
 * All possible moves in the matching game
 * These match the move types validated by MatchingGameValidator
 */
export type MatchingMove =
  | {
      type: "FLIP_CARD";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        cardId: string;
      };
    }
  | {
      type: "START_GAME";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        cards: GameCard[];
        activePlayers: string[];
        playerMetadata: Record<string, PlayerMetadata>;
      };
    }
  | {
      type: "CLEAR_MISMATCH";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "GO_TO_SETUP";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "SET_CONFIG";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        field: "gameType" | "difficulty" | "turnTimer";
        value: any;
      };
    }
  | {
      type: "RESUME_GAME";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "HOVER_CARD";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        cardId: string | null;
      };
    };

// ============================================================================
// Component Props
// ============================================================================

export interface GameCardProps {
  card: GameCard;
  isFlipped: boolean;
  isMatched: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export interface PlayerIndicatorProps {
  player: Player;
  isActive: boolean;
  score: number;
  name?: string;
}

export interface GameGridProps {
  cards: GameCard[];
  onCardClick: (cardId: string) => void;
  disabled?: boolean;
}

// ============================================================================
// Validation
// ============================================================================

export interface MatchValidationResult {
  isValid: boolean;
  reason?: string;
  type: "abacus-numeral" | "complement" | "invalid";
}
