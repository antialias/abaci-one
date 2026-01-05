/**
 * Client-side player ownership utilities
 *
 * This module contains ONLY client-safe utilities that can be imported
 * from client components without pulling in database code.
 */

import type { RoomData } from "@/hooks/useRoomData";

/**
 * Map of player IDs to user IDs
 * Key: playerId (database player.id)
 * Value: userId (database user.id)
 */
export type PlayerOwnershipMap = Record<string, string>;

/**
 * Player metadata for display purposes
 * Combines ownership info with display properties
 */
export interface PlayerMetadata {
  id: string;
  name: string;
  emoji: string;
  color: string;
  userId: string;
}

// ============================================================================
// CLIENT-SIDE UTILITIES (sync, in-memory)
// ============================================================================

/**
 * Build player ownership map from RoomData
 *
 * Client-side utility that extracts ownership information from the
 * RoomData structure (fetched from API or received via WebSocket).
 *
 * @param roomData - Room data containing memberPlayers mapping
 * @returns Map of playerId -> userId
 *
 * @example
 * ```ts
 * const { roomData } = useRoomData()
 * const ownership = buildPlayerOwnershipFromRoomData(roomData)
 * ```
 */
export function buildPlayerOwnershipFromRoomData(
  roomData: RoomData | null | undefined,
): PlayerOwnershipMap {
  if (!roomData?.memberPlayers) {
    return {};
  }

  const ownership: PlayerOwnershipMap = {};

  // Iterate over each user's players
  for (const [userId, userPlayers] of Object.entries(roomData.memberPlayers)) {
    for (const player of userPlayers) {
      ownership[player.id] = userId;
    }
  }

  return ownership;
}

// ============================================================================
// SHARED HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a player is owned by a specific user
 *
 * @param playerId - The player ID to check
 * @param userId - The user ID to check against
 * @param ownershipMap - The ownership map (from buildPlayerOwnershipMap or buildPlayerOwnershipFromRoomData)
 * @returns true if the player belongs to the user
 *
 * @example
 * ```ts
 * const canFlip = isPlayerOwnedByUser(currentPlayer, viewerId, ownershipMap)
 * ```
 */
export function isPlayerOwnedByUser(
  playerId: string,
  userId: string,
  ownershipMap: PlayerOwnershipMap,
): boolean {
  return ownershipMap[playerId] === userId;
}

/**
 * Get the owner user ID for a player
 *
 * @param playerId - The player ID to look up
 * @param ownershipMap - The ownership map
 * @returns The user ID that owns this player, or undefined if not found
 *
 * @example
 * ```ts
 * const ownerId = getPlayerOwner(playerId, ownershipMap)
 * if (ownerId === viewerId) {
 *   // Player belongs to current viewer
 * }
 * ```
 */
export function getPlayerOwner(
  playerId: string,
  ownershipMap: PlayerOwnershipMap,
): string | undefined {
  return ownershipMap[playerId];
}

/**
 * Build player metadata with correct userId ownership
 *
 * Combines player display data with ownership information to create
 * a complete metadata object for game state synchronization.
 *
 * @param playerIds - Array of player IDs to include
 * @param ownershipMap - The ownership map
 * @param playersMap - Map of playerId -> player display data
 * @returns Record of playerId -> PlayerMetadata
 *
 * @example
 * ```ts
 * const metadata = buildPlayerMetadata(
 *   activePlayers,
 *   ownershipMap,
 *   players // from GameModeContext
 * )
 * ```
 */
export function buildPlayerMetadata(
  playerIds: string[],
  ownershipMap: PlayerOwnershipMap,
  playersMap: Map<string, { name: string; emoji: string; color: string }>,
  fallbackUserId?: string,
): Record<string, PlayerMetadata> {
  const metadata: Record<string, PlayerMetadata> = {};

  for (const playerId of playerIds) {
    const playerData = playersMap.get(playerId);
    if (playerData) {
      // Get the actual owner userId from ownership map, or use fallback
      const ownerUserId = ownershipMap[playerId] || fallbackUserId || "";

      metadata[playerId] = {
        id: playerId,
        name: playerData.name,
        emoji: playerData.emoji,
        color: playerData.color,
        userId: ownerUserId, // Correct: Use actual owner's userId
      };
    }
  }

  return metadata;
}

/**
 * Filter players owned by a specific user
 *
 * @param playerIds - Array of player IDs to filter
 * @param userId - The user ID to filter by
 * @param ownershipMap - The ownership map
 * @returns Array of player IDs owned by the user
 *
 * @example
 * ```ts
 * const myPlayers = filterPlayersByOwner(allPlayerIds, viewerId, ownershipMap)
 * ```
 */
export function filterPlayersByOwner(
  playerIds: string[],
  userId: string,
  ownershipMap: PlayerOwnershipMap,
): string[] {
  return playerIds.filter((playerId) => ownershipMap[playerId] === userId);
}

/**
 * Get all unique user IDs from an ownership map
 *
 * @param ownershipMap - The ownership map
 * @returns Array of unique user IDs
 *
 * @example
 * ```ts
 * const userIds = getUniqueOwners(ownershipMap)
 * console.log(`Game has ${userIds.length} players`)
 * ```
 */
export function getUniqueOwners(ownershipMap: PlayerOwnershipMap): string[] {
  return Array.from(new Set(Object.values(ownershipMap)));
}

/**
 * Group player IDs by their owner user ID
 *
 * @param playerIds - Array of player IDs to group
 * @param ownershipMap - The ownership map
 * @returns Map of userId -> player IDs
 *
 * @example
 * ```ts
 * const playersByUser = groupPlayersByOwner(activePlayers, ownershipMap)
 * for (const [userId, userPlayers] of playersByUser.entries()) {
 *   console.log(`User ${userId} has ${userPlayers.length} players`)
 * }
 * ```
 */
export function groupPlayersByOwner(
  playerIds: string[],
  ownershipMap: PlayerOwnershipMap,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const playerId of playerIds) {
    const ownerId = ownershipMap[playerId];
    if (ownerId) {
      const existing = groups.get(ownerId) || [];
      existing.push(playerId);
      groups.set(ownerId, existing);
    }
  }

  return groups;
}
