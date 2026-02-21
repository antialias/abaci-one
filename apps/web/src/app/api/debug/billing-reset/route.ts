import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/debug/billing-reset
 *
 * Deletes the current user's subscription row from the local database,
 * resetting them to the Free tier. Does NOT cancel the Stripe subscription —
 * this is a local-only reset for testing.
 *
 * Admin-only (via route-policy.csv: /api/debug/* → admin).
 */
export const POST = withAuth(async (_request, { userId }) => {
  const deleted = await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .returning({ id: schema.subscriptions.id })

  if (deleted.length === 0) {
    return NextResponse.json({ reset: false, message: 'No subscription found' })
  }

  return NextResponse.json({ reset: true, deletedId: deleted[0].id })
})
