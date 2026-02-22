import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { markSubscriptionExpired } from '@/lib/notifications/subscription-manager'

/**
 * GET /api/notifications/subscriptions/[id]/unsubscribe
 *
 * One-click unsubscribe endpoint — no authentication required.
 * Used in email unsubscribe links. Marks the subscription as expired.
 *
 * Returns an HTML page confirming the unsubscription.
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }

    if (!id) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    await markSubscriptionExpired(id)

    // Return a simple HTML confirmation page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed - Abaci One</title>
</head>
<body style="margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;display:flex;justify-content:center;">
  <div style="max-width:480px;background:#fff;border-radius:12px;padding:32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="font-size:48px;margin-bottom:16px;">✓</div>
    <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;">Unsubscribed</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#71717a;">
      You will no longer receive practice notifications for this subscription.
    </p>
    <a href="/" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
      Go to Abaci One
    </a>
  </div>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('[notifications] Failed to unsubscribe:', error)
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
})
