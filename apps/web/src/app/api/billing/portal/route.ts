import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { stripe } from '@/lib/stripe'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://abaci.one'

/**
 * POST /api/billing/portal
 *
 * Create a Stripe Customer Portal session for managing subscription.
 */
export const POST = withAuth(
  async (_request, { userId }) => {
    const sub = await db
      .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .get()

    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${APP_URL}/settings`,
    })

    return NextResponse.json({ url: session.url })
  },
  { role: 'user' }
)
