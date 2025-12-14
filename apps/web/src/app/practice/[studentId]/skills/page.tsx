import { notFound } from 'next/navigation'
import { getAllSkillMastery, getPlayer, getPlayerCurriculum } from '@/lib/curriculum/server'
import { getRecentSessionResults } from '@/lib/curriculum/server'
import { SkillsClient } from './SkillsClient'

// Disable caching for this page - progress data should be fresh
export const dynamic = 'force-dynamic'

interface SkillsPageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Skills Dashboard Page - Server Component
 *
 * Shows comprehensive skill performance data:
 * - Intervention needed (struggling skills)
 * - Current focus (curriculum position)
 * - Ready to advance (fluent skills)
 * - All skills by category with drill-down to problem history
 *
 * URL: /practice/[studentId]/skills
 */
export default async function SkillsPage({ params }: SkillsPageProps) {
  const { studentId } = await params

  // Fetch all required data in parallel
  const [player, curriculum, skills, problemHistory] = await Promise.all([
    getPlayer(studentId),
    getPlayerCurriculum(studentId),
    getAllSkillMastery(studentId),
    getRecentSessionResults(studentId, 50), // Get last 50 sessions worth of problems
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  return (
    <SkillsClient
      studentId={studentId}
      player={player}
      curriculum={curriculum}
      skills={skills}
      problemHistory={problemHistory}
    />
  )
}
