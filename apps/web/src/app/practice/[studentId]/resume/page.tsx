import { notFound, redirect } from 'next/navigation'
import { getActiveSessionPlan, getPlayer } from '@/lib/curriculum/server'
import { ResumeClient } from './ResumeClient'

// Disable caching for this page - session state must always be fresh
export const dynamic = 'force-dynamic'

interface ResumePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Resume Session Page - Server Component
 *
 * Shows "Welcome back" card for students returning to an in-progress session.
 * If no active session exists, redirects to the main practice page.
 *
 * URL: /practice/[studentId]/resume
 */
export default async function ResumePage({ params }: ResumePageProps) {
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

  // No active session → redirect to main practice page (shows dashboard)
  if (!activeSession) {
    redirect(`/practice/${studentId}`)
  }

  // Session is completed → redirect to main practice page (shows summary)
  if (activeSession.completedAt) {
    redirect(`/practice/${studentId}`)
  }

  return <ResumeClient studentId={studentId} player={player} initialSession={activeSession} />
}
