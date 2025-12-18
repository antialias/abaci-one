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
import { getNextSkillToLearn } from '@/lib/curriculum/skill-unlock'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * GET - Get the next skill the student should learn
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const suggestion = await getNextSkillToLearn(playerId)

    return NextResponse.json({
      suggestion,
    })
  } catch (error) {
    console.error('Error fetching next skill:', error)
    return NextResponse.json({ error: 'Failed to fetch next skill' }, { status: 500 })
  }
}
