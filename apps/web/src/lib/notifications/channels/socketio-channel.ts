import type {
  NotificationChannel,
  DeliveryTarget,
  NotificationEvent,
  DeliveryResult,
} from '../types'
import { formatNotificationContent } from '../types'
import { getSocketIO } from '@/lib/socket-io'

/**
 * Socket.IO in-app notification channel.
 *
 * Emits a typed notification event to the user's Socket.IO room
 * so that connected clients can show an in-app toast/banner.
 */
export const socketIOChannel: NotificationChannel = {
  name: 'inApp',

  canDeliver(target: DeliveryTarget): boolean {
    return target.channels.inApp && !!target.userId
  },

  async deliver(target: DeliveryTarget, event: NotificationEvent): Promise<DeliveryResult> {
    const io = await getSocketIO()
    if (!io) {
      return { success: false, error: 'Socket.IO server not available' }
    }

    const content = formatNotificationContent(event)

    io.to(`user:${target.userId}`).emit('notification', {
      type: event.type,
      ...content,
      data: event.data,
    })

    return { success: true }
  },
}
