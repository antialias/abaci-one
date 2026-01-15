/**
 * Universal game stats types
 *
 * These types are used across ALL arcade games to record player performance.
 * Supports: solo, competitive, cooperative, and head-to-head game modes.
 *
 * See: .claude/GAME_STATS_COMPARISON.md for detailed cross-game analysis
 */

import type { GameStatsBreakdown } from "@/db/schema/player-stats";

/**
 * Standard game result that all arcade games must provide
 *
 * Supports:
 * - 1-N players
 * - Competitive (individual winners)
 * - Cooperative (team wins/losses)
 * - Solo completion
 * - Head-to-head (2-player)
 */
export interface GameResult {
  // Game identification
  gameType: string; // e.g., "matching", "complement-race", "memory-quiz"

  // Player results (supports 1-N players)
  playerResults: PlayerGameResult[];

  // Timing
  completedAt: number; // timestamp
  duration: number; // milliseconds

  // Optional game-specific data
  metadata?: {
    // For cooperative games (Memory Quiz, Card Sorting collaborative)
    // When true: all players share win/loss outcome
    isTeamVictory?: boolean;

    // For specific win conditions (Rithmomachia)
    winCondition?: string; // e.g., "HARMONY", "POINTS", "TIMEOUT"

    // For game modes
    gameMode?: string; // e.g., "solo", "competitive", "cooperative"

    // Extensible for other game-specific info
    [key: string]: unknown;
  };
}

/**
 * Individual player result within a game
 */
export interface PlayerGameResult {
  playerId: string;

  // Outcome
  won: boolean; // For cooperative games: all players have same value
  placement?: number; // 1st, 2nd, 3rd place (for tournaments with 3+ players)

  // Performance
  score?: number;
  accuracy?: number; // 0.0 - 1.0
  completionTime?: number; // milliseconds (player-specific)

  // Game-specific metrics (stored as JSON in DB)
  metrics?: {
    // Matching
    moves?: number;
    matchedPairs?: number;
    difficulty?: number;

    // Complement Race
    streak?: number;
    correctAnswers?: number;
    totalQuestions?: number;

    // Memory Quiz
    correct?: number;
    incorrect?: number;

    // Card Sorting
    exactMatches?: number;
    inversions?: number;
    lcsLength?: number;

    // Rithmomachia
    capturedPieces?: number;
    points?: number;

    // Extensible for future games
    [key: string]: unknown;
  };
}

/**
 * Stats update returned from API after recording a game
 */
export interface StatsUpdate {
  playerId: string;
  previousStats: PlayerStatsData;
  newStats: PlayerStatsData;
  changes: {
    gamesPlayed: number;
    wins: number;
    losses: number;
  };
}

/**
 * Complete player stats data (from DB)
 */
export interface PlayerStatsData {
  playerId: string;
  gamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  bestTime: number | null;
  highestAccuracy: number;
  favoriteGameType: string | null;
  gameStats: Record<string, GameStatsBreakdown>;
  lastPlayedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request body for recording a game result
 */
export interface RecordGameRequest {
  gameResult: GameResult;
}

/**
 * Response from recording a game result
 */
export interface RecordGameResponse {
  success: boolean;
  updates: StatsUpdate[];
}

/**
 * Response from fetching player stats
 */
export interface GetPlayerStatsResponse {
  stats: PlayerStatsData;
}

/**
 * Response from fetching all user's player stats
 */
export interface GetAllPlayerStatsResponse {
  playerStats: PlayerStatsData[];
}
