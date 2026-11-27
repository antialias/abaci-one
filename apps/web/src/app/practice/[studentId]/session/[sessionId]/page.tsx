import { notFound } from 'next/navigation'
import { canPerformAction } from '@/lib/classroom/access-control'
import {
  getPaceAssessment,
  getPracticeStudent,
  getRecentSessionResults,
  getSessionPlan,
} from '@/lib/curriculum/server'
import { loadSessionReport } from '@/lib/curriculum/session-report-server'
import { isEnabled } from '@/lib/feature-flags'
import { getEffectiveTierForStudent } from '@/lib/subscription'
import { getUserId } from '@/lib/viewer'
import { SummaryClient } from '../../summary/SummaryClient'

// Disable caching for this page - session data should be fresh
export const dynamic = 'force-dynamic'

function reportFailed(error: unknown): null {
  console.error('Error building session report:', error)
  return null
}

interface SessionPageProps {
  params: Promise<{ studentId: string; sessionId: string }>
}

/**
 * Session Page - View a specific historical session
 *
 * URL: /practice/[studentId]/session/[sessionId]
 *
 * Shows the results of a specific practice session by ID.
 * Used when viewing session history from the dashboard.
 */
export default async function SessionPage({ params }: SessionPageProps) {
  const { studentId, sessionId } = await params

  // Fetch player, session, and problem history in parallel
  const [player, session, problemHistory, paceAssessment] = await Promise.all([
    getPracticeStudent(studentId),
    getSessionPlan(sessionId),
    getRecentSessionResults(studentId, 100),
    getPaceAssessment(studentId), // Single producer of the robust pace statistic (#157)
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Check authorization - user must have view access to this player
  const viewerId = await getUserId()
  const hasAccess = await canPerformAction(viewerId, studentId, 'view')
  if (!hasAccess) {
    notFound() // Return 404 to avoid leaking existence of player
  }

  // 404 if session doesn't exist or belongs to different player
  if (!session || session.playerId !== studentId) {
    notFound()
  }

  // Robust, outlier-aware pace estimate from the single producer (#157) — the
  // stored per-session value could be poisoned by legacy/idle-capped samples.
  const avgSecondsPerProblem = paceAssessment.avgSecondsPerProblem

  // Same gate as the latest-session summary page: a past session shows its song
  // (and the family's "make my song now" card) too.
  // The report renders first; the client keeps it fresh (Phase 4b)
  const [songFlagEnabled, tierResult, initialReport] = await Promise.all([
    isEnabled('session-song.enabled'),
    getEffectiveTierForStudent(studentId, viewerId),
    // A report that fails to build renders as null: the client's live report fills in
    loadSessionReport(session).catch(reportFailed),
  ])
  const songEnabled = songFlagEnabled && tierResult.tier === 'family'

  return (
    <SummaryClient
      studentId={studentId}
      player={player}
      session={session}
      initialReport={initialReport}
      viewerId={viewerId}
      avgSecondsPerProblem={avgSecondsPerProblem}
      paceAssessment={paceAssessment}
      problemHistory={problemHistory}
      songEnabled={songEnabled}
    />
  )
}
