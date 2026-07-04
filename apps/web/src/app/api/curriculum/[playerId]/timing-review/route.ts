/**
 * Timing-review read endpoint (#158).
 *
 * GET /api/curriculum/[playerId]/timing-review
 *
 * Returns every flagged (Tier-1/Tier-2) attempt across the player's recent
 * session window plus the pace assessment, so the /review-timings page can show
 * all unusual timings at the player level (a parent need not know which session
 * to open). The estimate numbers come from `getPaceAssessment` (the single pace
 * producer) via `getTimingReviewData` — this route never computes its own.
 *
 * Gated on `repair-data` (parent or teacher-present) to match the write side:
 * the whole page is a repair tool, and every affordance on it requires that
 * capability.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getTimingReviewData } from '@/lib/curriculum/progress-manager'
import { getUserId } from '@/lib/viewer'

export const GET = withAuth(async (_request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
  }

  try {
    const userId = await getUserId()
    const canReview = await canPerformAction(userId, playerId, 'repair-data')
    if (!canReview) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const data = await getTimingReviewData(playerId)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching timing review data:', error)
    return NextResponse.json({ error: 'Failed to load timing review' }, { status: 500 })
  }
})
