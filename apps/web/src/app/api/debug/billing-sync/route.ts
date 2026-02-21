import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { syncCheckoutSession } from '@/lib/billing-sync'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/debug/billing-sync
 *
 * Finds the most recent completed Stripe checkout session for the current
 * user and syncs it to the local database. Useful when the verify-on-redirect
 * flow fails (e.g., wrong redirect URL, network issue).
 *
 * Admin-only (via route-policy.csv: /api/debug/* → admin).
 */
export const POST = withAuth(async (_request, { userId }) => {
  const stripe = getStripe()

  // List recent completed checkout sessions and find one for this user
  const sessions = await stripe.checkout.sessions.list({
    limit: 20,
    status: 'complete',
  })

  const match = sessions.data.find(
    (s) => s.client_reference_id === userId || s.metadata?.userId === userId
  )

  if (!match) {
    return NextResponse.json(
      { error: 'No completed checkout session found for your user' },
      { status: 404 }
    )
  }

  await syncCheckoutSession(match.id)

  return NextResponse.json({
    synced: true,
    sessionId: match.id,
    subscriptionId: match.subscription,
  })
})
