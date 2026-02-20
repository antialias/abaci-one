import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { approveJoinRequest } from '@/lib/arcade/room-join-requests'
import { withAuth } from '@/lib/auth/withAuth'
import { getViewerId } from '@/lib/viewer'
import { getSocketIO } from '@/lib/socket-io'

/**
 * POST /api/arcade/rooms/:roomId/join-requests/:requestId/approve
 * Approve a join request (host only)
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { roomId, requestId } = (await params) as { roomId: string; requestId: string }
    const viewerId = await getViewerId()

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === viewerId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json(
        { error: 'Only the host can approve join requests' },
        { status: 403 }
      )
    }

    // Get the request
    const [request] = await db
      .select()
      .from(schema.roomJoinRequests)
      .where(eq(schema.roomJoinRequests.id, requestId))
      .limit(1)

    if (!request) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 })
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Join request is not pending' }, { status: 400 })
    }

    // Approve the request
    const approvedRequest = await approveJoinRequest(requestId, viewerId, currentMember.displayName)

    // Notify the requesting user via socket
    const io = await getSocketIO()
    if (io) {
      try {
        io.to(`user:${request.userId}`).emit('join-request-approved', {
          roomId,
          requestId,
          approvedBy: currentMember.displayName,
        })

        console.log(
          `[Approve Join Request API] Request ${requestId} approved for user ${request.userId} to join room ${roomId}`
        )
      } catch (socketError) {
        console.error('[Approve Join Request API] Failed to broadcast approval:', socketError)
      }
    }

    return NextResponse.json({ request: approvedRequest }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to approve join request:', error)
    return NextResponse.json({ error: 'Failed to approve join request' }, { status: 500 })
  }
})
