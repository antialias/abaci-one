import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { syncCheckoutSession } from '@/lib/billing-sync'

/**
 * POST /api/billing/checkout/verify
 *
 * Verify a completed Stripe Checkout session and sync the subscription
 * to the local database. Called on the success redirect so the app
 * doesn't depend solely on webhooks (which don't reach localhost).
 *
 * Body: { sessionId: string }
 */
export const POST = withAuth(
  async (request) => {
    const { sessionId } = await request.json()
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    try {
      await syncCheckoutSession(sessionId)
      return NextResponse.json({ synced: true })
    } catch (err) {
      console.error('[billing/checkout/verify] Failed to sync:', err)
      return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 })
    }
  },
  { role: 'user' }
)
