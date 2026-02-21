import { NextResponse } from 'next/server'
import { getTeacherClassroom } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/classrooms/mine
 * Get current user's classroom (if teacher)
 *
 * Returns: { classroom } or 404
 */
export const GET = withAuth(async () => {
  try {
    // getUserId returns the stable database user.id for the current viewer
    const userId = await getUserId()
    const classroom = await getTeacherClassroom(userId)

    if (!classroom) {
      return NextResponse.json({ error: 'No classroom found' }, { status: 404 })
    }

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to fetch classroom:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom' }, { status: 500 })
  }
})
