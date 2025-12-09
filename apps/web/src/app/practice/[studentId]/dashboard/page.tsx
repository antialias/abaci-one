import { notFound, redirect } from 'next/navigation'
import {
  getActiveSessionPlan,
  getAllSkillMastery,
  getPlayer,
  getPlayerCurriculum,
  getRecentSessions,
} from '@/lib/curriculum/server'
import { DashboardClient } from './DashboardClient'

// Disable caching for this page - session state must always be fresh
export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Dashboard Page - Server Component
 *
 * Shows the student's progress dashboard with:
 * - Current level and progress
 * - Recent skills
 * - "Continue Practice" button to start a new session
 *
 * Guards:
 * - If there's an in_progress session → redirect to /practice/[studentId] (show problem)
 * - If there's a draft/approved session → redirect to /configure (approve and start)
 *
 * URL: /practice/[studentId]/dashboard
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  const { studentId } = await params

  // Fetch player and check for active session in parallel
  const [player, activeSession, curriculum, skills, recentSessions] = await Promise.all([
    getPlayer(studentId),
    getActiveSessionPlan(studentId),
    getPlayerCurriculum(studentId),
    getAllSkillMastery(studentId),
    getRecentSessions(studentId, 10),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Guard: redirect based on active session state
  if (activeSession) {
    if (activeSession.startedAt && !activeSession.completedAt) {
      // In progress → go to practice (show problem)
      redirect(`/practice/${studentId}`)
    }
    if (!activeSession.startedAt) {
      // Draft or approved but not started → go to configure
      redirect(`/practice/${studentId}/configure`)
    }
    // Completed sessions don't block dashboard access
  }

  return (
    <DashboardClient
      studentId={studentId}
      player={player}
      curriculum={curriculum}
      skills={skills}
      recentSessions={recentSessions}
    />
  )
}
