import { NextResponse } from 'next/server'
import {
  createInvitation,
  declineInvitation,
  getInvitation,
  getRoomInvitations,
} from '@/lib/arcade/room-invitations'
import { getRoomById } from '@/lib/arcade/room-manager'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { withAuth } from '@/lib/auth/withAuth'
import { getSocketIO } from '@/lib/socket-io'
import { getDbUserId } from '@/lib/viewer'

/**
 * POST /api/arcade/rooms/:roomId/invite
 * Send an invitation to a user (host only)
 * Body:
 *   - userId: string
 *   - userName: string
 *   - message?: string (optional)
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { roomId } = (await params) as { roomId: string }
    const userId = await getDbUserId()
    const body = await request.json()

    // Validate required fields
    if (!body.userId || !body.userName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, userName' },
        { status: 400 }
      )
    }

    // Get room to check access mode
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Cannot invite to retired rooms
    if (room.accessMode === 'retired') {
      return NextResponse.json(
        { error: 'Cannot send invitations to retired rooms' },
        { status: 403 }
      )
    }

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === userId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json({ error: 'Only the host can send invitations' }, { status: 403 })
    }

    // Can't invite yourself
    if (body.userId === userId) {
      return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })
    }

    // Can't invite someone who's already in the room
    const targetUser = members.find((m) => m.userId === body.userId)
    if (targetUser) {
      return NextResponse.json({ error: 'User is already in this room' }, { status: 400 })
    }

    // Create invitation
    const invitation = await createInvitation({
      roomId,
      userId: body.userId,
      userName: body.userName,
      invitedBy: userId,
      invitedByName: currentMember.displayName,
      invitationType: 'manual',
      message: body.message,
    })

    // Broadcast invitation via socket
    const io = await getSocketIO()
    if (io) {
      try {
        // Send to the invited user's channel
        io.to(`user:${body.userId}`).emit('room-invitation-received', {
          invitation: {
            id: invitation.id,
            roomId: invitation.roomId,
            invitedBy: invitation.invitedBy,
            invitedByName: invitation.invitedByName,
            message: invitation.message,
            createdAt: invitation.createdAt,
          },
        })

        console.log(`[Invite API] Sent invitation to user ${body.userId} for room ${roomId}`)
      } catch (socketError) {
        console.error('[Invite API] Failed to broadcast invitation:', socketError)
      }
    }

    return NextResponse.json({ invitation }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to send invitation:', error)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
  }
})

/**
 * GET /api/arcade/rooms/:roomId/invite
 * Get all invitations for a room (host only)
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { roomId } = (await params) as { roomId: string }
    const userId = await getDbUserId()

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === userId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json({ error: 'Only the host can view invitations' }, { status: 403 })
    }

    // Get all invitations
    const invitations = await getRoomInvitations(roomId)

    return NextResponse.json({ invitations }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to get invitations:', error)
    return NextResponse.json({ error: 'Failed to get invitations' }, { status: 500 })
  }
})

/**
 * DELETE /api/arcade/rooms/:roomId/invite
 * Decline an invitation (invited user only)
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { roomId } = (await params) as { roomId: string }
    const userId = await getDbUserId()

    // Check if there's an invitation for this user
    const invitation = await getInvitation(roomId, userId)

    if (!invitation) {
      return NextResponse.json({ error: 'No invitation found for this room' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is not pending' }, { status: 400 })
    }

    // Decline the invitation
    await declineInvitation(invitation.id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to decline invitation:', error)
    return NextResponse.json({ error: 'Failed to decline invitation' }, { status: 500 })
  }
})
