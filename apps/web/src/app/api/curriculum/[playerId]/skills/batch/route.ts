/**
 * API route for batch recording skill attempts
 *
 * POST /api/curriculum/[playerId]/skills/batch - Record multiple skill attempts
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { recordSkillAttempts } from '@/lib/curriculum/progress-manager'
import { getDbUserId } from '@/lib/viewer'

/**
 * POST - Record multiple skill attempts at once
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

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
    const { results } = body

    if (!Array.isArray(results)) {
      return NextResponse.json({ error: 'Results must be an array' }, { status: 400 })
    }

    // Validate each result
    for (const result of results) {
      if (!result.skillId || typeof result.isCorrect !== 'boolean') {
        return NextResponse.json(
          { error: 'Each result must have skillId and isCorrect' },
          { status: 400 }
        )
      }
    }

    const updatedSkills = await recordSkillAttempts(playerId, results)

    return NextResponse.json(updatedSkills)
  } catch (error) {
    console.error('Error recording batch skill attempts:', error)
    return NextResponse.json({ error: 'Failed to record skill attempts' }, { status: 500 })
  }
})
