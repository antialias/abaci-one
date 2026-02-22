import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appSettings, type NotificationChannelsConfig, practiceNotificationSubscriptions } from '@/db/schema'
import type { NotificationChannel, SessionStartedPayload, NotifyResult } from './types'
import { getActiveSubscriptionsForPlayer, markSubscriptionExpired } from './subscription-manager'

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
function isChannelEnabled(
  config: NotificationChannelsConfig,
  channelName: string
): boolean {
  const entry = config[channelName as keyof NotificationChannelsConfig]
  return entry?.enabled === true
}

/**
 * Notify all active subscribers for a player that a session has started.
 *
 * Flow:
 * 1. Read global config — bail if notifications disabled
 * 2. Get active subscriptions for the player
 * 3. For each subscription: throttle check, then fan out to registered channels
 * 4. Mark expired subscriptions, update lastNotifiedAt on success
 */
export async function notifySubscribers(
  event: SessionStartedPayload
): Promise<NotifyResult> {
  const result: NotifyResult = {
    subscriptionCount: 0,
    throttled: 0,
    attempted: 0,
    succeeded: 0,
    errors: [],
  }

  // 1. Read global config
  const config = await getGlobalChannelConfig()
  if (!config) return result

  // 2. Get active subscriptions
  const subscriptions = await getActiveSubscriptionsForPlayer(event.playerId)
  result.subscriptionCount = subscriptions.length

  if (subscriptions.length === 0) return result

  // 3. Process each subscription
  const now = Date.now()

  for (const sub of subscriptions) {
    // Throttle check
    if (sub.lastNotifiedAt && now - sub.lastNotifiedAt.getTime() < THROTTLE_MS) {
      result.throttled++
      continue
    }

    let deliveredAny = false

    for (const channel of channels) {
      // Skip if channel not enabled globally
      if (!isChannelEnabled(config, channel.name)) continue

      // Skip if subscription can't use this channel
      if (!channel.canDeliver(sub)) continue

      result.attempted++

      try {
        const delivery = await channel.deliver(sub, event)

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
        .catch((err) =>
          console.error('[notifications] Failed to update lastNotifiedAt:', err)
        )
    }
  }

  return result
}
