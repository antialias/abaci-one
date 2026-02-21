import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getLinkedChildren } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/family/children
 * Get all children linked to current user
 *
 * Returns: { children: Player[] }
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()

    const children = await getLinkedChildren(userId)

    return NextResponse.json({ children })
  } catch (error) {
    console.error('Failed to fetch children:', error)
    return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 })
  }
})
