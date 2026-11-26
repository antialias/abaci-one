// @vitest-environment node

import { sql } from 'drizzle-orm'
/**
 * Collected clips against an in-memory SQLite and a temp data/audio/:
 * say text is first-write-wins, the per-voice status points at the file the
 * clip is really stored under, and the bulk task writes exactly where the
 * on-demand route looks.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { NextRequest } from 'next/server'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  return { db: drizzle(createClient({ url: ':memory:' }), { schema }), schema }
})
vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/lib/ai-usage/helpers', () => ({ recordTtsUsage: vi.fn() }))

/** Run a task's handler inline, recording what it emitted. */
const taskEvents: Array<{ type: string; clipId?: string; error?: string }> = []
vi.mock('@/lib/task-manager', () => ({
  createTask: async (
    _type: string,
    input: unknown,
    handler: (handle: unknown, input: unknown) => Promise<void>
  ) => {
    await handler(
      {
        id: 'task-1',
        emit: (e: { type: string }) => taskEvents.push(e),
        fail: (msg: string) => taskEvents.push({ type: 'failed', error: msg }),
        complete: () => {},
        setProgress: () => {},
        isCancelled: () => false,
      },
      input
    )
    return 'task-1'
  },
}))

import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { computeClipHash } from '@/lib/audio/clipHash'
import { speechStorageKey } from '@/lib/speech/clipStorage'
import { startCollectedClipGeneration } from '@/lib/tasks/collected-clip-generate'
import { GET, POST } from '../route'

const VOICE = 'el-onwK4e9ZLuTAKqWW03F9'
const ctx = { userId: '' } as never
let root: string
let audio: string

function flush(clips: unknown[]) {
  return POST(
    new NextRequest('http://localhost/api/audio/collected-clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips }),
    }),
    ctx
  )
}

async function list(voice?: string) {
  const url = `http://localhost/api/audio/collected-clips${voice ? `?voice=${voice}` : ''}`
  return (await GET(new NextRequest(url), ctx)).json()
}

beforeAll(async () => {
  await db.run(
    sql.raw(
      'CREATE TABLE tts_collected_clips (id text PRIMARY KEY NOT NULL, tone text NOT NULL, play_count integer DEFAULT 0 NOT NULL, first_seen_at text NOT NULL, last_seen_at text NOT NULL)'
    )
  )
  await db.run(
    sql.raw(
      'CREATE TABLE tts_collected_clip_say (clip_id text NOT NULL, locale text NOT NULL, text text NOT NULL, PRIMARY KEY (clip_id, locale))'
    )
  )
})

beforeEach(async () => {
  await db.run(sql.raw('DELETE FROM tts_collected_clip_say'))
  await db.run(sql.raw('DELETE FROM tts_collected_clips'))
  taskEvents.length = 0
  root = mkdtempSync(join(tmpdir(), 'collected-clips-'))
  mkdirSync(join(root, 'app'))
  audio = join(root, 'app', 'data', 'audio')
  vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'app'))
  vi.stubEnv('ELEVENLABS_API_BASE_URL', 'http://door.test/elevenlabs')
  vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', 'proxy-login')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const { text } = JSON.parse(String(init.body))
      return new Response(new TextEncoder().encode(`AUDIO:${text}`), { status: 200 })
    })
  )
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

describe('POST: say text is first-write-wins', () => {
  it('a later flush cannot rewrite an existing clip text or tone, but still counts plays', async () => {
    await flush([
      { clipId: 'h-b46201e8', say: { en: 'The real line.' }, tone: 'warm', playCount: 1 },
    ])
    await flush([
      { clipId: 'h-b46201e8', say: { en: 'Something rude.' }, tone: 'creepy', playCount: 2 },
    ])
    const { clips } = await list()
    expect(clips).toHaveLength(1)
    expect(clips[0]).toMatchObject({ say: { en: 'The real line.' }, tone: 'warm', playCount: 3 })
  })

  it('a new locale can still be added', async () => {
    await flush([{ clipId: 'greet', say: { en: 'Hello.' }, tone: '', playCount: 1 }])
    await flush([{ clipId: 'greet', say: { es: 'Hola.' }, tone: '', playCount: 1 }])
    const { clips } = await list()
    expect(clips[0].say).toEqual({ en: 'Hello.', es: 'Hola.' })
  })
})

describe('bulk generation keys files exactly as the on-demand route does', () => {
  const text = 'Find where the two circles meet.'
  const tone = 'Patiently guiding a young child.'
  const hashId = computeClipHash({ en: text }, tone)
  const manifest = AUDIO_MANIFEST[0]

  beforeEach(async () => {
    await flush([
      { clipId: hashId, say: { en: text }, tone, playCount: 1 },
      { clipId: manifest.id, say: { en: manifest.text }, tone: 'client tone', playCount: 1 },
    ])
  })

  it('writes text-keyed and manifest files, and GET ?voice reports them with fileFor', async () => {
    const before = await list(VOICE)
    expect(before.generatedFor).toEqual({ [hashId]: false, [manifest.id]: false })
    expect(before.fileFor).toEqual({
      [hashId]: speechStorageKey(text, tone),
      [manifest.id]: manifest.id,
    })

    await startCollectedClipGeneration({ voice: VOICE, clipIds: [hashId, manifest.id] })

    expect(existsSync(join(audio, VOICE, `${speechStorageKey(text, tone)}.mp3`))).toBe(true)
    expect(existsSync(join(audio, VOICE, `${manifest.id}.mp3`))).toBe(true)
    expect(existsSync(join(audio, VOICE, `${hashId}.mp3`))).toBe(false)
    expect((await list(VOICE)).generatedFor).toEqual({ [hashId]: true, [manifest.id]: true })
  })

  it('skips clips already stored under their key', async () => {
    mkdirSync(join(audio, VOICE), { recursive: true })
    writeFileSync(join(audio, VOICE, `${speechStorageKey(text, tone)}.mp3`), 'x')
    await startCollectedClipGeneration({ voice: VOICE, clipIds: [hashId] })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('GET ?voice refuses non-voice folders', () => {
  it('songs', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/audio/collected-clips?voice=songs'),
      ctx
    )
    expect(res.status).toBe(400)
  })
})
