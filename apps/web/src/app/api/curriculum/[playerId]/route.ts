/**
 * API route for player curriculum management
 *
 * GET /api/curriculum/[playerId] - Get full curriculum state
 * PATCH /api/curriculum/[playerId] - Update curriculum settings
 */

import { NextResponse } from 'next/server'
import {
  getPlayerCurriculum,
  getAllSkillMastery,
  getRecentSessions,
  upsertPlayerCurriculum,
} from '@/lib/curriculum/progress-manager'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * GET - Fetch player's full curriculum state
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const [curriculum, skills, recentSessions] = await Promise.all([
      getPlayerCurriculum(playerId),
      getAllSkillMastery(playerId),
      getRecentSessions(playerId, 10),
    ])

    return NextResponse.json({
      curriculum,
      skills,
      recentSessions,
    })
  } catch (error) {
    console.error('Error fetching curriculum:', error)
    return NextResponse.json({ error: 'Failed to fetch curriculum' }, { status: 500 })
  }
}

/**
 * PATCH - Update curriculum settings
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { worksheetPreset, visualizationMode, currentLevel, currentPhaseId } = body

    const updated = await upsertPlayerCurriculum(playerId, {
      ...(worksheetPreset !== undefined && { worksheetPreset }),
      ...(visualizationMode !== undefined && { visualizationMode }),
      ...(currentLevel !== undefined && { currentLevel }),
      ...(currentPhaseId !== undefined && { currentPhaseId }),
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating curriculum:', error)
    return NextResponse.json({ error: 'Failed to update curriculum' }, { status: 500 })
  }
}
