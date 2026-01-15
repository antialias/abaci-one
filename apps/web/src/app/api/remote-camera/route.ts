import { NextResponse } from 'next/server'
import {
  createRemoteCameraSession,
  getRemoteCameraSession,
} from '@/lib/remote-camera/session-manager'

/**
 * POST /api/remote-camera
 * Create a new remote camera session
 */
export async function POST() {
  try {
    const session = await createRemoteCameraSession()

    return NextResponse.json({
      sessionId: session.id,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error('Failed to create remote camera session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

/**
 * GET /api/remote-camera?sessionId=xxx
 * Check if a session is valid and get its status
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const session = await getRemoteCameraSession(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 })
    }

    return NextResponse.json({
      sessionId: session.id,
      phoneConnected: session.phoneConnected,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error('Failed to get remote camera session:', error)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
}
