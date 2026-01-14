import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, sessionPlans } from '@/db/schema'
import { canPerformAction } from '@/lib/classroom'
import { validateSessionShare } from '@/lib/session-share'
import { getDbUserId } from '@/lib/viewer'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { PublicObservationClient } from './PublicObservationClient'
import { SessionEndedClient } from './SessionEndedClient'

export const dynamic = 'force-dynamic'

interface PublicObservationPageProps {
  params: Promise<{ token: string }>
}

export default async function PublicObservationPage({ params }: PublicObservationPageProps) {
  const { token } = await params

  // Validate the share token
  const validation = await validateSessionShare(token)
  if (!validation.valid || !validation.share) {
    notFound()
  }

  const share = validation.share

  // Get the session
  const sessions = await db
    .select()
    .from(sessionPlans)
    .where(eq(sessionPlans.id, share.sessionId))
    .limit(1)

  const session = sessions[0]
  if (!session) {
    notFound()
  }

  // Check if session is still active
  if (session.completedAt || !session.startedAt) {
    // Session has ended or hasn't started - check if user can view the report
    let sessionReportUrl: string | undefined
    try {
      const userId = await getDbUserId()
      if (userId) {
        const canView = await canPerformAction(userId, share.playerId, 'view')
        if (canView) {
          // User has access to view the student - provide link to the session report
          sessionReportUrl = `/practice/${share.playerId}/session/${session.id}`
        }
      }
    } catch {
      // Not logged in or error - no report link
    }

    // Get player info for the session ended page
    const playerResults = await db
      .select()
      .from(players)
      .where(eq(players.id, share.playerId))
      .limit(1)
    const player = playerResults[0]

    // Show a friendly "session ended" page with optional link to report
    return (
      <SessionEndedClient
        studentName={player?.name ?? 'Student'}
        studentEmoji={player?.emoji ?? '👤'}
        sessionCompleted={!!session.completedAt}
        sessionReportUrl={sessionReportUrl}
      />
    )
  }

  // Get the player
  const playerResults = await db
    .select()
    .from(players)
    .where(eq(players.id, share.playerId))
    .limit(1)

  const player = playerResults[0]
  if (!player) {
    notFound()
  }

  // Calculate progress info
  const parts = session.parts as Array<{ slots: Array<unknown> }>
  const totalProblems = parts.reduce((sum, part) => sum + part.slots.length, 0)
  let completedProblems = 0
  for (let i = 0; i < session.currentPartIndex; i++) {
    completedProblems += parts[i]?.slots.length ?? 0
  }
  completedProblems += session.currentSlotIndex

  // Check if the current user can observe this player directly (without the share link)
  let authenticatedObserveUrl: string | undefined
  try {
    const userId = await getDbUserId()
    if (userId) {
      const canObserve = await canPerformAction(userId, share.playerId, 'observe')
      if (canObserve) {
        authenticatedObserveUrl = `/practice/${share.playerId}/observe`
      }
    }
  } catch {
    // Not logged in or error checking permissions - that's fine, just don't show the banner
  }

  const sessionInfo: ActiveSessionInfo = {
    sessionId: session.id,
    playerId: session.playerId,
    startedAt:
      session.startedAt instanceof Date
        ? session.startedAt.toISOString()
        : String(session.startedAt),
    currentPartIndex: session.currentPartIndex,
    currentSlotIndex: session.currentSlotIndex,
    totalParts: parts.length,
    totalProblems,
    completedProblems,
  }

  return (
    <PublicObservationClient
      session={sessionInfo}
      shareToken={token}
      student={{
        name: player.name,
        emoji: player.emoji,
        color: player.color,
      }}
      expiresAt={
        share.expiresAt instanceof Date ? share.expiresAt.getTime() : Number(share.expiresAt)
      }
      authenticatedObserveUrl={authenticatedObserveUrl}
    />
  )
}
