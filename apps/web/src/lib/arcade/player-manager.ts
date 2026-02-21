/**
 * Player manager for arcade rooms
 * Handles fetching and validating player participation in rooms
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { Player } from '@/db/schema/players'

// Re-export ownership utilities for convenience
export {
  buildPlayerOwnershipMap,
  type PlayerOwnershipMap,
} from './player-ownership'

/**
 * Get all players for a user (regardless of isActive status)
 * @param userId - The database user.id (from getUserId())
 */
export async function getAllPlayers(userId: string): Promise<Player[]> {
  return await db.query.players.findMany({
    where: eq(schema.players.userId, userId),
    orderBy: schema.players.createdAt,
  })
}

/**
 * Get a user's active players (solo mode)
 * These are the players that will participate when the user joins a solo game
 * @param userId - The database user.id (from getUserId())
 */
export async function getActivePlayers(userId: string): Promise<Player[]> {
  return await db.query.players.findMany({
    where: and(eq(schema.players.userId, userId), eq(schema.players.isActive, true)),
    orderBy: schema.players.createdAt,
  })
}

/**
 * Get active players for all members in a room
 * Returns only players marked isActive=true from each room member
 * Returns a map of userId -> Player[]
 */
export async function getRoomActivePlayers(roomId: string): Promise<Map<string, Player[]>> {
  // Get all room members
  const members = await db.query.roomMembers.findMany({
    where: eq(schema.roomMembers.roomId, roomId),
  })

  // Fetch active players for each member (respects isActive flag)
  const playerMap = new Map<string, Player[]>()
  for (const member of members) {
    const players = await getActivePlayers(member.userId)
    playerMap.set(member.userId, players)
  }

  return playerMap
}

/**
 * Get all player IDs that should participate in a room game
 * Flattens the player lists from all room members
 */
export async function getRoomPlayerIds(roomId: string): Promise<string[]> {
  const playerMap = await getRoomActivePlayers(roomId)
  const allPlayers: string[] = []

  for (const players of playerMap.values()) {
    allPlayers.push(...players.map((p) => p.id))
  }

  return allPlayers
}

/**
 * Validate that a player ID belongs to a user who is a member of a room
 */
export async function validatePlayerInRoom(playerId: string, roomId: string): Promise<boolean> {
  // Get the player
  const player = await db.query.players.findFirst({
    where: eq(schema.players.id, playerId),
  })

  if (!player) return false

  // Check if the player's user is a member of the room
  const member = await db.query.roomMembers.findFirst({
    where: and(eq(schema.roomMembers.roomId, roomId), eq(schema.roomMembers.userId, player.userId)),
  })

  return !!member
}

/**
 * Get player details by ID
 */
export async function getPlayer(playerId: string): Promise<Player | undefined> {
  return await db.query.players.findFirst({
    where: eq(schema.players.id, playerId),
  })
}

/**
 * Get multiple players by IDs
 */
export async function getPlayers(playerIds: string[]): Promise<Player[]> {
  if (playerIds.length === 0) return []

  const players: Player[] = []
  for (const id of playerIds) {
    const player = await getPlayer(id)
    if (player) players.push(player)
  }

  return players
}

/**
 * Set a player's active status
 * @param playerId - The player ID
 * @param isActive - The new active status
 * @returns The updated player
 */
export async function setPlayerActiveStatus(
  playerId: string,
  isActive: boolean
): Promise<Player | undefined> {
  await db.update(schema.players).set({ isActive }).where(eq(schema.players.id, playerId))

  return await getPlayer(playerId)
}
