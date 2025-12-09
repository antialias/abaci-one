import { notFound } from 'next/navigation'
import { getPhaseDisplayInfo } from '@/lib/curriculum/definitions'
import {
  getActiveSessionPlan,
  getPlayer,
  getPlayerCurriculum,
  getRecentSessions,
} from '@/lib/curriculum/server'
import { ConfigureClient } from './ConfigureClient'

// Disable caching - session data should be fresh
export const dynamic = 'force-dynamic'

interface ConfigurePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Configure Practice Session Page - Server Component
 *
 * Shows a unified session configuration page with live preview:
 * - Duration selector that updates the preview in real-time
 * - Live preview showing estimated problems, session structure, and problem breakdown
 * - Single "Let's Go!" button that generates + starts the session
 *
 * This page is always accessible regardless of session state.
 * Parents/teachers can configure the next session while a session is in progress.
 *
 * URL: /practice/[studentId]/configure
 */
export default async function ConfigurePage({ params }: ConfigurePageProps) {
  const { studentId } = await params

  // Fetch player, curriculum, sessions, and active session in parallel
  const [player, activeSession, curriculum, recentSessions] = await Promise.all([
    getPlayer(studentId),
    getActiveSessionPlan(studentId),
    getPlayerCurriculum(studentId),
    getRecentSessions(studentId, 10),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Get phase display info for the focus description
  const currentPhaseId = curriculum?.currentPhaseId || 'L1.add.+1.direct'
  const phaseInfo = getPhaseDisplayInfo(currentPhaseId)

  // Calculate average time per problem from recent sessions (or use default)
  const DEFAULT_SECONDS_PER_PROBLEM = 45
  const validSessions = recentSessions.filter(
    (s) => s.averageTimeMs !== null && s.problemsAttempted > 0
  )
  let avgSecondsPerProblem = DEFAULT_SECONDS_PER_PROBLEM
  if (validSessions.length > 0) {
    const totalProblems = validSessions.reduce((sum, s) => sum + s.problemsAttempted, 0)
    const weightedSum = validSessions.reduce(
      (sum, s) => sum + s.averageTimeMs! * s.problemsAttempted,
      0
    )
    avgSecondsPerProblem = Math.round(weightedSum / totalProblems / 1000)
  }

  return (
    <ConfigureClient
      studentId={studentId}
      playerName={player.name}
      existingPlan={activeSession}
      focusDescription={phaseInfo.phaseName}
      avgSecondsPerProblem={avgSecondsPerProblem}
    />
  )
}
