/**
 * Room membership manager
 * Handles database operations for room members
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordRoomMemberHistory } from "./room-member-history";

export interface AddMemberOptions {
  roomId: string;
  userId: string; // User/guest ID
  displayName: string;
  isCreator?: boolean;
}

export interface AutoLeaveResult {
  leftRooms: string[]; // Room IDs user was removed from
  previousRoomMembers: Array<{ roomId: string; member: schema.RoomMember }>;
}

/**
 * Add a member to a room
 * Automatically removes user from any other rooms they're in (modal room enforcement)
 * Returns the new membership and info about rooms that were auto-left
 */
export async function addRoomMember(
  options: AddMemberOptions,
): Promise<{ member: schema.RoomMember; autoLeaveResult?: AutoLeaveResult }> {
  const now = new Date();

  // Check if member already exists in THIS room
  const existing = await getRoomMember(options.roomId, options.userId);
  if (existing) {
    // Already in this room - just update status (no auto-leave needed)
    const [updated] = await db
      .update(schema.roomMembers)
      .set({
        isOnline: true,
        lastSeen: now,
      })
      .where(eq(schema.roomMembers.id, existing.id))
      .returning();
    return { member: updated };
  }

  // AUTO-LEAVE LOGIC: Remove from all other rooms before joining this one
  const currentRooms = await getUserRooms(options.userId);
  const autoLeaveResult: AutoLeaveResult = {
    leftRooms: [],
    previousRoomMembers: [],
  };

  for (const roomId of currentRooms) {
    if (roomId !== options.roomId) {
      // Get member info before removing (for socket events)
      const memberToRemove = await getRoomMember(roomId, options.userId);
      if (memberToRemove) {
        autoLeaveResult.previousRoomMembers.push({
          roomId,
          member: memberToRemove,
        });
      }

      // Remove from room
      await removeMember(roomId, options.userId);
      autoLeaveResult.leftRooms.push(roomId);
      console.log(
        `[Room Membership] Auto-left room ${roomId} for user ${options.userId}`,
      );
    }
  }

  // Now add to new room
  const newMember: schema.NewRoomMember = {
    roomId: options.roomId,
    userId: options.userId,
    displayName: options.displayName,
    isCreator: options.isCreator || false,
    joinedAt: now,
    lastSeen: now,
    isOnline: true,
  };

  try {
    const [member] = await db
      .insert(schema.roomMembers)
      .values(newMember)
      .returning();
    console.log(
      "[Room Membership] Added member:",
      member.userId,
      "to room:",
      member.roomId,
    );

    // Record in history
    await recordRoomMemberHistory({
      roomId: options.roomId,
      userId: options.userId,
      displayName: options.displayName,
      action: "active",
    });

    return {
      member,
      autoLeaveResult:
        autoLeaveResult.leftRooms.length > 0 ? autoLeaveResult : undefined,
    };
  } catch (error: any) {
    // Handle unique constraint violation
    // This should rarely happen due to auto-leave logic above, but catch it for safety
    if (
      error.code === "SQLITE_CONSTRAINT" ||
      error.message?.includes("UNIQUE") ||
      error.message?.includes("unique")
    ) {
      console.error(
        "[Room Membership] Unique constraint violation:",
        error.message,
      );
      throw new Error(
        "ROOM_MEMBERSHIP_CONFLICT: User is already in another room. This should have been handled by auto-leave logic.",
      );
    }
    throw error;
  }
}

/**
 * Get a specific room member
 */
export async function getRoomMember(
  roomId: string,
  userId: string,
): Promise<schema.RoomMember | undefined> {
  return await db.query.roomMembers.findFirst({
    where: and(
      eq(schema.roomMembers.roomId, roomId),
      eq(schema.roomMembers.userId, userId),
    ),
  });
}

/**
 * Get all members in a room
 */
export async function getRoomMembers(
  roomId: string,
): Promise<schema.RoomMember[]> {
  return await db.query.roomMembers.findMany({
    where: eq(schema.roomMembers.roomId, roomId),
    orderBy: schema.roomMembers.joinedAt,
  });
}

/**
 * Get online members in a room
 */
export async function getOnlineRoomMembers(
  roomId: string,
): Promise<schema.RoomMember[]> {
  return await db.query.roomMembers.findMany({
    where: and(
      eq(schema.roomMembers.roomId, roomId),
      eq(schema.roomMembers.isOnline, true),
    ),
    orderBy: schema.roomMembers.joinedAt,
  });
}

/**
 * Update member's online status
 */
export async function setMemberOnline(
  roomId: string,
  userId: string,
  isOnline: boolean,
): Promise<void> {
  await db
    .update(schema.roomMembers)
    .set({
      isOnline,
      lastSeen: new Date(),
    })
    .where(
      and(
        eq(schema.roomMembers.roomId, roomId),
        eq(schema.roomMembers.userId, userId),
      ),
    );
}

/**
 * Update member's last seen timestamp
 */
export async function touchMember(
  roomId: string,
  userId: string,
): Promise<void> {
  await db
    .update(schema.roomMembers)
    .set({ lastSeen: new Date() })
    .where(
      and(
        eq(schema.roomMembers.roomId, roomId),
        eq(schema.roomMembers.userId, userId),
      ),
    );
}

/**
 * Remove a member from a room
 * Note: This only removes from active members. History is preserved.
 * Use updateRoomMemberAction from room-member-history to set the reason (left/kicked/banned)
 */
export async function removeMember(
  roomId: string,
  userId: string,
): Promise<void> {
  // Get member info before deleting
  const member = await getRoomMember(roomId, userId);

  await db
    .delete(schema.roomMembers)
    .where(
      and(
        eq(schema.roomMembers.roomId, roomId),
        eq(schema.roomMembers.userId, userId),
      ),
    );
  console.log(
    "[Room Membership] Removed member:",
    userId,
    "from room:",
    roomId,
  );

  // Update history to show they left (default action)
  // This can be overridden by kick/ban functions
  if (member) {
    await recordRoomMemberHistory({
      roomId,
      userId,
      displayName: member.displayName,
      action: "left",
    });
  }
}

/**
 * Remove all members from a room
 */
export async function removeAllMembers(roomId: string): Promise<void> {
  await db
    .delete(schema.roomMembers)
    .where(eq(schema.roomMembers.roomId, roomId));
  console.log("[Room Membership] Removed all members from room:", roomId);
}

/**
 * Get count of online members in a room
 */
export async function getOnlineMemberCount(roomId: string): Promise<number> {
  const members = await getOnlineRoomMembers(roomId);
  return members.length;
}

/**
 * Check if a user is a member of a room
 */
export async function isMember(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const member = await getRoomMember(roomId, userId);
  return !!member;
}

/**
 * Get all rooms a user is a member of
 */
export async function getUserRooms(userId: string): Promise<string[]> {
  const memberships = await db.query.roomMembers.findMany({
    where: eq(schema.roomMembers.userId, userId),
    columns: { roomId: true },
  });
  return memberships.map((m) => m.roomId);
}
