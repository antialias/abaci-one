import { authorizeKidSongsRequest } from '@/lib/auth/integrationToken'
import { readAndHashSong } from '@/lib/kid-songs/audio'
import {
  isValidAudioVersion,
  isValidId,
  toEligibleSongCandidate,
} from '@/lib/kid-songs/eligibility'
import { getSongCandidateById } from '@/lib/kid-songs/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const commonHeaders = { 'Cache-Control': 'no-store', Vary: 'Authorization' }
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
  })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ playerId: string }> }
): Promise<Response> {
  try {
    const auth = authorizeKidSongsRequest(request)
    if (!auth.configured || !auth.tokenAccepted) return json({ error: 'Unauthorized' }, 401)

    const { playerId } = await context.params
    const search = new URL(request.url).searchParams
    const songId = search.get('songId')
    const version = search.get('v')
    if (!isValidId(playerId) || !isValidId(songId) || !isValidAudioVersion(version)) {
      return json({ error: 'Invalid parameters' }, 400)
    }
    if (!auth.allowedPlayerIds.has(playerId)) return json({ error: 'Not found' }, 404)

    const row = await getSongCandidateById(playerId, songId)
    const candidate = row ? toEligibleSongCandidate(row) : null
    if (!candidate) return json({ error: 'Not found' }, 404)

    let audio
    try {
      // readAndHashSong performs one whole-file read; its ID guard protects the join.
      audio = await readAndHashSong(songId)
    } catch (error) {
      console.error(`[kid-songs] Audio unavailable for ${songId}:`, error)
      return json({ error: 'Audio unavailable' }, 503)
    }
    if (audio.sha256 !== version) return json({ error: 'Not found' }, 404)

    return new Response(new Uint8Array(audio.bytes), {
      status: 200,
      headers: {
        ...commonHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.bytes.byteLength),
        'Content-Disposition': `inline; filename="${songId}.mp3"`,
        'X-Content-SHA256': version,
      },
    })
  } catch (error) {
    console.error('[kid-songs] Audio route failed:', error)
    return json({ error: 'Internal error' }, 500)
  }
}
