import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { TierName, TierLimits } from './tier-limits'
import { TIER_LIMITS } from './tier-limits'

/**
 * Resolve a user's current subscription tier.
 *
 * - No userId → 'guest'
 * - No subscription row or canceled → 'free'
 * - Active/trialing/past_due family subscription → 'family'
 */
export async function getTierForUser(userId?: string): Promise<TierName> {
  if (!userId) return 'guest'

  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, userId),
  })

  if (!sub) return 'free'

  // past_due still gets access (7-day grace period)
  if (
    sub.plan === 'family' &&
    (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')
  ) {
    return 'family'
  }

  return 'free'
}

/** Get the limits for a user's current tier. */
export async function getLimitsForUser(userId?: string): Promise<TierLimits> {
  const tier = await getTierForUser(userId)
  return TIER_LIMITS[tier]
}

/** Get the limits for a tier name (sync, no DB call). */
export function getLimitsForTier(tier: TierName): TierLimits {
  return TIER_LIMITS[tier]
}
