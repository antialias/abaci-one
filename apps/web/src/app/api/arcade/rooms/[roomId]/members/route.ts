import { type NextRequest, NextResponse } from 'next/server'
import { getRoomById } from '@/lib/arcade/room-manager'
import { getOnlineMemberCount, getRoomMembers } from '@/lib/arcade/room-membership'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * GET /api/arcade/rooms/:roomId/members
 * Get all members in a room
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get members
    const members = await getRoomMembers(roomId)
    const onlineCount = await getOnlineMemberCount(roomId)

    return NextResponse.json({
      members,
      onlineCount,
    })
  } catch (error) {
    console.error('Failed to fetch members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}
