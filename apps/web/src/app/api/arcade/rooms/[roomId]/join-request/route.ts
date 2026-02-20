import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { createJoinRequest, getJoinRequest } from '@/lib/arcade/room-join-requests'
import { withAuth } from '@/lib/auth/withAuth'
import { getDbUserId } from '@/lib/viewer'
import { getSocketIO } from '@/lib/socket-io'

/**
 * POST /api/arcade/rooms/:roomId/join-request
 * Request to join an approval-only room
 * Body:
 *   - userName: string
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { roomId } = (await params) as { roomId: string }
    const userId = await getDbUserId()
    const body = await request.json()

    // Validate required fields
    if (!body.userName) {
      return NextResponse.json({ error: 'Missing required field: userName' }, { status: 400 })
    }

    // Get room details
    const [room] = await db
      .select()
      .from(schema.arcadeRooms)
      .where(eq(schema.arcadeRooms.id, roomId))
      .limit(1)

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if room is approval-only
    if (room.accessMode !== 'approval-only') {
      return NextResponse.json(
        { error: 'This room does not require approval to join' },
        { status: 400 }
      )
    }

    // Check if user is already in the room
    const members = await getRoomMembers(roomId)
    const existingMember = members.find((m) => m.userId === userId)
    if (existingMember) {
      return NextResponse.json({ error: 'You are already in this room' }, { status: 400 })
    }

    // Check if user already has a pending request
    const existingRequest = await getJoinRequest(roomId, userId)
    if (existingRequest && existingRequest.status === 'pending') {
      return NextResponse.json(
        { error: 'You already have a pending join request' },
        { status: 400 }
      )
    }

    // Create join request
    const joinRequest = await createJoinRequest({
      roomId,
      userId: userId,
      userName: body.userName,
    })

    // Broadcast to host via socket
    const io = await getSocketIO()
    if (io) {
      try {
        // Get host user ID
        const host = members.find((m) => m.isCreator)
        if (host) {
          io.to(`user:${host.userId}`).emit('join-request-received', {
            roomId,
            request: {
              id: joinRequest.id,
              userId: joinRequest.userId,
              userName: joinRequest.userName,
              requestedAt: joinRequest.requestedAt,
            },
          })
        }

        console.log(`[Join Request API] User ${userId} requested to join room ${roomId}`)
      } catch (socketError) {
        console.error('[Join Request API] Failed to broadcast request:', socketError)
      }
    }

    return NextResponse.json({ request: joinRequest }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to create join request:', error)
    return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 })
  }
})
