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
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const row = await db
      .select()
      .from(playerSessionPreferences)
      .where(eq(playerSessionPreferences.playerId, playerId))
      .get()

    const parsed = row
      ? (JSON.parse(row.config) as PlayerSessionPreferencesConfig & {
          euclidLanguageStyle?: PlayerSessionPreferencesConfig['kidLanguageStyle']
        })
      : null

    if (parsed && !parsed.kidLanguageStyle && parsed.euclidLanguageStyle) {
      parsed.kidLanguageStyle = parsed.euclidLanguageStyle
    }

    return NextResponse.json({
      preferences: parsed,
    })
  } catch (error) {
    console.error('Error fetching session preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch session preferences' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getUserId()
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
})
