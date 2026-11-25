/**
 * POST /api/curriculum/[playerId]/sessions/plans/[planId]/song/retry
 *
 * Fill in a session's missing song: retry its failed song. Open to anyone who can
 * start the student's practice sessions on a family plan, not only admins, but only
 * when kidRetryRefusal allows it (the failure clears up on its own, songs work now,
 * and the song hasn't been tried too often).
 */

import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { isEnabled } from '@/lib/feature-flags'
import { kidRetryRefusal, latestSongOutcome } from '@/lib/session-song/kid-retry'
import { getEffectiveTierForStudent } from '@/lib/subscription'
import { retrySessionSongGeneration } from '@/lib/tasks/session-song'

export const POST = withAuth(async (_request, { userId, params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    if (!(await isEnabled('session-song.enabled'))) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 404 })
    }
    if (!userId || !(await canPerformAction(userId, playerId, 'start-session'))) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }
    const tier = await getEffectiveTierForStudent(playerId, userId)
    if (tier.tier !== 'family') {
      return NextResponse.json(
        { error: 'Session songs require a family subscription' },
        { status: 403 }
      )
    }

    const [song] = await db
      .select()
      .from(schema.sessionSongs)
      .where(
        and(
          eq(schema.sessionSongs.sessionPlanId, planId),
          eq(schema.sessionSongs.playerId, playerId)
        )
      )
      .orderBy(desc(schema.sessionSongs.createdAt))
      .limit(1)
    if (!song) {
      return NextResponse.json({ error: 'No song for this session' }, { status: 404 })
    }

    const refusal = kidRetryRefusal(song, await latestSongOutcome())
    if (refusal) {
      return NextResponse.json({ error: refusal }, { status: 409 })
    }

    const result = await retrySessionSongGeneration(song.id, {
      userId,
      reason: 'Filled in from the session page',
    })
    return NextResponse.json({ songId: result.songId, taskId: result.taskId }, { status: 202 })
  } catch (error) {
    console.error('Error retrying session song:', error)
    return NextResponse.json({ error: 'Failed to retry the song' }, { status: 500 })
  }
})
