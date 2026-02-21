import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { approveEnrollmentRequest, getLinkedParentIds, getTeacherClassroom } from '@/lib/classroom'
import {
  emitEnrollmentCompleted,
  emitEnrollmentRequestApproved,
} from '@/lib/classroom/socket-emitter'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/classrooms/[classroomId]/enrollment-requests/[requestId]/approve
 * Teacher approves enrollment request
 *
 * Returns: { request, enrolled: boolean }
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

    const result = await approveEnrollmentRequest(requestId, userId, 'teacher')

    // Emit socket events for real-time updates
    try {
      // Get classroom and player info for socket events
      const [classroomInfo] = await db
        .select({ name: schema.classrooms.name })
        .from(schema.classrooms)
        .where(eq(schema.classrooms.id, classroomId))
        .limit(1)

      const [playerInfo] = await db
        .select({ name: schema.players.name })
        .from(schema.players)
        .where(eq(schema.players.id, result.request.playerId))
        .limit(1)

      if (classroomInfo && playerInfo) {
        // Get parent IDs to notify
        const parentIds = await getLinkedParentIds(result.request.playerId)

        const payload = {
          requestId,
          classroomId,
          classroomName: classroomInfo.name,
          playerId: result.request.playerId,
          playerName: playerInfo.name,
        }

        if (result.fullyApproved) {
          // Both sides approved - notify everyone
          await emitEnrollmentCompleted(payload, {
            classroomId, // Teacher sees the update
            userIds: parentIds, // Parents see the update
            playerIds: [result.request.playerId], // Student's enrolled classrooms list updates
          })
        } else {
          // Only teacher approved - notify parent that their part is done
          // This happens when the request was parent-initiated
          await emitEnrollmentRequestApproved(
            { ...payload, approvedBy: 'teacher' },
            { userIds: parentIds }
          )
        }
      }
    } catch (socketError) {
      console.error('[Teacher Approve] Failed to emit socket event:', socketError)
    }

    return NextResponse.json({
      request: result.request,
      enrolled: result.fullyApproved,
    })
  } catch (error) {
    console.error('Failed to approve enrollment request:', error)
    const message = error instanceof Error ? error.message : 'Failed to approve enrollment request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
