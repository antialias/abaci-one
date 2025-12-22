import { type NextRequest, NextResponse } from 'next/server'
import { getEnrolledStudents, getTeacherClassroom } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string }>
}

/**
 * GET /api/classrooms/[classroomId]/enrollments
 * Get all enrolled students (teacher only)
 *
 * Returns: { students: Player[] }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params
    const viewerId = await getViewerId()

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(viewerId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const students = await getEnrolledStudents(classroomId)

    return NextResponse.json({ students })
  } catch (error) {
    console.error('Failed to fetch enrolled students:', error)
    return NextResponse.json({ error: 'Failed to fetch enrolled students' }, { status: 500 })
  }
}
