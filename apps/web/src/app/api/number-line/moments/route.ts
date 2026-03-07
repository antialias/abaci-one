import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { players } from '@/db/schema/players'
import type { MomentSnapshot } from '@/db/schema/number-line-postcards'
import type { MomentCategory } from '@/db/schema/number-line-moments'

const VALID_CATEGORIES: MomentCategory[] = [
  'question',
  'discovery',
  'game',
  'exploration',
  'conversation',
  'conference',
]

interface MomentBody {
  playerId: string
  callerNumber: number
  sessionId: string
  moment: {
    caption: string
    category: MomentCategory
    significance: number
    snapshot?: MomentSnapshot
    transcriptExcerpt?: string
  }
}

/** POST /api/number-line/moments — persist a single marked moment (fire-and-forget from client) */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const body = (await request.json()) as MomentBody
    const { playerId, callerNumber, sessionId, moment } = body

    if (!playerId || !sessionId || !moment?.caption) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!VALID_CATEGORIES.includes(moment.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    // Verify playerId belongs to this user
    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.userId, userId)))
      .limit(1)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 403 })
    }

    // Upsert session row (create if first moment, increment count otherwise)
    await db
      .insert(schema.numberLineSessions)
      .values({
        id: sessionId,
        playerId,
        callerNumber,
        momentCount: 1,
      })
      .onConflictDoUpdate({
        target: schema.numberLineSessions.id,
        set: {
          momentCount: sql`${schema.numberLineSessions.momentCount} + 1`,
        },
      })

    // Insert the moment
    await db.insert(schema.numberLineMoments).values({
      playerId,
      callerNumber,
      sessionId,
      caption: moment.caption,
      category: moment.category,
      rawSignificance: Math.max(1, Math.min(10, Math.round(moment.significance))),
      snapshot: moment.snapshot ?? null,
      transcriptExcerpt: moment.transcriptExcerpt ?? null,
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[number-line/moments] POST failed:', err)
    return NextResponse.json({ error: 'Failed to persist moment' }, { status: 500 })
  }
})
