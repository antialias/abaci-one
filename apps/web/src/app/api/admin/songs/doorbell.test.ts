// @vitest-environment node

import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ring, updateWhere, selectLimit } = vi.hoisted(() => ({
  ring: vi.fn(),
  updateWhere: vi.fn(),
  selectLimit: vi.fn(),
}))

vi.mock('@/lib/kid-songs/doorbell', () => ({ ringKidSongsDoorbell: ring }))
vi.mock('@/lib/auth/withAuth', () => ({
  withAuth:
    (handler: (request: Request, context: { userId: string }) => Promise<Response>) =>
    (request: Request) =>
      handler(request, { userId: 'admin-1' }),
}))
vi.mock('@/lib/tasks/session-song', () => ({
  retrySessionSongGeneration: vi.fn(),
  startSessionSongGeneration: vi.fn(),
}))
vi.mock('@/lib/session-song/admin-validation-summary', () => ({
  getAdminSongPlanSummary: vi.fn(),
  getSongPlanValidationSummary: vi.fn(),
}))
vi.mock('@/lib/song-share/songPlan', () => ({ parseSongPlan: vi.fn() }))
vi.mock('@/db', () => {
  const selectWhere = vi.fn(() => ({ limit: selectLimit }))
  const from = vi.fn(() => ({ where: selectWhere }))
  const set = vi.fn(() => ({ where: updateWhere }))
  return {
    db: {
      select: vi.fn(() => ({ from })),
      update: vi.fn(() => ({ set })),
    },
    schema: {
      sessionSongs: {
        id: 'id',
      },
    },
  }
})

import { POST } from './route'

function request(action: string, reason?: string): NextRequest {
  return new Request('http://localhost/api/admin/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId: 'song-1', action, reason }),
  }) as NextRequest
}

describe('admin song mutation doorbells', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectLimit.mockResolvedValue([
      { id: 'song-1', sessionPlanId: 'plan-1', playerId: 'player-1', triggerSource: null },
    ])
    updateWhere.mockResolvedValue(undefined)
    ring.mockResolvedValue(undefined)
  })

  it.each([
    ['flag_content', 'unsafe lyrics'],
    ['clear_content_flag', undefined],
  ])('rings only after the %s update commits', async (action, reason) => {
    let commit: (() => void) | undefined
    updateWhere.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          commit = resolve
        })
    )

    const responsePromise = POST(request(action, reason))
    await vi.waitFor(() => expect(updateWhere).toHaveBeenCalledTimes(1))
    expect(ring).not.toHaveBeenCalled()

    commit?.()
    const response = await responsePromise

    expect(response.status).toBe(200)
    expect(ring).toHaveBeenCalledTimes(1)
    expect(updateWhere.mock.invocationCallOrder[0]).toBeLessThan(ring.mock.invocationCallOrder[0])
  })

  it.each([
    ['flag_content', 'unsafe lyrics'],
    ['clear_content_flag', undefined],
  ])('does not wait for detached %s delivery before responding', async (action, reason) => {
    ring.mockImplementationOnce(() => new Promise<void>(() => undefined))

    const response = await POST(request(action, reason))

    expect(response.status).toBe(200)
    expect(ring).toHaveBeenCalledTimes(1)
  })

  it('does not ring when flag validation fails', async () => {
    const response = await POST(request('flag_content', '   '))

    expect(response.status).toBe(400)
    expect(updateWhere).not.toHaveBeenCalled()
    expect(ring).not.toHaveBeenCalled()
  })
})
