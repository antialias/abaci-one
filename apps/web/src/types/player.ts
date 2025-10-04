/**
 * Player types for the new UUID-based player system
 * This replaces the old index-based (1-4) player system
 */

export interface Player {
  /** Globally unique identifier (nanoid) */
  id: string

  /** Display name */
  name: string

  /** Player emoji/avatar */
  emoji: string

  /** Player color (for UI theming) */
  color: string

  /** Creation timestamp */
  createdAt: number

  /** Optional: Device ID for multi-device sync */
  deviceId?: string

  /** Optional: Last sync timestamp */
  syncedAt?: number

  /** Optional: Whether this is a local or remote player */
  isLocal?: boolean
}

/**
 * Storage format V2
 * Replaces the old UserProfile format with indexed players
 */
export interface PlayerStorageV2 {
  version: 2

  /** All known players, keyed by ID */
  players: Record<string, Player>

  /** IDs of currently active players (order matters) */
  activePlayerIds: string[]

  /** Activation order mapping for sorting */
  activationOrder: Record<string, number>
}

/**
 * Legacy storage format (V1)
 * Used for migration from old system
 */
export interface UserProfileV1 {
  player1Emoji: string
  player2Emoji: string
  player3Emoji: string
  player4Emoji: string
  player1Name: string
  player2Name: string
  player3Name: string
  player4Name: string
  gamesPlayed: number
  totalWins: number
  favoriteGameType: 'abacus-numeral' | 'complement-pairs' | null
  bestTime: number | null
  highestAccuracy: number
}

/**
 * New stats-only profile (player data moved to PlayerStorageV2)
 */
export interface UserStatsProfile {
  gamesPlayed: number
  totalWins: number
  favoriteGameType: 'abacus-numeral' | 'complement-pairs' | null
  bestTime: number | null
  highestAccuracy: number
}

/**
 * Default player colors (used during migration and player creation)
 */
export const DEFAULT_PLAYER_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f97316', // Deep Orange
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#84cc16', // Lime
]

/**
 * Get a color for a new player (cycles through defaults)
 */
export function getNextPlayerColor(existingPlayers: Player[]): string {
  const usedColors = new Set(existingPlayers.map(p => p.color))

  // Find first unused color
  for (const color of DEFAULT_PLAYER_COLORS) {
    if (!usedColors.has(color)) {
      return color
    }
  }

  // If all colors used, cycle back
  return DEFAULT_PLAYER_COLORS[existingPlayers.length % DEFAULT_PLAYER_COLORS.length]
}
