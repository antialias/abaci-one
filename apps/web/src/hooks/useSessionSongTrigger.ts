'use client'

/**
 * Smart trigger hook for session song generation.
 *
 * Runs during active practice. Fires a song generation request when:
 * - Feature flag is enabled AND tier is 'family'
 * - Haven't already triggered for this session
 * - Kid is in the LAST practice part (so game break results are already saved)
 * - completionRatio >= 0.6 (enough data for a meaningful prompt)
 * - estimatedRemainingSeconds <= 180 (song should be ready by end)
 *
 * We wait for the last part because game breaks happen between parts.
 * Triggering earlier would race with game break result persistence.
 *
 * Where the kid is and how far along comes from the session report's
 * `position` (Phase 5b): its segment, the server's flow state, and its
 * progress (items done of planned), the count every view shows.
 *
 * Fire-and-forget — no UI impact on the practice screen.
 */

import { useEffect, useRef } from 'react'
import type { SessionReport } from '@/lib/curriculum/session-report'

interface UseSessionSongTriggerOptions {
  studentId: string
  planId: string
  /** The session report (undefined until it has loaded) */
  report: SessionReport | null | undefined
  /** The plan's average seconds per problem, for the time left (default 30) */
  avgSecondsPerProblem?: number | null
  /** Whether the song feature is available for this user */
  songEnabled: boolean
}

export function useSessionSongTrigger({
  studentId,
  planId,
  report,
  avgSecondsPerProblem,
  songEnabled,
}: UseSessionSongTriggerOptions) {
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (!songEnabled || !report || triggeredRef.current) return
    if (report.sessionId !== planId) return
    if (report.outcome !== 'in_progress') return
    const position = report.position
    if (position?.flowState !== 'practicing') return

    // Only trigger in the last part — game breaks happen between parts,
    // so by the last part all game break results are persisted.
    if (position.segment.kind !== 'part') return
    const isLastPart = position.segment.partIndex >= report.parts.length - 1
    if (!isLastPart) return

    const { done, total } = position.progress
    if (total === 0) return

    const completionRatio = done / total
    if (completionRatio < 0.6) return

    // Estimate remaining time
    const remaining = total - done
    const avgSeconds = avgSecondsPerProblem ?? 30
    const estimatedRemainingSeconds = remaining * avgSeconds

    if (estimatedRemainingSeconds > 180) return

    // All conditions met — trigger song generation
    triggeredRef.current = true

    fetch(`/api/curriculum/${studentId}/sessions/plans/${planId}/song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerSource: 'smart_trigger' }),
    }).catch((err) => {
      // Fire and forget — log but don't surface to user
      console.warn('[session-song] Smart trigger failed:', err)
    })
  }, [songEnabled, report, planId, studentId, avgSecondsPerProblem])
}
