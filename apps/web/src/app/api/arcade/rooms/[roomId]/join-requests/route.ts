import { type NextRequest, NextResponse } from 'next/server'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getPendingJoinRequests } from '@/lib/arcade/room-join-requests'
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
