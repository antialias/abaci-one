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
import { getSkillAnomalies } from '@/lib/curriculum/skill-unlock'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * GET - Get skill anomalies for teacher review
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const anomalies = await getSkillAnomalies(playerId)

    return NextResponse.json({
      anomalies,
    })
  } catch (error) {
    console.error('Error fetching skill anomalies:', error)
    return NextResponse.json({ error: 'Failed to fetch skill anomalies' }, { status: 500 })
  }
}
