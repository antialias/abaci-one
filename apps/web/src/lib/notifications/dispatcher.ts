import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  appSettings,
  users,
  type NotificationChannelsConfig,
  practiceNotificationSubscriptions,
  userNotificationSettings,
} from '@/db/schema'
import type {
  NotificationChannel,
  NotificationEvent,
  DeliveryTarget,
  NotifyResult,
  SessionStartedPayload,
} from './types'
import type { NotificationType, ChannelOverrides } from '@/db/schema/user-notification-settings'
import { getActiveSubscriptionsForPlayer, markSubscriptionExpired } from './subscription-manager'
import { createSessionShare } from '@/lib/session-share'

/** Throttle window: skip notification if lastNotifiedAt is within this many ms */
const THROTTLE_MS = 5 * 60 * 1000

/** Module-level channel registry */
const channels: NotificationChannel[] = []

/**
 * Register a notification channel implementation.
 * Deduplicates by name — re-registering replaces the existing channel.
 */
export function registerChannel(channel: NotificationChannel): void {
  const idx = channels.findIndex((c) => c.name === channel.name)
  if (idx >= 0) {
    channels[idx] = channel
  } else {
    channels.push(channel)
  }
}

/**
 * Get all currently registered channels.
 */
export function getRegisteredChannels(): readonly NotificationChannel[] {
  return channels
}

/**
 * Test helper: clear all registered channels.
 */
export function _resetChannels(): void {
  channels.length = 0
}

/**
 * Read the global notification channels config from app_settings.
 * Returns null if notifications are globally disabled (no config set).
 */
async function getGlobalChannelConfig(): Promise<NotificationChannelsConfig | null> {
  const [settings] = await db
    .select({ notificationChannels: appSettings.notificationChannels })
    .from(appSettings)
    .where(eq(appSettings.id, 'default'))
    .limit(1)

  if (!settings?.notificationChannels) return null

  try {
    return JSON.parse(settings.notificationChannels) as NotificationChannelsConfig
  } catch {
    console.error('[notifications] Failed to parse notificationChannels config')
    return null
  }
}

/**
 * Check whether a channel is enabled in the global config.
 */
function isChannelEnabled(config: NotificationChannelsConfig, channelName: string): boolean {
  const entry = config[channelName as keyof NotificationChannelsConfig]
  return entry?.enabled === true
}

// ---------------------------------------------------------------------------
// Resolve delivery target for a user
// ---------------------------------------------------------------------------

/**
 * Resolve a user's notification channel preferences for a given event type.
 *
 * Precedence: per-type override > user default > system default
 *   System defaults: inApp=true, push=false, email=false
 */
async function resolveDeliveryTarget(
  userId: string,
  eventType: NotificationType
): Promise<DeliveryTarget> {
  // Load user settings (or null if none exist — use system defaults)
  const [settings] = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1)

  // System defaults for users without explicit settings.
  // Postcards default to email on — they're async and the user expects delivery.
  // Session-started is real-time, so email is off by default.
  const typeDefaults: Partial<
    Record<NotificationType, { inApp: boolean; push: boolean; email: boolean }>
  > = {
    'postcard-ready': { inApp: true, push: false, email: true },
  }
  const defaults = typeDefaults[eventType] ?? {
    inApp: true,
    push: false,
    email: false,
  }

  const userDefaults = settings
    ? {
        inApp: settings.inAppEnabled,
        push: settings.pushEnabled,
        email: settings.emailEnabled,
      }
    : defaults

  // Apply per-type overrides (sparse — only set keys override)
  const overrides: ChannelOverrides | undefined = settings?.typeOverrides?.[eventType]
  const resolved = {
    inApp: overrides?.inApp ?? userDefaults.inApp,
    push: overrides?.push ?? userDefaults.push,
    email: overrides?.email ?? userDefaults.email,
  }

  // Resolve email address
  let email: string | null = settings?.notificationEmail ?? null
  if (!email) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    email = user?.email ?? null
  }

  return { userId, email, channels: resolved }
}

// ---------------------------------------------------------------------------
// notifyUser — direct user notification (postcards, system alerts, etc)
// ---------------------------------------------------------------------------

/**
 * Notify a specific user about an event.
 *
 * Uses the user's notification preferences (defaults + per-type overrides)
 * to determine which channels to deliver through.
 *
 * This is the primary entry point for non-subscription-based notifications.
 */
export async function notifyUser(userId: string, event: NotificationEvent): Promise<NotifyResult> {
  const result: NotifyResult = {
    targetCount: 1,
    attempted: 0,
    succeeded: 0,
    errors: [],
  }

  // 1. Check global config
  const config = await getGlobalChannelConfig()
  if (!config) return result

  // 2. Resolve this user's delivery preferences for this event type
  const target = await resolveDeliveryTarget(userId, event.type)

  // 3. Deliver through each enabled channel
  for (const channel of channels) {
    if (!isChannelEnabled(config, channel.name)) continue
    if (!channel.canDeliver(target)) continue

    result.attempted++
    try {
      const delivery = await channel.deliver(target, event)
      if (delivery.success) {
        result.succeeded++
      } else {
        if (delivery.error) result.errors.push(delivery.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`${channel.name}: ${message}`)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// notifySubscribers — subscription-based (practice sessions, etc)
// ---------------------------------------------------------------------------

/**
 * Notify all active subscribers for a player about an event.
 *
 * This is the subscription-based entry point used by practice session
 * notifications. It looks up who subscribed to a player, resolves each
 * subscriber's delivery preferences, and fans out through channels.
 *
 * For each subscriber, channel resolution follows user preferences
 * (if the subscriber has a userId and user_notification_settings).
 * Anonymous subscribers fall back to subscription-level channel config.
 */
export async function notifySubscribers(event: SessionStartedPayload): Promise<NotifyResult> {
  const result: NotifyResult = {
    targetCount: 0,
    attempted: 0,
    succeeded: 0,
    errors: [],
  }

  // 1. Read global config
  const config = await getGlobalChannelConfig()
  if (!config) return result

  // 2. Get active subscriptions
  const subscriptions = await getActiveSubscriptionsForPlayer(event.playerId)
  result.targetCount = subscriptions.length

  if (subscriptions.length === 0) return result

  // 3. Process each subscription
  const now = Date.now()
  let anonymousShareToken: string | null = null

  const wrappedEvent: NotificationEvent = { type: 'session-started', data: event }

  for (const sub of subscriptions) {
    // Throttle check
    if (sub.lastNotifiedAt && now - sub.lastNotifiedAt.getTime() < THROTTLE_MS) {
      continue
    }

    // For anonymous subscribers, generate a share link URL
    let subEvent = wrappedEvent
    if (!sub.userId) {
      if (!anonymousShareToken) {
        try {
          const share = await createSessionShare(event.sessionId, event.playerId, 'system', '24h')
          anonymousShareToken = share.id
        } catch (err) {
          console.error('[notifications] Failed to create share token for anonymous sub:', err)
        }
      }
      if (anonymousShareToken) {
        const base =
          process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://abaci.one'
        subEvent = {
          type: 'session-started',
          data: { ...event, observeUrl: `${base}/observe/${anonymousShareToken}` },
        }
      }
    }

    // Resolve delivery target
    let target: DeliveryTarget
    if (sub.userId) {
      // Authenticated subscriber — use their user-level preferences
      target = await resolveDeliveryTarget(sub.userId, 'session-started')
    } else {
      // Anonymous subscriber — use subscription-level channel config
      target = {
        userId: '',
        email: sub.email,
        channels: {
          inApp: sub.channels.inApp ?? false,
          push: sub.channels.webPush ?? false,
          email: sub.channels.email ?? false,
        },
        subscriptionPushEndpoint: sub.pushSubscription ?? undefined,
      }
    }

    let deliveredAny = false

    for (const channel of channels) {
      if (!isChannelEnabled(config, channel.name)) continue
      if (!channel.canDeliver(target)) continue

      result.attempted++

      try {
        const delivery = await channel.deliver(target, subEvent)

        if (delivery.success) {
          result.succeeded++
          deliveredAny = true
        } else {
          if (delivery.error) result.errors.push(delivery.error)
          if (delivery.shouldDisable) {
            markSubscriptionExpired(sub.id).catch((err) =>
              console.error('[notifications] Failed to mark subscription expired:', err)
            )
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        result.errors.push(`${channel.name}: ${message}`)
      }
    }

    // Update lastNotifiedAt if we delivered through any channel
    if (deliveredAny) {
      db.update(practiceNotificationSubscriptions)
        .set({ lastNotifiedAt: new Date() })
        .where(eq(practiceNotificationSubscriptions.id, sub.id))
        .catch((err) => console.error('[notifications] Failed to update lastNotifiedAt:', err))
    }
  }

  return result
}
