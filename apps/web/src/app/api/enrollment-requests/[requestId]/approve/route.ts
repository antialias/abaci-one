import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { enrollmentRequests } from '@/db/schema'
import { approveEnrollmentRequest, isParent } from '@/lib/classroom'
import {
  emitEnrollmentCompleted,
  emitEnrollmentRequestApproved,
} from '@/lib/classroom/socket-emitter'
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
  params: Promise<{ requestId: string }>
}

/**
 * POST /api/enrollment-requests/[requestId]/approve
 * Parent approves enrollment request
 *
 * Returns: { request, enrolled: boolean }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { requestId } = await params
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)

    // Get the request to verify parent owns the child
    const request = await db.query.enrollmentRequests.findFirst({
      where: eq(enrollmentRequests.id, requestId),
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify user is a parent of the child in the request
    const parentCheck = await isParent(user.id, request.playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const result = await approveEnrollmentRequest(requestId, user.id, 'parent')

    // Emit socket events for real-time updates
    try {
      const classroomId = result.request.classroomId

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
        const payload = {
          requestId,
          classroomId,
          classroomName: classroomInfo.name,
          playerId: result.request.playerId,
          playerName: playerInfo.name,
        }

        if (result.fullyApproved) {
          // Both sides approved - notify teacher and student
          await emitEnrollmentCompleted(payload, {
            classroomId, // Teacher sees the update
            playerIds: [result.request.playerId], // Student's enrolled classrooms list updates
          })
        } else {
          // Only parent approved - notify teacher that parent approved their request
          await emitEnrollmentRequestApproved({ ...payload, approvedBy: 'parent' }, { classroomId })
        }
      }
    } catch (socketError) {
      console.error('[Parent Approve] Failed to emit socket event:', socketError)
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
}
