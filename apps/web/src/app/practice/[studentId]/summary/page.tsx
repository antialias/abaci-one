import { notFound } from 'next/navigation'
import {
  getActiveSessionPlan,
  getMostRecentCompletedSession,
  getPlayer,
  getRecentSessionResults,
} from '@/lib/curriculum/server'
import { SummaryClient } from './SummaryClient'

// Disable caching for this page - session data should be fresh
export const dynamic = 'force-dynamic'

interface SummaryPageProps {
  params: Promise<{ studentId: string }>
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
 * URL: /practice/[studentId]/summary
 */
export default async function SummaryPage({ params }: SummaryPageProps) {
  const { studentId } = await params

  // Fetch player, active session, most recent completed session, and problem history in parallel
  const [player, activeSession, completedSession, problemHistory] = await Promise.all([
    getPlayer(studentId),
    getActiveSessionPlan(studentId),
    getMostRecentCompletedSession(studentId),
    getRecentSessionResults(studentId, 100),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Priority: show in-progress session (partial results) > completed session > null
  const sessionToShow = activeSession?.startedAt ? activeSession : completedSession

  // Calculate average seconds per problem from the session
  const avgSecondsPerProblem = sessionToShow?.avgTimePerProblemSeconds ?? 40

  return (
    <SummaryClient
      studentId={studentId}
      player={player}
      session={sessionToShow}
      avgSecondsPerProblem={avgSecondsPerProblem}
      problemHistory={problemHistory}
    />
  )
}
