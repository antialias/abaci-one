import { type NextRequest, NextResponse } from 'next/server'
import { denyEnrollmentRequest, getTeacherClassroom } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string; requestId: string }>
}

/**
 * POST /api/classrooms/[classroomId]/enrollment-requests/[requestId]/deny
 * Teacher denies enrollment request
 *
 * Returns: { request }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId, requestId } = await params
    const viewerId = await getViewerId()

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(viewerId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const request = await denyEnrollmentRequest(requestId, viewerId, 'teacher')

    return NextResponse.json({ request })
  } catch (error) {
    console.error('Failed to deny enrollment request:', error)
    const message = error instanceof Error ? error.message : 'Failed to deny enrollment request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
