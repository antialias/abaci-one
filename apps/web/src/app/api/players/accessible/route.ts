import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getAccessiblePlayers } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/players/accessible
 * Get all players current user can access
 *
 * Returns: {
 *   ownChildren: Player[],
 *   enrolledStudents: Player[],
 *   presentStudents: Player[]
 * }
 */
export const GET = withAuth(async () => {
  try {
    const viewerId = await getViewerId()

    const accessible = await getAccessiblePlayers(viewerId)

    return NextResponse.json(accessible)
  } catch (error) {
    console.error('Failed to fetch accessible players:', error)
    return NextResponse.json({ error: 'Failed to fetch accessible players' }, { status: 500 })
  }
})
