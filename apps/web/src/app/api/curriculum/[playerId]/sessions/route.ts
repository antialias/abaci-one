/**
 * Paginated sessions API endpoint
 *
 * GET /api/curriculum/[playerId]/sessions?cursor=<id>&limit=<n>
 *
 * Returns cursor-based paginated session history for infinite scroll.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getPaginatedSessions } from '@/lib/curriculum/progress-manager'
import { getDbUserId } from '@/lib/viewer'

export const GET = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 20

    console.log(`[API /sessions] playerId=${playerId}, cursor=${cursor}, limit=${limit}`)

    const result = await getPaginatedSessions(playerId, limit, cursor)

    console.log(
      `[API /sessions] Returning ${result.sessions.length} sessions, hasMore=${result.hasMore}, nextCursor=${result.nextCursor}`
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching paginated sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
})
