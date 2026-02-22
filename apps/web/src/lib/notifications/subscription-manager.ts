import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  practiceNotificationSubscriptions,
  type PracticeNotificationSubscription,
  type SubscriptionChannels,
  type WebPushSubscriptionJson,
} from '@/db/schema'

export interface CreateSubscriptionParams {
  userId?: string
  playerId: string
  email?: string
  pushSubscription?: WebPushSubscriptionJson
  channels: SubscriptionChannels
  label?: string
  expiresAt?: Date
}

export interface CreateSubscriptionResult {
  success: boolean
  subscription?: PracticeNotificationSubscription
  error?: string
}

/**
 * Create a new notification subscription for a player.
 *
 * Validates that at least one channel is enabled and that required
 * data is present for each enabled channel.
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResult> {
  const { userId, playerId, email, pushSubscription, channels, label, expiresAt } = params

  // At least one channel must be enabled
  if (!channels.webPush && !channels.email && !channels.inApp) {
    return { success: false, error: 'At least one notification channel must be enabled' }
  }

  // Email channel requires an email address
  if (channels.email && !email) {
    return { success: false, error: 'Email address is required when email channel is enabled' }
  }

  // WebPush channel requires a push subscription
  if (channels.webPush && !pushSubscription) {
    return {
      success: false,
      error: 'Push subscription is required when webPush channel is enabled',
    }
  }

  const id = createId()
  const now = new Date()

  await db.insert(practiceNotificationSubscriptions).values({
    id,
    userId: userId ?? null,
    playerId,
    email: email ?? null,
    pushSubscription: pushSubscription ?? null,
    channels,
    status: 'active',
    label: label ?? null,
    createdAt: now,
    expiresAt: expiresAt ?? null,
    lastNotifiedAt: null,
  })

  // Construct the object to avoid a read-back query
  const subscription: PracticeNotificationSubscription = {
    id,
    userId: userId ?? null,
    playerId,
    email: email ?? null,
    pushSubscription: pushSubscription ?? null,
    channels,
    status: 'active',
    label: label ?? null,
    createdAt: now,
    expiresAt: expiresAt ?? null,
    lastNotifiedAt: null,
  }

  return { success: true, subscription }
}

/**
 * Get all active subscriptions for a player.
 */
export async function getActiveSubscriptionsForPlayer(
  playerId: string
): Promise<PracticeNotificationSubscription[]> {
  return db
    .select()
    .from(practiceNotificationSubscriptions)
    .where(
      and(
        eq(practiceNotificationSubscriptions.playerId, playerId),
        eq(practiceNotificationSubscriptions.status, 'active')
      )
    )
}

/**
 * Mark a subscription as expired (e.g. push endpoint is no longer valid).
 */
export async function markSubscriptionExpired(id: string): Promise<void> {
  await db
    .update(practiceNotificationSubscriptions)
    .set({ status: 'expired' })
    .where(eq(practiceNotificationSubscriptions.id, id))
}

/**
 * Update the push subscription JSON for an existing subscription.
 */
export async function updatePushSubscription(
  id: string,
  pushSub: WebPushSubscriptionJson
): Promise<void> {
  await db
    .update(practiceNotificationSubscriptions)
    .set({ pushSubscription: pushSub })
    .where(eq(practiceNotificationSubscriptions.id, id))
}

/**
 * Delete a subscription (hard delete).
 */
export async function deleteSubscription(id: string): Promise<void> {
  await db
    .delete(practiceNotificationSubscriptions)
    .where(eq(practiceNotificationSubscriptions.id, id))
}
