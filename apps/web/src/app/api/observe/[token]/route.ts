import { type NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, sessionPlans } from '@/db/schema'
import { validateSessionShare } from '@/lib/session-share'

interface RouteParams {
  params: Promise<{ token: string }>
}

/**
 * GET /api/observe/[token]
 * Validate a share token and return session/player info
 *
 * This endpoint does NOT require authentication - anyone with the token can access it.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params

  try {
    // Validate the token
    const validation = await validateSessionShare(token)

    if (!validation.valid || !validation.share) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.error || 'Invalid share link',
        },
        { status: 404 }
      )
    }

    const share = validation.share

    // Get the session
    const sessions = await db
      .select()
      .from(sessionPlans)
      .where(eq(sessionPlans.id, share.sessionId))
      .limit(1)

    const session = sessions[0]
    if (!session) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Session not found',
        },
        { status: 404 }
      )
    }

    // Check if session is still active
    if (session.completedAt) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Session has ended',
        },
        { status: 410 } // Gone
      )
    }

    if (!session.startedAt) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Session has not started yet',
        },
        { status: 425 } // Too Early
      )
    }

    // Get the player info
    const playerResults = await db
      .select({
        id: players.id,
        name: players.name,
        emoji: players.emoji,
        color: players.color,
      })
      .from(players)
      .where(eq(players.id, share.playerId))
      .limit(1)

    const player = playerResults[0]
    if (!player) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Player not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      session: {
        id: session.id,
        playerId: session.playerId,
        startedAt:
          session.startedAt instanceof Date ? session.startedAt.getTime() : session.startedAt,
      },
      player: {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        color: player.color,
      },
      expiresAt: share.expiresAt instanceof Date ? share.expiresAt.getTime() : share.expiresAt,
    })
  } catch (error) {
    console.error('Error validating share token:', error)
    return NextResponse.json(
      {
        valid: false,
        error: 'Failed to validate share link',
      },
      { status: 500 }
    )
  }
}
