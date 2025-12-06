/**
 * API route for practice sessions
 *
 * POST /api/curriculum/[playerId]/sessions - Start a new practice session
 */

import { NextResponse } from 'next/server'
import { startPracticeSession } from '@/lib/curriculum/progress-manager'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * POST - Start a new practice session
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { phaseId, visualizationMode = false } = body

    if (!phaseId) {
      return NextResponse.json({ error: 'Phase ID required' }, { status: 400 })
    }

    const session = await startPracticeSession(playerId, phaseId, visualizationMode)

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error starting session:', error)
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 })
  }
}
