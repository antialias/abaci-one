// @vitest-environment node
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SongRow } from '@/lib/kid-songs/queries'

vi.mock('@/lib/kid-songs/queries', () => ({
  getLatestSongCandidates: vi.fn(),
  getSongCandidateById: vi.fn(),
}))
vi.mock('@/lib/kid-songs/audio', () => ({
  readAndHashSong: vi.fn(),
}))

import { readAndHashSong } from '@/lib/kid-songs/audio'
import { getLatestSongCandidates, getSongCandidateById } from '@/lib/kid-songs/queries'
import { GET as getAudio } from '../[playerId]/audio/route'
import { GET as getLatest } from '../[playerId]/latest/route'

const TOKEN = 'integration-test-token-value'
const PLAYER = 'player-1'
const SONG = 'song-1'
const bytes = Buffer.from('an mp3 test payload')
const digest = createHash('sha256').update(bytes).digest('hex')
const row: SongRow = {
  id: SONG,
  playerId: PLAYER,
  status: 'completed',
  contentReviewStatus: 'none',
  llmOutput: { title: '  Fern’s Bead Blast  ' },
  durationSeconds: 96.4,
  createdAt: new Date('2026-08-30T13:55:00.000Z'),
  completedAt: new Date('2026-08-30T14:02:11.000Z'),
}

function request(path: string, authorization = `Bearer ${TOKEN}`) {
  return new Request(`https://example.test${path}`, {
    headers: authorization ? { Authorization: authorization } : {},
  })
}
function context(playerId = PLAYER) {
  return { params: Promise.resolve({ playerId }) }
}

beforeEach(() => {
  process.env.KID_SONGS_SYNC_TOKEN = TOKEN
  process.env.KID_SONGS_SYNC_PLAYER_IDS = PLAYER
  vi.mocked(getLatestSongCandidates).mockResolvedValue([row])
  vi.mocked(getSongCandidateById).mockResolvedValue(row)
  vi.mocked(readAndHashSong).mockResolvedValue({ bytes, sha256: digest })
})
afterEach(() => {
  vi.clearAllMocks()
  delete process.env.KID_SONGS_SYNC_TOKEN
  delete process.env.KID_SONGS_SYNC_PLAYER_IDS
})

async function expectContractHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('vary')).toBe('Authorization')
}

describe('kid-song integration authentication', () => {
  it.each([
    ['absent header', ''],
    ['basic header', `Basic ${TOKEN}`],
    ['wrong token', 'Bearer wrong-token-value'],
    ['lowercase scheme', `bearer ${TOKEN}`],
  ])('returns uniform 401 before DB work for %s', async (_name, authorization) => {
    const response = await getLatest(request(`/api/integrations/kid-songs/${PLAYER}/latest`, authorization), context())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(getLatestSongCandidates).not.toHaveBeenCalled()
    await expectContractHeaders(response)
  })

  it.each(['unset token', 'short token', 'unset allowlist', 'malformed allowlist'])(
    'fails closed for %s',
    async (scenario) => {
      if (scenario === 'unset token') delete process.env.KID_SONGS_SYNC_TOKEN
      if (scenario === 'short token') process.env.KID_SONGS_SYNC_TOKEN = 'short'
      if (scenario === 'unset allowlist') delete process.env.KID_SONGS_SYNC_PLAYER_IDS
      if (scenario === 'malformed allowlist') process.env.KID_SONGS_SYNC_PLAYER_IDS = `${PLAYER},,other`
      const response = await getLatest(request(`/api/integrations/kid-songs/${PLAYER}/latest`), context())
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
      expect(getLatestSongCandidates).not.toHaveBeenCalled()
    }
  )
})

describe('latest route', () => {
  it('returns the exact latest-song contract body', async () => {
    const response = await getLatest(request(`/api/integrations/kid-songs/${PLAYER}/latest`), context())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      song: {
        id: SONG,
        playerId: PLAYER,
        title: 'Fern’s Bead Blast',
        durationSeconds: 96.4,
        createdAt: '2026-08-30T13:55:00.000Z',
        completedAt: '2026-08-30T14:02:11.000Z',
        audioVersion: digest,
        audioSha256: digest,
        audioUrl: `/api/integrations/kid-songs/${PLAYER}/audio?songId=${SONG}&v=${digest}`,
      },
      knownSong: null,
    })
    await expectContractHeaders(response)
  })

  it('returns song null and known-song true or false', async () => {
    vi.mocked(getLatestSongCandidates).mockResolvedValue([])
    let response = await getLatest(
      request(`/api/integrations/kid-songs/${PLAYER}/latest?knownSongId=${SONG}`),
      context()
    )
    expect(await response.json()).toEqual({ song: null, knownSong: { id: SONG, eligible: true } })

    vi.mocked(getSongCandidateById).mockResolvedValue(null)
    response = await getLatest(
      request(`/api/integrations/kid-songs/${PLAYER}/latest?knownSongId=missing`),
      context()
    )
    expect(await response.json()).toEqual({ song: null, knownSong: { id: 'missing', eligible: false } })
  })

  it('does not query for a valid nonallowlisted or unknown player', async () => {
    const response = await getLatest(
      request('/api/integrations/kid-songs/other/latest?knownSongId=old'),
      context('other')
    )
    expect(await response.json()).toEqual({ song: null, knownSong: { id: 'old', eligible: false } })
    expect(getLatestSongCandidates).not.toHaveBeenCalled()
    expect(getSongCandidateById).not.toHaveBeenCalled()
  })

  it.each([
    ['bad player ID', '../bad', ''],
    ['bad known ID', PLAYER, '?knownSongId=bad%2Fid'],
  ])('returns 400 for %s only after auth', async (_name, playerId, query) => {
    const response = await getLatest(
      request(`/api/integrations/kid-songs/${playerId}/latest${query}`),
      context(playerId)
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid parameters' })
  })

  it('maps unexpected query exceptions to contract 500', async () => {
    vi.mocked(getLatestSongCandidates).mockRejectedValue(new Error('db down'))
    const response = await getLatest(request(`/api/integrations/kid-songs/${PLAYER}/latest`), context())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal error' })
  })
})

describe('audio route', () => {
  const audioPath = (songId = SONG, version = digest) =>
    `/api/integrations/kid-songs/${PLAYER}/audio?songId=${songId}&v=${version}`

  it.each([
    ['missing songId', `/api/integrations/kid-songs/${PLAYER}/audio?v=${digest}`],
    ['missing version', `/api/integrations/kid-songs/${PLAYER}/audio?songId=${SONG}`],
    ['malformed songId', audioPath('bad/id')],
    ['malformed version', audioPath(SONG, 'abc')],
  ])('returns 400 for %s', async (_name, path) => {
    const response = await getAudio(request(path), context())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid parameters' })
  })

  it('uses a uniform 404 for nonallowlisted, cross-player/ineligible, and stale versions', async () => {
    let response = await getAudio(
      request(`/api/integrations/kid-songs/other/audio?songId=${SONG}&v=${digest}`),
      context('other')
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })

    vi.mocked(getSongCandidateById).mockResolvedValue(null)
    response = await getAudio(request(audioPath()), context())
    expect(response.status).toBe(404)

    vi.mocked(getSongCandidateById).mockResolvedValue(row)
    response = await getAudio(request(audioPath(SONG, 'a'.repeat(64))), context())
    expect(response.status).toBe(404)
  })

  it('returns 503 when eligible audio is absent', async () => {
    vi.mocked(readAndHashSong).mockRejectedValue(new Error('ENOENT'))
    const response = await getAudio(request(audioPath()), context())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Audio unavailable' })
  })

  it('returns exact bytes and headers and performs the scoped lookup', async () => {
    const response = await getAudio(request(audioPath()), context())
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(response.headers.get('content-type')).toBe('audio/mpeg')
    expect(response.headers.get('content-length')).toBe(String(bytes.length))
    expect(response.headers.get('content-disposition')).toBe(`inline; filename="${SONG}.mp3"`)
    expect(response.headers.get('x-content-sha256')).toBe(digest)
    await expectContractHeaders(response)
    expect(getSongCandidateById).toHaveBeenCalledWith(PLAYER, SONG)
    expect(getLatestSongCandidates).not.toHaveBeenCalled()
  })
})
