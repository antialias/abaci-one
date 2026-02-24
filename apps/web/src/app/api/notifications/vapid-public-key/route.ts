import { NextResponse } from 'next/server'

// Force dynamic so Next.js reads process.env at request time, not build time.
// Without this, the route would be statically cached with whatever value VAPID_PUBLIC_KEY
// had during the build (typically unset in CI), causing it to always return null in prod.
export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications/vapid-public-key
 *
 * Returns the VAPID public key for browser push subscription.
 * No auth required — the public key is not secret.
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) {
    return NextResponse.json({ vapidPublicKey: null }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ vapidPublicKey: key }, { headers: { 'Cache-Control': 'no-store' } })
}
