import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { deleteOverride } from '@/lib/feature-flags'

/**
 * DELETE /api/admin/feature-flags/[key]/overrides/[userId]
 *
 * Remove a per-user override (admin only).
 */
export const DELETE = withAuth(
  async (_request, { params }) => {
    const { key, userId } = (await params) as { key: string; userId: string }

    try {
      const deleted = await deleteOverride(key, userId)

      if (!deleted) {
        return NextResponse.json({ error: 'Override not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, flagKey: key, userId })
    } catch (error) {
      console.error('[feature-flags] Delete override failed:', error)
      return NextResponse.json({ error: 'Failed to delete override' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
