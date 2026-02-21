import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getEnrolledClassrooms, canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/players/[id]/enrolled-classrooms
 * Get classrooms that this student is enrolled in
 *
 * Returns: { classrooms: Classroom[] }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }
    const userId = await getUserId()

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
})
