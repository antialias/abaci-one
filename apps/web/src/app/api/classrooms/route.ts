import { NextResponse } from 'next/server'
import { createClassroom, getTeacherClassroom } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/classrooms
 * Get current user's classroom (alias for /api/classrooms/mine)
 *
 * Returns: { classroom } or { classroom: null }
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()

    const classroom = await getTeacherClassroom(userId)

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to fetch classroom:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom' }, { status: 500 })
  }
})

/**
 * POST /api/classrooms
 * Create a classroom for current user (becomes teacher)
 *
 * Body: { name: string }
 * Returns: { success: true, classroom } or { success: false, error }
 */
export const POST = withAuth(async (req) => {
  try {
    const userId = await getUserId()
    const body = await req.json()

    if (!body.name) {
      return NextResponse.json({ success: false, error: 'Missing name' }, { status: 400 })
    }

    const result = await createClassroom({
      teacherId: userId,
      name: body.name,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, classroom: result.classroom }, { status: 201 })
  } catch (error) {
    console.error('Failed to create classroom:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create classroom' },
      { status: 500 }
    )
  }
})
