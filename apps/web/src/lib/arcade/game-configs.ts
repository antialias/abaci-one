/**
 * Shared game configuration types
 *
 * ARCHITECTURE: Phase 3 - Type Inference
 * - Modern games (memory-quiz, matching): Types inferred from game definitions
 * - Legacy games (complement-race): Manual types until migrated
 *
 * These types are used across:
 * - Database storage (room_game_configs table)
 * - Validators (getInitialState method signatures)
 * - Client providers (settings UI and state management)
 * - Helper functions (reading/writing configs)
 */

// Type-only imports (won't load React components at runtime)
import type { memoryQuizGame } from "@/arcade-games/memory-quiz";
import type { matchingGame } from "@/arcade-games/matching";
import type { cardSortingGame } from "@/arcade-games/card-sorting";
import type { yjsDemoGame } from "@/arcade-games/yjs-demo";
import type { rithmomachiaGame } from "@/arcade-games/rithmomachia";

/**
 * Utility type: Extract config type from a game definition
 * Uses TypeScript's infer keyword to extract the TConfig generic
 */
type InferGameConfig<T> = T extends { defaultConfig: infer Config }
  ? Config
  : never;

// ============================================================================
// Modern Games (Type Inference from Game Definitions)
// ============================================================================

/**
 * Configuration for memory-quiz (soroban lightning) game
 * INFERRED from memoryQuizGame.defaultConfig
 */
export type MemoryQuizGameConfig = InferGameConfig<typeof memoryQuizGame>;

/**
 * Configuration for matching (memory pairs battle) game
 * INFERRED from matchingGame.defaultConfig
 */
export type MatchingGameConfig = InferGameConfig<typeof matchingGame>;

/**
 * Configuration for card-sorting (pattern recognition) game
 * INFERRED from cardSortingGame.defaultConfig
 */
export type CardSortingGameConfig = InferGameConfig<typeof cardSortingGame>;

/**
 * Configuration for yjs-demo (Yjs real-time sync demo) game
 * INFERRED from yjsDemoGame.defaultConfig
 */
export type YjsDemoGameConfig = InferGameConfig<typeof yjsDemoGame>;

/**
 * Configuration for rithmomachia (Battle of Numbers) game
 * INFERRED from rithmomachiaGame.defaultConfig
 */
export type RithmomachiaGameConfig = InferGameConfig<typeof rithmomachiaGame>;

// ============================================================================
// Legacy Games (Manual Type Definitions)
// TODO: Migrate these games to the modular system for type inference
// ============================================================================

/**
 * Configuration for complement-race game
 * Supports multiplayer racing with AI opponents
 */
export interface ComplementRaceGameConfig {
  // Game Style (which mode)
  style: "practice" | "sprint" | "survival";

  // Question Settings
  mode: "friends5" | "friends10" | "mixed";
  complementDisplay: "number" | "abacus" | "random";

  // Difficulty
  timeoutSetting:
    | "preschool"
    | "kindergarten"
    | "relaxed"
    | "slow"
    | "normal"
    | "fast"
    | "expert";

  // AI Settings
  enableAI: boolean;
  aiOpponentCount: number; // 0-2 for multiplayer, 2 for single-player

  // Multiplayer Settings
  maxPlayers: number; // 1-4

  // Sprint Mode Specific
  routeDuration: number; // seconds per route (default 60)
  enablePassengers: boolean;
  passengerCount: number; // 6-8 passengers per route
  maxConcurrentPassengers: number; // 3 per train

  // Practice/Survival Mode Specific
  raceGoal: number; // questions to win practice mode (default 20)

  // Win Conditions
  winCondition: "route-based" | "score-based" | "time-based" | "infinite";
  targetScore?: number; // for score-based (e.g., 100)
  timeLimit?: number; // for time-based (e.g., 300 seconds)
  routeCount?: number; // for route-based (e.g., 3 routes)

  // Index signature to satisfy GameConfig constraint
  [key: string]: unknown;
}

// ============================================================================
// Combined Types
// ============================================================================

/**
 * Union type of all game configs for type-safe access
 * Modern games use inferred types, legacy games use manual types
 */
export type GameConfigByName = {
  // Modern games (inferred types)
  "memory-quiz": MemoryQuizGameConfig;
  matching: MatchingGameConfig;
  "card-sorting": CardSortingGameConfig;
  "yjs-demo": YjsDemoGameConfig;
  rithmomachia: RithmomachiaGameConfig;

  // Legacy games (manual types)
  "complement-race": ComplementRaceGameConfig;
};

/**
 * Room's game configuration object (nested by game name)
 * This matches the structure stored in room_game_configs table
 *
 * AUTO-DERIVED: Adding a game to GameConfigByName automatically adds it here
 */
export type RoomGameConfig = {
  [K in keyof GameConfigByName]?: GameConfigByName[K];
};

/**
 * Default configurations for each game
 */
export const DEFAULT_MATCHING_CONFIG: MatchingGameConfig = {
  gameType: "abacus-numeral",
  difficulty: 6,
  turnTimer: 30,
};

export const DEFAULT_MEMORY_QUIZ_CONFIG: MemoryQuizGameConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: "easy",
  playMode: "cooperative",
};

export const DEFAULT_CARD_SORTING_CONFIG: CardSortingGameConfig = {
  cardCount: 8,
  showNumbers: true,
  timeLimit: null,
  gameMode: "solo",
};

export const DEFAULT_RITHMOMACHIA_CONFIG: RithmomachiaGameConfig = {
  pointWinEnabled: false,
  pointWinThreshold: 30,
  repetitionRule: true,
  fiftyMoveRule: true,
  allowAnySetOnRecheck: true,
  timeControlMs: null,
};

export const DEFAULT_YIJS_DEMO_CONFIG: YjsDemoGameConfig = {
  gridSize: 8,
  duration: 60,
};

export const DEFAULT_COMPLEMENT_RACE_CONFIG: ComplementRaceGameConfig = {
  // Game style
  style: "practice",

  // Question settings
  mode: "mixed",
  complementDisplay: "random",

  // Difficulty
  timeoutSetting: "normal",

  // AI settings
  enableAI: true,
  aiOpponentCount: 2,

  // Multiplayer
  maxPlayers: 4,

  // Sprint mode
  routeDuration: 60,
  enablePassengers: true,
  passengerCount: 6,
  maxConcurrentPassengers: 3,

  // Practice/Survival
  raceGoal: 20,

  // Win conditions
  winCondition: "infinite", // Sprint mode is infinite by default (Steam Sprint)
  routeCount: 3,
  targetScore: 100,
  timeLimit: 300,
};
