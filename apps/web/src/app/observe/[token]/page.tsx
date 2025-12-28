import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, sessionPlans } from '@/db/schema'
import { validateSessionShare } from '@/lib/session-share'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { PublicObservationClient } from './PublicObservationClient'

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
    notFound()
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
    />
  )
}
