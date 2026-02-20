import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/curriculum/[playerId]/problem-history
 *
 * Returns the recent problem history for a player.
 * Used for BKT computation and skill classification preview.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  try {
    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const history = await getRecentSessionResults(playerId, 50)
    return NextResponse.json({ history })
  } catch (error) {
    console.error('Error fetching problem history:', error)
    return NextResponse.json({ error: 'Failed to fetch problem history' }, { status: 500 })
  }
})
