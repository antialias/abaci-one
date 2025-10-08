import { type NextRequest, NextResponse } from 'next/server'
import { getRoomByCode } from '@/lib/arcade/room-manager'
import { normalizeRoomCode } from '@/lib/arcade/room-code'

type RouteContext = {
  params: Promise<{ code: string }>
}

/**
 * GET /api/arcade/rooms/code/:code
 * Get room by join code (for resolving codes to room IDs)
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params

    // Normalize the code (uppercase, remove spaces/dashes)
    const normalizedCode = normalizeRoomCode(code)

    // Get room
    const room = await getRoomByCode(normalizedCode)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Generate redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/arcade/rooms/${room.id}`

    return NextResponse.json({
      roomId: room.id,
      redirectUrl,
      room,
    })
  } catch (error) {
    console.error('Failed to find room by code:', error)
    return NextResponse.json({ error: 'Failed to find room by code' }, { status: 500 })
  }
}
