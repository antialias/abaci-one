import { NextResponse } from 'next/server'
import { getUserRooms } from '@/lib/arcade/room-membership'
import { getRoomById } from '@/lib/arcade/room-manager'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getRoomActivePlayers } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/arcade/rooms/current
 * Returns the user's current room (if any)
 */
export async function GET() {
  try {
    const userId = await getViewerId()
    console.log('[Current Room API] Fetching for user:', userId)

    // Get all rooms user is in (should be at most 1 due to modal room enforcement)
    const roomIds = await getUserRooms(userId)
    console.log('[Current Room API] User rooms:', roomIds)

    if (roomIds.length === 0) {
      console.log('[Current Room API] User is not in any room')
      return NextResponse.json({ room: null }, { status: 200 })
    }

    const roomId = roomIds[0]

    // Get room data
    const room = await getRoomById(roomId)
    if (!room) {
      console.log('[Current Room API] Room not found:', roomId)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get members
    const members = await getRoomMembers(roomId)

    // Get active players for all members
    const memberPlayers = await getRoomActivePlayers(roomId)

    // Convert Map to object for JSON serialization
    const memberPlayersObj: Record<string, any[]> = {}
    for (const [uid, players] of memberPlayers.entries()) {
      memberPlayersObj[uid] = players
    }

    console.log('[Current Room API] Returning room:', {
      roomId: room.id,
      roomName: room.name,
      memberCount: members.length,
    })

    return NextResponse.json({
      room,
      members,
      memberPlayers: memberPlayersObj,
    })
  } catch (error) {
    console.error('[Current Room API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch current room' }, { status: 500 })
  }
}
