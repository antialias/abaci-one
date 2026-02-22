import webpush from 'web-push'
import type { WebPushSubscriptionJson } from '@/db/schema'

let configured = false

/**
 * Lazily configure VAPID credentials — avoids crashes at build time
 * when env vars are absent.
 */
function ensureConfigured(): void {
  if (configured) return

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error(
      '[web-push] NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set'
    )
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
 * Send a web push notification to a subscription endpoint.
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
 * Reset configured state (for testing).
 */
export function _resetWebPushConfig(): void {
  configured = false
}
