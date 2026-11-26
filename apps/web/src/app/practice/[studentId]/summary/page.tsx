import { notFound } from 'next/navigation'
import { canPerformAction } from '@/lib/classroom/access-control'
import {
  getActiveSessionPlan,
  getMostRecentCompletedSession,
  getPaceAssessment,
  getPracticeStudent,
  getRecentSessionResults,
  getRecentSessions,
} from '@/lib/curriculum/server'
import { getSessionReport, loadSessionReport } from '@/lib/curriculum/session-report-server'
import { isEnabled } from '@/lib/feature-flags'
import { getEffectiveTierForStudent } from '@/lib/subscription'
import { getUserId } from '@/lib/viewer'
import { SummaryClient } from './SummaryClient'

// Disable caching for this page - session data should be fresh
export const dynamic = 'force-dynamic'

function reportFailed(error: unknown): null {
  console.error('Error building session report:', error)
  return null
}

interface SummaryPageProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ completed?: string }>
}

/**
 * Summary Page - Server Component
 *
 * Shows the results of a practice session:
 * - If there's an in-progress session → shows partial results so far
 * - If there's a completed session → shows the most recent completed session
 * - If no sessions exist → shows "no sessions yet" message
 *
 * This page is always accessible regardless of session state.
 * Parents/teachers can view progress even while a session is in progress.
 *
 * For viewing specific historical sessions, use /practice/[studentId]/session/[sessionId]
 *
 * URL: /practice/[studentId]/summary
 */
export default async function SummaryPage({ params, searchParams }: SummaryPageProps) {
  const { studentId } = await params
  const { completed } = await searchParams
  const justCompleted = completed === '1'

  // Fetch player, active session, most recent completed session, problem history, and recent sessions in parallel
  const [player, activeSession, completedSession, problemHistory, recentSessions, paceAssessment] =
    await Promise.all([
      getPracticeStudent(studentId),
      getActiveSessionPlan(studentId),
      getMostRecentCompletedSession(studentId),
      getRecentSessionResults(studentId, 100),
      getRecentSessions(studentId, 10), // For trend calculation
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

  // Priority: show in-progress session (partial results) > completed session > null
  const sessionToShow = activeSession?.startedAt ? activeSession : completedSession

  // Robust, outlier-aware pace estimate from the single producer (#157) — the
  // stored per-session value could be poisoned by legacy/idle-capped samples.
  const avgSecondsPerProblem = paceAssessment.avgSecondsPerProblem

  // The previous session, for the trend: the current session (if ended) is in
  // recentSessions (newest first), so the previous one is the next after it
  let previousSessionId: string | null = null
  if (sessionToShow && recentSessions.length > 0) {
    const currentIndex = recentSessions.findIndex((s) => s.id === sessionToShow.id)
    const previousSession = currentIndex >= 0 ? recentSessions[currentIndex + 1] : recentSessions[0]
    if (previousSession && previousSession.id !== sessionToShow.id) {
      previousSessionId = previousSession.id
    }
  }

  // Both sessions' numbers come from their reports (§4, Phase 4b), so the
  // trend compares first-try accuracy with first-try accuracy
  // A report that fails to build renders as null: the client's live report fills in
  const [initialReport, previousReport] = await Promise.all([
    sessionToShow ? loadSessionReport(sessionToShow).catch(reportFailed) : null,
    previousSessionId ? getSessionReport(previousSessionId).catch(reportFailed) : null,
  ])
  const previousAccuracy = previousReport?.totals.firstTryAccuracy ?? null

  // Check if session songs are enabled for this student
  const [songFlagEnabled, tierResult] = await Promise.all([
    isEnabled('session-song.enabled'),
    getEffectiveTierForStudent(studentId, viewerId),
  ])
  const songEnabled = songFlagEnabled && tierResult.tier === 'family'

  return (
    <SummaryClient
      studentId={studentId}
      player={player}
      session={sessionToShow}
      initialReport={initialReport}
      viewerId={viewerId}
      avgSecondsPerProblem={avgSecondsPerProblem}
      paceAssessment={paceAssessment}
      problemHistory={problemHistory}
      justCompleted={justCompleted}
      previousAccuracy={previousAccuracy}
      songEnabled={songEnabled}
    />
  )
}
