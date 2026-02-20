import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { syncCheckoutSession } from '@/lib/billing-sync'

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler. Processes subscription lifecycle events
 * to keep the local subscriptions table in sync.
 *
 * This route does NOT use withAuth — Stripe signs the request itself.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      default:
        // Ignore unhandled event types
        break
    }
  } catch (err) {
    console.error(`[stripe webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * New checkout completed — create or update subscription record.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  await syncCheckoutSession(session.id)
}

/**
 * Subscription updated — sync status, plan, period end, cancel flag.
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const stripeSubscriptionId = sub.id
  const existing = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .get()

  if (!existing) {
    console.warn(`[stripe webhook] subscription.updated for unknown sub: ${stripeSubscriptionId}`)
    return
  }

  const status = mapStripeStatus(sub.status)

  await db
    .update(schema.subscriptions)
    .set({
      status,
      currentPeriodEnd: sub.items.data[0]?.current_period_end
        ? new Date(sub.items.data[0].current_period_end * 1000)
        : new Date(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))

  console.log(`[stripe webhook] subscription.updated: sub=${stripeSubscriptionId} status=${status}`)
}

/**
 * Subscription deleted — mark as canceled.
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await db
    .update(schema.subscriptions)
    .set({
      status: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.stripeSubscriptionId, sub.id))

  console.log(`[stripe webhook] subscription.deleted: sub=${sub.id}`)
}

/**
 * Payment failed — mark as past_due (7-day grace, don't lock out).
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subDetails = invoice.parent?.subscription_details
  if (!subDetails) return

  const stripeSubscriptionId =
    typeof subDetails.subscription === 'string'
      ? subDetails.subscription
      : subDetails.subscription.id

  await db
    .update(schema.subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))

  console.log(`[stripe webhook] invoice.payment_failed: sub=${stripeSubscriptionId}`)
}

/** Map Stripe subscription status to our simplified status set. */
function mapStripeStatus(status: string): 'active' | 'past_due' | 'canceled' | 'trialing' {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'active'
  }
}
