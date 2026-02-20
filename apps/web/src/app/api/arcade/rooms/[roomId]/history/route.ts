import { NextResponse } from 'next/server'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getRoomHistoricalMembersWithStatus } from '@/lib/arcade/room-member-history'
import { withAuth } from '@/lib/auth/withAuth'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/arcade/rooms/:roomId/history
 * Get all historical members with their current status (host only)
 * Returns: array of historical members with status info
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { roomId } = (await params) as { roomId: string }
    const userId = await getDbUserId()

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === userId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json({ error: 'Only the host can view room history' }, { status: 403 })
    }

    // Get all historical members with status
    const historicalMembers = await getRoomHistoricalMembersWithStatus(roomId)

    return NextResponse.json({ historicalMembers }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to get room history:', error)
    return NextResponse.json({ error: 'Failed to get room history' }, { status: 500 })
  }
})
