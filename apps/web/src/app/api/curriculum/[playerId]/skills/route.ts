/**
 * API route for skill mastery operations
 *
 * POST /api/curriculum/[playerId]/skills - Record a skill attempt
 * PUT /api/curriculum/[playerId]/skills - Set mastered skills (manual override)
 */

import { NextResponse } from 'next/server'
import { recordSkillAttempt, setMasteredSkills } from '@/lib/curriculum/progress-manager'

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

/**
 * PUT - Set which skills are mastered (teacher manual override)
 * Body: { masteredSkillIds: string[] }
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { masteredSkillIds } = body

    if (!Array.isArray(masteredSkillIds)) {
      return NextResponse.json({ error: 'masteredSkillIds must be an array' }, { status: 400 })
    }

    // Validate that all items are strings
    if (!masteredSkillIds.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'All skill IDs must be strings' }, { status: 400 })
    }

    const result = await setMasteredSkills(playerId, masteredSkillIds)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error setting mastered skills:', error)
    return NextResponse.json({ error: 'Failed to set mastered skills' }, { status: 500 })
  }
}
