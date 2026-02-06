import nextDynamic from 'next/dynamic'
import { notFound, redirect } from 'next/navigation'
import { canPerformAction } from '@/lib/classroom/access-control'
import { getActiveSessionPlan, getPlayer } from '@/lib/curriculum/server'
import { getDbUserId } from '@/lib/viewer'

// Skip SSR for PracticeClient — practice is fully interactive and has hooks
// (useHasPhysicalKeyboard, useSearchParams) that produce server/client mismatches
const PracticeClient = nextDynamic(
  () => import('./PracticeClient').then((m) => m.PracticeClient),
  { ssr: false }
)

// Disable caching for this page - session state must always be fresh
export const dynamic = 'force-dynamic'

interface StudentPracticePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Student Practice Page - Server Component
 *
 * This page ONLY shows the current problem for active practice sessions.
 * All other states redirect to appropriate pages.
 *
 * Guards/Redirects:
 * - No active session → /dashboard (show progress, start new session)
 * - Draft/approved session (not started) → /dashboard (modal handles configuration)
 * - In_progress session → SHOW PROBLEM (this is the only state we render here)
 * - Completed session → /summary (show results)
 *
 * URL: /practice/[studentId]
 */
export default async function StudentPracticePage({ params }: StudentPracticePageProps) {
  const { studentId } = await params

  // Fetch player and active session in parallel
  const [player, activeSession] = await Promise.all([
    getPlayer(studentId),
    getActiveSessionPlan(studentId),
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

  // No active session → dashboard
  if (!activeSession) {
    redirect(`/practice/${studentId}/dashboard`)
  }

  // Draft or approved but not started → dashboard (modal handles configuration)
  if (!activeSession.startedAt) {
    redirect(`/practice/${studentId}/dashboard`)
  }

  // Session is completed → summary page
  if (activeSession.completedAt) {
    redirect(`/practice/${studentId}/summary`)
  }

  // Only state left: in_progress session → show problem
  return <PracticeClient studentId={studentId} player={player} initialSession={activeSession} />
}
