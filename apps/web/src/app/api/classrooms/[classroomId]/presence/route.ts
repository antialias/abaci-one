import { NextResponse } from 'next/server'
import {
  enterClassroom,
  getClassroomPresence,
  getTeacherClassroom,
  isParentOf,
} from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/classrooms/[classroomId]/presence
 * Get all students currently present in classroom (teacher only)
 *
 * Returns: { students: Player[] }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }
    const userId = await getUserId()

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(userId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const presences = await getClassroomPresence(classroomId)

    // Return players with presence info
    return NextResponse.json({
      students: presences.map((p) => ({
        ...p.player,
        enteredAt: p.enteredAt,
        enteredBy: p.enteredBy,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch classroom presence:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom presence' }, { status: 500 })
  }
})

/**
 * POST /api/classrooms/[classroomId]/presence
 * Enter student into classroom (teacher or parent)
 *
 * Body: { playerId: string }
 * Returns: { success: true, presence } or { success: false, error }
 */
export const POST = withAuth(async (req, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }
    const userId = await getUserId()
    const body = await req.json()

    if (!body.playerId) {
      return NextResponse.json({ success: false, error: 'Missing playerId' }, { status: 400 })
    }

    // Check authorization: must be teacher of classroom OR parent of student
    const classroom = await getTeacherClassroom(userId)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParentOf(userId, body.playerId)

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        {
          success: false,
          error: 'Must be the classroom teacher or a parent of the student',
        },
        { status: 403 }
      )
    }

    const result = await enterClassroom({
      playerId: body.playerId,
      classroomId,
      enteredBy: userId,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, presence: result.presence })
  } catch (error) {
    console.error('Failed to enter classroom:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to enter classroom' },
      { status: 500 }
    )
  }
})
