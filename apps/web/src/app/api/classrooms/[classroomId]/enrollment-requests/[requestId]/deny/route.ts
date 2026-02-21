import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { denyEnrollmentRequest, getLinkedParentIds, getTeacherClassroom } from '@/lib/classroom'
import { emitEnrollmentRequestDenied } from '@/lib/classroom/socket-emitter'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/classrooms/[classroomId]/enrollment-requests/[requestId]/deny
 * Teacher denies enrollment request
 *
 * Returns: { request }
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { classroomId, requestId } = (await params) as { classroomId: string; requestId: string }
    const userId = await getUserId()

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(userId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const request = await denyEnrollmentRequest(requestId, userId, 'teacher')

    // Emit socket event for real-time updates
    try {
      // Get classroom and player info for socket event
      const [classroomInfo] = await db
        .select({ name: schema.classrooms.name })
        .from(schema.classrooms)
        .where(eq(schema.classrooms.id, classroomId))
        .limit(1)

      const [playerInfo] = await db
        .select({ name: schema.players.name })
        .from(schema.players)
        .where(eq(schema.players.id, request.playerId))
        .limit(1)

      if (classroomInfo && playerInfo) {
        // Get parent IDs to notify
        const parentIds = await getLinkedParentIds(request.playerId)

        await emitEnrollmentRequestDenied(
          {
            requestId,
            classroomId,
            classroomName: classroomInfo.name,
            playerId: request.playerId,
            playerName: playerInfo.name,
            deniedBy: 'teacher',
          },
          { userIds: parentIds }
        )
      }
    } catch (socketError) {
      console.error('[Teacher Deny] Failed to emit socket event:', socketError)
    }

    return NextResponse.json({ request })
  } catch (error) {
    console.error('Failed to deny enrollment request:', error)
    const message = error instanceof Error ? error.message : 'Failed to deny enrollment request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
