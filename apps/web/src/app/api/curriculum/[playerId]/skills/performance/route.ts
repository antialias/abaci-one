import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { analyzeSkillPerformance } from '@/lib/curriculum/progress-manager'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/curriculum/[playerId]/skills/performance
 * Get skill performance analysis for a player (response times, strengths/weaknesses)
 */
export const GET = withAuth(async (_request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  try {
    // Authorization check
    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const analysis = await analyzeSkillPerformance(playerId)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error fetching skill performance:', error)
    return NextResponse.json({ error: 'Failed to fetch skill performance' }, { status: 500 })
  }
})
