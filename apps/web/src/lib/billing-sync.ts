import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getStripe } from './stripe'
import { createId } from '@paralleldrive/cuid2'

/**
 * Sync a completed checkout session into the local subscriptions table.
 *
 * Idempotent — safe to call from both the Stripe webhook and the
 * verify-on-redirect endpoint. If a subscription row already exists
 * for this user, it's updated; otherwise a new row is created.
 */
export async function syncCheckoutSession(sessionId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId)

  const userId = session.client_reference_id || session.metadata?.userId
  if (!userId || !session.subscription || !session.customer) return

  const stripeSubscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription.id
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer.id

  // Fetch full subscription to get current_period_end
  const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId)
  const firstItem = sub.items.data[0]
  const currentPeriodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : new Date()

  const now = new Date()
  const existing = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .get()

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        plan: 'family',
        status: 'active',
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      })
      .where(eq(schema.subscriptions.userId, userId))
  } else {
    await db.insert(schema.subscriptions).values({
      id: createId(),
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      plan: 'family',
      status: 'active',
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    })
  }

  console.log(`[billing-sync] synced checkout session: user=${userId} plan=family`)
}
