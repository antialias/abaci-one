import { type NextRequest, NextResponse } from 'next/server'
import { getRoomById, touchRoom } from '@/lib/arcade/room-manager'
import { addRoomMember } from '@/lib/arcade/room-membership'
import { getActivePlayers } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * POST /api/arcade/rooms/:roomId/join
 * Join a room
 * Body:
 *   - displayName?: string (optional, will generate from viewerId if not provided)
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

    // Check if room is locked
    if (room.isLocked) {
      return NextResponse.json({ error: 'Room is locked' }, { status: 403 })
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
