import { NextResponse } from 'next/server'
import { getTeacherClassroom } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/classrooms/mine
 * Get current user's classroom (if teacher)
 *
 * Returns: { classroom } or 404
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()

    const classroom = await getTeacherClassroom(viewerId)

    if (!classroom) {
      return NextResponse.json({ error: 'No classroom found' }, { status: 404 })
    }

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to fetch classroom:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom' }, { status: 500 })
  }
}
