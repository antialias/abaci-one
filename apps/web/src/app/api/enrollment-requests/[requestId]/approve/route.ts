import { type NextRequest, NextResponse } from 'next/server'
import { approveEnrollmentRequest, isParent } from '@/lib/classroom'
import { db } from '@/db'
import { enrollmentRequests } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getViewerId } from '@/lib/viewer'

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

    // Get the request to verify parent owns the child
    const request = await db.query.enrollmentRequests.findFirst({
      where: eq(enrollmentRequests.id, requestId),
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify user is a parent of the child in the request
    const parentCheck = await isParent(viewerId, request.playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const result = await approveEnrollmentRequest(requestId, viewerId, 'parent')

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
