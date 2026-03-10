import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, sessionPlans, sessionSongs } from '@/db/schema'
import { canPerformAction } from '@/lib/classroom'
import { validateSessionShare } from '@/lib/session-share'
import { getUserId, getViewer } from '@/lib/viewer'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import type { SessionSongLLMOutput } from '@/db/schema/session-songs'
import { PublicObservationClient } from './PublicObservationClient'
import { SessionEndedClient } from './SessionEndedClient'

export const dynamic = 'force-dynamic'

interface PublicObservationPageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PublicObservationPageProps): Promise<Metadata> {
  const { token } = await params

  const validation = await validateSessionShare(token)
  if (!validation.valid || !validation.share) {
    return { title: 'Session Not Found | Abaci.One' }
  }

  const share = validation.share

  const [playerResults, sessions] = await Promise.all([
    db.select().from(players).where(eq(players.id, share.playerId)).limit(1),
    db.select().from(sessionPlans).where(eq(sessionPlans.id, share.sessionId)).limit(1),
  ])

  const player = playerResults[0]
  const session = sessions[0]
  const studentName = player?.name ?? 'Student'
  const studentEmoji = player?.emoji ?? ''

  // Check for a completed song
  let songTitle: string | null = null
  if (session?.completedAt) {
    const [song] = await db
      .select()
      .from(sessionSongs)
      .where(eq(sessionSongs.sessionPlanId, share.sessionId))
      .limit(1)
    if (song?.status === 'completed' && song.llmOutput) {
      songTitle = (song.llmOutput as SessionSongLLMOutput)?.title ?? null
    }
  }

  const title = songTitle
    ? `${studentEmoji} ${studentName}'s Practice Song`
    : session?.completedAt
      ? `${studentEmoji} ${studentName} finished practicing!`
      : `${studentEmoji} Watch ${studentName} practice`

  const description = songTitle
    ? `Listen to "${songTitle}" — a song celebrating ${studentName}'s practice session on Abaci.One`
    : session?.completedAt
      ? `${studentName} just finished a practice session on Abaci.One!`
      : `Watch ${studentName} practice math on Abaci.One in real time`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Abaci.One',
    },
  }
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
    let endedUserId: string | undefined
    try {
      const viewer = await getViewer()
      if (viewer.kind === 'user' && viewer.session.user?.id) {
        endedUserId = viewer.session.user.id
        const canView = await canPerformAction(endedUserId, share.playerId, 'view')
        if (canView) {
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
        playerId={share.playerId}
        sessionPlanId={session.id}
        shareToken={token}
        sessionReportUrl={sessionReportUrl}
        userId={endedUserId}
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
  let observeUserId: string | undefined
  try {
    const viewer = await getViewer()
    // Only treat real authenticated users (not guests) as having a userId
    if (viewer.kind === 'user' && viewer.session.user?.id) {
      observeUserId = viewer.session.user.id
      const canObserve = await canPerformAction(observeUserId, share.playerId, 'observe')
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
      userId={observeUserId}
    />
  )
}
