/**
 * Player manager for arcade rooms
 * Handles fetching and validating player participation in rooms
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { Player } from '@/db/schema/players'

/**
 * Get a user's active players
 * These are the players that will participate when the user joins a game
 * @param viewerId - The guestId from the cookie (same as what getViewerId() returns)
 */
export async function getActivePlayers(viewerId: string): Promise<Player[]> {
  // First get the user record by guestId
  const user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    return []
  }

  // Now query players by the actual user.id
  return await db.query.players.findMany({
    where: and(eq(schema.players.userId, user.id), eq(schema.players.isActive, true)),
    orderBy: schema.players.createdAt,
  })
}

/**
 * Get all active players for all members in a room
 * Returns a map of userId -> Player[]
 */
export async function getRoomActivePlayers(roomId: string): Promise<Map<string, Player[]>> {
  // Get all room members
  const members = await db.query.roomMembers.findMany({
    where: eq(schema.roomMembers.roomId, roomId),
  })

  // Fetch active players for each member
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
