/**
 * API route for getting skill anomalies for teacher review
 *
 * GET /api/curriculum/[playerId]/anomalies
 *
 * Returns anomalies such as:
 * - Skills that have been repeatedly skipped (student avoiding tutorials)
 * - Skills that are mastered according to BKT but not being practiced
 */

import { NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/classroom'
import { getSkillAnomalies } from '@/lib/curriculum/skill-unlock'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET - Get skill anomalies for teacher review
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const anomalies = await getSkillAnomalies(playerId)

    return NextResponse.json({
      anomalies,
    })
  } catch (error) {
    console.error('Error fetching skill anomalies:', error)
    return NextResponse.json({ error: 'Failed to fetch skill anomalies' }, { status: 500 })
  }
})
