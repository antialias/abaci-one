import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getAllFlags } from '@/lib/feature-flags'

/**
 * GET /api/feature-flags
 *
 * Public endpoint — returns all flags for client-side consumption.
 * No description or timestamps (minimal payload).
 *
 * Session-aware: if the user is logged in, per-user overrides
 * are merged into the response.
 */
export const GET = withAuth(async (_request, { userId, userRole }) => {
  try {
    const flags = await getAllFlags(userId || undefined, userRole)
    return NextResponse.json({ flags })
  } catch (error) {
    console.error('[feature-flags] Failed to fetch flags:', error)
    return NextResponse.json({ error: 'Failed to fetch feature flags' }, { status: 500 })
  }
})
