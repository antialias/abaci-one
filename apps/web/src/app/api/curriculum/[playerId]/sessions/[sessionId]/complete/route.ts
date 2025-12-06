/**
 * API route for completing practice sessions
 *
 * POST /api/curriculum/[playerId]/sessions/[sessionId]/complete - Complete a session
 */

import { NextResponse } from 'next/server'
import { completePracticeSession } from '@/lib/curriculum/progress-manager'

interface RouteParams {
  params: Promise<{ playerId: string; sessionId: string }>
}

/**
 * POST - Complete a practice session
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId, sessionId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { problemsAttempted, problemsCorrect, skillsUsed, averageTimeMs, totalTimeMs } = body

    const session = await completePracticeSession(sessionId, {
      ...(problemsAttempted !== undefined && { problemsAttempted }),
      ...(problemsCorrect !== undefined && { problemsCorrect }),
      ...(skillsUsed !== undefined && { skillsUsed }),
      ...(averageTimeMs !== undefined && { averageTimeMs }),
      ...(totalTimeMs !== undefined && { totalTimeMs }),
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error completing session:', error)
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 })
  }
}
