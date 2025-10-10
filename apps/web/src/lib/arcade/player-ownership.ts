/**
 * Server-side player ownership utilities
 *
 * This module contains database-backed utilities for server-side code.
 * For client-side code, import from player-ownership.client.ts instead.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PlayerOwnershipMap } from "./player-ownership.client";

// Re-export all client-safe utilities
export * from "./player-ownership.client";

// ============================================================================
// SERVER-SIDE UTILITIES (async, database-backed)
// ============================================================================

/**
 * Build player ownership map from database
 *
 * Fetches all players (optionally filtered by room) and creates a mapping
 * of playerId -> userId for authorization checks.
 *
 * @param roomId - Optional room ID to filter players by room membership
 * @returns Map of playerId -> userId
 *
 * @example
 * ```ts
 * // Get ownership for all players
 * const ownership = await buildPlayerOwnershipMap()
 *
 * // Get ownership for players in a specific room
 * const roomOwnership = await buildPlayerOwnershipMap('room-123')
 * ```
 */
export async function buildPlayerOwnershipMap(
  roomId?: string,
): Promise<PlayerOwnershipMap> {
  let players: Array<{ id: string; userId: string }>;

  if (roomId) {
    // Fetch players who belong to users that are members of this room
    const members = await db.query.roomMembers.findMany({
      where: eq(schema.roomMembers.roomId, roomId),
      columns: { userId: true },
    });

    const memberUserIds = members.map((m) => m.userId);

    // Fetch all players belonging to room members
    players = await db.query.players.findMany({
      columns: { id: true, userId: true },
    });

    // Filter to only players owned by room members
    players = players.filter((p) => memberUserIds.includes(p.userId));
  } else {
    // Fetch all players
    players = await db.query.players.findMany({
      columns: { id: true, userId: true },
    });
  }

  return Object.fromEntries(players.map((p) => [p.id, p.userId]));
}
