import { NextRequest, NextResponse } from 'next/server'
import {
  createArcadeSession,
  getArcadeSession,
  deleteArcadeSession,
} from '@/lib/arcade/session-manager'
import type { GameName } from '@/lib/arcade/validation'

/**
 * GET /api/arcade-session?userId=xxx
 * Get the active arcade session for a user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const session = await getArcadeSession(userId)

    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 404 })
    }

    return NextResponse.json({
      session: {
        currentGame: session.currentGame,
        gameUrl: session.gameUrl,
        gameState: session.gameState,
        activePlayers: session.activePlayers,
        version: session.version,
        expiresAt: session.expiresAt,
      },
    })
  } catch (error) {
    console.error('Error fetching arcade session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/arcade-session
 * Create a new arcade session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, gameName, gameUrl, initialState, activePlayers } = body

    if (!userId || !gameName || !gameUrl || !initialState || !activePlayers) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const session = await createArcadeSession({
      userId,
      gameName: gameName as GameName,
      gameUrl,
      initialState,
      activePlayers,
    })

    return NextResponse.json({
      session: {
        currentGame: session.currentGame,
        gameUrl: session.gameUrl,
        gameState: session.gameState,
        activePlayers: session.activePlayers,
        version: session.version,
        expiresAt: session.expiresAt,
      },
    })
  } catch (error) {
    console.error('Error creating arcade session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/arcade-session?userId=xxx
 * Delete an arcade session
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    await deleteArcadeSession(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting arcade session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
