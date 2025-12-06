/**
 * API route for recording skill attempts
 *
 * POST /api/curriculum/[playerId]/skills - Record a skill attempt
 */

import { NextResponse } from 'next/server'
import { recordSkillAttempt } from '@/lib/curriculum/progress-manager'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * POST - Record a single skill attempt
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { skillId, isCorrect } = body

    if (!skillId) {
      return NextResponse.json({ error: 'Skill ID required' }, { status: 400 })
    }

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'isCorrect must be a boolean' }, { status: 400 })
    }

    const result = await recordSkillAttempt(playerId, skillId, isCorrect)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error recording skill attempt:', error)
    return NextResponse.json({ error: 'Failed to record skill attempt' }, { status: 500 })
  }
}
