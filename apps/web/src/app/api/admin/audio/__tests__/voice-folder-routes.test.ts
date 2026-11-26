// @vitest-environment node

/**
 * Admin routes that write or remove voice folders, against a real temp
 * data/audio/. Stubbed: withAuth (passthrough) and the settings row.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { NextRequest } from 'next/server'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/db', () => {
  const q = {
    from: () => q,
    where: () => q,
    limit: () => Promise.resolve([{ audioVoice: 'el-active' }]),
  }
  return { db: { select: () => q, delete: () => Promise.resolve() } }
})

let root: string
let audio: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'voice-folder-'))
  mkdirSync(join(root, 'app'))
  audio = join(root, 'app', 'data', 'audio')
  mkdirSync(join(audio, 'el-old'), { recursive: true })
  writeFileSync(join(audio, 'el-old', 'a.mp3'), 'x')
  mkdirSync(join(audio, 'songs'), { recursive: true })
  writeFileSync(join(audio, 'songs', 'song-1.mp3'), 'a child song')
  writeFileSync(join(root, 'app', 'precious.txt'), 'keep')
  vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'app'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

/** Route modules read process.cwd() at module scope in places; import after the spy. */
async function routes() {
  vi.resetModules()
  const voice = await import('../voice/[voice]/route')
  const custom = await import('../custom-clips/[voice]/[clipId]/route')
  const all = await import('../voices/route')
  const clips = await import('@/app/api/audio/clips/[voice]/[clipId]/route')
  return {
    removeVoice: voice.DELETE,
    uploadClip: custom.POST,
    patchClip: custom.PATCH,
    deleteClip: custom.DELETE,
    removeAll: all.DELETE,
    serveClip: clips.GET,
  }
}

const ctx = (params: object) => ({ userId: 'admin-1', params: Promise.resolve(params) }) as never

describe('DELETE /api/admin/audio/voice/[voice]', () => {
  it.each(['.', '..', ' .. ', 'el-old/..', '..\\app'])(
    'refuses %j without removing anything',
    async (voice) => {
      const { removeVoice } = await routes()
      const res = await removeVoice(new NextRequest('http://localhost/x'), ctx({ voice }))
      expect(res.status).toBe(400)
      expect(existsSync(join(audio, 'el-old', 'a.mp3'))).toBe(true)
      expect(existsSync(join(root, 'app', 'precious.txt'))).toBe(true)
    }
  )

  it('removes one voice folder', async () => {
    const { removeVoice } = await routes()
    const res = await removeVoice(new NextRequest('http://localhost/x'), ctx({ voice: 'el-old' }))
    expect(res.status).toBe(200)
    expect(existsSync(join(audio, 'el-old'))).toBe(false)
    expect(existsSync(audio)).toBe(true)
  })
})

describe('POST /api/admin/audio/custom-clips/[voice]/[clipId]', () => {
  function upload() {
    const form = new FormData()
    form.append('audio', new Blob([new Uint8Array([1, 2])], { type: 'audio/webm' }))
    return new NextRequest('http://localhost/x', { method: 'POST', body: form })
  }

  it.each(['nova', 'ONYX', 'el-onwK4e9ZLuTAKqWW03F9', 'EL-whatever'])(
    'refuses the reserved name %j',
    async (voice) => {
      const { uploadClip } = await routes()
      const res = await uploadClip(upload(), ctx({ voice, clipId: 'hello' }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/reserved/)
      expect(existsSync(join(audio, voice))).toBe(false)
    }
  )

  it('saves a recording under a custom name', async () => {
    const { uploadClip } = await routes()
    const res = await uploadClip(upload(), ctx({ voice: 'Thomas Hallock', clipId: 'hello' }))
    expect(res.status).toBe(200)
    expect(existsSync(join(audio, 'Thomas Hallock', 'cc-hello.webm'))).toBe(true)
  })
})

describe("songs holds children's session songs: no voice route touches it", () => {
  const songFile = () => join(audio, 'songs', 'song-1.mp3')

  it.each(['songs', 'SONGS', ' songs '])('DELETE /voice/%j is refused', async (voice) => {
    const { removeVoice } = await routes()
    const res = await removeVoice(new NextRequest('http://localhost/x'), ctx({ voice }))
    expect(res.status).toBe(400)
    expect(existsSync(songFile())).toBe(true)
  })

  it('the remove-everything reset keeps songs', async () => {
    const { removeAll } = await routes()
    const res = await removeAll(new NextRequest('http://localhost/x'), ctx({}))
    expect(res.status).toBe(200)
    expect(existsSync(join(audio, 'el-old'))).toBe(false)
    expect(existsSync(songFile())).toBe(true)
  })

  it('custom-clip upload, deactivate and delete refuse it', async () => {
    const { uploadClip, patchClip, deleteClip } = await routes()
    const form = new FormData()
    form.append('audio', new Blob([new Uint8Array([1])], { type: 'audio/webm' }))
    const params = { voice: 'songs', clipId: 'song-1' }
    const up = await uploadClip(
      new NextRequest('http://localhost/x', { method: 'POST', body: form }),
      ctx(params)
    )
    const patch = await patchClip(
      new NextRequest('http://localhost/x', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'deactivate' }),
      }),
      ctx(params)
    )
    const del = await deleteClip(
      new NextRequest('http://localhost/x', { method: 'DELETE' }),
      ctx(params)
    )
    expect([up.status, patch.status, del.status]).toEqual([400, 400, 400])
    expect(existsSync(songFile())).toBe(true)
  })

  it('the clip server will not serve from it', async () => {
    const { serveClip } = await routes()
    const res = await serveClip(
      new NextRequest('http://localhost/x'),
      ctx({ voice: 'songs', clipId: 'song-1' })
    )
    expect(res.status).toBe(400)
  })
})
