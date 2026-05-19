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
import { loadSessionMoments } from '@/lib/session-moments/persist'
import { parseSongPlan } from '@/lib/song-share/songPlan'
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
export const GET = withAuth(async (_request, { userId, userRole, params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    const [song] = await db
      .select()
      .from(schema.sessionSongs)
      .where(eq(schema.sessionSongs.sessionPlanId, planId))
      .limit(1)

    if (!song) {
      return NextResponse.json({ song: null })
    }

    // Owner = the user who owns the player profile. Admins see owner-level
    // detail for any player. Used to gate raw error details and remediation.
    let isOwnerOrAdmin = userRole === 'admin'
    if (!isOwnerOrAdmin && userId) {
      const [player] = await db
        .select({ userId: schema.players.userId })
        .from(schema.players)
        .where(eq(schema.players.id, playerId))
        .limit(1)
      if (player?.userId === userId) isOwnerOrAdmin = true
    }

    const parsedPlan = parseSongPlan(song.llmOutput)
    // Per-section lyrics for the synced-lyrics player. Shaped down from the
    // full plan so we don't leak style/validation metadata to the client.
    const lyrics =
      song.status === 'completed'
        ? parsedPlan.sections.map((s) => ({
            name: s.name,
            lines: s.lines,
            durationMs: s.durationMs,
            momentRefs: s.momentRefs,
          }))
        : null

    // Resolved moments (snapshot + summary) for the SceneStage renderer.
    // Empty for legacy songs that pre-date moment derivation.
    const moments = song.status === 'completed' ? await loadSessionMoments(song.sessionPlanId) : []

    return NextResponse.json({
      song: {
        id: song.id,
        status: song.status,
        title: parsedPlan.title,
        durationSeconds: song.durationSeconds,
        audioPath: song.status === 'completed' ? `/api/audio/songs/${song.id}` : null,
        // Word-alignment sidecar. The route 404s for songs generated before
        // timestamps shipped, so older songs degrade to plain playback.
        alignmentPath:
          song.status === 'completed' ? `/api/audio/songs/${song.id}/alignment` : null,
        lyrics,
        moments,
        triggerSource: song.triggerSource,
        failureKind: song.status === 'failed' ? (song.failureKind ?? null) : null,
        // Raw error string is owner/admin-only — leak nothing to other viewers.
        errorDetail: song.status === 'failed' && isOwnerOrAdmin ? song.errorMessage : null,
        viewerIsOwner: isOwnerOrAdmin,
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
