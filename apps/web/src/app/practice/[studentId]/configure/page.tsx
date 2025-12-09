import { notFound, redirect } from 'next/navigation'
import { getActiveSessionPlan, getPlayer } from '@/lib/curriculum/server'
import { ConfigureClient } from './ConfigureClient'

// Disable caching - must check session state fresh every time
export const dynamic = 'force-dynamic'

interface ConfigurePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Configure Practice Session Page - Server Component
 *
 * Guards against accessing this page when there's an active session.
 * If a session exists, redirects to the main practice page.
 *
 * URL: /practice/[studentId]/configure
 */
export default async function ConfigurePage({ params }: ConfigurePageProps) {
  const { studentId } = await params

  // Fetch player and check for active session in parallel
  const [player, activeSession] = await Promise.all([
    getPlayer(studentId),
    getActiveSessionPlan(studentId),
  ])

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  // Guard: redirect if there's an active session
  if (activeSession) {
    redirect(`/practice/${studentId}`)
  }

  return <ConfigureClient studentId={studentId} playerName={player.name} />
}
