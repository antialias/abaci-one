import { type NextRequest, NextResponse } from 'next/server'
import { kickUserFromRoom } from '@/lib/arcade/room-moderation'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getRoomActivePlayers } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'
import { getSocketIO } from '@/lib/socket-io'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * POST /api/arcade/rooms/:roomId/kick
 * Kick a user from the room (host only)
 * Body:
 *   - userId: string
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()
    const body = await req.json()

    // Validate required fields
    if (!body.userId) {
      return NextResponse.json({ error: 'Missing required field: userId' }, { status: 400 })
    }

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === viewerId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json({ error: 'Only the host can kick users' }, { status: 403 })
    }

    // Can't kick yourself
    if (body.userId === viewerId) {
      return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 })
    }

    // Verify the user to kick is in the room
    const targetUser = members.find((m) => m.userId === body.userId)
    if (!targetUser) {
      return NextResponse.json({ error: 'User is not in this room' }, { status: 404 })
    }

    // Kick the user
    await kickUserFromRoom(roomId, body.userId)

    // Broadcast updates via socket
    const io = await getSocketIO()
    if (io) {
      try {
        // Get updated member list
        const updatedMembers = await getRoomMembers(roomId)
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Tell the kicked user they've been removed
        io.to(`user:${body.userId}`).emit('kicked-from-room', {
          roomId,
          kickedBy: currentMember.displayName,
        })

        // Notify everyone else in the room
        io.to(`room:${roomId}`).emit('member-left', {
          roomId,
          userId: body.userId,
          members: updatedMembers,
          memberPlayers: memberPlayersObj,
          reason: 'kicked',
        })

        console.log(`[Kick API] User ${body.userId} kicked from room ${roomId}`)
      } catch (socketError) {
        console.error('[Kick API] Failed to broadcast kick:', socketError)
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to kick user:', error)
    return NextResponse.json({ error: 'Failed to kick user' }, { status: 500 })
  }
}
