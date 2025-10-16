/**
 * Shared game configuration types
 *
 * This is the single source of truth for all game settings.
 * These types are used across:
 * - Database storage (room_game_configs table)
 * - Validators (getInitialState method signatures)
 * - Client providers (settings UI and state management)
 * - Helper functions (reading/writing configs)
 */

import type { DifficultyLevel } from '@/app/arcade/memory-quiz/types'
import type { Difficulty, GameType } from '@/app/games/matching/context/types'

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

/**
 * Configuration for number-guesser game
 */
export interface NumberGuesserGameConfig {
  minNumber: number
  maxNumber: number
  roundsToWin: number
}

/**
 * Union type of all game configs for type-safe access
 */
export type GameConfigByName = {
  matching: MatchingGameConfig
  'memory-quiz': MemoryQuizGameConfig
  'complement-race': ComplementRaceGameConfig
  'number-guesser': NumberGuesserGameConfig
}

/**
 * Room's game configuration object (nested by game name)
 * This matches the structure stored in room_game_configs table
 */
export interface RoomGameConfig {
  matching?: MatchingGameConfig
  'memory-quiz'?: MemoryQuizGameConfig
  'complement-race'?: ComplementRaceGameConfig
  'number-guesser'?: NumberGuesserGameConfig
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
