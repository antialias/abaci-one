import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

/** GET /api/postcards/unread-count — count unread postcards */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')

    const conditions = [
      eq(schema.numberLinePostcards.userId, userId),
      eq(schema.numberLinePostcards.status, 'ready'),
      eq(schema.numberLinePostcards.isRead, false),
    ]
    if (playerId) {
      conditions.push(eq(schema.numberLinePostcards.playerId, playerId))
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.numberLinePostcards)
      .where(and(...conditions))

    return NextResponse.json({ count: result?.count ?? 0 })
  } catch (err) {
    console.error('[postcards/unread-count] GET failed:', err)
    return NextResponse.json({ error: 'Failed to count postcards' }, { status: 500 })
  }
})
