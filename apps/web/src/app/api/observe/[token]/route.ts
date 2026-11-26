import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { loadSharedPlan } from '@/lib/curriculum/shared-session-report'

/**
 * GET /api/observe/[token]
 * Validate a share token and return session/player info
 *
 * This endpoint does NOT require authentication - anyone with the token can access it.
 * Live / ended / not started is the session's outcome (Phase 4c), as the share
 * page and the token report route decide it: ended (completed, ended early,
 * abandoned) answers 410, not started 425. It reads the plan row only (no
 * report build), so a report failure cannot fail it.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { token } = (await params) as { token: string }

  try {
    const shared = await loadSharedPlan(token)
    if (shared.kind !== 'ok') {
      return NextResponse.json({ valid: false, error: shared.error }, { status: 404 })
    }

    if (shared.outcome === 'completed' || shared.outcome === 'abandoned') {
      return NextResponse.json(
        { valid: false, error: 'Session has ended' },
        { status: 410 } // Gone
      )
    }

    if (shared.outcome === 'not_started') {
      return NextResponse.json(
        { valid: false, error: 'Session has not started yet' },
        { status: 425 } // Too Early
      )
    }

    const { plan, player, share } = shared
    if (!player) {
      return NextResponse.json({ valid: false, error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      session: {
        id: plan.id,
        playerId: plan.playerId,
        startedAt: plan.startedAt ? new Date(plan.startedAt).getTime() : null,
      },
      player,
      expiresAt: share.expiresAt.getTime(),
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
})
