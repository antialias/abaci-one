import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getTierForUser } from '@/lib/subscription'
import { TIER_LIMITS } from '@/lib/tier-limits'

/**
 * GET /api/billing/tier
 *
 * Returns the current user's subscription tier and limits.
 * Used by client-side components (DurationSelector, upgrade prompts, etc.)
 * to know what the user's plan allows.
 *
 * Prefetched in root layout — no extra request on initial load.
 */
export const GET = withAuth(async (_request, { userId, userRole }) => {
  // Guests don't have a userId row with subscriptions — resolve from role
  const tier = userRole === 'guest' ? 'guest' : await getTierForUser(userId)
  const limits = TIER_LIMITS[tier]

  return NextResponse.json({
    tier,
    limits: {
      maxPracticeStudents:
        limits.maxPracticeStudents === Infinity ? null : limits.maxPracticeStudents,
      maxSessionMinutes: limits.maxSessionMinutes,
      maxSessionsPerWeek: limits.maxSessionsPerWeek === Infinity ? null : limits.maxSessionsPerWeek,
      maxOfflineParsingPerMonth: limits.maxOfflineParsingPerMonth,
    },
  })
})
