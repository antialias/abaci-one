/**
 * API route for getting the session mode for a student
 *
 * GET /api/curriculum/[playerId]/session-mode
 *
 * Returns the unified session mode that determines:
 * - What type of session should be run (remediation/progression/maintenance)
 * - What to show in the dashboard banner
 * - What CTA to show in the StartPracticeModal
 * - What problems the session planner should generate
 *
 * This is the single source of truth for session planning decisions.
 */

import { NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/classroom'
import { getSessionMode, type SessionMode } from '@/lib/curriculum/session-mode'
import { getSessionModeComfortLevel } from '@/lib/curriculum/session-mode-comfort'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

export interface SessionModeResponse {
  sessionMode: SessionMode
  comfortLevel: number
}

/**
 * GET - Get the session mode for a student
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

    const sessionMode = await getSessionMode(playerId)
    const comfortLevel = await getSessionModeComfortLevel(playerId, sessionMode)

    return NextResponse.json({
      sessionMode,
      comfortLevel,
    } satisfies SessionModeResponse)
  } catch (error) {
    console.error('Error fetching session mode:', error)
    return NextResponse.json({ error: 'Failed to fetch session mode' }, { status: 500 })
  }
}
