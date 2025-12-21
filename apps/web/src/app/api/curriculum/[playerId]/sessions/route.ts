/**
 * Paginated sessions API endpoint
 *
 * GET /api/curriculum/[playerId]/sessions?cursor=<id>&limit=<n>
 *
 * Returns cursor-based paginated session history for infinite scroll.
 */

import { NextResponse } from 'next/server'
import { getPaginatedSessions } from '@/lib/curriculum/progress-manager'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
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
}
