import { nanoid } from 'nanoid'
import {
  Player,
  PlayerStorageV2,
  UserProfileV1,
  UserStatsProfile,
  DEFAULT_PLAYER_COLORS,
} from '../types/player'

// Storage keys
export const STORAGE_KEY_V1 = 'soroban-memory-pairs-profile'
export const STORAGE_KEY_V2 = 'soroban-players-v2'
export const STORAGE_KEY_STATS = 'soroban-user-stats'

/**
 * Migrate from V1 (indexed players) to V2 (UUID-based players)
 */
export function migrateFromV1(v1Profile: UserProfileV1): PlayerStorageV2 {
  const players: Record<string, Player> = {}
  const activePlayerIds: string[] = []
  const activationOrder: Record<string, number> = {}

  // Migrate each indexed player (1-4)
  for (let i = 1; i <= 4; i++) {
    const id = nanoid()
    const createdAt = Date.now() - (4 - i) * 1000 // Preserve order (older = lower index)

    players[id] = {
      id,
      name: v1Profile[`player${i}Name` as keyof UserProfileV1] as string,
      emoji: v1Profile[`player${i}Emoji` as keyof UserProfileV1] as string,
      color: DEFAULT_PLAYER_COLORS[i - 1],
      createdAt,
      isLocal: true,
    }

    // First player active by default (matches old behavior)
    if (i === 1) {
      activePlayerIds.push(id)
      activationOrder[id] = 0
    }
  }

  return {
    version: 2,
    players,
    activePlayerIds,
    activationOrder,
  }
}

/**
 * Extract stats from V1 profile (player data removed)
 */
export function extractStatsFromV1(v1Profile: UserProfileV1): UserStatsProfile {
  return {
    gamesPlayed: v1Profile.gamesPlayed,
    totalWins: v1Profile.totalWins,
    favoriteGameType: v1Profile.favoriteGameType,
    bestTime: v1Profile.bestTime,
    highestAccuracy: v1Profile.highestAccuracy,
  }
}

/**
 * Check if migration is needed
 */
export function needsMigration(): boolean {
  if (typeof window === 'undefined') return false

  const hasV1 = localStorage.getItem(STORAGE_KEY_V1) !== null
  const hasV2 = localStorage.getItem(STORAGE_KEY_V2) !== null

  return hasV1 && !hasV2
}

/**
 * Perform migration from V1 to V2
 * Returns migrated data or null if migration not needed
 */
export function performMigration(): {
  players: PlayerStorageV2
  stats: UserStatsProfile
} | null {
  if (typeof window === 'undefined') return null
  if (!needsMigration()) return null

  try {
    const v1Json = localStorage.getItem(STORAGE_KEY_V1)
    if (!v1Json) return null

    const v1Profile = JSON.parse(v1Json) as UserProfileV1

    // Migrate to V2
    const v2Storage = migrateFromV1(v1Profile)
    const stats = extractStatsFromV1(v1Profile)

    // Validate migration
    if (!validateMigration(v1Profile, v2Storage)) {
      console.error('Migration validation failed')
      return null
    }

    // Save to new storage keys
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Storage))
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats))

    // Keep V1 for rollback (don't delete yet)
    console.log('✅ Successfully migrated from V1 to V2 player storage')

    return { players: v2Storage, stats }
  } catch (error) {
    console.error('Migration failed:', error)
    return null
  }
}

/**
 * Validate that migration preserved all data
 */
export function validateMigration(
  v1: UserProfileV1,
  v2: PlayerStorageV2
): boolean {
  // Should have migrated all 4 players
  const playerCount = Object.keys(v2.players).length
  if (playerCount !== 4) {
    console.error(`Expected 4 players, got ${playerCount}`)
    return false
  }

  // Check that all player data is preserved
  const v2Players = Object.values(v2.players)

  // Verify all names migrated
  const v1Names = [
    v1.player1Name,
    v1.player2Name,
    v1.player3Name,
    v1.player4Name,
  ]
  const v2Names = v2Players.map(p => p.name)

  for (const name of v1Names) {
    if (!v2Names.includes(name)) {
      console.error(`Missing player name: ${name}`)
      return false
    }
  }

  // Verify all emojis migrated
  const v1Emojis = [
    v1.player1Emoji,
    v1.player2Emoji,
    v1.player3Emoji,
    v1.player4Emoji,
  ]
  const v2Emojis = v2Players.map(p => p.emoji)

  for (const emoji of v1Emojis) {
    if (!v2Emojis.includes(emoji)) {
      console.error(`Missing player emoji: ${emoji}`)
      return false
    }
  }

  // Should have exactly 1 active player (player 1)
  if (v2.activePlayerIds.length !== 1) {
    console.error(
      `Expected 1 active player, got ${v2.activePlayerIds.length}`
    )
    return false
  }

  console.log('✅ Migration validation passed')
  return true
}

/**
 * Rollback to V1 (for emergency use)
 */
export function rollbackToV1(): void {
  if (typeof window === 'undefined') return

  const confirmed = confirm(
    'Are you sure you want to rollback to the old player system? This will delete all new player data.'
  )

  if (!confirmed) return

  localStorage.removeItem(STORAGE_KEY_V2)
  localStorage.removeItem(STORAGE_KEY_STATS)

  console.log('⚠️ Rolled back to V1 storage')
  window.location.reload()
}

/**
 * Load V2 storage or perform migration if needed
 */
export function loadPlayerStorage(): PlayerStorageV2 | null {
  if (typeof window === 'undefined') return null

  // Try to load V2
  const v2Json = localStorage.getItem(STORAGE_KEY_V2)
  if (v2Json) {
    try {
      return JSON.parse(v2Json) as PlayerStorageV2
    } catch (error) {
      console.error('Failed to parse V2 storage:', error)
    }
  }

  // No V2, check if migration needed
  const migrationResult = performMigration()
  return migrationResult?.players ?? null
}

/**
 * Save V2 storage
 */
export function savePlayerStorage(storage: PlayerStorageV2): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(storage))
  } catch (error) {
    console.error('Failed to save player storage:', error)
  }
}
