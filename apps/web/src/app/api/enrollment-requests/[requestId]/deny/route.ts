import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db, schema } from '@/db'
import { enrollmentRequests } from '@/db/schema'
import { denyEnrollmentRequest, isParent } from '@/lib/classroom'
import { emitEnrollmentRequestDenied } from '@/lib/classroom/socket-emitter'
import { getDbUserId } from '@/lib/viewer'

/**
 * POST /api/enrollment-requests/[requestId]/deny
 * Parent denies enrollment request
 *
 * Returns: { request }
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { requestId } = (await params) as { requestId: string }
    const userId = await getDbUserId()

    // Get the request to verify parent owns the child
    const request = await db.query.enrollmentRequests.findFirst({
      where: eq(enrollmentRequests.id, requestId),
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify user is a parent of the child in the request
    const parentCheck = await isParent(userId, request.playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const updatedRequest = await denyEnrollmentRequest(requestId, userId, 'parent')

    // Emit socket event for real-time updates (notify teacher via classroom channel)
    try {
      // Get classroom and player info for socket event
      const [classroomInfo] = await db
        .select({ name: schema.classrooms.name })
        .from(schema.classrooms)
        .where(eq(schema.classrooms.id, request.classroomId))
        .limit(1)

      const [playerInfo] = await db
        .select({ name: schema.players.name })
        .from(schema.players)
        .where(eq(schema.players.id, request.playerId))
        .limit(1)

      if (classroomInfo && playerInfo) {
        await emitEnrollmentRequestDenied(
          {
            requestId,
            classroomId: request.classroomId,
            classroomName: classroomInfo.name,
            playerId: request.playerId,
            playerName: playerInfo.name,
            deniedBy: 'parent',
          },
          { classroomId: request.classroomId } // Teacher sees the update via classroom channel
        )
      }
    } catch (socketError) {
      console.error('[Parent Deny] Failed to emit socket event:', socketError)
    }

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    console.error('Failed to deny enrollment request:', error)
    const message = error instanceof Error ? error.message : 'Failed to deny enrollment request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
