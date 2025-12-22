import { type NextRequest, NextResponse } from 'next/server'
import { unenrollStudent, getTeacherClassroom, isParent } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string; playerId: string }>
}

/**
 * DELETE /api/classrooms/[classroomId]/enrollments/[playerId]
 * Unenroll student from classroom (teacher or parent)
 *
 * Returns: { success: true }
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId, playerId } = await params
    const viewerId = await getViewerId()

    // Check authorization: must be teacher of classroom OR parent of student
    const classroom = await getTeacherClassroom(viewerId)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParent(viewerId, playerId)

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        { error: 'Must be the classroom teacher or a parent of the student' },
        { status: 403 }
      )
    }

    await unenrollStudent(classroomId, playerId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to unenroll student:', error)
    return NextResponse.json({ error: 'Failed to unenroll student' }, { status: 500 })
  }
}
