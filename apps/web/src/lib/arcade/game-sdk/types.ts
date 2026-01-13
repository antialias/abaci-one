/**
 * Type definitions for the Arcade Game SDK
 * These types define the contract that all games must implement
 */

import type { ReactNode } from 'react'
import type { GameManifest } from '../manifest-schema'
import type { GameMove as BaseGameMove, GameValidator } from '../validation/types'

// Re-export manifest types
export type {
  GameManifest,
  GameResultsConfig,
  PracticeBreakConfig,
} from '../manifest-schema'

/**
 * Re-export base validation types from arcade system
 */
export type {
  GameMove,
  GameValidator,
  PracticeBreakOptions,
  ValidationContext,
  ValidationResult,
} from '../validation/types'
export { TEAM_MOVE } from '../validation/types'
export type { TeamMoveSentinel } from '../validation/types'

/**
 * Generic game configuration
 * Each game defines its own specific config type
 */
export type GameConfig = Record<string, unknown>

/**
 * Generic game state
 * Each game defines its own specific state type
 */
export type GameState = Record<string, unknown>

/**
 * Provider component interface
 * Each game provides a React context provider that wraps the game UI
 */
export type GameProviderComponent = (props: { children: ReactNode }) => JSX.Element

/**
 * Main game component interface
 * The root component that renders the game UI
 */
export type GameComponent = () => JSX.Element

/**
 * Complete game definition
 * This is what games export after using defineGame()
 */
export interface GameDefinition<
  TConfig extends GameConfig = GameConfig,
  TState extends GameState = GameState,
  TMove extends BaseGameMove = BaseGameMove,
> {
  /** Parsed and validated manifest */
  manifest: GameManifest

  /** React provider component */
  Provider: GameProviderComponent

  /** Main game UI component */
  GameComponent: GameComponent

  /** Server-side validator */
  validator: GameValidator<TState, TMove>

  /** Default configuration */
  defaultConfig: TConfig

  /**
   * Validate a config object at runtime
   * Returns true if config is valid for this game
   *
   * @param config - Configuration object to validate
   * @returns true if valid, false otherwise
   */
  validateConfig?: (config: unknown) => config is TConfig
}

// =============================================================================
// Game Results Reporting Types
// =============================================================================

/**
 * Individual player's result in a game session.
 * Used for both single-player (array of 1) and multiplayer games.
 */
export interface PlayerResult {
  /** Player ID */
  playerId: string
  /** Player's display name */
  playerName: string
  /** Player's emoji */
  playerEmoji: string
  /** User ID (for cross-device identification) */
  userId: string

  // === Scoring ===
  /** Player's primary score */
  score: number
  /** Rank in this game (1 = winner/best) */
  rank: number
  /** Whether this player won (for competitive games) */
  isWinner?: boolean

  // === Accuracy Metrics ===
  /** Number of correct answers/matches */
  correctCount?: number
  /** Number of incorrect attempts */
  incorrectCount?: number
  /** Total attempts made */
  totalAttempts?: number
  /** Accuracy percentage (0-100) */
  accuracy?: number

  // === Speed/Streak Metrics ===
  /** Best consecutive streak achieved */
  bestStreak?: number
  /** Average response time in ms (for speed games) */
  avgResponseTimeMs?: number

  // === Game-Specific Metrics ===
  /** Flexible key-value for game-specific player stats */
  customMetrics?: Record<string, string | number | boolean>
}

/**
 * Scoreboard category for cross-game comparison
 */
export type ScoreboardCategory = 'puzzle' | 'memory' | 'speed' | 'strategy' | 'geography'

/**
 * Game mode type
 */
export type GameModeType = 'single-player' | 'cooperative' | 'competitive' | 'turn-based'

/**
 * Result display theme
 */
export type ResultTheme = 'success' | 'good' | 'neutral' | 'needs-practice'

/**
 * Celebration animation type
 */
export type CelebrationType = 'confetti' | 'fireworks' | 'stars' | 'none'

/**
 * Standard game results report that all games can produce.
 * Games implement this via their validator's getResultsReport() method.
 *
 * Designed to support:
 * - Single-player puzzle games (Card Sorting)
 * - Competitive multiplayer (Matching, Complement Race)
 * - Cooperative multiplayer (Memory Quiz, Know Your World)
 * - Turn-based strategy (Rithmomachia)
 * - Racing/speed games (Complement Race)
 */
export interface GameResultsReport {
  // === Game Identity ===
  /** Internal game name */
  gameName: string
  /** Game display name */
  gameDisplayName: string
  /** Game icon emoji */
  gameIcon: string

  // === Session Metadata ===
  /** Duration in milliseconds */
  durationMs: number
  /** Whether the game was completed normally (vs timeout/skip/resignation) */
  completedNormally: boolean
  /** Timestamp when game started */
  startedAt: number
  /** Timestamp when game ended */
  endedAt: number

  // === Game Mode ===
  /** Type of game session */
  gameMode: GameModeType
  /** Number of players who participated */
  playerCount: number

  // === Player Results ===
  /**
   * Results for each player, ordered by rank (winner first).
   * Single-player games have exactly one entry.
   * Cooperative games may share scores.
   */
  playerResults: PlayerResult[]

  // === Victory Conditions (for competitive/strategy games) ===
  /** Winner player ID (null for ties or cooperative games) */
  winnerId?: string | null
  /** How the game was won (game-specific) */
  winCondition?: string
  /** For strategy games: type of victory achieved */
  victoryType?: string

  // === Aggregate Metrics (for cooperative games or overall stats) ===
  /** Combined/team score (cooperative games) */
  teamScore?: number
  /** Combined accuracy (cooperative games) */
  teamAccuracy?: number
  /** Total items completed (e.g., regions found, pairs matched) */
  itemsCompleted?: number
  /** Total items possible */
  itemsTotal?: number
  /** Completion percentage (0-100) */
  completionPercent?: number

  // === Score Breakdown (for complex scoring like Card Sorting) ===
  /**
   * Detailed score breakdown for games with multi-factor scoring.
   * Each component contributes to the final score.
   */
  scoreBreakdown?: Array<{
    /** Name of score component */
    component: string
    /** Points from this component */
    points: number
    /** Max possible points for this component */
    maxPoints?: number
    /** Description of what this measures */
    description?: string
  }>

  // === Leaderboard Entry (for universal scoreboard) ===
  /**
   * Normalized data for universal scoreboard comparison.
   * Allows comparing across different games.
   */
  leaderboardEntry?: {
    /** Normalized score (0-100 scale for cross-game comparison) */
    normalizedScore: number
    /** Category for grouping on scoreboard */
    category: ScoreboardCategory
    /** Difficulty level played */
    difficulty?: string
    /** Whether this was a personal best */
    isPersonalBest?: boolean
  }

  // === Game-Specific Stats ===
  /**
   * Game-specific statistics for nuanced display.
   * Each entry has a label and value for rendering.
   */
  customStats?: Array<{
    label: string
    value: string | number
    /** Optional: icon or emoji to display with stat */
    icon?: string
    /** Optional: highlight this stat (e.g., "best streak") */
    highlight?: boolean
    /** Optional: group related stats together */
    group?: string
  }>

  // === Display Hints ===
  /**
   * Optional headline message (e.g., "Perfect Game!", "Great Job!")
   * Games can customize this based on performance.
   */
  headline?: string
  /** Optional subheadline */
  subheadline?: string
  /** Optional color theme for results display */
  resultTheme?: ResultTheme
  /** Optional celebration animation to show */
  celebrationType?: CelebrationType
}

// GameResultsConfig is re-exported from manifest-schema at line 11
