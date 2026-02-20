import { NextResponse } from 'next/server'
import { getViewerId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/viewer
 *
 * Returns the current viewer's ID (guest or authenticated user)
 */
export const GET = withAuth(async () => {
  try {
    const viewerId = await getViewerId()
    return NextResponse.json({ viewerId })
  } catch (_error) {
    return NextResponse.json({ error: 'No valid viewer session found' }, { status: 401 })
  }
})
