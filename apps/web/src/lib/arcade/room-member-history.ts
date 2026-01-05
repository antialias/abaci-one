/**
 * Room Member History Manager
 * Tracks all users who have ever been in a room
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Record or update a user's membership in room history
 * This is append-only for new users, or updates the lastAction for existing users
 */
export async function recordRoomMemberHistory(params: {
  roomId: string;
  userId: string;
  displayName: string;
  action: "active" | "left" | "kicked" | "banned";
}): Promise<schema.RoomMemberHistory> {
  const now = new Date();

  // Check if this user already has a history entry for this room
  const existing = await db
    .select()
    .from(schema.roomMemberHistory)
    .where(
      and(
        eq(schema.roomMemberHistory.roomId, params.roomId),
        eq(schema.roomMemberHistory.userId, params.userId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing record
    const [updated] = await db
      .update(schema.roomMemberHistory)
      .set({
        lastSeenAt: now,
        lastAction: params.action,
        lastActionAt: now,
        displayName: params.displayName, // Update display name in case it changed
      })
      .where(eq(schema.roomMemberHistory.id, existing[0].id))
      .returning();
    return updated;
  }

  // Create new history record
  const [history] = await db
    .insert(schema.roomMemberHistory)
    .values({
      roomId: params.roomId,
      userId: params.userId,
      displayName: params.displayName,
      firstJoinedAt: now,
      lastSeenAt: now,
      lastAction: params.action,
      lastActionAt: now,
    })
    .returning();

  console.log("[Room History] Recorded history:", {
    userId: params.userId,
    roomId: params.roomId,
    action: params.action,
  });

  return history;
}

/**
 * Get all historical members for a room
 */
export async function getRoomMemberHistory(
  roomId: string,
): Promise<schema.RoomMemberHistory[]> {
  return await db
    .select()
    .from(schema.roomMemberHistory)
    .where(eq(schema.roomMemberHistory.roomId, roomId))
    .orderBy(schema.roomMemberHistory.firstJoinedAt);
}

/**
 * Get history for a specific user in a room
 */
export async function getUserRoomHistory(
  roomId: string,
  userId: string,
): Promise<schema.RoomMemberHistory | undefined> {
  const results = await db
    .select()
    .from(schema.roomMemberHistory)
    .where(
      and(
        eq(schema.roomMemberHistory.roomId, roomId),
        eq(schema.roomMemberHistory.userId, userId),
      ),
    )
    .limit(1);

  return results[0];
}

/**
 * Update the last action for a user in a room
 */
export async function updateRoomMemberAction(
  roomId: string,
  userId: string,
  action: "active" | "left" | "kicked" | "banned",
): Promise<void> {
  const now = new Date();

  await db
    .update(schema.roomMemberHistory)
    .set({
      lastAction: action,
      lastActionAt: now,
      lastSeenAt: now,
    })
    .where(
      and(
        eq(schema.roomMemberHistory.roomId, roomId),
        eq(schema.roomMemberHistory.userId, userId),
      ),
    );

  console.log("[Room History] Updated action:", { userId, roomId, action });
}

export interface HistoricalMemberWithStatus {
  userId: string;
  displayName: string;
  firstJoinedAt: Date;
  lastSeenAt: Date;
  status: "active" | "banned" | "kicked" | "left";
  isCurrentlyInRoom: boolean;
  isBanned: boolean;
  banDetails?: {
    reason: string;
    bannedBy: string;
    bannedByName: string;
    bannedAt: Date;
  };
  invitationStatus?: "pending" | "accepted" | "declined" | "expired" | null;
}

/**
 * Get all historical members with their current status
 * Combines data from history, current members, bans, and invitations
 */
export async function getRoomHistoricalMembersWithStatus(
  roomId: string,
): Promise<HistoricalMemberWithStatus[]> {
  // Get all historical members
  const history = await getRoomMemberHistory(roomId);

  // Get current members
  const currentMembers = await db
    .select()
    .from(schema.roomMembers)
    .where(eq(schema.roomMembers.roomId, roomId));

  const currentMemberIds = new Set(currentMembers.map((m) => m.userId));

  // Get all bans
  const bans = await db
    .select()
    .from(schema.roomBans)
    .where(eq(schema.roomBans.roomId, roomId));

  const banMap = new Map(bans.map((ban) => [ban.userId, ban]));

  // Get all invitations
  const invitations = await db
    .select()
    .from(schema.roomInvitations)
    .where(eq(schema.roomInvitations.roomId, roomId));

  const invitationMap = new Map(invitations.map((inv) => [inv.userId, inv]));

  // Combine into result
  const results: HistoricalMemberWithStatus[] = history.map((h) => {
    const isCurrentlyInRoom = currentMemberIds.has(h.userId);
    const ban = banMap.get(h.userId);
    const invitation = invitationMap.get(h.userId);

    // Determine current status
    let status: "active" | "banned" | "kicked" | "left";
    if (ban) {
      status = "banned";
    } else if (isCurrentlyInRoom) {
      status = "active";
    } else {
      status = h.lastAction; // Use the recorded action from history
    }

    return {
      userId: h.userId,
      displayName: h.displayName,
      firstJoinedAt: h.firstJoinedAt,
      lastSeenAt: h.lastSeenAt,
      status,
      isCurrentlyInRoom,
      isBanned: !!ban,
      banDetails: ban
        ? {
            reason: ban.reason,
            bannedBy: ban.bannedBy,
            bannedByName: ban.bannedByName,
            bannedAt: ban.createdAt,
          }
        : undefined,
      invitationStatus: invitation?.status || null,
    };
  });

  return results;
}
