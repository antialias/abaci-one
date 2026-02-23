/**
 * Session Song API — trigger generation and check status.
 *
 * POST — Trigger song generation for a session plan
 * GET  — Get song status for a session plan
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { isEnabled } from '@/lib/feature-flags'
import { getEffectiveTierForStudent } from '@/lib/subscription'
import { startSessionSongGeneration } from '@/lib/tasks/session-song'
import type { SessionSongTriggerSource } from '@/db/schema/session-songs'

/**
 * POST /api/curriculum/[playerId]/sessions/plans/[planId]/song
 *
 * Trigger song generation. Idempotent — returns existing song if already started.
 */
export const POST = withAuth(async (request, { userId, params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    // Check feature flag
    const enabled = await isEnabled('session-song.enabled')
    if (!enabled) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 404 })
    }

    // Check tier
    const tierResult = await getEffectiveTierForStudent(playerId, userId)
    if (tierResult.tier !== 'family') {
      return NextResponse.json(
        { error: 'Session songs require a family subscription' },
        { status: 403 }
      )
    }

    // Parse optional trigger source from body
    let triggerSource: SessionSongTriggerSource = 'smart_trigger'
    try {
      const body = await request.json()
      if (body.triggerSource === 'completion_fallback') {
        triggerSource = 'completion_fallback'
      }
    } catch {
      // No body or invalid JSON — use default
    }

    const result = await startSessionSongGeneration(
      { sessionPlanId: planId, playerId, triggerSource },
      userId
    )

    if (result.existing) {
      return NextResponse.json(
        { songId: result.songId, taskId: result.taskId, existing: true },
        { status: 200 }
      )
    }

    return NextResponse.json({ songId: result.songId, taskId: result.taskId }, { status: 202 })
  } catch (error) {
    console.error('Error triggering session song:', error)
    return NextResponse.json({ error: 'Failed to start song generation' }, { status: 500 })
  }
})

/**
 * GET /api/curriculum/[playerId]/sessions/plans/[planId]/song
 *
 * Get song status for a session plan.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { planId } = (await params) as { playerId: string; planId: string }

  try {
    const [song] = await db
      .select()
      .from(schema.sessionSongs)
      .where(eq(schema.sessionSongs.sessionPlanId, planId))
      .limit(1)

    if (!song) {
      return NextResponse.json({ song: null })
    }

    return NextResponse.json({
      song: {
        id: song.id,
        status: song.status,
        title: (song.llmOutput as { title?: string } | null)?.title ?? null,
        durationSeconds: song.durationSeconds,
        audioPath: song.status === 'completed' ? `/api/audio/songs/${song.id}` : null,
        triggerSource: song.triggerSource,
        createdAt: song.createdAt instanceof Date ? song.createdAt.getTime() : song.createdAt,
        completedAt:
          song.completedAt instanceof Date ? song.completedAt.getTime() : song.completedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching session song:', error)
    return NextResponse.json({ error: 'Failed to fetch song' }, { status: 500 })
  }
})
