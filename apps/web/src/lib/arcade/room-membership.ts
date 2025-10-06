/**
 * Room membership manager
 * Handles database operations for room members
 */

import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'

export interface AddMemberOptions {
  roomId: string
  userId: string // User/guest ID
  displayName: string
  isCreator?: boolean
}

/**
 * Add a member to a room
 */
export async function addRoomMember(options: AddMemberOptions): Promise<schema.RoomMember> {
  const now = new Date()

  // Check if member already exists
  const existing = await getRoomMember(options.roomId, options.userId)
  if (existing) {
    // Update lastSeen and isOnline
    const [updated] = await db
      .update(schema.roomMembers)
      .set({
        isOnline: true,
        lastSeen: now,
      })
      .where(eq(schema.roomMembers.id, existing.id))
      .returning()
    return updated
  }

  const newMember: schema.NewRoomMember = {
    roomId: options.roomId,
    userId: options.userId,
    displayName: options.displayName,
    isCreator: options.isCreator || false,
    joinedAt: now,
    lastSeen: now,
    isOnline: true,
  }

  const [member] = await db.insert(schema.roomMembers).values(newMember).returning()
  console.log('[Room Membership] Added member:', member.userId, 'to room:', member.roomId)
  return member
}

/**
 * Get a specific room member
 */
export async function getRoomMember(
  roomId: string,
  userId: string
): Promise<schema.RoomMember | undefined> {
  return await db.query.roomMembers.findFirst({
    where: and(
      eq(schema.roomMembers.roomId, roomId),
      eq(schema.roomMembers.userId, userId)
    )
  })
}

/**
 * Get all members in a room
 */
export async function getRoomMembers(roomId: string): Promise<schema.RoomMember[]> {
  return await db.query.roomMembers.findMany({
    where: eq(schema.roomMembers.roomId, roomId),
    orderBy: schema.roomMembers.joinedAt
  })
}

/**
 * Get online members in a room
 */
export async function getOnlineRoomMembers(roomId: string): Promise<schema.RoomMember[]> {
  return await db.query.roomMembers.findMany({
    where: and(
      eq(schema.roomMembers.roomId, roomId),
      eq(schema.roomMembers.isOnline, true)
    ),
    orderBy: schema.roomMembers.joinedAt
  })
}

/**
 * Update member's online status
 */
export async function setMemberOnline(
  roomId: string,
  userId: string,
  isOnline: boolean
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
        eq(schema.roomMembers.userId, userId)
      )
    )
}

/**
 * Update member's last seen timestamp
 */
export async function touchMember(roomId: string, userId: string): Promise<void> {
  await db
    .update(schema.roomMembers)
    .set({ lastSeen: new Date() })
    .where(
      and(
        eq(schema.roomMembers.roomId, roomId),
        eq(schema.roomMembers.userId, userId)
      )
    )
}

/**
 * Remove a member from a room
 */
export async function removeMember(roomId: string, userId: string): Promise<void> {
  await db
    .delete(schema.roomMembers)
    .where(
      and(
        eq(schema.roomMembers.roomId, roomId),
        eq(schema.roomMembers.userId, userId)
      )
    )
  console.log('[Room Membership] Removed member:', userId, 'from room:', roomId)
}

/**
 * Remove all members from a room
 */
export async function removeAllMembers(roomId: string): Promise<void> {
  await db.delete(schema.roomMembers).where(eq(schema.roomMembers.roomId, roomId))
  console.log('[Room Membership] Removed all members from room:', roomId)
}

/**
 * Get count of online members in a room
 */
export async function getOnlineMemberCount(roomId: string): Promise<number> {
  const members = await getOnlineRoomMembers(roomId)
  return members.length
}

/**
 * Check if a user is a member of a room
 */
export async function isMember(roomId: string, userId: string): Promise<boolean> {
  const member = await getRoomMember(roomId, userId)
  return !!member
}

/**
 * Get all rooms a user is a member of
 */
export async function getUserRooms(userId: string): Promise<string[]> {
  const memberships = await db.query.roomMembers.findMany({
    where: eq(schema.roomMembers.userId, userId),
    columns: { roomId: true }
  })
  return memberships.map(m => m.roomId)
}
