import { type NextRequest, NextResponse } from 'next/server'
import {
  createEnrollmentRequest,
  getPendingRequestsForClassroom,
  getTeacherClassroom,
  isParent,
} from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string }>
}

/**
 * GET /api/classrooms/[classroomId]/enrollment-requests
 * Get pending enrollment requests (teacher only)
 *
 * Returns: { requests: EnrollmentRequest[] }
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

    const requests = await getPendingRequestsForClassroom(classroomId)

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Failed to fetch enrollment requests:', error)
    return NextResponse.json({ error: 'Failed to fetch enrollment requests' }, { status: 500 })
  }
}

/**
 * POST /api/classrooms/[classroomId]/enrollment-requests
 * Create enrollment request (parent or teacher)
 *
 * Body: { playerId: string }
 * Returns: { request }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params
    const viewerId = await getViewerId()
    const body = await req.json()

    if (!body.playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
    }

    // Determine role: is user the teacher or a parent?
    const classroom = await getTeacherClassroom(viewerId)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParent(viewerId, body.playerId)

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        { error: 'Must be the classroom teacher or a parent of the student' },
        { status: 403 }
      )
    }

    const requestedByRole = isTeacher ? 'teacher' : 'parent'

    const request = await createEnrollmentRequest({
      classroomId,
      playerId: body.playerId,
      requestedBy: viewerId,
      requestedByRole,
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (error) {
    console.error('Failed to create enrollment request:', error)
    return NextResponse.json({ error: 'Failed to create enrollment request' }, { status: 500 })
  }
}
