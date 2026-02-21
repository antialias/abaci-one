import { NextResponse } from 'next/server'
import { getRoomById, isRoomCreator } from '@/lib/arcade/room-manager'
import { isMember, removeMember } from '@/lib/arcade/room-membership'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

/**
 * DELETE /api/arcade/rooms/:roomId/members/:userId
 * Kick a member from room (creator only)
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { roomId, userId } = (await params) as { roomId: string; userId: string }
    const currentUserId = await getUserId()

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if requester is room creator
    const isCreator = await isRoomCreator(roomId, currentUserId)
    if (!isCreator) {
      return NextResponse.json({ error: 'Only room creator can kick members' }, { status: 403 })
    }

    // Cannot kick self
    if (userId === currentUserId) {
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
})
