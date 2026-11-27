import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { sessionSongs } from '@/db/schema'
import type { SessionSongLLMOutput } from '@/db/schema/session-songs'
import { canPerformAction } from '@/lib/classroom'
import { loadSharedSession } from '@/lib/curriculum/shared-session-report'
import { getViewer } from '@/lib/viewer'
import { PublicObservationClient } from './PublicObservationClient'
import { SessionEndedClient } from './SessionEndedClient'

export const dynamic = 'force-dynamic'

interface PublicObservationPageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PublicObservationPageProps): Promise<Metadata> {
  const { token } = await params

  const shared = await loadSharedSession(token)
  if (shared.kind !== 'ok') {
    return { title: 'Session Not Found | Abaci.One' }
  }

  const studentName = shared.player?.name ?? 'Student'
  const studentEmoji = shared.player?.emoji ?? ''
  const ended = shared.outcome === 'completed' || shared.outcome === 'abandoned'

  // Check for a completed song
  let songTitle: string | null = null
  if (ended) {
    const [song] = await db
      .select()
      .from(sessionSongs)
      .where(eq(sessionSongs.sessionPlanId, shared.share.sessionId))
      .limit(1)
    if (song?.status === 'completed' && song.llmOutput) {
      songTitle = (song.llmOutput as SessionSongLLMOutput)?.title ?? null
    }
  }

  const title = songTitle
    ? `${studentEmoji} ${studentName}'s Practice Song`
    : ended
      ? `${studentEmoji} ${studentName} finished practicing!`
      : `${studentEmoji} Watch ${studentName} practice`

  const description = songTitle
    ? `Listen to "${songTitle}" — a song celebrating ${studentName}'s practice session on Abaci.One`
    : ended
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

/** The signed-in (non-guest) viewer's id, or undefined. */
async function signedInUserId(): Promise<string | undefined> {
  try {
    const viewer = await getViewer()
    if (viewer.kind === 'user' && viewer.session.user?.id) return viewer.session.user.id
  } catch {
    // Not logged in
  }
  return undefined
}

export default async function PublicObservationPage({ params }: PublicObservationPageProps) {
  const { token } = await params

  // The share, its session and report (live / ended / not started by outcome)
  const shared = await loadSharedSession(token)
  if (shared.kind !== 'ok') {
    notFound()
  }
  const { share, plan, outcome, report, player } = shared
  const userId = await signedInUserId()

  if (outcome !== 'in_progress') {
    // Ended (completed, ended early, abandoned) or not started yet
    let sessionReportUrl: string | undefined
    if (userId) {
      try {
        if (await canPerformAction(userId, share.playerId, 'view')) {
          sessionReportUrl = `/practice/${share.playerId}/session/${plan.id}`
        }
      } catch {
        // No report link
      }
    }

    return (
      <SessionEndedClient
        studentName={player?.name ?? 'Student'}
        studentEmoji={player?.emoji ?? '👤'}
        report={outcome === 'not_started' ? null : report}
        playerId={share.playerId}
        sessionPlanId={plan.id}
        shareToken={token}
        sessionReportUrl={sessionReportUrl}
        userId={userId}
      />
    )
  }

  if (!player) {
    notFound()
  }

  // Check if the current user can observe this player directly (without the share link)
  let authenticatedObserveUrl: string | undefined
  if (userId) {
    try {
      if (await canPerformAction(userId, share.playerId, 'observe')) {
        authenticatedObserveUrl = `/practice/${share.playerId}/observe`
      }
    } catch {
      // Don't show the banner
    }
  }

  return (
    <PublicObservationClient
      session={{ sessionId: plan.id, playerId: plan.playerId }}
      shareToken={token}
      student={{
        name: player.name,
        emoji: player.emoji,
        color: player.color,
      }}
      expiresAt={share.expiresAt.getTime()}
      authenticatedObserveUrl={authenticatedObserveUrl}
      userId={userId}
    />
  )
}
