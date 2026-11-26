// @vitest-environment node

/**
 * POST /api/audio/generate-clip against a real filesystem (a temp cwd).
 * Stubbed: withAuth (passthrough), usage recording, and fetch (the door).
 * Storage keying, the cache, the guest-cookie check, dedupe and the write
 * are the real code.
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

import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { computeClipHash } from '@/lib/audio/clipHash'
import { createGuestToken, GUEST_COOKIE_NAME } from '@/lib/guest-token'
import { speechStorageKey } from '@/lib/speech/clipStorage'
import { onDemandSpeechBudget } from '@/lib/speech/generationBudget'
import { onDemandGenerations } from '@/lib/speech/onDemandGeneration'
import { SPEECH_TIMEOUT_MS } from '@/lib/speech/synthesize'
import { POST } from '../route'

const VOICE = 'el-onwK4e9ZLuTAKqWW03F9'
const fetchMock = vi.fn()
let root: string
let audio: string

/** The door "speaks" by echoing what it was sent, so a test can tell clips apart. */
function echoDoor() {
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const { text } = JSON.parse(String(init.body))
    return new Response(new TextEncoder().encode(`AUDIO:${text}`), { status: 200 })
  })
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/audio/generate-clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
const call = (body: unknown, ctx: object = { userId: 'user-1' }, headers = {}) =>
  POST(post(body, headers), ctx as never)

async function bodyText(res: Response): Promise<string> {
  return new TextDecoder().decode(await res.arrayBuffer())
}

/** Every file under `dir`, relative, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => {
      const parent = (d as unknown as { parentPath?: string; path: string }).parentPath ?? d.path
      return join(parent, d.name).slice(dir.length + 1)
    })
    .sort()
}

/** Let the route run until `cond` holds, without advancing (possibly fake) timers. */
async function until(cond: () => boolean) {
  for (let i = 0; i < 2000 && !cond(); i++) await new Promise((r) => setImmediate(r))
  expect(cond()).toBe(true)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'generate-clip-'))
  mkdirSync(join(root, 'app'))
  audio = join(root, 'app', 'data', 'audio')
  vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'app'))
  vi.stubEnv('ELEVENLABS_API_BASE_URL', 'http://door.test/elevenlabs')
  vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', 'proxy-login')
  vi.stubEnv('AUTH_SECRET', 'test-secret-for-guest-tokens-0123456789')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  echoDoor()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  expect(onDemandGenerations.inFlight).toBe(0)
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

describe('storage is keyed by the text the server speaks', () => {
  const text = 'Find where the two circles meet.'
  const tone = 'Patiently guiding a young child through a geometry construction.'
  const clipId = computeClipHash({ en: text }, tone)

  it('writes a hash clip under the t- key of its text, never under the client id', async () => {
    const res = await call({ voice: VOICE, clipId, text, tone })
    expect(res.status).toBe(200)
    expect(await bodyText(res)).toBe(`AUDIO:${text}`)
    const key = speechStorageKey(text, tone)
    expect(key).toMatch(/^t-[0-9a-f]{32}$/)
    expect(filesUnder(root)).toEqual([join('app', 'data', 'audio', VOICE, `${key}.mp3`)])
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://door.test/elevenlabs/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9?output_format=mp3_44100_128'
    )
  })

  it('a collected named id is keyed by its text too', async () => {
    const res = await call({ voice: VOICE, clipId: 'my-feature-hello', text: 'Hello there.' })
    expect(res.status).toBe(200)
    expect(existsSync(join(audio, VOICE, `${speechStorageKey('Hello there.', '')}.mp3`))).toBe(true)
    expect(existsSync(join(audio, VOICE, 'my-feature-hello.mp3'))).toBe(false)
  })

  it("a manifest clip keeps its named file and speaks the manifest's text", async () => {
    const entry = AUDIO_MANIFEST[0]
    const res = await call({ voice: VOICE, clipId: entry.id, text: entry.text, tone: 'whatever' })
    expect(res.status).toBe(200)
    expect(existsSync(join(audio, VOICE, `${entry.id}.mp3`))).toBe(true)
  })

  it('serves from the cache without calling the door', async () => {
    await call({ voice: VOICE, clipId, text, tone })
    const res = await call({ voice: VOICE, clipId, text, tone })
    expect(res.status).toBe(200)
    expect(await bodyText(res)).toBe(`AUDIO:${text}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cacheOnly answers 404 for a missing clip and never generates', async () => {
    const res = await call({ voice: VOICE, clipId, text, tone, cacheOnly: true })
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(filesUnder(root)).toEqual([])
  })

  it('cacheOnly serves a cached clip', async () => {
    await call({ voice: VOICE, clipId, text, tone })
    const res = await call({ voice: VOICE, clipId, text, tone, cacheOnly: true })
    expect(res.status).toBe(200)
    expect(await bodyText(res)).toBe(`AUDIO:${text}`)
  })

  it('retired voices keep serving their files by clip id, and never generate', async () => {
    mkdirSync(join(audio, 'onyx'), { recursive: true })
    writeFileSync(join(audio, 'onyx', `${clipId}.mp3`), 'OLD')
    const hit = await call({ voice: 'onyx', clipId, text, tone, cacheOnly: true })
    expect(await bodyText(hit)).toBe('OLD')
    const miss = await call({ voice: 'onyx', clipId: computeClipHash({ en: 'x' }, ''), text: 'x' })
    expect(miss.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

/**
 * The reviewer's recipe (/tmp/fnvdemo/forge.mjs): FNV-1a 32 runs backwards,
 * so any prefix can be completed to hit a chosen hash id.
 */
function forgeFnvCollision(realText: string, tone: string, prefix: string): string {
  const P = 0x01000193
  let inv = P // Newton: P * inv ≡ 1 (mod 2^32)
  for (let i = 0; i < 5; i++) inv = Math.imul(inv, (2 - Math.imul(P, inv)) >>> 0) >>> 0
  const fnv = (s: string, h = 0x811c9dc5) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), P)
    return h >>> 0
  }
  let t = fnv(`${realText}\0${tone}`)
  const tail = `\0${tone}`
  for (let i = tail.length - 1; i >= 0; i--)
    t = ((Math.imul(t, inv) >>> 0) ^ tail.charCodeAt(i)) >>> 0
  const need = Math.imul(t, inv) >>> 0
  for (const z of 'abcdefghijklmnopqrstuvwxyz ') {
    const s0 = fnv(prefix + z)
    for (let c1 = 0x20; c1 < 0x10000; c1++) {
      const c2 = (Math.imul((s0 ^ c1) >>> 0, P) >>> 0) ^ need
      if (c2 >= 0x20 && c2 < 0x10000) return prefix + z + String.fromCharCode(c1, c2)
    }
  }
  throw new Error('no collision found')
}

describe('a forged FNV collision cannot reach anyone else', () => {
  const tone = 'tutorial-instruction'
  const real =
    'You chose the lower intersection. I will rotate the triangle 180 degrees around the midpoint of AB.'
  const clipId = computeClipHash({ en: real }, tone)
  const forged = forgeFnvCollision(real, tone, 'Something no child should hear. ')

  it('the recipe really forges the id', () => {
    expect(forged).not.toBe(real)
    expect(computeClipHash({ en: forged }, tone)).toBe(clipId)
  })

  it('forged first: the real request still gets audio of the real text', async () => {
    const attack = await call({ voice: VOICE, clipId, text: forged, tone }, { userId: '' })
    expect(await bodyText(attack)).toBe(`AUDIO:${forged}`)

    const child = await call({ voice: VOICE, clipId, text: real, tone }, { userId: '' })
    expect(child.status).toBe(200)
    expect(await bodyText(child)).toBe(`AUDIO:${real}`)
    // Two files, one per text; the child's never touched by the forgery.
    expect(filesUnder(join(audio, VOICE))).toEqual(
      [`${speechStorageKey(forged, tone)}.mp3`, `${speechStorageKey(real, tone)}.mp3`].sort()
    )
  })

  it('real first: the forgery neither overwrites nor is served the real clip', async () => {
    await call({ voice: VOICE, clipId, text: real, tone })
    const attack = await call({ voice: VOICE, clipId, text: forged, tone }, { userId: '' })
    expect(await bodyText(attack)).toBe(`AUDIO:${forged}`)
    const child = await call({ voice: VOICE, clipId, text: real, tone, cacheOnly: true })
    expect(await bodyText(child)).toBe(`AUDIO:${real}`)
  })
})

describe('refuses traversal, writing nothing and spending nothing', () => {
  const text = 'hi'
  const clipId = computeClipHash({ en: text }, '')

  it.each([
    ['voice ..', { voice: '..', clipId, text }],
    ['voice with a slash', { voice: `${VOICE}/../../escape`, clipId, text }],
    ['voice with a backslash', { voice: 'el-x\\..\\escape', clipId, text }],
    ['the songs folder', { voice: 'songs', clipId, text }],
    [
      'clipId climbing out (retired voice, stored by id)',
      { voice: 'onyx', clipId: '../../x', text },
    ],
    ['clipId with a slash (retired voice)', { voice: 'onyx', clipId: 'a/b', text }],
    ['clipId with a backslash (retired voice)', { voice: 'onyx', clipId: '..\\x', text }],
    ['clipId with NUL (retired voice)', { voice: 'onyx', clipId: 'a\0b', text }],
  ])('%s', async (_, body) => {
    const res = await call(body)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(filesUnder(root)).toEqual([])
  })

  it('a hostile clip id on an ElevenLabs voice never names the file', async () => {
    const res = await call({ voice: VOICE, clipId: '../../../escape', text: 'Hello.' })
    expect(res.status).toBe(200)
    expect(filesUnder(root)).toEqual([
      join('app', 'data', 'audio', VOICE, `${speechStorageKey('Hello.', '')}.mp3`),
    ])
  })
})

describe('who is charged', () => {
  const text = 'Find where the two circles meet.'
  const clipId = computeClipHash({ en: text }, '')

  function chargedIdentity() {
    return vi.spyOn(onDemandSpeechBudget, 'tryConsume')
  }

  it('a signed-in user by user id', async () => {
    const spy = chargedIdentity()
    await call({ voice: VOICE, clipId, text }, { userId: 'u-7' })
    expect(spy).toHaveBeenCalledWith('user:u-7', text.length)
  })

  it('a guest by the sid in the signed guest cookie', async () => {
    const spy = chargedIdentity()
    const token = await createGuestToken('guest-sid-42')
    await call(
      { voice: VOICE, clipId, text },
      { userId: '' },
      { cookie: `${GUEST_COOKIE_NAME}=${token}` }
    )
    expect(spy).toHaveBeenCalledWith('guest:guest-sid-42', text.length)
  })

  it('ignores a client-set x-guest-id and a forged cookie; falls back to the proxy-seen address', async () => {
    const spy = chargedIdentity()
    await call(
      { voice: VOICE, clipId, text },
      { userId: '' },
      {
        'x-guest-id': 'attacker-chosen',
        cookie: `${GUEST_COOKIE_NAME}=not.a.validtoken`,
        // A client-supplied hop on the left; the proxy appended the right one.
        'x-forwarded-for': '6.6.6.6, 10.42.0.1',
      }
    )
    expect(spy).toHaveBeenCalledWith('ip:10.42.0.1', text.length)
  })

  it('answers 429 when a cap is reached, writing and spending nothing', async () => {
    vi.spyOn(onDemandSpeechBudget, 'tryConsume').mockReturnValue({ ok: false, scope: 'pod' })
    const res = await call({ voice: VOICE, clipId, text })
    expect(res.status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(filesUnder(root)).toEqual([])
  })

  it('a cache hit spends nothing', async () => {
    await call({ voice: VOICE, clipId, text })
    const spy = chargedIdentity()
    await call({ voice: VOICE, clipId, text })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('a slow door: answer fast, keep the paid request, dedupe', () => {
  const text = 'A line that takes the door a long time.'
  const clipId = computeClipHash({ en: text }, '')
  const file = () => join(audio, VOICE, `${speechStorageKey(text, '')}.mp3`)

  /** A door that answers only when told to. */
  function slowDoor() {
    let answer!: (r: Response) => void
    let fail!: (e: Error) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve, reject) => {
          answer = resolve
          fail = reject
        })
    )
    return {
      answer: () =>
        answer(new Response(new TextEncoder().encode(`AUDIO:${text}`), { status: 200 })),
      fail: () => fail(new TypeError('fetch failed')),
    }
  }

  it('504s after the wait, still caches the clip when it lands, and charges once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const door = slowDoor()
    const charge = vi.spyOn(onDemandSpeechBudget, 'tryConsume')
    const admit = vi.spyOn(onDemandGenerations, 'admit')

    // First play: starts the upstream request, then gives up waiting.
    const first = call({ voice: VOICE, clipId, text })
    await until(() => fetchMock.mock.calls.length === 1)
    await vi.advanceTimersByTimeAsync(SPEECH_TIMEOUT_MS.onDemandWait)
    expect((await first).status).toBe(504)
    expect(existsSync(file())).toBe(false)

    // Second play while it's still running: joins it, no new request or charge.
    const second = call({ voice: VOICE, clipId, text })
    await until(() => admit.mock.calls.length === 2)
    await vi.advanceTimersByTimeAsync(SPEECH_TIMEOUT_MS.onDemandWait)
    expect((await second).status).toBe(504)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(charge).toHaveBeenCalledTimes(1)

    // The door answers: the clip is cached even though nobody was waiting.
    door.answer()
    await until(() => existsSync(file()))
    await until(() => onDemandGenerations.inFlight === 0)

    // Third play: served from the cache.
    const third = await call({ voice: VOICE, clipId, text })
    expect(third.status).toBe(200)
    expect(await bodyText(third)).toBe(`AUDIO:${text}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(charge).toHaveBeenCalledTimes(1)
  })

  it('a play that joins in time gets the audio', async () => {
    const door = slowDoor()
    const admit = vi.spyOn(onDemandGenerations, 'admit')
    const a = call({ voice: VOICE, clipId, text })
    const b = call({ voice: VOICE, clipId, text })
    await until(() => admit.mock.calls.length === 2)
    door.answer()
    const [ra, rb] = await Promise.all([a, b])
    expect([ra.status, rb.status]).toEqual([200, 200])
    expect(await bodyText(rb)).toBe(`AUDIO:${text}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a failure after everyone stopped waiting is logged, not thrown; the next play retries', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const door = slowDoor()
    const first = call({ voice: VOICE, clipId, text })
    await until(() => fetchMock.mock.calls.length === 1)
    await vi.advanceTimersByTimeAsync(SPEECH_TIMEOUT_MS.onDemandWait)
    expect((await first).status).toBe(504)
    door.fail()
    await until(() => onDemandGenerations.inFlight === 0)
    expect(existsSync(file())).toBe(false)

    echoDoor()
    const retry = await call({ voice: VOICE, clipId, text })
    expect(retry.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('the upstream request runs under its own longer limit', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    await call({ voice: VOICE, clipId, text })
    expect(spy).toHaveBeenCalledWith(SPEECH_TIMEOUT_MS.onDemandUpstream)
  })
})
