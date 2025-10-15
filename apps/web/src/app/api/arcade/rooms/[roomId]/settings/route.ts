import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getRoomActivePlayers } from '@/lib/arcade/player-manager'
import { recordRoomMemberHistory } from '@/lib/arcade/room-member-history'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getSocketIO } from '@/lib/socket-io'
import { getViewerId } from '@/lib/viewer'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * PATCH /api/arcade/rooms/:roomId/settings
 * Update room settings (host only)
 * Body:
 *   - accessMode?: 'open' | 'locked' | 'retired' | 'password' | 'restricted' | 'approval-only'
 *   - password?: string (plain text, will be hashed)
 *   - gameName?: 'matching' | 'memory-quiz' | 'complement-race' | null (select game for room)
 *   - gameConfig?: object (game-specific settings)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params
    const viewerId = await getViewerId()
    const body = await req.json()

    // Check if user is the host
    const members = await getRoomMembers(roomId)
    const currentMember = members.find((m) => m.userId === viewerId)

    if (!currentMember) {
      return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })
    }

    if (!currentMember.isCreator) {
      return NextResponse.json({ error: 'Only the host can change room settings' }, { status: 403 })
    }

    // Validate accessMode if provided
    const validAccessModes = [
      'open',
      'locked',
      'retired',
      'password',
      'restricted',
      'approval-only',
    ]
    if (body.accessMode && !validAccessModes.includes(body.accessMode)) {
      return NextResponse.json({ error: 'Invalid access mode' }, { status: 400 })
    }

    // Validate password requirements
    if (body.accessMode === 'password' && !body.password) {
      return NextResponse.json(
        { error: 'Password is required for password-protected rooms' },
        { status: 400 }
      )
    }

    // Validate gameName if provided
    if (body.gameName !== undefined && body.gameName !== null) {
      const validGames = ['matching', 'memory-quiz', 'complement-race']
      if (!validGames.includes(body.gameName)) {
        return NextResponse.json({ error: 'Invalid game name' }, { status: 400 })
      }
    }

    // Prepare update data
    const updateData: Record<string, any> = {}

    if (body.accessMode !== undefined) {
      updateData.accessMode = body.accessMode
    }

    // Hash password if provided
    if (body.password !== undefined) {
      if (body.password === null || body.password === '') {
        updateData.password = null // Clear password
        updateData.displayPassword = null // Also clear display password
      } else {
        const hashedPassword = await bcrypt.hash(body.password, 10)
        updateData.password = hashedPassword
        updateData.displayPassword = body.password // Store plain text for display
      }
    }

    // Update game selection if provided
    if (body.gameName !== undefined) {
      updateData.gameName = body.gameName
    }

    // Update game config if provided
    if (body.gameConfig !== undefined) {
      updateData.gameConfig = body.gameConfig
    }

    // If game is being changed (or cleared), delete the existing arcade session
    // This ensures a fresh session will be created with the new game settings
    if (body.gameName !== undefined) {
      console.log(`[Settings API] Deleting existing arcade session for room ${roomId}`)
      await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.roomId, roomId))
    }

    // Update room settings
    const [updatedRoom] = await db
      .update(schema.arcadeRooms)
      .set(updateData)
      .where(eq(schema.arcadeRooms.id, roomId))
      .returning()

    // If setting to retired, expel all non-owner members
    if (body.accessMode === 'retired') {
      const nonOwnerMembers = members.filter((m) => !m.isCreator)

      if (nonOwnerMembers.length > 0) {
        // Remove all non-owner members from the room
        await db.delete(schema.roomMembers).where(
          and(
            eq(schema.roomMembers.roomId, roomId),
            // Delete all members except the creator
            eq(schema.roomMembers.isCreator, false)
          )
        )

        // Record in history for each expelled member
        for (const member of nonOwnerMembers) {
          await recordRoomMemberHistory({
            roomId,
            userId: member.userId,
            displayName: member.displayName,
            action: 'left',
          })
        }

        // Broadcast updates via socket
        const io = await getSocketIO()
        if (io) {
          try {
            // Get updated member list (should only be the owner now)
            const updatedMembers = await getRoomMembers(roomId)
            const memberPlayers = await getRoomActivePlayers(roomId)

            // Convert memberPlayers Map to object for JSON serialization
            const memberPlayersObj: Record<string, any[]> = {}
            for (const [uid, players] of memberPlayers.entries()) {
              memberPlayersObj[uid] = players
            }

            // Notify each expelled member
            for (const member of nonOwnerMembers) {
              io.to(`user:${member.userId}`).emit('kicked-from-room', {
                roomId,
                kickedBy: currentMember.displayName,
                reason: 'Room has been retired',
              })
            }

            // Notify the owner that members were expelled
            io.to(`room:${roomId}`).emit('member-left', {
              roomId,
              userId: nonOwnerMembers.map((m) => m.userId),
              members: updatedMembers,
              memberPlayers: memberPlayersObj,
              reason: 'room-retired',
            })

            console.log(
              `[Settings API] Expelled ${nonOwnerMembers.length} members from retired room ${roomId}`
            )
          } catch (socketError) {
            console.error('[Settings API] Failed to broadcast member expulsion:', socketError)
          }
        }
      }
    }

    return NextResponse.json({ room: updatedRoom }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to update room settings:', error)
    return NextResponse.json({ error: 'Failed to update room settings' }, { status: 500 })
  }
}
