import { notFound } from 'next/navigation'
import {
  getAllSkillMastery,
  getPlayer,
  getPlayerCurriculum,
  getRecentSessions,
} from '@/lib/curriculum/server'
import { DashboardClient } from './DashboardClient'

// Disable caching for this page - progress data should be fresh
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
 * This page is always accessible regardless of session state.
 * Parents/teachers can view stats even while a session is in progress.
 *
 * URL: /practice/[studentId]/dashboard
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  const { studentId } = await params

  // Fetch player data in parallel
  const [player, curriculum, skills, recentSessions] = await Promise.all([
    getPlayer(studentId),
    getPlayerCurriculum(studentId),
    getAllSkillMastery(studentId),
    getRecentSessions(studentId, 10),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
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
