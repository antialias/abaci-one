/**
 * API route for per-student session preferences
 *
 * GET /api/curriculum/[playerId]/session-preferences
 * PUT /api/curriculum/[playerId]/session-preferences
 *
 * Persists StartPracticeModal settings per student so they survive
 * across modal opens and browser refreshes.
 */

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { playerSessionPreferences } from '@/db/schema/player-session-preferences'
import type { PlayerSessionPreferencesConfig } from '@/db/schema/player-session-preferences'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const row = await db
      .select()
      .from(playerSessionPreferences)
      .where(eq(playerSessionPreferences.playerId, playerId))
      .get()

    return NextResponse.json({
      preferences: row ? (JSON.parse(row.config) as PlayerSessionPreferencesConfig) : null,
    })
  } catch (error) {
    console.error('Error fetching session preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch session preferences' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getDbUserId()
    const canEdit = await canPerformAction(userId, playerId, 'start-session')
    if (!canEdit) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = (await request.json()) as { preferences: PlayerSessionPreferencesConfig }
    const config = JSON.stringify(body.preferences)
    const now = Date.now()

    await db
      .insert(playerSessionPreferences)
      .values({ playerId, config, updatedAt: now })
      .onConflictDoUpdate({
        target: playerSessionPreferences.playerId,
        set: { config, updatedAt: now },
      })

    return NextResponse.json({ preferences: body.preferences })
  } catch (error) {
    console.error('Error saving session preferences:', error)
    return NextResponse.json({ error: 'Failed to save session preferences' }, { status: 500 })
  }
}
