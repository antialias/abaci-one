import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getEffectiveTierForStudent, getLimitsForTier } from '@/lib/subscription'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/players/[id]/effective-tier
 *
 * Returns the effective subscription tier for a student,
 * considering all linked parents' plans (not just the caller's).
 *
 * Response:
 * {
 *   tier: 'family' | 'free' | 'guest',
 *   limits: { maxSessionMinutes, maxSessionsPerWeek, ... },
 *   providedBy: { name: 'Mom' } | null
 * }
 */
export const GET = withAuth(async (_request, { params }) => {
  const { id: playerId } = (await params) as { id: string }

  const userId = await getUserId()
  const canView = await canPerformAction(userId, playerId, 'view')
  if (!canView) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { tier, providedBy } = await getEffectiveTierForStudent(playerId, userId)
  const limits = getLimitsForTier(tier)

  return NextResponse.json({
    tier,
    limits: {
      maxPracticeStudents:
        limits.maxPracticeStudents === Infinity ? null : limits.maxPracticeStudents,
      maxSessionMinutes: limits.maxSessionMinutes,
      maxSessionsPerWeek: limits.maxSessionsPerWeek === Infinity ? null : limits.maxSessionsPerWeek,
      maxOfflineParsingPerMonth: limits.maxOfflineParsingPerMonth,
    },
    providedBy,
  })
})
