import type { PracticeNotificationSubscription } from '@/db/schema'

export interface NotificationChannel {
  /** Must match a key in NotificationChannelsConfig: 'webPush' | 'email' | 'inApp' */
  name: string
  /** Check whether this subscription has the data needed for delivery */
  canDeliver(sub: PracticeNotificationSubscription): boolean
  /** Attempt to deliver a notification */
  deliver(sub: PracticeNotificationSubscription, event: SessionStartedPayload): Promise<DeliveryResult>
}

export interface SessionStartedPayload {
  sessionId: string
  playerId: string
  playerName: string
  playerEmoji: string
  observeUrl: string
}

export interface DeliveryResult {
  success: boolean
  error?: string
  /** When true, the subscription should be marked expired (e.g. push endpoint gone) */
  shouldDisable?: boolean
}

export interface NotifyResult {
  subscriptionCount: number
  throttled: number
  attempted: number
  succeeded: number
  errors: string[]
}
