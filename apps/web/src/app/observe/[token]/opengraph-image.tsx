import { eq } from 'drizzle-orm'
import { ImageResponse } from 'next/og'
import { db } from '@/db'
import { sessionSongs } from '@/db/schema'
import type { SessionSongLLMOutput } from '@/db/schema/session-songs'
import { loadSharedSession } from '@/lib/curriculum/shared-session-report'
import { extractProblems, formatProblem } from '@/lib/song-share/sessionFacts'
import { ObserveOgCard, type ObserveOgCardProps, ogCardFromReport } from './opengraph-card'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const alt = 'Practice session on Abaci.One'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

interface OGImageProps {
  params: Promise<{ token: string }>
}

/**
 * The card's props for a share token: the numbers from the session report
 * (the token report path, Phase 4c), as the share page shows them; the song
 * title once the session ended.
 */
async function ogCardPropsForToken(token: string): Promise<ObserveOgCardProps> {
  const props: ObserveOgCardProps = {
    studentName: 'Student',
    studentEmoji: '',
    status: 'unknown',
    songTitle: null,
    sampleProblems: [],
    stats: null,
  }
  const shared = await loadSharedSession(token)
  if (shared.kind !== 'ok') return props

  if (shared.player) {
    props.studentName = shared.player.name
    props.studentEmoji = shared.player.emoji
  }
  props.sampleProblems = extractProblems(shared.plan.parts).slice(0, 2).map(formatProblem)
  Object.assign(props, ogCardFromReport(shared.report))

  if (shared.outcome === 'completed' || shared.outcome === 'abandoned') {
    const [song] = await db
      .select()
      .from(sessionSongs)
      .where(eq(sessionSongs.sessionPlanId, shared.share.sessionId))
      .limit(1)
    if (song?.status === 'completed' && song.llmOutput) {
      props.songTitle = (song.llmOutput as SessionSongLLMOutput)?.title ?? null
    }
  }
  return props
}

export default async function Image({ params }: OGImageProps) {
  const { token } = await params
  return new ImageResponse(<ObserveOgCard {...(await ogCardPropsForToken(token))} />, { ...size })
}
