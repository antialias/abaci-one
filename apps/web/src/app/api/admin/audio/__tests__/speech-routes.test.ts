// @vitest-environment node

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))

const mockRecordTtsUsage = vi.fn()
vi.mock('@/lib/ai-usage/helpers', () => ({
  recordTtsUsage: (...args: unknown[]) => mockRecordTtsUsage(...args),
}))

const startAudioGeneration = vi.fn()
vi.mock('@/lib/tasks/audio-generate', () => ({
  startAudioGeneration: (...args: unknown[]) => startAudioGeneration(...args),
}))

const startCollectedClipGeneration = vi.fn()
vi.mock('@/lib/tasks/collected-clip-generate', () => ({
  startCollectedClipGeneration: (...args: unknown[]) => startCollectedClipGeneration(...args),
}))

import { POST as generateClip } from '@/app/api/audio/generate-clip/route'
import { POST as generate } from '../generate/route'
import { POST as generateCollected } from '../generate-collected/route'
import { POST as preview } from '../preview/route'

const ctx = { userId: 'admin-1' } as never
const fetchMock = vi.fn()
const EL_VOICE = 'el-21m00Tcm4TlvDq8ikWAM'

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_BASE_URL', 'http://door.test/elevenlabs')
  vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', 'proxy-login')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  startAudioGeneration.mockReset().mockResolvedValue('task-1')
  startCollectedClipGeneration.mockReset().mockResolvedValue('task-2')
  mockRecordTtsUsage.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('retired OpenAI voices are refused with a clear message', () => {
  it('POST /api/audio/generate-clip', async () => {
    const res = await generateClip(
      post('/api/audio/generate-clip', {
        voice: 'onyx',
        clipId: `test-never-on-disk-${Date.now()}`,
        text: 'seven',
        tone: 'math-dictation',
      }),
      ctx
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/"onyx" is a retired OpenAI voice/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POST /api/admin/audio/preview', async () => {
    const res = await preview(post('/api/admin/audio/preview', { voice: 'nova', text: 'hi' }), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/retired OpenAI voice/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POST /api/admin/audio/generate', async () => {
    const res = await generate(post('/api/admin/audio/generate', { voice: 'onyx' }), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/retired OpenAI voice/)
    expect(startAudioGeneration).not.toHaveBeenCalled()
  })

  it('POST /api/admin/audio/generate-collected', async () => {
    const res = await generateCollected(
      post('/api/admin/audio/generate-collected', { voice: 'onyx', clipIds: ['a'] }),
      ctx
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/retired OpenAI voice/)
    expect(startCollectedClipGeneration).not.toHaveBeenCalled()
  })
})

describe('ElevenLabs voices go through', () => {
  it('preview speaks through the door and records usage', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    const res = await preview(
      post('/api/admin/audio/preview', { voice: EL_VOICE, text: 'hi', tone: 'celebration' }),
      ctx
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(mockRecordTtsUsage).toHaveBeenCalledWith(
      '[excited] hi',
      'eleven_v3',
      expect.objectContaining({ userId: 'admin-1', feature: 'tts:preview' })
    )
  })

  it("preview passes the door's error on as 502 with ElevenLabs' message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: { message: 'voice not found' } }), { status: 404 })
    )
    const res = await preview(
      post('/api/admin/audio/preview', { voice: EL_VOICE, text: 'hi' }),
      ctx
    )
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('ElevenLabs HTTP 404: voice not found')
  })

  it('bulk generation starts for an ElevenLabs voice', async () => {
    const res = await generateCollected(
      post('/api/admin/audio/generate-collected', { voice: EL_VOICE, clipIds: ['a'] }),
      ctx
    )
    expect(res.status).toBe(200)
    expect(startCollectedClipGeneration).toHaveBeenCalledWith({
      voice: EL_VOICE,
      clipIds: ['a'],
      _userId: 'admin-1',
    })
  })
})
