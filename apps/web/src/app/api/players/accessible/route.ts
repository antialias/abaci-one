import { NextResponse } from 'next/server'
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
export async function GET() {
  try {
    const viewerId = await getViewerId()

    const accessible = await getAccessiblePlayers(viewerId)

    return NextResponse.json(accessible)
  } catch (error) {
    console.error('Failed to fetch accessible players:', error)
    return NextResponse.json({ error: 'Failed to fetch accessible players' }, { status: 500 })
  }
}
