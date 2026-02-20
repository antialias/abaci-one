import { notFound } from 'next/navigation'
import { canPerformAction } from '@/lib/classroom/access-control'
import { getPracticeStudent, getRecentSessionResults, getSessionPlan } from '@/lib/curriculum/server'
import { getDbUserId } from '@/lib/viewer'
import { SummaryClient } from '../../summary/SummaryClient'

// Disable caching for this page - session data should be fresh
export const dynamic = 'force-dynamic'

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
  const [player, session, problemHistory] = await Promise.all([
    getPracticeStudent(studentId),
    getSessionPlan(sessionId),
    getRecentSessionResults(studentId, 100),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Check authorization - user must have view access to this player
  const viewerId = await getDbUserId()
  const hasAccess = await canPerformAction(viewerId, studentId, 'view')
  if (!hasAccess) {
    notFound() // Return 404 to avoid leaking existence of player
  }

  // 404 if session doesn't exist or belongs to different player
  if (!session || session.playerId !== studentId) {
    notFound()
  }

  // Calculate average seconds per problem from the session
  const avgSecondsPerProblem = session.avgTimePerProblemSeconds ?? 40

  return (
    <SummaryClient
      studentId={studentId}
      player={player}
      session={session}
      avgSecondsPerProblem={avgSecondsPerProblem}
      problemHistory={problemHistory}
    />
  )
}
