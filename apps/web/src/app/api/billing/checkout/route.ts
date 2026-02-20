import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getStripe, FAMILY_MONTHLY_PRICE_ID, FAMILY_ANNUAL_PRICE_ID } from '@/lib/stripe'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://abaci.one'

/**
 * POST /api/billing/checkout
 *
 * Create a Stripe Checkout session for the Family plan.
 * Body: { interval: 'month' | 'year' }
 */
export const POST = withAuth(
  async (request, { userId, userEmail }) => {
    const { interval = 'month' } = await request.json()

    const priceId = interval === 'year' ? FAMILY_ANNUAL_PRICE_ID : FAMILY_MONTHLY_PRICE_ID
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
    }

    // Check if user already has a Stripe customer ID
    const existing = await db
      .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .get()

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/settings?billing=canceled`,
      client_reference_id: userId,
      ...(existing?.stripeCustomerId
        ? { customer: existing.stripeCustomerId }
        : { customer_email: userEmail || undefined }),
      metadata: { userId },
    })

    return NextResponse.json({ url: session.url })
  },
  { role: 'user' }
)
