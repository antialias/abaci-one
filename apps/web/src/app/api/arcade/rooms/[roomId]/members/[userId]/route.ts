import { type NextRequest, NextResponse } from 'next/server'
import { getRoomById, isRoomCreator } from '@/lib/arcade/room-manager'
import { isMember, removeMember } from '@/lib/arcade/room-membership'
import { getViewerId } from '@/lib/viewer'

type RouteContext = {
  params: Promise<{ roomId: string; userId: string }>
}

/**
 * DELETE /api/arcade/rooms/:roomId/members/:userId
 * Kick a member from room (creator only)
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { roomId, userId } = await context.params
    const viewerId = await getViewerId()

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if requester is room creator
    const isCreator = await isRoomCreator(roomId, viewerId)
    if (!isCreator) {
      return NextResponse.json({ error: 'Only room creator can kick members' }, { status: 403 })
    }

    // Cannot kick self
    if (userId === viewerId) {
      return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 })
    }

    // Check if target user is a member
    const isTargetMember = await isMember(roomId, userId)
    if (!isTargetMember) {
      return NextResponse.json({ error: 'User is not a member of this room' }, { status: 404 })
    }

    // Remove member
    await removeMember(roomId, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to kick member:', error)
    return NextResponse.json({ error: 'Failed to kick member' }, { status: 500 })
  }
}
