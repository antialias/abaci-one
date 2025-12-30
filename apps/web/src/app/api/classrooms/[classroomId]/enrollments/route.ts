import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { directEnrollStudent, getEnrolledStudents, getTeacherClassroom } from '@/lib/classroom'
import { emitEnrollmentCompleted } from '@/lib/classroom/socket-emitter'
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
 * GET /api/classrooms/[classroomId]/enrollments
 * Get all enrolled students (teacher only)
 *
 * Returns: { students: Player[] }
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

    const students = await getEnrolledStudents(classroomId)

    return NextResponse.json({ students })
  } catch (error) {
    console.error('Failed to fetch enrolled students:', error)
    return NextResponse.json({ error: 'Failed to fetch enrolled students' }, { status: 500 })
  }
}

/**
 * POST /api/classrooms/[classroomId]/enrollments
 * Directly enroll a student (teacher only, bypasses request workflow)
 *
 * Body: { playerId: string }
 * Returns: { enrolled: boolean }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(user.id)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await req.json()
    const { playerId } = body

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
    }

    // Verify the player exists and belongs to this teacher
    const player = await db.query.players.findFirst({
      where: eq(schema.players.id, playerId),
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Verify teacher owns this player
    if (player.userId !== user.id) {
      return NextResponse.json(
        { error: 'Can only directly enroll students you created' },
        { status: 403 }
      )
    }

    // Directly enroll the student
    const enrolled = await directEnrollStudent(classroomId, playerId)

    if (enrolled) {
      // Emit socket event for real-time updates
      try {
        await emitEnrollmentCompleted(
          {
            classroomId,
            classroomName: classroom.name,
            playerId,
            playerName: player.name,
          },
          {
            classroomId,
            userIds: [], // No parents to notify since teacher created this student
            playerIds: [playerId],
          }
        )
      } catch (socketError) {
        console.error('[DirectEnroll] Failed to emit socket event:', socketError)
      }
    }

    return NextResponse.json({ enrolled })
  } catch (error) {
    console.error('Failed to directly enroll student:', error)
    return NextResponse.json({ error: 'Failed to enroll student' }, { status: 500 })
  }
}
