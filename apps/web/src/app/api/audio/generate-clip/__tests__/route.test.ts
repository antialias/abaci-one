// @vitest-environment node

/**
 * POST /api/audio/generate-clip against a real filesystem (a temp cwd).
 * Stubbed: withAuth (passthrough), usage recording, the DB (collected-clip
 * text), and fetch (the door). Path handling, clip authority, the cache and
 * the write are the real code.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { NextRequest } from 'next/server'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/lib/ai-usage/helpers', () => ({ recordTtsUsage: vi.fn() }))

/** Rows the fake DB returns, by table: [collected clip rows, say rows]. */
let collectedRows: { id: string; tone: string }[] = []
let sayRows: { clipId: string; locale: string; text: string }[] = []
vi.mock('@/db', () => {
  const query = (rows: () => unknown[]) => {
    const q = {
      where: () => q,
      limit: () => q,
      // biome-ignore lint/suspicious/noThenProperty: drizzle queries are thenables
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows()).then(resolve),
    }
    return q
  }
  return {
    db: {
      select: () => ({
        from: (table: unknown) => query(() => (String(table) === 'say' ? sayRows : collectedRows)),
      }),
    },
  }
})
vi.mock('@/db/schema', () => ({
  ttsCollectedClips: { toString: () => 'clips' },
  ttsCollectedClipSay: { toString: () => 'say' },
}))

import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { computeClipHash } from '@/lib/audio/clipHash'
import { onDemandSpeechBudget } from '@/lib/speech/generationBudget'
import { SPEECH_TIMEOUT_MS } from '@/lib/speech/synthesize'
import { POST } from '../route'

const VOICE = 'el-onwK4e9ZLuTAKqWW03F9'
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 7])
const fetchMock = vi.fn()
let root: string

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/audio/generate-clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
const call = (body: unknown, ctx: object = { userId: 'user-1' }, headers = {}) =>
  POST(post(body, headers), ctx as never)

function sentToDoor(): { text: string; model_id: string } {
  return JSON.parse(fetchMock.mock.calls[0][1].body)
}

/** Every file under `dir`, relative. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) =>
      join(d.parentPath ?? (d as unknown as { path: string }).path, d.name).slice(dir.length + 1)
    )
    .sort()
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'generate-clip-'))
  vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'app'))
  mkdirSync(join(root, 'app'))
  vi.stubEnv('ELEVENLABS_API_BASE_URL', 'http://door.test/elevenlabs')
  vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', 'proxy-login')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockImplementation(async () => new Response(MP3, { status: 200 }))
  collectedRows = []
  sayRows = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

describe('writes into data/audio/el-{id}/', () => {
  const text = 'Find where the two circles meet.'
  const tone = 'Patiently guiding a young child through a geometry construction.'
  const clipId = computeClipHash({ en: text }, tone)

  it('generates a hash clip, writes it under the voice folder and returns it', async () => {
    const res = await call({ voice: VOICE, clipId, text, tone })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(MP3)
    expect(filesUnder(root)).toEqual([join('app', 'data', 'audio', VOICE, `${clipId}.mp3`)])
    expect(sentToDoor()).toEqual({ text, model_id: 'eleven_v3' })
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://door.test/elevenlabs/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9?output_format=mp3_44100_128'
    )
  })

  it('serves a clip already on disk without calling the door', async () => {
    const dir = join(root, 'app', 'data', 'audio', VOICE)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${clipId}.mp3`), Buffer.from([9, 9]))
    const res = await call({ voice: VOICE, clipId, text, tone })
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([9, 9]))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("speaks a manifest clip's own text in its own tone", async () => {
    const entry = AUDIO_MANIFEST.find((e) => e.tone === 'celebration') ?? AUDIO_MANIFEST[0]
    const res = await call({ voice: VOICE, clipId: entry.id, text: entry.text, tone: 'whatever' })
    expect(res.status).toBe(200)
    expect(sentToDoor().text).toContain(entry.text)
    expect(existsSync(join(root, 'app', 'data', 'audio', VOICE, `${entry.id}.mp3`))).toBe(true)
  })

  it("speaks a collected clip's server text", async () => {
    collectedRows = [{ id: 'my-feature-hello', tone: 'tutorial-instruction' }]
    sayRows = [{ clipId: 'my-feature-hello', locale: 'en', text: 'Hello there.' }]
    const res = await call({ voice: VOICE, clipId: 'my-feature-hello', text: 'Hello there.' })
    expect(res.status).toBe(200)
    expect(sentToDoor().text).toBe('Hello there.')
  })
})

describe('refuses traversal, writing nothing and spending nothing', () => {
  const text = 'hi'
  const clipId = computeClipHash({ en: text }, '')

  it.each([
    ['voice ..', { voice: '..', clipId, text }],
    ['voice with a slash', { voice: `${VOICE}/../../escape`, clipId, text }],
    ['voice with a backslash', { voice: `el-x\\..\\escape`, clipId, text }],
    ['clipId climbing out', { voice: VOICE, clipId: '../../../escape', text }],
    ['clipId with a slash', { voice: VOICE, clipId: 'a/b', text }],
    ['clipId with a backslash', { voice: VOICE, clipId: '..\\escape', text }],
    ['clipId with NUL', { voice: VOICE, clipId: 'a\0b', text }],
  ])('%s', async (_, body) => {
    const res = await call(body)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(filesUnder(root)).toEqual([])
  })
})

describe('speaks only what the clip id stands for', () => {
  const text = 'Find where the two circles meet.'
  const clipId = computeClipHash({ en: text }, '')

  it('refuses other words under a hash id', async () => {
    const res = await call({ voice: VOICE, clipId, text: 'Something else entirely.' })
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(filesUnder(root)).toEqual([])
  })

  it('refuses other words under a manifest id', async () => {
    const res = await call({ voice: VOICE, clipId: AUDIO_MANIFEST[0].id, text: 'Rude words.' })
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a named id the server has never seen', async () => {
    const res = await call({ voice: VOICE, clipId: 'invented-id', text: 'Anything.' })
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('hourly caps', () => {
  const text = 'Find where the two circles meet.'
  const clipId = computeClipHash({ en: text }, '')

  it('counts a guest by its guest id, and answers 429 when a cap is reached', async () => {
    const spy = vi
      .spyOn(onDemandSpeechBudget, 'tryConsume')
      .mockReturnValue({ ok: false, scope: 'identity' })
    const res = await call({ voice: VOICE, clipId, text }, { userId: '' }, { 'x-guest-id': 'g-42' })
    expect(res.status).toBe(429)
    expect(spy).toHaveBeenCalledWith('g-42', text.length)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(filesUnder(root)).toEqual([])
  })

  it('a cache hit spends nothing', async () => {
    const spy = vi.spyOn(onDemandSpeechBudget, 'tryConsume')
    const dir = join(root, 'app', 'data', 'audio', VOICE)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${clipId}.mp3`), Buffer.from([1]))
    await call({ voice: VOICE, clipId, text })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('a stuck door', () => {
  it('answers 504 after the on-demand timeout and writes nothing', async () => {
    const realTimeout = AbortSignal.timeout.bind(AbortSignal)
    const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(20))
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
    const text = 'Find where the two circles meet.'
    const res = await call({ voice: VOICE, clipId: computeClipHash({ en: text }, ''), text })
    expect(spy).toHaveBeenCalledWith(SPEECH_TIMEOUT_MS.onDemand)
    expect(res.status).toBe(504)
    expect(filesUnder(root)).toEqual([])
  })
})
