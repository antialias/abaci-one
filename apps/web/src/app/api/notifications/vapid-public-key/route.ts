import { NextResponse } from 'next/server'

/**
 * GET /api/notifications/vapid-public-key
 *
 * Returns the VAPID public key for browser push subscription.
 * No auth required — the public key is not secret.
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) {
    return NextResponse.json({ vapidPublicKey: null }, { status: 404 })
  }
  return NextResponse.json({ vapidPublicKey: key })
}
