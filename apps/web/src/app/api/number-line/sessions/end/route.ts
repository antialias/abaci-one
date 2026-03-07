import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { players } from '@/db/schema/players'
import { startMomentCull } from '@/lib/tasks/moment-cull'

/** POST /api/number-line/sessions/end — mark a session as ended and trigger cull */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const { sessionId } = (await request.json()) as { sessionId: string }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Verify session exists
    const [session] = await db
      .select()
      .from(schema.numberLineSessions)
      .where(eq(schema.numberLineSessions.id, sessionId))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify the session's player belongs to this user
    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.id, session.playerId), eq(players.userId, userId)))
      .limit(1)
    if (!player) {
      return NextResponse.json({ error: 'Not authorized for this session' }, { status: 403 })
    }

    // Mark session as ended
    await db
      .update(schema.numberLineSessions)
      .set({ endedAt: new Date() })
      .where(eq(schema.numberLineSessions.id, sessionId))

    // Skip cull if no moments were marked
    if (session.momentCount === 0) {
      await db
        .update(schema.numberLineSessions)
        .set({ isCulled: true })
        .where(eq(schema.numberLineSessions.id, sessionId))
      return NextResponse.json({ ok: true, culled: false })
    }

    // Enqueue cull task
    const taskId = await startMomentCull(
      {
        sessionId,
        playerId: session.playerId,
        callerNumber: session.callerNumber,
      },
      userId
    )

    // Store task reference on session
    await db
      .update(schema.numberLineSessions)
      .set({ cullTaskId: taskId })
      .where(eq(schema.numberLineSessions.id, sessionId))

    return NextResponse.json({ ok: true, cullTaskId: taskId })
  } catch (err) {
    console.error('[number-line/sessions/end] POST failed:', err)
    return NextResponse.json({ error: 'Failed to end session' }, { status: 500 })
  }
})
