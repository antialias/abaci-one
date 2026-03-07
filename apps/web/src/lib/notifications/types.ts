import type { NotificationType } from '@/db/schema/user-notification-settings'

// ---------------------------------------------------------------------------
// Event payloads — one per notification type
// ---------------------------------------------------------------------------

export interface SessionStartedPayload {
  sessionId: string
  playerId: string
  playerName: string
  playerEmoji: string
  observeUrl: string
}

export interface PostcardReadyPayload {
  postcardId: string
  callerNumber: number
  imageUrl: string | null
  thumbnailUrl: string | null
  postcardUrl: string
}

// ---------------------------------------------------------------------------
// Discriminated union of all notification events
// ---------------------------------------------------------------------------

export type NotificationEvent =
  | { type: 'session-started'; data: SessionStartedPayload }
  | { type: 'postcard-ready'; data: PostcardReadyPayload }

/**
 * Extract the payload type for a given notification type.
 * Useful for channel implementations that switch on event.type.
 */
export type PayloadFor<T extends NotificationType> = Extract<NotificationEvent, { type: T }>['data']

// ---------------------------------------------------------------------------
// Delivery target — who to notify and how to reach them
// ---------------------------------------------------------------------------

/**
 * Resolved delivery target — represents one user who should receive
 * a notification, with their resolved channel preferences and endpoints.
 */
export interface DeliveryTarget {
  userId: string
  email: string | null
  channels: {
    inApp: boolean
    push: boolean
    email: boolean
  }
  /**
   * Push endpoint from a practice notification subscription record.
   * Used for anonymous subscribers who don't have user-level push registrations.
   * When present, the web push channel sends directly to this endpoint
   * instead of looking up user_push_subscriptions.
   */
  subscriptionPushEndpoint?: { endpoint: string; keys: { p256dh: string; auth: string } }
}

// ---------------------------------------------------------------------------
// Channel interface — delivery implementations
// ---------------------------------------------------------------------------

export interface NotificationChannel {
  /** Must match a key in NotificationChannelsConfig: 'webPush' | 'email' | 'inApp' */
  name: string
  /** Check whether this target has the data needed for delivery via this channel */
  canDeliver(target: DeliveryTarget): boolean
  /** Attempt to deliver a notification to a target */
  deliver(target: DeliveryTarget, event: NotificationEvent): Promise<DeliveryResult>
}

export interface DeliveryResult {
  success: boolean
  error?: string
  /** When true, the push endpoint should be removed (e.g. 410 Gone) */
  shouldDisable?: boolean
}

export interface NotifyResult {
  targetCount: number
  attempted: number
  succeeded: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Helpers for formatting notification content per event type
// ---------------------------------------------------------------------------

export interface NotificationContent {
  title: string
  body: string
  icon: string
  url: string
}

/** Format a notification event into display-ready content */
export function formatNotificationContent(event: NotificationEvent): NotificationContent {
  switch (event.type) {
    case 'session-started':
      return {
        title: `${event.data.playerName} started practicing!`,
        body: 'Tap to watch live',
        icon: '/icon-192x192.png',
        url: event.data.observeUrl,
      }
    case 'postcard-ready':
      return {
        title: `Your postcard from #${Number.isInteger(event.data.callerNumber) ? event.data.callerNumber : event.data.callerNumber.toPrecision(4)} is ready!`,
        body: 'Tap to view your postcard',
        icon: event.data.thumbnailUrl ?? '/icon-192x192.png',
        url: event.data.postcardUrl,
      }
  }
}
