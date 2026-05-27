/**
 * Tests for the liveness derivation in useSessionSong (#153 wiring).
 *
 * Liveness is a pure state machine over (lastAliveAt, ticker):
 *   - 'unknown' when no heartbeat seed and no alive event has arrived
 *   - 'fresh'   when lastAliveAt is within STALE_THRESHOLD_MS of now
 *   - 'stale'   when lastAliveAt is older than STALE_THRESHOLD_MS
 *
 * The seed comes from the GET response (server-time heartbeat + serverNow
 * for skew correction); updates come from `session-song:alive:<planId>`
 * socket events. We always take the max of the two so events that race
 * ahead of a slow refetch don't get walked back by a stale seed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionSong } from '../useSessionSong'

// ============================================================================
// Mocks
// ============================================================================

interface FakeSocket {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connected: boolean
}

let mockSocket: FakeSocket
const handlers = new Map<string, (...args: unknown[]) => void>()

vi.mock('@/lib/socket', () => ({
  createSocket: () => mockSocket,
}))

vi.mock('@/lib/queryClient', () => ({
  api: (path: string) => global.fetch(path),
}))

const PLAN_ID = 'plan-abc'
const PLAYER_ID = 'player-xyz'

function buildResponse(opts: {
  lastHeartbeatAt: number | null
  serverNow: number
  status?: string
}): { song: Record<string, unknown> | null; serverNow: number } {
  return {
    song: {
      id: 'song-1',
      status: opts.status ?? 'generating',
      title: null,
      durationSeconds: null,
      audioPath: null,
      alignmentPath: null,
      lyrics: null,
      triggerSource: 'smart_trigger',
      failureKind: null,
      errorDetail: null,
      viewerIsOwner: false,
      lastHeartbeatAt: opts.lastHeartbeatAt,
      taskStatus: opts.lastHeartbeatAt == null ? null : 'running',
      createdAt: opts.serverNow - 5_000,
      completedAt: null,
    },
    serverNow: opts.serverNow,
  }
}

function mockFetchOnce(payload: unknown) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => payload,
  } as Response)
}

// ============================================================================
// Setup
// ============================================================================

let queryClient: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-27T12:00:00Z'))

  handlers.clear()
  mockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler)
      return mockSocket
    }) as never,
    off: vi.fn() as never,
    emit: vi.fn() as never,
    connect: vi.fn() as never,
    disconnect: vi.fn() as never,
    connected: true,
  }

  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  global.fetch = vi.fn() as never
})

afterEach(() => {
  vi.useRealTimers()
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children)

async function renderAndWaitForQuery() {
  const hook = renderHook(
    () => useSessionSong({ playerId: PLAYER_ID, planId: PLAN_ID, enabled: true }),
    { wrapper }
  )
  // Fake timers block waitFor's polling; explicitly flush microtasks +
  // a tick of timer time so the fetch promise resolves + React Query
  // commits the data, then the hook's `useEffect` seeds lastAliveAt.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  if (hook.result.current.song == null) {
    throw new Error('expected song to be loaded — query did not settle')
  }
  return hook
}

// ============================================================================
// Tests
// ============================================================================

describe('useSessionSong liveness', () => {
  it('reports unknown when the seed heartbeat is null', async () => {
    mockFetchOnce(buildResponse({ lastHeartbeatAt: null, serverNow: Date.now() }))
    const { result } = await renderAndWaitForQuery()
    expect(result.current.liveness).toBe('unknown')
    expect(result.current.lastAliveAt).toBeNull()
  })

  it('reports fresh when the seed heartbeat is recent', async () => {
    const now = Date.now()
    mockFetchOnce(buildResponse({ lastHeartbeatAt: now - 5_000, serverNow: now }))
    const { result } = await renderAndWaitForQuery()
    expect(result.current.liveness).toBe('fresh')
    expect(result.current.lastAliveAt).toBeGreaterThan(0)
  })

  it('flips to stale on the 1s ticker after 31s without an alive event', async () => {
    const now = Date.now()
    mockFetchOnce(buildResponse({ lastHeartbeatAt: now, serverNow: now }))
    const { result } = await renderAndWaitForQuery()
    expect(result.current.liveness).toBe('fresh')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })
    expect(result.current.liveness).toBe('stale')
  })

  it('resets liveness back to fresh when an alive event fires after going stale', async () => {
    const now = Date.now()
    mockFetchOnce(buildResponse({ lastHeartbeatAt: now, serverNow: now }))
    const { result } = await renderAndWaitForQuery()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })
    expect(result.current.liveness).toBe('stale')

    const aliveHandler = handlers.get(`session-song:alive:${PLAN_ID}`)
    expect(aliveHandler).toBeDefined()
    await act(async () => {
      aliveHandler?.()
      // Let the 1s ticker re-evaluate.
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(result.current.liveness).toBe('fresh')
  })

  it('skew-corrects the seed when the server clock is ahead of the client', async () => {
    // Server says it is "now" but client wall clock is 5s behind.
    const clientNow = Date.now()
    const serverNow = clientNow + 5_000
    const lastHeartbeatAt = serverNow - 2_000 // 2s old in server time
    mockFetchOnce(buildResponse({ lastHeartbeatAt, serverNow }))
    const { result } = await renderAndWaitForQuery()

    // Should be ~2s old in CLIENT time, regardless of the 5s clock gap.
    // (i.e. lastAliveAt ≈ clientNow - 2_000, NOT serverNow - 2_000)
    expect(result.current.lastAliveAt).not.toBeNull()
    const clientAge = clientNow - (result.current.lastAliveAt ?? 0)
    expect(clientAge).toBeGreaterThanOrEqual(2_000 - 50)
    expect(clientAge).toBeLessThanOrEqual(2_000 + 50)
  })

  it('does not walk lastAliveAt backwards if a stale seed arrives after a fresh alive event', async () => {
    // First query: no heartbeat — liveness unknown.
    const baseNow = Date.now()
    mockFetchOnce(buildResponse({ lastHeartbeatAt: null, serverNow: baseNow }))
    const { result } = await renderAndWaitForQuery()
    expect(result.current.liveness).toBe('unknown')

    // Fresh alive event jumps lastAliveAt to "now".
    const aliveHandler = handlers.get(`session-song:alive:${PLAN_ID}`)
    expect(aliveHandler).toBeDefined()
    await act(async () => {
      aliveHandler?.()
    })
    const afterAliveAt = result.current.lastAliveAt
    expect(afterAliveAt).not.toBeNull()
    expect(afterAliveAt).toBeGreaterThanOrEqual(baseNow)

    // A second (stale) GET arrives with a much older heartbeat — invalidate
    // the cache so the queryFn runs again with our new mock.
    mockFetchOnce(
      buildResponse({ lastHeartbeatAt: baseNow - 60_000, serverNow: baseNow })
    )
    await act(async () => {
      await queryClient.invalidateQueries()
      await vi.advanceTimersByTimeAsync(10)
    })

    // lastAliveAt should NOT have moved backwards.
    expect(result.current.lastAliveAt).toBe(afterAliveAt)
  })
})
