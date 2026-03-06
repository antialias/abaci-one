import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userPushSubscriptions } from '@/db/schema'
import type { WebPushSubscriptionJson } from '@/db/schema'

let configured = false

/**
 * Lazily configure VAPID credentials — avoids crashes at build time
 * when env vars are absent.
 */
function ensureConfigured(): void {
  if (configured) return

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('[web-push] VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set')
  }

  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hallock@gmail.com'
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface WebPushResult {
  success: boolean
  statusCode?: number
}

/**
 * Send a web push notification to a single subscription endpoint.
 *
 * Catches 410 Gone and 404 (endpoint expired/invalid) and returns
 * a failure result instead of throwing — the caller can use
 * `shouldDisable` logic based on statusCode.
 *
 * Re-throws other errors for the channel to handle.
 */
export async function sendWebPush(
  subscription: WebPushSubscriptionJson,
  payload: object
): Promise<WebPushResult> {
  ensureConfigured()

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    )
    return { success: true, statusCode: 201 }
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : undefined

    // 410 Gone or 404 = endpoint expired / unsubscribed
    if (statusCode === 410 || statusCode === 404) {
      return { success: false, statusCode }
    }

    throw err
  }
}

/**
 * Send a web push notification to ALL registered push endpoints for a user.
 *
 * Looks up endpoints from user_push_subscriptions table.
 * Removes expired endpoints (410/404) automatically.
 * Returns count of total endpoints and successful sends.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: object
): Promise<{ total: number; sent: number }> {
  const subs = await db
    .select()
    .from(userPushSubscriptions)
    .where(eq(userPushSubscriptions.userId, userId))

  if (subs.length === 0) return { total: 0, sent: 0 }

  let sent = 0
  for (const sub of subs) {
    const pushSub: WebPushSubscriptionJson = {
      endpoint: sub.endpoint,
      keys: sub.keys,
    }
    try {
      const result = await sendWebPush(pushSub, payload)
      if (result.success) {
        sent++
        // Update lastUsedAt
        db.update(userPushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(userPushSubscriptions.id, sub.id))
          .catch(() => {})
      } else if (result.statusCode === 410 || result.statusCode === 404) {
        // Endpoint gone — remove it
        db.delete(userPushSubscriptions)
          .where(eq(userPushSubscriptions.id, sub.id))
          .catch((err) => console.error('[web-push] Failed to remove expired endpoint:', err))
      }
    } catch (err) {
      console.error('[web-push] Error sending to endpoint:', err)
    }
  }

  return { total: subs.length, sent }
}

/**
 * Reset configured state (for testing).
 */
export function _resetWebPushConfig(): void {
  configured = false
}
