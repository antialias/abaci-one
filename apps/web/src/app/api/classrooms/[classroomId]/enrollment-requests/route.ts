import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  createEnrollmentRequest,
  getPendingRequestsForClassroom,
  getTeacherClassroom,
  isParent,
} from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * Get or create user record for a viewerId (guestId)
 */
async function getOrCreateUser(viewerId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  return user
}

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
    const user = await getOrCreateUser(viewerId)

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(user.id)
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
    const user = await getOrCreateUser(viewerId)
    const body = await req.json()

    if (!body.playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
    }

    // Determine role: is user the teacher or a parent?
    const classroom = await getTeacherClassroom(user.id)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParent(user.id, body.playerId)

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
      requestedBy: user.id,
      requestedByRole,
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (error) {
    console.error('Failed to create enrollment request:', error)
    return NextResponse.json({ error: 'Failed to create enrollment request' }, { status: 500 })
  }
}
