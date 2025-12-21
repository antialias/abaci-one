import { notFound } from 'next/navigation'
import {
  getAllSkillMastery,
  getPlayer,
  getPlayerCurriculum,
  getRecentSessions,
  getRecentSessionResults,
} from '@/lib/curriculum/server'
import { getActiveSessionPlan } from '@/lib/curriculum/session-planner'
import { DashboardClient } from './DashboardClient'

// Disable caching for this page - progress data should be fresh
export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ tab?: string }>
}

/**
 * Dashboard Page - Server Component
 *
 * Shows the student's tabbed dashboard with:
 * - Overview tab: Current level, progress, session controls
 * - Skills tab: Detailed skill mastery, BKT analysis, skill management
 * - History tab: Past sessions (future)
 *
 * This page is always accessible regardless of session state.
 * Parents/teachers can view stats even while a session is in progress.
 *
 * URL: /practice/[studentId]/dashboard?tab=overview|skills|history
 */
export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { studentId } = await params
  const { tab } = await searchParams

  // Fetch player data in parallel
  const [player, curriculum, skills, recentSessions, activeSession, problemHistory] =
    await Promise.all([
      getPlayer(studentId),
      getPlayerCurriculum(studentId),
      getAllSkillMastery(studentId),
      getRecentSessions(studentId, 200),
      getActiveSessionPlan(studentId),
      getRecentSessionResults(studentId, 2000), // For Skills tab BKT analysis
    ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Get skill IDs that are in the student's active practice rotation
  // isPracticing=true means the skill is enabled for practice, NOT that it's mastered
  const currentPracticingSkillIds = skills.filter((s) => s.isPracticing).map((s) => s.skillId)

  return (
    <DashboardClient
      studentId={studentId}
      player={player}
      curriculum={curriculum}
      skills={skills}
      recentSessions={recentSessions}
      activeSession={activeSession}
      currentPracticingSkillIds={currentPracticingSkillIds}
      problemHistory={problemHistory}
      initialTab={tab as 'overview' | 'skills' | 'history' | undefined}
    />
  )
}
