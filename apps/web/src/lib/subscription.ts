import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getLinkedParentIds } from '@/lib/classroom/family-manager'
import { getParentedPlayerIds } from '@/lib/classroom/access-control'
import type { TierName, TierLimits } from './tier-limits'
import { TIER_LIMITS } from './tier-limits'

/** Tier ranking — higher index = better tier. */
const TIER_RANK: Record<TierName, number> = { guest: 0, free: 1, family: 2 }

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

export interface EffectiveTierResult {
  tier: TierName
  /** Non-null when a *different* user provides the best tier. */
  providedBy: { userId: string; name: string } | null
}

/**
 * Determine the best subscription tier available for a student,
 * considering all linked parents (not just the acting user).
 *
 * Returns the highest tier among:
 *  - the student's owner (players.userId)
 *  - every parent in the parent_child table
 *
 * If the best tier comes from someone other than `actingUserId`,
 * `providedBy` identifies who provides it.
 */
export async function getEffectiveTierForStudent(
  playerId: string,
  actingUserId: string
): Promise<EffectiveTierResult> {
  // 1. Gather all candidate user IDs: owner + linked parents
  const player = await db.query.players.findFirst({
    where: eq(schema.players.id, playerId),
    columns: { userId: true },
  })
  if (!player) {
    // Unknown player — fall back to the acting user's own tier
    const tier = await getTierForUser(actingUserId)
    return { tier, providedBy: null }
  }

  const linkedIds = await getLinkedParentIds(playerId)
  const candidateIds = [...new Set([player.userId, ...linkedIds])]

  // 2. Resolve tier for every candidate in one query
  const subs = await db.query.subscriptions.findMany({
    where: inArray(schema.subscriptions.userId, candidateIds),
  })

  const subByUser = new Map(subs.map((s) => [s.userId, s]))

  function tierFor(uid: string): TierName {
    const sub = subByUser.get(uid)
    if (!sub) return 'free'
    if (
      sub.plan === 'family' &&
      (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')
    ) {
      return 'family'
    }
    return 'free'
  }

  // 3. Find the best tier and who provides it
  let bestTier: TierName = 'free'
  let bestUserId = actingUserId

  for (const uid of candidateIds) {
    const t = tierFor(uid)
    if (TIER_RANK[t] > TIER_RANK[bestTier]) {
      bestTier = t
      bestUserId = uid
    }
  }

  // 4. If someone else provides the tier, look up their name
  if (bestUserId !== actingUserId) {
    const provider = await db.query.users.findFirst({
      where: eq(schema.users.id, bestUserId),
      columns: { id: true, name: true },
    })
    return {
      tier: bestTier,
      providedBy: provider
        ? { userId: provider.id, name: provider.name ?? 'Another parent' }
        : null,
    }
  }

  return { tier: bestTier, providedBy: null }
}

// ---------------------------------------------------------------------------
// Family coverage: how many of a user's children are covered by another
// parent's family plan?
// ---------------------------------------------------------------------------

export interface FamilyCoverage {
  isCovered: boolean
  coveredBy: { userId: string; name: string } | null
  coveredChildCount: number
  totalChildCount: number
}

/**
 * For a given (typically free-tier) user, check whether any of their children
 * are covered by another parent's family subscription.
 *
 * This is used on pricing/settings pages to avoid confusing free-tier parents
 * who already have coverage through a co-parent.
 */
export async function getUserFamilyCoverage(userId: string): Promise<FamilyCoverage> {
  const playerIds = await getParentedPlayerIds(userId)

  if (playerIds.length === 0) {
    return { isCovered: false, coveredBy: null, coveredChildCount: 0, totalChildCount: 0 }
  }

  let coveredCount = 0
  let firstProvider: { userId: string; name: string } | null = null

  for (const pid of playerIds) {
    const result = await getEffectiveTierForStudent(pid, userId)
    if (result.tier === 'family' && result.providedBy !== null) {
      coveredCount++
      if (!firstProvider) {
        firstProvider = result.providedBy
      }
    }
  }

  return {
    isCovered: coveredCount > 0,
    coveredBy: firstProvider,
    coveredChildCount: coveredCount,
    totalChildCount: playerIds.length,
  }
}
