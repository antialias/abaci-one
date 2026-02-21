import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getStudentPresence, canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/players/[id]/presence
 * Get student's current classroom presence
 *
 * Returns: { presence } or { presence: null }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }
    const userId = await getUserId()

    // Check authorization: must have at least view access
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const presence = await getStudentPresence(playerId)

    return NextResponse.json({ presence })
  } catch (error) {
    console.error('Failed to fetch student presence:', error)
    return NextResponse.json({ error: 'Failed to fetch student presence' }, { status: 500 })
  }
})
