import type {
  NotificationChannel,
  DeliveryTarget,
  NotificationEvent,
  DeliveryResult,
} from '../types'
import { formatNotificationContent } from '../types'
import { sendWebPush, sendWebPushToUser } from '../web-push'

/**
 * Web Push notification channel implementation.
 *
 * For authenticated users: looks up all registered push endpoints from
 * user_push_subscriptions and sends to each.
 *
 * For legacy/anonymous subscribers: uses the push subscription stored
 * directly on the delivery target (from the practice subscription record).
 */
export const webPushChannel: NotificationChannel = {
  name: 'webPush',

  canDeliver(target: DeliveryTarget): boolean {
    return target.channels.push && (!!target.userId || !!target.subscriptionPushEndpoint)
  },

  async deliver(target: DeliveryTarget, event: NotificationEvent): Promise<DeliveryResult> {
    const content = formatNotificationContent(event)

    const payload = {
      title: content.title,
      body: content.body,
      icon: content.icon,
      data: { url: content.url },
    }

    // Legacy path: use the push subscription from the subscription record
    if (target.subscriptionPushEndpoint) {
      try {
        const result = await sendWebPush(target.subscriptionPushEndpoint, payload)
        if (result.success) return { success: true }
        return {
          success: false,
          error: `Push endpoint returned ${result.statusCode}`,
          shouldDisable: true,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: `webPush: ${message}` }
      }
    }

    // User-level path: send to all registered push endpoints
    try {
      const result = await sendWebPushToUser(target.userId, payload)
      if (result.sent === 0 && result.total === 0) {
        return { success: false, error: 'No push subscriptions registered for user' }
      }
      if (result.sent === 0) {
        return { success: false, error: `All ${result.total} push endpoints failed` }
      }
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `webPush: ${message}` }
    }
  },
}
