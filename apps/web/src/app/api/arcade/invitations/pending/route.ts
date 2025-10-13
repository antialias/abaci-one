import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/arcade/invitations/pending
 * Get all pending invitations for the current user with room details
 */
export async function GET(req: NextRequest) {
  try {
    const viewerId = await getViewerId()

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
      .where(eq(schema.roomInvitations.userId, viewerId))
      .orderBy(schema.roomInvitations.createdAt)

    // Filter to only pending invitations
    const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')

    return NextResponse.json({ invitations: pendingInvitations }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to get pending invitations:', error)
    return NextResponse.json({ error: 'Failed to get pending invitations' }, { status: 500 })
  }
}
