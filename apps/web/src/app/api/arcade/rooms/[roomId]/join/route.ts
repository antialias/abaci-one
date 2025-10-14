import bcrypt from 'bcryptjs'
import { type NextRequest, NextResponse } from 'next/server'
import { getActivePlayers, getRoomActivePlayers } from '@/lib/arcade/player-manager'
import { getInvitation } from '@/lib/arcade/room-invitations'
import { getJoinRequest } from '@/lib/arcade/room-join-requests'
import { getRoomById, touchRoom } from '@/lib/arcade/room-manager'
import { addRoomMember, getRoomMembers } from '@/lib/arcade/room-membership'
import { isUserBanned } from '@/lib/arcade/room-moderation'
import { getSocketIO } from '@/lib/socket-io'
import { getViewerId } from '@/lib/viewer'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * POST /api/arcade/rooms/:roomId/join
 * Join a room
 * Body:
 *   - displayName?: string (optional, will generate from viewerId if not provided)
 *   - password?: string (required for password-protected rooms)
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()
    const body = await req.json().catch(() => ({}))

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if user is banned
    const banned = await isUserBanned(roomId, viewerId)
    if (banned) {
      return NextResponse.json({ error: 'You are banned from this room' }, { status: 403 })
    }

    // Check if user is already a member (for locked/retired room access)
    const members = await getRoomMembers(roomId)
    const isExistingMember = members.some((m) => m.userId === viewerId)
    const isRoomCreator = room.createdBy === viewerId

    // Validate access mode
    switch (room.accessMode) {
      case 'locked':
        // Allow existing members to continue using the room, but block new members
        if (!isExistingMember) {
          return NextResponse.json(
            { error: 'This room is locked and not accepting new members' },
            { status: 403 }
          )
        }
        break

      case 'retired':
        // Only the room creator can access retired rooms
        if (!isRoomCreator) {
          return NextResponse.json(
            { error: 'This room has been retired and is only accessible to the owner' },
            { status: 410 }
          )
        }
        break

      case 'password': {
        if (!body.password) {
          return NextResponse.json(
            { error: 'Password required to join this room' },
            { status: 401 }
          )
        }
        if (!room.password) {
          return NextResponse.json({ error: 'Room password not configured' }, { status: 500 })
        }
        const passwordMatch = await bcrypt.compare(body.password, room.password)
        if (!passwordMatch) {
          return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
        }
        break
      }

      case 'restricted': {
        // Room creator can always rejoin their own room
        if (!isRoomCreator) {
          // Check for valid pending invitation
          const invitation = await getInvitation(roomId, viewerId)
          if (!invitation || invitation.status !== 'pending') {
            return NextResponse.json(
              { error: 'You need a valid invitation to join this room' },
              { status: 403 }
            )
          }
        }
        break
      }

      case 'approval-only': {
        // Room creator can always rejoin their own room without approval
        if (!isRoomCreator) {
          // Check for approved join request
          const joinRequest = await getJoinRequest(roomId, viewerId)
          if (!joinRequest || joinRequest.status !== 'approved') {
            return NextResponse.json(
              { error: 'Your join request must be approved by the host' },
              { status: 403 }
            )
          }
        }
        break
      }
      default:
        // No additional checks needed
        break
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

    // Add member (with auto-leave logic for modal room enforcement)
    const { member, autoLeaveResult } = await addRoomMember({
      roomId,
      userId: viewerId,
      displayName,
      isCreator: false,
    })

    // Fetch user's active players (these will participate in the game)
    const activePlayers = await getActivePlayers(viewerId)

    // Update room activity to refresh TTL
    await touchRoom(roomId)

    // Broadcast to all users in the room via socket
    const io = await getSocketIO()
    if (io) {
      try {
        const members = await getRoomMembers(roomId)
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Broadcast to all users in this room
        io.to(`room:${roomId}`).emit('member-joined', {
          roomId,
          userId: viewerId,
          members,
          memberPlayers: memberPlayersObj,
        })

        console.log(`[Join API] Broadcasted member-joined for user ${viewerId} in room ${roomId}`)
      } catch (socketError) {
        // Log but don't fail the request if socket broadcast fails
        console.error('[Join API] Failed to broadcast member-joined:', socketError)
      }
    }

    // Build response with auto-leave info if applicable
    return NextResponse.json(
      {
        member,
        room,
        activePlayers, // The user's active players that will join the game
        autoLeave: autoLeaveResult
          ? {
              leftRooms: autoLeaveResult.leftRooms,
              roomCount: autoLeaveResult.leftRooms.length,
              message: `You were automatically removed from ${autoLeaveResult.leftRooms.length} other room(s)`,
            }
          : undefined,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Failed to join room:', error)

    // Handle specific constraint violation error
    if (error.message?.includes('ROOM_MEMBERSHIP_CONFLICT')) {
      return NextResponse.json(
        {
          error: 'You are already in another room',
          code: 'ROOM_MEMBERSHIP_CONFLICT',
          message:
            'You can only be in one room at a time. Please leave your current room before joining a new one.',
          userMessage:
            '⚠️ Already in Another Room\n\nYou can only be in one room at a time. Please refresh the page and try again.',
        },
        { status: 409 } // 409 Conflict
      )
    }

    // Generic error
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
  }
}
