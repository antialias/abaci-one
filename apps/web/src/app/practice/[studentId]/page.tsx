import { notFound } from 'next/navigation'
import {
  getActiveSessionPlan,
  getAllSkillMastery,
  getPlayer,
  getPlayerCurriculum,
  getRecentSessions,
} from '@/lib/curriculum/server'
import { StudentPracticeClient } from './StudentPracticeClient'

// Disable caching for this page - session state must always be fresh
export const dynamic = 'force-dynamic'

interface StudentPracticePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Student Practice Page - Server Component
 *
 * Fetches all required data on the server and passes to client component.
 * This provides instant rendering with no loading spinner.
 *
 * URL: /practice/[studentId]
 */
export default async function StudentPracticePage({ params }: StudentPracticePageProps) {
  const { studentId } = await params

  // Fetch all data in parallel
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

  return (
    <StudentPracticeClient
      studentId={studentId}
      initialPlayer={player}
      initialActiveSession={activeSession}
      initialCurriculum={{
        curriculum,
        skills,
        recentSessions,
      }}
    />
  )
}
