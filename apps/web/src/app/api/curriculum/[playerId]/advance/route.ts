/**
 * API route for advancing curriculum phase
 *
 * POST /api/curriculum/[playerId]/advance - Advance to next phase
 */

import { NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/classroom'
import { advanceToNextPhase } from '@/lib/curriculum/progress-manager'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * POST - Advance player to next curriculum phase
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { nextPhaseId, nextLevel } = body

    if (!nextPhaseId) {
      return NextResponse.json({ error: 'Next phase ID required' }, { status: 400 })
    }

    const updated = await advanceToNextPhase(playerId, nextPhaseId, nextLevel)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error advancing phase:', error)
    return NextResponse.json({ error: 'Failed to advance phase' }, { status: 500 })
  }
}
