import { NextResponse } from 'next/server'
import { leaveSpecificClassroom, getTeacherClassroom, isParentOf } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * DELETE /api/classrooms/[classroomId]/presence/[playerId]
 * Remove student from classroom (teacher or parent)
 *
 * Returns: { success: true }
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { classroomId, playerId } = (await params) as { classroomId: string; playerId: string }
    const userId = await getUserId()

    // Check authorization: must be teacher of classroom OR parent of student
    const classroom = await getTeacherClassroom(userId)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParentOf(userId, playerId)

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        { error: 'Must be the classroom teacher or a parent of the student' },
        { status: 403 }
      )
    }

    // Pass 'teacher' if removed by teacher, 'self' otherwise (parent removing their child)
    await leaveSpecificClassroom(playerId, classroomId, isTeacher ? 'teacher' : 'self')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove student from classroom:', error)
    return NextResponse.json({ error: 'Failed to remove student from classroom' }, { status: 500 })
  }
})
