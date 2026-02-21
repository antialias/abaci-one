import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/identity
 *
 * Returns the current viewer's stable database user.id
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()
    return NextResponse.json({ userId })
  } catch (_error) {
    return NextResponse.json({ error: 'No valid viewer session found' }, { status: 401 })
  }
})
