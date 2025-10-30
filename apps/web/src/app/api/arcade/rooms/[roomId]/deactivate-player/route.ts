import { type NextRequest, NextResponse } from 'next/server'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getPlayer, getRoomActivePlayers, setPlayerActiveStatus } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'
import { getSocketIO } from '@/lib/socket-io'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * POST /api/arcade/rooms/:roomId/deactivate-player
 * Deactivate a specific player in the room (host only)
 * Body:
 *   - playerId: string - The player to deactivate
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()
    const body = await req.json()

    // Validate required fields
    if (!body.playerId) {
      return NextResponse.json({ error: 'Missing required field: playerId' }, { status: 400 })
    }

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === viewerId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json({ error: 'Only the host can deactivate players' }, { status: 403 })
    }

    // Get the player
    const player = await getPlayer(body.playerId)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Find which user owns this player
    const playerOwnerMember = members.find((m) => m.userId === player.userId)
    if (!playerOwnerMember) {
      return NextResponse.json(
        { error: 'Player does not belong to a room member' },
        { status: 404 }
      )
    }

    // Can't deactivate your own players (use the regular player controls for that)
    if (player.userId === viewerId) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own players. Use the player controls in the nav.' },
        { status: 400 }
      )
    }

    // Deactivate the player
    await setPlayerActiveStatus(body.playerId, false)

    // Broadcast updates via socket
    const io = await getSocketIO()
    if (io) {
      try {
        // Get updated player list
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Notify everyone in the room about the player update
        io.to(`room:${roomId}`).emit('player-deactivated', {
          roomId,
          playerId: body.playerId,
          playerName: player.name,
          deactivatedBy: currentMember.displayName,
          memberPlayers: memberPlayersObj,
        })

        console.log(
          `[Deactivate Player API] Player ${body.playerId} (${player.name}) deactivated by host in room ${roomId}`
        )
      } catch (socketError) {
        console.error('[Deactivate Player API] Failed to broadcast deactivation:', socketError)
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to deactivate player:', error)
    return NextResponse.json({ error: 'Failed to deactivate player' }, { status: 500 })
  }
}
