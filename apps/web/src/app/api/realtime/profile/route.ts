/**
 * API route that assembles a child profile for mid-call identification.
 *
 * POST /api/realtime/profile
 * Body: { playerId: string }
 * Returns: { profile: ChildProfile } or { failed: true }
 */

import { NextResponse } from 'next/server'
import { assembleChildProfile } from '@/components/toys/number-line/talkToNumber/assembleChildProfile'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { playerId } = body

    if (typeof playerId !== 'string' || !playerId) {
      return NextResponse.json(
        { error: 'playerId must be a non-empty string' },
        { status: 400 }
      )
    }

    const result = await assembleChildProfile(playerId)

    if (result && 'failed' in result) {
      return NextResponse.json({ failed: true })
    }

    return NextResponse.json({ profile: result })
  } catch (error) {
    console.error('[realtime/profile] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
