import { notFound, redirect } from 'next/navigation'
import {
  getActiveSessionPlan,
  getMostRecentCompletedSession,
  getPlayer,
} from '@/lib/curriculum/server'
import { SummaryClient } from './SummaryClient'

// Disable caching for this page - session state must always be fresh
export const dynamic = 'force-dynamic'

interface SummaryPageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Summary Page - Server Component
 *
 * Shows the results of a completed practice session.
 *
 * Guards:
 * - If there's an in_progress session → redirect to /practice/[studentId] (can't view summary mid-session)
 * - If there's no completed session → redirect to /dashboard (nothing to show)
 *
 * URL: /practice/[studentId]/summary
 */
export default async function SummaryPage({ params }: SummaryPageProps) {
  const { studentId } = await params

  // Fetch player, active session, and most recent completed session in parallel
  const [player, activeSession, completedSession] = await Promise.all([
    getPlayer(studentId),
    getActiveSessionPlan(studentId),
    getMostRecentCompletedSession(studentId),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Guard: if there's an in_progress session, can't view summary
  if (activeSession?.startedAt && !activeSession.completedAt) {
    redirect(`/practice/${studentId}`)
  }

  // Guard: if there's a draft/approved session, redirect to configure
  if (activeSession && !activeSession.startedAt) {
    redirect(`/practice/${studentId}/configure`)
  }

  // Guard: if no completed session exists, redirect to dashboard
  if (!completedSession) {
    redirect(`/practice/${studentId}/dashboard`)
  }

  return <SummaryClient studentId={studentId} player={player} session={completedSession} />
}
