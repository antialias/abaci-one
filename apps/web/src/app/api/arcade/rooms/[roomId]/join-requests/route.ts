import { NextResponse } from 'next/server'
import { createJoinRequest, getPendingJoinRequests } from '@/lib/arcade/room-join-requests'
import { getRoomById } from '@/lib/arcade/room-manager'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { withAuth } from '@/lib/auth/withAuth'
import { getSocketIO } from '@/lib/socket-io'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/arcade/rooms/:roomId/join-requests
 * Get all pending join requests for a room (host only)
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
      return NextResponse.json({ error: 'Only the host can view join requests' }, { status: 403 })
    }

    // Get all pending requests
    const requests = await getPendingJoinRequests(roomId)

    return NextResponse.json({ requests }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to get join requests:', error)
    return NextResponse.json({ error: 'Failed to get join requests' }, { status: 500 })
  }
})

/**
 * POST /api/arcade/rooms/:roomId/join-requests
 * Create a join request for an approval-only room
 * Body:
 *   - displayName?: string (optional, will generate from userId if not provided)
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { roomId } = (await params) as { roomId: string }
    const userId = await getDbUserId()
    const body = await request.json().catch(() => ({}))

    // Get room to verify it exists
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Verify room is approval-only
    if (room.accessMode !== 'approval-only') {
      return NextResponse.json(
        { error: 'This room does not require approval to join' },
        { status: 400 }
      )
    }

    // Get or generate display name
    const displayName = body.displayName || `Guest ${userId.slice(-4)}`

    // Validate display name length
    if (displayName.length > 50) {
      return NextResponse.json(
        { error: 'Display name too long (max 50 characters)' },
        { status: 400 }
      )
    }

    // Create join request
    const joinRequest = await createJoinRequest({
      roomId,
      userId: userId,
      userName: displayName,
    })

    console.log(
      `[Join Requests] Created request for user ${userId} (${displayName}) to join room ${roomId}`
    )

    // Broadcast to the room host (creator) only via socket
    const io = await getSocketIO()
    if (io) {
      try {
        // Send notification only to the room creator's user channel
        io.to(`user:${room.createdBy}`).emit('join-request-submitted', {
          roomId,
          request: {
            id: joinRequest.id,
            userId: joinRequest.userId,
            userName: joinRequest.userName,
            createdAt: joinRequest.requestedAt,
          },
        })

        console.log(
          `[Join Requests] Broadcasted join-request-submitted to room creator ${room.createdBy}`
        )
      } catch (socketError) {
        // Log but don't fail the request if socket broadcast fails
        console.error('[Join Requests] Failed to broadcast join-request-submitted:', socketError)
      }
    }

    return NextResponse.json({ request: joinRequest }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create join request:', error)
    return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 })
  }
})
