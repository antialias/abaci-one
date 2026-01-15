import { type NextRequest, NextResponse } from 'next/server'
import { getEnrolledClassrooms, canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/players/[id]/enrolled-classrooms
 * Get classrooms that this student is enrolled in
 *
 * Returns: { classrooms: Classroom[] }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: playerId } = await params
    const userId = await getDbUserId()

    // Check authorization: must have at least view access
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const classrooms = await getEnrolledClassrooms(playerId)

    return NextResponse.json({ classrooms })
  } catch (error) {
    console.error('Failed to fetch enrolled classrooms:', error)
    return NextResponse.json({ error: 'Failed to fetch enrolled classrooms' }, { status: 500 })
  }
}
