import type { NotificationChannel, SessionStartedPayload, DeliveryResult } from '../types'
import type { PracticeNotificationSubscription } from '@/db/schema'
import { sendWebPush } from '../web-push'

/**
 * Web Push notification channel implementation.
 *
 * Sends browser push notifications via the Web Push protocol (VAPID).
 * Requires a valid pushSubscription on the subscription record.
 */
export const webPushChannel: NotificationChannel = {
  name: 'webPush',

  canDeliver(sub: PracticeNotificationSubscription): boolean {
    return sub.channels.webPush === true && sub.pushSubscription != null
  },

  async deliver(
    sub: PracticeNotificationSubscription,
    event: SessionStartedPayload
  ): Promise<DeliveryResult> {
    if (!sub.pushSubscription) {
      return { success: false, error: 'No push subscription on record' }
    }

    const payload = {
      title: `${event.playerName} started practicing!`,
      body: 'Tap to watch live',
      icon: '/icon-192x192.png',
      data: { url: event.observeUrl },
    }

    try {
      const result = await sendWebPush(sub.pushSubscription, payload)

      if (result.success) {
        return { success: true }
      }

      // 410 or 404 — endpoint is gone, mark for disabling
      return {
        success: false,
        error: `Push endpoint returned ${result.statusCode}`,
        shouldDisable: true,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `webPush: ${message}` }
    }
  },
}
