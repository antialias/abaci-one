import { type NextRequest, NextResponse } from 'next/server'
import { createJoinRequest, getPendingJoinRequests } from '@/lib/arcade/room-join-requests'
import { getRoomById } from '@/lib/arcade/room-manager'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getSocketIO } from '@/lib/socket-io'
import { getViewerId } from '@/lib/viewer'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * GET /api/arcade/rooms/:roomId/join-requests
 * Get all pending join requests for a room (host only)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === viewerId)

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
}

/**
 * POST /api/arcade/rooms/:roomId/join-requests
 * Create a join request for an approval-only room
 * Body:
 *   - displayName?: string (optional, will generate from viewerId if not provided)
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()
    const body = await req.json().catch(() => ({}))

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
    const displayName = body.displayName || `Guest ${viewerId.slice(-4)}`

    // Validate display name length
    if (displayName.length > 50) {
      return NextResponse.json(
        { error: 'Display name too long (max 50 characters)' },
        { status: 400 }
      )
    }

    // Create join request
    const request = await createJoinRequest({
      roomId,
      userId: viewerId,
      userName: displayName,
    })

    console.log(
      `[Join Requests] Created request for user ${viewerId} (${displayName}) to join room ${roomId}`
    )

    // Broadcast to all members in the room (particularly the host) via socket
    const io = await getSocketIO()
    if (io) {
      try {
        io.to(`room:${roomId}`).emit('join-request-submitted', {
          roomId,
          request: {
            id: request.id,
            userId: request.userId,
            userName: request.userName,
            createdAt: request.requestedAt,
          },
        })

        console.log(
          `[Join Requests] Broadcasted join-request-submitted for user ${viewerId} to room ${roomId}`
        )
      } catch (socketError) {
        // Log but don't fail the request if socket broadcast fails
        console.error('[Join Requests] Failed to broadcast join-request-submitted:', socketError)
      }
    }

    return NextResponse.json({ request }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create join request:', error)
    return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 })
  }
}
