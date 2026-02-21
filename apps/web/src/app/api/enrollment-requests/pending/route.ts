import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getPendingRequestsForParent } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/enrollment-requests/pending
 * Get enrollment requests pending current user's approval as parent
 *
 * These are requests initiated by teachers for the user's children,
 * where parent approval hasn't been given yet.
 *
 * Returns: { requests: EnrollmentRequestWithRelations[] }
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()

    const requests = await getPendingRequestsForParent(userId)

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Failed to fetch pending enrollment requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending enrollment requests' },
      { status: 500 }
    )
  }
})
