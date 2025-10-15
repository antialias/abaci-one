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
  ValidationContext,
  ValidationResult,
  TeamMoveSentinel,
} from './types'

export { TEAM_MOVE } from './types'

export type { GameManifest } from '../manifest-schema'

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
 * Helper for loading and validating game manifests
 */
export { loadManifest } from './load-manifest'

/**
 * Game definition helper
 */
export { defineGame } from './define-game'

// ============================================================================
// Re-exports for convenience
// ============================================================================

/**
 * Common types from contexts
 */
export type { Player } from '@/contexts/GameModeContext'
