import { type NextRequest, NextResponse } from 'next/server'
import { createRoom, listActiveRooms } from '@/lib/arcade/room-manager'
import { addRoomMember, getRoomMembers, isMember } from '@/lib/arcade/room-membership'
import { getRoomActivePlayers } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'
import type { GameName } from '@/lib/arcade/validation'

/**
 * GET /api/arcade/rooms
 * List all active public rooms (lobby view)
 * Query params:
 *   - gameName?: string - Filter by game
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const gameName = searchParams.get('gameName') as GameName | null

    const viewerId = await getViewerId()
    const rooms = await listActiveRooms(gameName || undefined)

    // Enrich with member counts, player counts, and membership status
    const roomsWithCounts = await Promise.all(
      rooms.map(async (room) => {
        const members = await getRoomMembers(room.id)
        const playerMap = await getRoomActivePlayers(room.id)
        const userIsMember = await isMember(room.id, viewerId)

        let totalPlayers = 0
        for (const players of playerMap.values()) {
          totalPlayers += players.length
        }

        return {
          id: room.id,
          name: room.name,
          code: room.code,
          gameName: room.gameName,
          status: room.status,
          createdAt: room.createdAt,
          creatorName: room.creatorName,
          isLocked: room.isLocked,
          memberCount: members.length,
          playerCount: totalPlayers,
          isMember: userIsMember,
        }
      })
    )

    return NextResponse.json({ rooms: roomsWithCounts })
  } catch (error) {
    console.error('Failed to fetch rooms:', error)
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 })
  }
}

/**
 * POST /api/arcade/rooms
 * Create a new room
 * Body:
 *   - name: string
 *   - gameName: string
 *   - gameConfig?: object
 *   - ttlMinutes?: number
 */
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const body = await req.json()

    // Validate required fields
    if (!body.name || !body.gameName) {
      return NextResponse.json(
        { error: 'Missing required fields: name, gameName' },
        { status: 400 }
      )
    }

    // Validate game name
    const validGames: GameName[] = ['matching', 'memory-quiz', 'complement-race']
    if (!validGames.includes(body.gameName)) {
      return NextResponse.json({ error: 'Invalid game name' }, { status: 400 })
    }

    // Validate name length
    if (body.name.length > 50) {
      return NextResponse.json({ error: 'Room name too long (max 50 characters)' }, { status: 400 })
    }

    // Get display name from body or generate from viewerId
    const displayName = body.creatorName || `Guest ${viewerId.slice(-4)}`

    // Create room
    const room = await createRoom({
      name: body.name,
      createdBy: viewerId,
      creatorName: displayName,
      gameName: body.gameName,
      gameConfig: body.gameConfig || {},
      ttlMinutes: body.ttlMinutes,
    })

    // Add creator as first member
    await addRoomMember({
      roomId: room.id,
      userId: viewerId,
      displayName,
      isCreator: true,
    })

    // Generate join URL
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const joinUrl = `${baseUrl}/arcade/rooms/${room.id}`

    return NextResponse.json(
      {
        room,
        joinUrl,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create room:', error)
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}
