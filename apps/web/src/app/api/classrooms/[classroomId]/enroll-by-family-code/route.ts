import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  createEnrollmentRequest,
  getLinkedParentIds,
  getTeacherClassroom,
  isEnrolled,
} from '@/lib/classroom'
import { getSocketIO } from '@/lib/socket-io'
import { getViewerId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

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

/**
 * POST /api/classrooms/[classroomId]/enroll-by-family-code
 * Teacher looks up a student by family code and creates an enrollment request
 *
 * Body: { familyCode: string }
 * Returns: { success: true, request, player } or { success: false, error }
 */
export const POST = withAuth(async (req, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)
    const body = await req.json()

    if (!body.familyCode) {
      return NextResponse.json({ success: false, error: 'Missing familyCode' }, { status: 400 })
    }

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(user.id)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 })
    }

    // Look up player by family code
    const normalizedCode = body.familyCode.toUpperCase().trim()
    const player = await db.query.players.findFirst({
      where: eq(schema.players.familyCode, normalizedCode),
    })

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'No student found with that family code' },
        { status: 404 }
      )
    }

    // Check if already enrolled
    const alreadyEnrolled = await isEnrolled(classroomId, player.id)
    if (alreadyEnrolled) {
      return NextResponse.json(
        {
          success: false,
          error: 'This student is already enrolled in your classroom',
        },
        { status: 400 }
      )
    }

    // Create enrollment request (teacher-initiated, requires parent approval)
    const request = await createEnrollmentRequest({
      classroomId,
      playerId: player.id,
      requestedBy: user.id,
      requestedByRole: 'teacher',
    })

    // Emit socket event for real-time updates
    const io = await getSocketIO()
    if (io) {
      try {
        const eventData = {
          request: {
            id: request.id,
            classroomId,
            classroomName: classroom.name,
            playerId: player.id,
            playerName: player.name,
            requestedByRole: 'teacher',
          },
        }

        // Emit to classroom channel (for teacher's view)
        io.to(`classroom:${classroomId}`).emit('enrollment-request-created', eventData)
        console.log(
          `[Enroll by Family Code API] Teacher created enrollment request for ${player.name}`
        )

        // Also emit to parent's user channel so they see the pending approval
        const parentIds = await getLinkedParentIds(player.id)
        for (const parentId of parentIds) {
          io.to(`user:${parentId}`).emit('enrollment-request-created', eventData)
          console.log(`[Enroll by Family Code API] Notified parent ${parentId} of new request`)
        }
      } catch (socketError) {
        console.error('[Enroll by Family Code API] Failed to broadcast:', socketError)
      }
    }

    return NextResponse.json({
      success: true,
      request,
      player: {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        color: player.color,
      },
    })
  } catch (error) {
    console.error('Failed to enroll by family code:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create enrollment request' },
      { status: 500 }
    )
  }
})
