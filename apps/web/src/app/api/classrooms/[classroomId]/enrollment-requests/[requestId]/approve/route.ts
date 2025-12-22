import { type NextRequest, NextResponse } from 'next/server'
import { approveEnrollmentRequest, getTeacherClassroom } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string; requestId: string }>
}

/**
 * POST /api/classrooms/[classroomId]/enrollment-requests/[requestId]/approve
 * Teacher approves enrollment request
 *
 * Returns: { request, enrolled: boolean }
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

    const result = await approveEnrollmentRequest(requestId, viewerId, 'teacher')

    return NextResponse.json({
      request: result.request,
      enrolled: result.fullyApproved,
    })
  } catch (error) {
    console.error('Failed to approve enrollment request:', error)
    const message = error instanceof Error ? error.message : 'Failed to approve enrollment request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
