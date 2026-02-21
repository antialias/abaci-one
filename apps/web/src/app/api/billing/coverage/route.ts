import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserFamilyCoverage } from '@/lib/subscription'

/**
 * GET /api/billing/coverage
 *
 * Returns family coverage info for the current user — whether any of their
 * children are covered by another parent's family subscription.
 *
 * Used on pricing/settings pages to surface inherited coverage and prevent
 * accidental double-subscriptions.
 */
export const GET = withAuth(async (_request, { userId, userRole }) => {
  if (userRole === 'guest') {
    return NextResponse.json({
      isCovered: false,
      coveredBy: null,
      coveredChildCount: 0,
      totalChildCount: 0,
    })
  }

  const coverage = await getUserFamilyCoverage(userId)
  return NextResponse.json(coverage)
})
