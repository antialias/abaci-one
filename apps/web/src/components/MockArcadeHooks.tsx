'use client'

/**
 * Mock implementations of arcade SDK hooks for game previews
 * These are exported with the same names so games can use them transparently
 */

import {
  useMockViewerId,
  useMockRoomData,
  useMockUpdateGameConfig,
  useMockGameMode,
} from './MockArcadeEnvironment'

// Re-export with SDK names
export const useUserId = useMockViewerId
export const useRoomData = useMockRoomData
export const useUpdateGameConfig = useMockUpdateGameConfig
export const useGameMode = useMockGameMode

// Note: useArcadeSession must be handled per-game since it needs type parameters
