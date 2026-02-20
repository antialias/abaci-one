import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/arcade/invitations/pending
 * Get all pending invitations for the current user with room details
 * Excludes invitations for rooms where the user is currently banned
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getDbUserId()

    // Get pending invitations with room details
    const invitations = await db
      .select({
        id: schema.roomInvitations.id,
        roomId: schema.roomInvitations.roomId,
        roomName: schema.arcadeRooms.name,
        roomGameName: schema.arcadeRooms.gameName,
        userId: schema.roomInvitations.userId,
        userName: schema.roomInvitations.userName,
        invitedBy: schema.roomInvitations.invitedBy,
        invitedByName: schema.roomInvitations.invitedByName,
        status: schema.roomInvitations.status,
        invitationType: schema.roomInvitations.invitationType,
        message: schema.roomInvitations.message,
        createdAt: schema.roomInvitations.createdAt,
        expiresAt: schema.roomInvitations.expiresAt,
      })
      .from(schema.roomInvitations)
      .innerJoin(schema.arcadeRooms, eq(schema.roomInvitations.roomId, schema.arcadeRooms.id))
      .where(eq(schema.roomInvitations.userId, userId))
      .orderBy(schema.roomInvitations.createdAt)

    // Get all active bans for this user (bans are deleted when unbanned, so any existing ban is active)
    const activeBans = await db
      .select({ roomId: schema.roomBans.roomId })
      .from(schema.roomBans)
      .where(eq(schema.roomBans.userId, userId))

    const bannedRoomIds = new Set(activeBans.map((ban) => ban.roomId))

    // Filter to only pending invitations, excluding banned rooms
    const pendingInvitations = invitations.filter(
      (inv) => inv.status === 'pending' && !bannedRoomIds.has(inv.roomId)
    )

    return NextResponse.json({ invitations: pendingInvitations }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to get pending invitations:', error)
    return NextResponse.json({ error: 'Failed to get pending invitations' }, { status: 500 })
  }
})
