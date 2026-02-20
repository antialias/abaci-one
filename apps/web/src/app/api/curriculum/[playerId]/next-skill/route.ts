/**
 * API route for getting the next skill a student should learn
 *
 * GET /api/curriculum/[playerId]/next-skill
 *
 * Returns the next skill in curriculum order that:
 * - Is not yet mastered (according to BKT)
 * - Is not currently being practiced
 * - Has a tutorial available
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getNextSkillToLearn } from '@/lib/curriculum/skill-unlock'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET - Get the next skill the student should learn
 */
export const GET = withAuth(async (_request, { params }) => {
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

    const suggestion = await getNextSkillToLearn(playerId)

    return NextResponse.json({
      suggestion,
    })
  } catch (error) {
    console.error('Error fetching next skill:', error)
    return NextResponse.json({ error: 'Failed to fetch next skill' }, { status: 500 })
  }
})
