import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getRoomMembers } from '@/lib/arcade/room-membership'
import { getViewerId } from '@/lib/viewer'
import bcrypt from 'bcryptjs'

type RouteContext = {
  params: Promise<{ roomId: string }>
}

/**
 * PATCH /api/arcade/rooms/:roomId/settings
 * Update room settings (host only)
 * Body:
 *   - accessMode?: 'open' | 'locked' | 'retired' | 'password' | 'restricted' | 'approval-only'
 *   - password?: string (plain text, will be hashed)
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

    // Prepare update data
    const updateData: Record<string, any> = {}

    if (body.accessMode !== undefined) {
      updateData.accessMode = body.accessMode
    }

    // Hash password if provided
    if (body.password !== undefined) {
      if (body.password === null || body.password === '') {
        updateData.password = null // Clear password
      } else {
        const hashedPassword = await bcrypt.hash(body.password, 10)
        updateData.password = hashedPassword
      }
    }

    // Update room settings
    const [updatedRoom] = await db
      .update(schema.arcadeRooms)
      .set(updateData)
      .where(eq(schema.arcadeRooms.id, roomId))
      .returning()

    return NextResponse.json({ room: updatedRoom }, { status: 200 })
  } catch (error: any) {
    console.error('Failed to update room settings:', error)
    return NextResponse.json({ error: 'Failed to update room settings' }, { status: 500 })
  }
}
