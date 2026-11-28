import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { sessionReportKeys } from '@/lib/queryKeys'
import { tenProblemSessionReport } from '@/test/fixtures/session-report'

type Handler = (...args: any[]) => void
interface MockSocket {
  on: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  fire: (event: string, ...args: any[]) => void
}
let sockets: MockSocket[] = []

vi.mock('@/lib/socket', () => ({
  createSocket: vi.fn(() => {
    const handlers: Record<string, Handler[]> = {}
    const socket: MockSocket = {
      on: vi.fn((event: string, h: Handler) => {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(h)
      }) as ReturnType<typeof vi.fn>,
      emit: vi.fn(),
      disconnect: vi.fn(),
      fire: (event, ...args) => {
        for (const h of handlers[event] ?? []) h(...args)
      },
    }
    sockets.push(socket)
    return socket
  }),
}))

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/queryClient', () => ({ api }))

import { fetchedReport, newerReport, useSessionReport } from '../useSessionReport'

const base = tenProblemSessionReport()
const at = (rowVersion: number, patch: Partial<SessionReport> = {}): SessionReport => ({
  ...base,
  rowVersion,
  ...patch,
})

function respond(report: SessionReport, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { report } : { error: 'nope' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

describe('useSessionReport', () => {
  beforeEach(() => {
    sockets = []
    api.mockReset()
  })

  it('fetches the plan report and joins the session room on connect (refetching)', async () => {
    api.mockResolvedValue(respond(at(14)))
    const { wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId: 'parent-1' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.data?.rowVersion).toBe(14))
    expect(api).toHaveBeenCalledWith(`curriculum/fx-player/sessions/plans/${base.sessionId}/report`)

    api.mockResolvedValue(respond(at(15)))
    act(() => sockets[0].fire('connect'))
    expect(sockets[0].emit).toHaveBeenCalledWith('subscribe-session-report', {
      sessionId: base.sessionId,
      playerId: 'fx-player',
    })
    await waitFor(() => expect(result.current.data?.rowVersion).toBe(15))
  })

  it('fetches before the viewer id is known and joins the push room once it is (Phase 5b)', async () => {
    api.mockResolvedValue(respond(at(14)))
    const { wrapper } = setup()
    const { result, rerender } = renderHook(
      ({ viewerId }: { viewerId: string | null }) =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId }),
      { wrapper, initialProps: { viewerId: null as string | null } }
    )
    await waitFor(() => expect(result.current.data?.rowVersion).toBe(14))
    // No room without a credential
    expect(sockets).toHaveLength(0)

    rerender({ viewerId: 'parent-1' })
    expect(sockets).toHaveLength(1)
    act(() => sockets[0].fire('connect'))
    expect(sockets[0].emit).toHaveBeenCalledWith('subscribe-session-report', {
      sessionId: base.sessionId,
      playerId: 'fx-player',
    })
  })

  it('applies a pushed report only when its rowVersion is newer', async () => {
    api.mockResolvedValue(respond(at(14)))
    const { client, wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId: 'parent-1' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.data?.rowVersion).toBe(14))

    expect(sockets).toHaveLength(1)
    act(() => sockets[0].fire('session-report', { report: at(16) }))
    await waitFor(() => expect(result.current.data?.rowVersion).toBe(16))
    act(() => sockets[0].fire('session-report', { report: at(15) }))
    act(() => sockets[0].fire('session-report', { report: at(99, { sessionId: 'other' }) }))
    expect(
      client.getQueryData<SessionReport>(sessionReportKeys.plan(base.sessionId))?.rowVersion
    ).toBe(16)
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('a fetch that answers older than a push it raced keeps the push', async () => {
    let release!: (r: Response) => void
    api.mockReturnValueOnce(new Promise<Response>((r) => (release = r)))
    const { client, wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId: 'parent-1' }),
      { wrapper }
    )
    act(() => {
      client.setQueryData(sessionReportKeys.plan(base.sessionId), at(20))
    })
    await act(async () => release(respond(at(18))))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.data?.rowVersion).toBe(20)
  })

  it('session-ended refetches (React Query invalidation)', async () => {
    api.mockResolvedValue(respond(at(14, { outcome: 'in_progress' })))
    const { wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId: 'parent-1' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.data?.outcome).toBe('in_progress'))

    api.mockResolvedValue(respond(at(15)))
    act(() => sockets[0].fire('session-ended', { sessionId: base.sessionId, rowVersion: 15 }))
    await waitFor(() => expect(result.current.data?.outcome).toBe('completed'))
  })

  it('by token: reads the share route and joins the room once the session id is known', async () => {
    api.mockResolvedValue(respond(at(14)))
    const { wrapper } = setup()
    const { result, unmount } = renderHook(() => useSessionReport({ token: 'abcDEF1234' }), {
      wrapper,
    })
    expect(sockets).toHaveLength(0)
    await waitFor(() => expect(result.current.data?.rowVersion).toBe(14))
    expect(api).toHaveBeenCalledWith('observe/abcDEF1234/report')
    expect(sockets).toHaveLength(1)
    act(() => sockets[0].fire('connect'))
    expect(sockets[0].emit).toHaveBeenCalledWith('subscribe-session-report', {
      sessionId: base.sessionId,
      shareToken: 'abcDEF1234',
    })
    unmount()
    expect(sockets[0].emit).toHaveBeenCalledWith('unsubscribe-session-report', {
      sessionId: base.sessionId,
    })
    expect(sockets[0].disconnect).toHaveBeenCalled()
  })

  it('a refused token surfaces the error without retrying', async () => {
    api.mockResolvedValue(respond(at(1), 410))
    const { wrapper } = setup()
    const { result } = renderHook(() => useSessionReport({ token: 'abcDEF1234' }), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('session-song-status refetches, and the same-rowVersion answer replaces the held report (Phase 4e)', async () => {
    api.mockResolvedValue(respond(at(14, { song: { status: 'pending', songId: 'fx-song' } })))
    const { wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId: 'parent-1' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.data?.song.status).toBe('pending'))

    // The song row moved; the session row did not (same rowVersion)
    api.mockResolvedValue(
      respond(at(14, { song: { status: 'ready', songId: 'fx-song', shareCode: 'fxShare001' } }))
    )
    // Another session's song is not ours
    act(() =>
      sockets[0].fire('session-song-status', { sessionId: 'other', songId: 'x', status: 'ready' })
    )
    expect(api).toHaveBeenCalledTimes(1)
    act(() =>
      sockets[0].fire('session-song-status', {
        sessionId: base.sessionId,
        songId: 'fx-song',
        status: 'ready',
      })
    )
    await waitFor(() => expect(result.current.data?.song.status).toBe('ready'))
    expect(result.current.data?.song.shareCode).toBe('fxShare001')
    expect(result.current.data?.rowVersion).toBe(14)
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('session-song-status during a fetch in flight cancels it and takes the new fetch (Phase 4e)', async () => {
    const pending = at(14, { song: { status: 'pending', songId: 'fx-song' } })
    api.mockResolvedValue(respond(pending))
    const { wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSessionReport({ playerId: 'fx-player', planId: base.sessionId, viewerId: 'parent-1' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.data?.song.status).toBe('pending'))

    // A refetch (socket connect) is in flight; it read the song before it moved
    let release!: (r: Response) => void
    api.mockReturnValueOnce(new Promise<Response>((r) => (release = r)))
    act(() => sockets[0].fire('connect'))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2))

    api.mockResolvedValue(
      respond(at(14, { song: { status: 'ready', songId: 'fx-song', shareCode: 'fxShare001' } }))
    )
    act(() =>
      sockets[0].fire('session-song-status', {
        sessionId: base.sessionId,
        songId: 'fx-song',
        status: 'ready',
      })
    )
    await waitFor(() => expect(result.current.data?.song.status).toBe('ready'))
    expect(api).toHaveBeenCalledTimes(3)

    // The cancelled fetch answers late with the old status: not taken
    await act(async () => release(respond(pending)))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.data?.song.status).toBe('ready')
  })

  it('fetchedReport keeps the held report only when it is strictly newer', () => {
    expect(fetchedReport(at(3), at(3, { song: { status: 'ready' } })).song.status).toBe('ready')
    expect(fetchedReport(at(4), at(3)).rowVersion).toBe(4)
    expect(fetchedReport(at(3), at(4)).rowVersion).toBe(4)
    expect(fetchedReport(undefined, at(1)).rowVersion).toBe(1)
  })

  it('newerReport keeps the held report on a tie or an older version', () => {
    expect(newerReport(at(3), at(3)).rowVersion).toBe(3)
    expect(newerReport(at(4), at(3)).rowVersion).toBe(4)
    expect(newerReport(at(3), at(4)).rowVersion).toBe(4)
    expect(newerReport(undefined, at(1)).rowVersion).toBe(1)
  })
})
