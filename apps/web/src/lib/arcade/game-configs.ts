/**
 * Shared game configuration types
 *
 * All config types are defined using Zod schemas in each game's types.ts file.
 * This file re-exports them for centralized access.
 */

// Import config types from Zod schemas (single source of truth)
import type { MemoryQuizConfig } from '@/arcade-games/memory-quiz/types'
import type { MatchingConfig } from '@/arcade-games/matching/types'
import type { CardSortingConfig } from '@/arcade-games/card-sorting/types'
import type { YjsDemoConfig } from '@/arcade-games/yjs-demo/types'
import type { RithmomachiaConfig } from '@/arcade-games/rithmomachia/types'
import type { KnowYourWorldConfig } from '@/arcade-games/know-your-world/types'
import type { ComplementRaceGameConfig } from '@/arcade-games/complement-race/types'

// Re-export all config types
export type { MemoryQuizConfig as MemoryQuizGameConfig } from '@/arcade-games/memory-quiz/types'
export type { MatchingConfig as MatchingGameConfig } from '@/arcade-games/matching/types'
export type { CardSortingConfig as CardSortingGameConfig } from '@/arcade-games/card-sorting/types'
export type { YjsDemoConfig as YjsDemoGameConfig } from '@/arcade-games/yjs-demo/types'
export type { RithmomachiaConfig as RithmomachiaGameConfig } from '@/arcade-games/rithmomachia/types'
export type { KnowYourWorldConfig } from '@/arcade-games/know-your-world/types'
export type { ComplementRaceGameConfig } from '@/arcade-games/complement-race/types'

// ============================================================================
// Combined Types
// ============================================================================

/**
 * Union type of all game configs for type-safe access
 */
export type GameConfigByName = {
  'memory-quiz': MemoryQuizConfig
  matching: MatchingConfig
  'card-sorting': CardSortingConfig
  'yjs-demo': YjsDemoConfig
  rithmomachia: RithmomachiaConfig
  'know-your-world': KnowYourWorldConfig
  'complement-race': ComplementRaceGameConfig
}

/**
 * Room's game configuration object (nested by game name)
 * This matches the structure stored in room_game_configs table
 */
export type RoomGameConfig = {
  [K in keyof GameConfigByName]?: GameConfigByName[K]
}

/**
 * Default configurations for each game
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
}

export const DEFAULT_MEMORY_QUIZ_CONFIG: MemoryQuizConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: 'easy',
  playMode: 'cooperative',
}

export const DEFAULT_CARD_SORTING_CONFIG: CardSortingConfig = {
  cardCount: 8,
  timeLimit: null,
  gameMode: 'solo',
}

export const DEFAULT_RITHMOMACHIA_CONFIG: RithmomachiaConfig = {
  pointWinEnabled: false,
  pointWinThreshold: 30,
  repetitionRule: true,
  fiftyMoveRule: true,
  allowAnySetOnRecheck: true,
  timeControlMs: null,
}

export const DEFAULT_YIJS_DEMO_CONFIG: YjsDemoConfig = {
  gridSize: 8,
  duration: 60,
}

export const DEFAULT_KNOW_YOUR_WORLD_CONFIG: KnowYourWorldConfig = {
  selectedMap: 'world',
  gameMode: 'cooperative',
  includeSizes: ['huge', 'large', 'medium'],
  assistanceLevel: 'helpful',
  studyDuration: 0,
  selectedContinent: 'all',
}

export const DEFAULT_COMPLEMENT_RACE_CONFIG: ComplementRaceGameConfig = {
  style: 'practice',
  mode: 'mixed',
  complementDisplay: 'random',
  timeoutSetting: 'normal',
  enableAI: true,
  aiOpponentCount: 2,
  maxPlayers: 4,
  routeDuration: 60,
  enablePassengers: true,
  passengerCount: 6,
  maxConcurrentPassengers: 3,
  raceGoal: 20,
  winCondition: 'infinite',
  routeCount: 3,
  targetScore: 100,
  timeLimit: 300,
}
