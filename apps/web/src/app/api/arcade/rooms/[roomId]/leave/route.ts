import { type NextRequest, NextResponse } from 'next/server'
import { getRoomById } from '@/lib/arcade/room-manager'
import { isMember, removeMember } from '@/lib/arcade/room-membership'
import { getViewerId } from '@/lib/viewer'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * POST /api/arcade/rooms/:roomId/leave
 * Leave a room
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if member
    const isMemberOfRoom = await isMember(roomId, viewerId)
    if (!isMemberOfRoom) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 400 })
    }

    // Remove member
    await removeMember(roomId, viewerId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to leave room:', error)
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 })
  }
}
