import type { PracticeNotificationSubscription } from '@/db/schema'
import type { NotificationChannel, SessionStartedPayload, DeliveryResult } from '../types'
import { getSocketIO } from '@/lib/socket-io'

/**
 * Socket.IO in-app notification channel.
 *
 * Emits a 'practice-notification' event to the user's Socket.IO room
 * so that connected clients can show an in-app toast/banner.
 */
export const socketIOChannel: NotificationChannel = {
  name: 'inApp',

  canDeliver(sub: PracticeNotificationSubscription): boolean {
    return sub.channels.inApp === true && sub.userId != null
  },

  async deliver(
    sub: PracticeNotificationSubscription,
    event: SessionStartedPayload
  ): Promise<DeliveryResult> {
    if (!sub.userId) {
      return { success: false, error: 'No userId on subscription for in-app delivery' }
    }

    const io = await getSocketIO()
    if (!io) {
      return { success: false, error: 'Socket.IO server not available' }
    }

    io.to(`user:${sub.userId}`).emit('practice-notification', {
      sessionId: event.sessionId,
      playerId: event.playerId,
      playerName: event.playerName,
      playerEmoji: event.playerEmoji,
      observeUrl: event.observeUrl,
    })

    return { success: true }
  },
}
