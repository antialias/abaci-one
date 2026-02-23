import { notFound } from 'next/navigation'
import { canPerformAction } from '@/lib/classroom/access-control'
import {
  getActiveSessionPlan,
  getMostRecentCompletedSession,
  getPracticeStudent,
  getRecentSessionResults,
  getRecentSessions,
} from '@/lib/curriculum/server'
import { isEnabled } from '@/lib/feature-flags'
import { getEffectiveTierForStudent } from '@/lib/subscription'
import { getUserId } from '@/lib/viewer'
import { SummaryClient } from './SummaryClient'

// Disable caching for this page - session data should be fresh
export const dynamic = 'force-dynamic'

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
  const [player, activeSession, completedSession, problemHistory, recentSessions] =
    await Promise.all([
      getPracticeStudent(studentId),
      getActiveSessionPlan(studentId),
      getMostRecentCompletedSession(studentId),
      getRecentSessionResults(studentId, 100),
      getRecentSessions(studentId, 10), // For trend calculation
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

  // Calculate average seconds per problem from the session
  const avgSecondsPerProblem = sessionToShow?.avgTimePerProblemSeconds ?? 40

  // Calculate previous session's accuracy for trend comparison
  // The current session (if completed) is included in recentSessions, so we need to find the one after it
  let previousAccuracy: number | null = null
  if (sessionToShow && recentSessions.length > 0) {
    // Find index of current session in recent sessions
    const currentIndex = recentSessions.findIndex((s) => s.id === sessionToShow.id)
    // Previous session is the next one in the list (since ordered newest first)
    const previousSession = currentIndex >= 0 ? recentSessions[currentIndex + 1] : recentSessions[0]
    if (previousSession && previousSession.id !== sessionToShow.id) {
      // Get accuracy from the session - it's stored as problemsCorrect/problemsAttempted
      previousAccuracy =
        previousSession.problemsAttempted > 0
          ? previousSession.problemsCorrect / previousSession.problemsAttempted
          : null
    }
  }

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
      avgSecondsPerProblem={avgSecondsPerProblem}
      problemHistory={problemHistory}
      justCompleted={justCompleted}
      previousAccuracy={previousAccuracy}
      songEnabled={songEnabled}
    />
  )
}
