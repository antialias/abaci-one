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
  return { db: { select: () => q } }
})

let root: string
let audio: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'voice-folder-'))
  mkdirSync(join(root, 'app'))
  audio = join(root, 'app', 'data', 'audio')
  mkdirSync(join(audio, 'el-old'), { recursive: true })
  writeFileSync(join(audio, 'el-old', 'a.mp3'), 'x')
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
  return { removeVoice: voice.DELETE, uploadClip: custom.POST }
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
