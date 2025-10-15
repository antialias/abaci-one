/**
 * Game configuration helpers
 *
 * Centralized functions for reading and writing game configs from the database.
 * Uses the room_game_configs table (one row per game per room).
 */

import { and, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db, schema } from '@/db'
import type { GameName } from './validation'
import type { GameConfigByName } from './game-configs'
import {
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_MEMORY_QUIZ_CONFIG,
  DEFAULT_COMPLEMENT_RACE_CONFIG,
} from './game-configs'

/**
 * Get default config for a game
 */
function getDefaultGameConfig(gameName: GameName): GameConfigByName[GameName] {
  switch (gameName) {
    case 'matching':
      return DEFAULT_MATCHING_CONFIG
    case 'memory-quiz':
      return DEFAULT_MEMORY_QUIZ_CONFIG
    case 'complement-race':
      return DEFAULT_COMPLEMENT_RACE_CONFIG
    default:
      throw new Error(`Unknown game: ${gameName}`)
  }
}

/**
 * Get game-specific config from database with defaults
 * Type-safe: returns the correct config type based on gameName
 */
export async function getGameConfig<T extends GameName>(
  roomId: string,
  gameName: T
): Promise<GameConfigByName[T]> {
  // Query the room_game_configs table for this specific room+game
  const configRow = await db.query.roomGameConfigs.findFirst({
    where: and(
      eq(schema.roomGameConfigs.roomId, roomId),
      eq(schema.roomGameConfigs.gameName, gameName)
    ),
  })

  // If no config exists, return defaults
  if (!configRow) {
    return getDefaultGameConfig(gameName) as GameConfigByName[T]
  }

  // Merge saved config with defaults to handle missing fields
  const defaults = getDefaultGameConfig(gameName)
  return { ...defaults, ...(configRow.config as object) } as GameConfigByName[T]
}

/**
 * Set (upsert) a game's config in the database
 * Creates a new row if it doesn't exist, updates if it does
 */
export async function setGameConfig<T extends GameName>(
  roomId: string,
  gameName: T,
  config: Partial<GameConfigByName[T]>
): Promise<void> {
  const now = new Date()

  // Check if config already exists
  const existing = await db.query.roomGameConfigs.findFirst({
    where: and(
      eq(schema.roomGameConfigs.roomId, roomId),
      eq(schema.roomGameConfigs.gameName, gameName)
    ),
  })

  if (existing) {
    // Update existing config (merge with existing values)
    const mergedConfig = { ...(existing.config as object), ...config }
    await db
      .update(schema.roomGameConfigs)
      .set({
        config: mergedConfig as any,
        updatedAt: now,
      })
      .where(eq(schema.roomGameConfigs.id, existing.id))
  } else {
    // Insert new config (merge with defaults)
    const defaults = getDefaultGameConfig(gameName)
    const mergedConfig = { ...defaults, ...config }

    await db.insert(schema.roomGameConfigs).values({
      id: createId(),
      roomId,
      gameName,
      config: mergedConfig as any,
      createdAt: now,
      updatedAt: now,
    })
  }

  console.log(`[GameConfig] Updated ${gameName} config for room ${roomId}`)
}

/**
 * Update a specific field in a game's config
 * Convenience wrapper around setGameConfig
 */
export async function updateGameConfigField<
  T extends GameName,
  K extends keyof GameConfigByName[T],
>(roomId: string, gameName: T, field: K, value: GameConfigByName[T][K]): Promise<void> {
  // Create a partial config with just the field being updated
  const partialConfig: Partial<GameConfigByName[T]> = {} as any
  ;(partialConfig as any)[field] = value
  await setGameConfig(roomId, gameName, partialConfig)
}

/**
 * Delete a game's config from the database
 * Useful when clearing game selection or cleaning up
 */
export async function deleteGameConfig(roomId: string, gameName: GameName): Promise<void> {
  await db
    .delete(schema.roomGameConfigs)
    .where(
      and(eq(schema.roomGameConfigs.roomId, roomId), eq(schema.roomGameConfigs.gameName, gameName))
    )

  console.log(`[GameConfig] Deleted ${gameName} config for room ${roomId}`)
}

/**
 * Get all game configs for a room (all games)
 * Returns a map of gameName -> config
 */
export async function getAllGameConfigs(
  roomId: string
): Promise<Partial<Record<GameName, unknown>>> {
  const configs = await db.query.roomGameConfigs.findMany({
    where: eq(schema.roomGameConfigs.roomId, roomId),
  })

  const result: Partial<Record<GameName, unknown>> = {}
  for (const config of configs) {
    result[config.gameName as GameName] = config.config
  }

  return result
}

/**
 * Delete all game configs for a room
 * Called when deleting a room (cascade should handle this, but useful for explicit cleanup)
 */
export async function deleteAllGameConfigs(roomId: string): Promise<void> {
  await db.delete(schema.roomGameConfigs).where(eq(schema.roomGameConfigs.roomId, roomId))
  console.log(`[GameConfig] Deleted all configs for room ${roomId}`)
}

/**
 * Validate a game config at runtime
 * Returns true if the config is valid for the given game
 */
export function validateGameConfig(gameName: GameName, config: any): boolean {
  switch (gameName) {
    case 'matching':
      return (
        typeof config === 'object' &&
        config !== null &&
        ['abacus-numeral', 'complement-pairs'].includes(config.gameType) &&
        typeof config.difficulty === 'number' &&
        [6, 8, 12, 15].includes(config.difficulty) &&
        typeof config.turnTimer === 'number' &&
        config.turnTimer >= 5 &&
        config.turnTimer <= 300
      )

    case 'memory-quiz':
      return (
        typeof config === 'object' &&
        config !== null &&
        [2, 5, 8, 12, 15].includes(config.selectedCount) &&
        typeof config.displayTime === 'number' &&
        config.displayTime > 0 &&
        ['beginner', 'easy', 'medium', 'hard', 'expert'].includes(config.selectedDifficulty) &&
        ['cooperative', 'competitive'].includes(config.playMode)
      )

    case 'complement-race':
      // TODO: Add validation when complement-race settings are defined
      return typeof config === 'object' && config !== null

    default:
      return false
  }
}
