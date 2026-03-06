import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type AuthenticatedContext } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/** POST /api/postcards/:postcardId/read — mark a postcard as read */
export const POST = withAuth(async (_request: NextRequest, context: AuthenticatedContext) => {
  try {
    const userId = await getUserId()
    const params = await context.params
    const postcardId = params.postcardId as string

    await db
      .update(schema.numberLinePostcards)
      .set({ isRead: true, updatedAt: new Date() })
      .where(
        and(
          eq(schema.numberLinePostcards.id, postcardId),
          eq(schema.numberLinePostcards.userId, userId)
        )
      )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[postcards/read] POST failed:', err)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
})
