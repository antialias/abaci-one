import { NextResponse } from 'next/server'
import { getPendingRequestsForParent } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/enrollment-requests/pending
 * Get enrollment requests pending current user's approval as parent
 *
 * Returns: { requests: EnrollmentRequest[] }
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()

    const requests = await getPendingRequestsForParent(viewerId)

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Failed to fetch pending enrollment requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending enrollment requests' },
      { status: 500 }
    )
  }
}
