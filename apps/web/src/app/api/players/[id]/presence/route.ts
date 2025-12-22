import { type NextRequest, NextResponse } from 'next/server'
import { getStudentPresence, canPerformAction } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/players/[id]/presence
 * Get student's current classroom presence
 *
 * Returns: { presence } or { presence: null }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: playerId } = await params
    const viewerId = await getViewerId()

    // Check authorization: must have at least view access
    const canView = await canPerformAction(viewerId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const presence = await getStudentPresence(playerId)

    return NextResponse.json({ presence })
  } catch (error) {
    console.error('Failed to fetch student presence:', error)
    return NextResponse.json({ error: 'Failed to fetch student presence' }, { status: 500 })
  }
}
