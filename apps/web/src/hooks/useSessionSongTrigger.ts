'use client'

/**
 * Smart trigger hook for session song generation.
 *
 * Runs during active practice. Fires a song generation request when:
 * - Feature flag is enabled AND tier is 'family'
 * - Haven't already triggered for this session
 * - completionRatio >= 0.6 (enough data for a meaningful prompt)
 * - estimatedRemainingSeconds <= 180 (song should be ready by end)
 *
 * Fire-and-forget — no UI impact on the practice screen.
 */

import { useEffect, useRef } from 'react'
import type { SessionPlan } from '@/db/schema/session-plans'
import { getCompletedProblemCount, getTotalProblemCount } from '@/db/schema/session-plan-helpers'

interface UseSessionSongTriggerOptions {
  studentId: string
  plan: SessionPlan | null
  /** Whether the song feature is available for this user */
  songEnabled: boolean
}

export function useSessionSongTrigger({
  studentId,
  plan,
  songEnabled,
}: UseSessionSongTriggerOptions) {
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (!songEnabled || !plan || triggeredRef.current) return
    if (plan.status !== 'in_progress') return

    const completed = getCompletedProblemCount(plan)
    const total = getTotalProblemCount(plan)
    if (total === 0) return

    const completionRatio = completed / total
    if (completionRatio < 0.6) return

    // Estimate remaining time
    const remaining = total - completed
    const avgSeconds = plan.avgTimePerProblemSeconds ?? 30
    const estimatedRemainingSeconds = remaining * avgSeconds

    if (estimatedRemainingSeconds > 180) return

    // All conditions met — trigger song generation
    triggeredRef.current = true

    fetch(`/api/curriculum/${studentId}/sessions/plans/${plan.id}/song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerSource: 'smart_trigger' }),
    }).catch((err) => {
      // Fire and forget — log but don't surface to user
      console.warn('[session-song] Smart trigger failed:', err)
    })
  }, [songEnabled, plan, studentId])
}
