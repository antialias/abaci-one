import { authorizeKidSongsRequest } from '@/lib/auth/integrationToken'
import { readAndHashSong } from '@/lib/kid-songs/audio'
import {
  audioUrlFor,
  isValidId,
  toEligibleSongCandidate,
  toIso,
  toNullableIso,
} from '@/lib/kid-songs/eligibility'
import { getLatestSongCandidates, getSongCandidateById } from '@/lib/kid-songs/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' }
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

async function isFullyEligible(playerId: string, songId: string): Promise<boolean> {
  const row = await getSongCandidateById(playerId, songId)
  const candidate = row ? toEligibleSongCandidate(row) : null
  if (!candidate) return false
  try {
    await readAndHashSong(candidate.id)
    return true
  } catch (error) {
    console.error(`[kid-songs] Unable to hash known song ${candidate.id}:`, error)
    return false
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ playerId: string }> }
): Promise<Response> {
  try {
    const auth = authorizeKidSongsRequest(request)
    if (!auth.configured || !auth.tokenAccepted) return json({ error: 'Unauthorized' }, 401)

    const { playerId } = await context.params
    const knownSongId = new URL(request.url).searchParams.get('knownSongId')
    if (!isValidId(playerId) || (knownSongId !== null && !isValidId(knownSongId))) {
      return json({ error: 'Invalid parameters' }, 400)
    }

    const emptyKnown = knownSongId === null ? null : { id: knownSongId, eligible: false }
    if (!auth.allowedPlayerIds.has(playerId)) {
      return json({ song: null, knownSong: emptyKnown })
    }

    let song = null
    const candidates = await getLatestSongCandidates(playerId)
    for (const row of candidates) {
      const candidate = toEligibleSongCandidate(row)
      if (!candidate) continue
      try {
        const audio = await readAndHashSong(candidate.id)
        song = {
          id: candidate.id,
          playerId: candidate.playerId,
          title: candidate.title,
          durationSeconds: candidate.durationSeconds,
          createdAt: toIso(candidate.createdAt),
          completedAt: toNullableIso(candidate.completedAt),
          audioVersion: audio.sha256,
          audioSha256: audio.sha256,
          audioUrl: audioUrlFor(candidate.playerId, candidate.id, audio.sha256),
        }
        break
      } catch (error) {
        console.error(`[kid-songs] Skipping unreadable song ${candidate.id}:`, error)
      }
    }

    const knownSong =
      knownSongId === null
        ? null
        : { id: knownSongId, eligible: await isFullyEligible(playerId, knownSongId) }
    return json({ song, knownSong })
  } catch (error) {
    console.error('[kid-songs] Latest route failed:', error)
    return json({ error: 'Internal error' }, 500)
  }
}
