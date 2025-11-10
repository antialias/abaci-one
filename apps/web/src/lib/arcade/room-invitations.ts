/**
 * Room Invitations Manager
 * Handles invitation logic for room members
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'

export interface CreateInvitationParams {
  roomId: string
  userId: string
  userName: string
  invitedBy: string
  invitedByName: string
  invitationType: 'manual' | 'auto-unban' | 'auto-create'
  message?: string
  expiresAt?: Date
}

/**
 * Create or update an invitation
 * If a pending invitation exists, it will be replaced
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<schema.RoomInvitation> {
  const now = new Date()

  // Check if there's an existing invitation
  const existing = await db
    .select()
    .from(schema.roomInvitations)
    .where(
      and(
        eq(schema.roomInvitations.roomId, params.roomId),
        eq(schema.roomInvitations.userId, params.userId)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    // Update existing invitation
    const [updated] = await db
      .update(schema.roomInvitations)
      .set({
        userName: params.userName,
        invitedBy: params.invitedBy,
        invitedByName: params.invitedByName,
        invitationType: params.invitationType,
        message: params.message,
        status: 'pending', // Reset to pending
        createdAt: now, // Update timestamp
        respondedAt: null,
        expiresAt: params.expiresAt,
      })
      .where(eq(schema.roomInvitations.id, existing[0].id))
      .returning()

    console.log('[Room Invitations] Updated invitation:', {
      userId: params.userId,
      roomId: params.roomId,
    })

    return updated
  }

  // Create new invitation
  const [invitation] = await db
    .insert(schema.roomInvitations)
    .values({
      roomId: params.roomId,
      userId: params.userId,
      userName: params.userName,
      invitedBy: params.invitedBy,
      invitedByName: params.invitedByName,
      invitationType: params.invitationType,
      message: params.message,
      status: 'pending',
      createdAt: now,
      expiresAt: params.expiresAt,
    })
    .returning()

  console.log('[Room Invitations] Created invitation:', {
    userId: params.userId,
    roomId: params.roomId,
  })

  return invitation
}

/**
 * Get all pending invitations for a user
 */
export async function getUserPendingInvitations(userId: string): Promise<schema.RoomInvitation[]> {
  return await db
    .select()
    .from(schema.roomInvitations)
    .where(
      and(eq(schema.roomInvitations.userId, userId), eq(schema.roomInvitations.status, 'pending'))
    )
    .orderBy(schema.roomInvitations.createdAt)
}

/**
 * Get all invitations for a room
 */
export async function getRoomInvitations(roomId: string): Promise<schema.RoomInvitation[]> {
  return await db
    .select()
    .from(schema.roomInvitations)
    .where(eq(schema.roomInvitations.roomId, roomId))
    .orderBy(schema.roomInvitations.createdAt)
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(invitationId: string): Promise<schema.RoomInvitation> {
  const [invitation] = await db
    .update(schema.roomInvitations)
    .set({
      status: 'accepted',
      respondedAt: new Date(),
    })
    .where(eq(schema.roomInvitations.id, invitationId))
    .returning()

  console.log('[Room Invitations] Accepted invitation:', invitationId)

  return invitation
}

/**
 * Decline an invitation
 */
export async function declineInvitation(invitationId: string): Promise<schema.RoomInvitation> {
  const [invitation] = await db
    .update(schema.roomInvitations)
    .set({
      status: 'declined',
      respondedAt: new Date(),
    })
    .where(eq(schema.roomInvitations.id, invitationId))
    .returning()

  console.log('[Room Invitations] Declined invitation:', invitationId)

  return invitation
}

/**
 * Cancel/delete an invitation
 */
export async function cancelInvitation(roomId: string, userId: string): Promise<void> {
  await db
    .delete(schema.roomInvitations)
    .where(
      and(eq(schema.roomInvitations.roomId, roomId), eq(schema.roomInvitations.userId, userId))
    )

  console.log('[Room Invitations] Cancelled invitation:', { userId, roomId })
}

/**
 * Get a specific invitation
 */
export async function getInvitation(
  roomId: string,
  userId: string
): Promise<schema.RoomInvitation | undefined> {
  const results = await db
    .select()
    .from(schema.roomInvitations)
    .where(
      and(eq(schema.roomInvitations.roomId, roomId), eq(schema.roomInvitations.userId, userId))
    )
    .limit(1)

  return results[0]
}
