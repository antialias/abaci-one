/**
 * Arcade Game SDK - Stable API Surface
 *
 * This is the ONLY module that games are allowed to import from.
 * All game code must use this SDK - no direct imports from /src/
 *
 * @example
 * ```typescript
 * import {
 *   defineGame,
 *   useArcadeSession,
 *   useRoomData,
 *   type GameDefinition
 * } from '@/lib/arcade/game-sdk'
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================
export type {
  GameDefinition,
  GameProviderComponent,
  GameComponent,
  GameValidator,
  GameConfig,
  GameState,
  GameMove,
  PracticeBreakOptions,
  ValidationContext,
  ValidationResult,
  TeamMoveSentinel,
} from './types'

export { TEAM_MOVE } from './types'

export type { GameManifest, PracticeBreakConfig } from '../manifest-schema'

// ============================================================================
// React Hooks (Controlled API)
// ============================================================================

/**
 * Arcade session management hook
 * Handles state synchronization, move validation, and multiplayer sync
 */
export { useArcadeSession } from '@/hooks/useArcadeSession'

/**
 * Room data hook - access current room information
 */
export { useRoomData, useUpdateGameConfig } from '@/hooks/useRoomData'

/**
 * Game mode context - access players and game mode
 */
export { useGameMode } from '@/contexts/GameModeContext'

/**
 * Viewer ID hook - get current user's ID
 */
export { useViewerId } from '@/hooks/useViewerId'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Player ownership and metadata utilities
 */
export {
  buildPlayerMetadata,
  buildPlayerOwnershipFromRoomData,
} from '@/lib/arcade/player-ownership.client'

/**
 * Game definition helper
 */
export { defineGame } from './define-game'

/**
 * Standard color themes for game cards
 * Use these to ensure consistent appearance across all games
 */
export { getGameTheme, GAME_THEMES } from '../game-themes'
export type { GameTheme, GameThemeName } from '../game-themes'

// ============================================================================
// Re-exports for convenience
// ============================================================================

/**
 * Common types from contexts
 */
export type { Player } from '@/contexts/GameModeContext'
