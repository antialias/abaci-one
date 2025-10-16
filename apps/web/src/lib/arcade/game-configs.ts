/**
 * Shared game configuration types
 *
 * ARCHITECTURE: Phase 3 - Type Inference
 * - Modern games (number-guesser, math-sprint): Types inferred from game definitions
 * - Legacy games (matching, memory-quiz, complement-race): Manual types until migrated
 *
 * These types are used across:
 * - Database storage (room_game_configs table)
 * - Validators (getInitialState method signatures)
 * - Client providers (settings UI and state management)
 * - Helper functions (reading/writing configs)
 */

import type { DifficultyLevel } from '@/app/arcade/memory-quiz/types'
import type { Difficulty, GameType } from '@/app/games/matching/context/types'

// Type-only imports (won't load React components at runtime)
import type { numberGuesserGame } from '@/arcade-games/number-guesser'
import type { mathSprintGame } from '@/arcade-games/math-sprint'

/**
 * Utility type: Extract config type from a game definition
 * Uses TypeScript's infer keyword to extract the TConfig generic
 */
type InferGameConfig<T> = T extends { defaultConfig: infer Config } ? Config : never

// ============================================================================
// Modern Games (Type Inference from Game Definitions)
// ============================================================================

/**
 * Configuration for number-guesser game
 * INFERRED from numberGuesserGame.defaultConfig
 */
export type NumberGuesserGameConfig = InferGameConfig<typeof numberGuesserGame>

/**
 * Configuration for math-sprint game
 * INFERRED from mathSprintGame.defaultConfig
 */
export type MathSprintGameConfig = InferGameConfig<typeof mathSprintGame>

// ============================================================================
// Legacy Games (Manual Type Definitions)
// TODO: Migrate these games to the modular system for type inference
// ============================================================================

/**
 * Configuration for matching (memory pairs) game
 */
export interface MatchingGameConfig {
  gameType: GameType
  difficulty: Difficulty
  turnTimer: number
}

/**
 * Configuration for memory-quiz (soroban lightning) game
 */
export interface MemoryQuizGameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15
  displayTime: number
  selectedDifficulty: DifficultyLevel
  playMode: 'cooperative' | 'competitive'
}

/**
 * Configuration for complement-race game
 * TODO: Define when implementing complement-race settings
 */
export interface ComplementRaceGameConfig {
  // Future settings will go here
  placeholder?: never
}

// ============================================================================
// Combined Types
// ============================================================================

/**
 * Union type of all game configs for type-safe access
 * Modern games use inferred types, legacy games use manual types
 */
export type GameConfigByName = {
  // Legacy games (manual types)
  matching: MatchingGameConfig
  'memory-quiz': MemoryQuizGameConfig
  'complement-race': ComplementRaceGameConfig

  // Modern games (inferred types)
  'number-guesser': NumberGuesserGameConfig
  'math-sprint': MathSprintGameConfig
}

/**
 * Room's game configuration object (nested by game name)
 * This matches the structure stored in room_game_configs table
 *
 * AUTO-DERIVED: Adding a game to GameConfigByName automatically adds it here
 */
export type RoomGameConfig = {
  [K in keyof GameConfigByName]?: GameConfigByName[K]
}

/**
 * Default configurations for each game
 */
export const DEFAULT_MATCHING_CONFIG: MatchingGameConfig = {
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
}

export const DEFAULT_MEMORY_QUIZ_CONFIG: MemoryQuizGameConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: 'easy',
  playMode: 'cooperative',
}

export const DEFAULT_COMPLEMENT_RACE_CONFIG: ComplementRaceGameConfig = {
  // Future defaults will go here
}

export const DEFAULT_NUMBER_GUESSER_CONFIG: NumberGuesserGameConfig = {
  minNumber: 1,
  maxNumber: 100,
  roundsToWin: 3,
}

export const DEFAULT_MATH_SPRINT_CONFIG: MathSprintGameConfig = {
  difficulty: 'medium',
  questionsPerRound: 10,
  timePerQuestion: 30,
}
