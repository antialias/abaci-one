import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/debug/billing-set-tier
 *
 * Sets the current user's tier for e2e testing.
 *
 * - { tier: 'free' }   → deletes subscription row (resolves to free)
 * - { tier: 'family' } → upserts subscription with plan: 'family', status: 'active'
 *
 * Admin-only (via route-policy.csv: /api/debug/* → admin).
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const { tier } = body

  if (tier !== 'free' && tier !== 'family') {
    return NextResponse.json({ error: 'tier must be "free" or "family"' }, { status: 400 })
  }

  if (tier === 'free') {
    const deleted = await db
      .delete(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .returning({ id: schema.subscriptions.id })

    return NextResponse.json({
      tier: 'free',
      action: deleted.length > 0 ? 'deleted' : 'already_free',
    })
  }

  // tier === 'family': upsert subscription row
  const now = new Date()
  await db
    .insert(schema.subscriptions)
    .values({
      userId,
      stripeCustomerId: `cus_test_${userId}`,
      stripeSubscriptionId: `sub_test_${userId}`,
      plan: 'family',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        plan: 'family',
        status: 'active',
        stripeCustomerId: `cus_test_${userId}`,
        stripeSubscriptionId: `sub_test_${userId}`,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        updatedAt: now,
      },
    })

  return NextResponse.json({ tier: 'family', action: 'upserted' })
})
