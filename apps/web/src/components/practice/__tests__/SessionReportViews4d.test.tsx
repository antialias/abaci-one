/**
 * Phase 4d (session architecture §4, §7): the dashboard list row, the active
 * card and the end event, from the
 * shared report fixture, so these screens show the same numbers as every
 * other view of the session.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionHistoryEntry } from '@/lib/curriculum/progress-manager'
import { summarizeSessionReport } from '@/lib/curriculum/session-report'
import { sessionHistoryKeys } from '@/lib/queryKeys'
import {
  abandonedSession,
  liveTenProblemSession,
  reportOf,
  T0,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'

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

import { useChildSessionsSocket } from '@/hooks/useChildSessionsSocket'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { ActiveSessionCard, SessionItem } from '../VirtualizedSessionList'

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}
function wrapperOf(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}
function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A list row as `getRecentSessions` makes it from the fixture's report. */
function historyEntryOf(): SessionHistoryEntry {
  const report = tenProblemSessionReport()
  return {
    id: report.sessionId,
    playerId: report.playerId,
    phaseId: 'session',
    problemsAttempted: report.totals.problems,
    problemsCorrect: report.totals.firstTryCorrect,
    averageTimeMs: Math.round(report.time.activeMs / report.totals.tries),
    totalTimeMs: report.time.activeMs,
    skillsUsed: ['basic.directAddition'],
    visualizationMode: false,
    startedAt: new Date(report.startedAt!),
    completedAt: new Date(report.endedAt!),
    unresolvedTimingCount: 0,
    report: summarizeSessionReport(report),
  }
}

/** The visible text of an element, one line per stat */
function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

beforeEach(() => {
  sockets = []
  api.mockReset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(T0 + 15 * 60_000)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('dashboard list row', () => {
  it('renders the fixture report: 7/10 first try, 70 %, 12 min wall, 1 min active, 100 % final', () => {
    const { container } = render(
      <SessionItem session={historyEntryOf()} studentId="fx-player" isDark={false} />,
      { wrapper: wrapperOf(client()) }
    )
    const row = container.querySelector('[data-element="session-history-item"]')
    expect({
      badge: textOf(row!.querySelector('[data-element="status-badge"]')),
      wall: textOf(row!.querySelector('[data-element="wall-duration"]')),
      active: textOf(row!.querySelector('[data-element="active-duration"]')),
      final: textOf(row!.querySelector('[data-element="final-accuracy"]')),
    }).toMatchInlineSnapshot(`
      {
        "active": "1 min active",
        "badge": "7/10 first try · 70%",
        "final": "100% final",
        "wall": "12 min",
      }
    `)
  })

  it('an abandoned row is dated by its last activity, not its auto-abandon three days later', () => {
    const fixture = abandonedSession()
    const report = reportOf(fixture)
    const entry: SessionHistoryEntry = {
      ...historyEntryOf(),
      id: report.sessionId,
      completedAt: fixture.plan.completedAt,
      report: summarizeSessionReport(report),
    }
    const { container } = render(
      <SessionItem session={entry} studentId="fx-player" isDark={false} />,
      { wrapper: wrapperOf(client()) }
    )
    const text = textOf(container.querySelector('[data-element="session-history-item"]'))
    expect(text).toContain(new Date(report.endedAt!).toLocaleDateString())
    expect(text).not.toContain(new Date(fixture.plan.completedAt!).toLocaleDateString())
  })
})

describe('active card', () => {
  const session = {
    id: 'fx-ten-problems',
    startedAt: new Date(T0),
    createdAt: new Date(T0),
    results: [],
  }

  it('from tenProblemSessionReport(): done of planned and first try', () => {
    const { container } = render(
      <ActiveSessionCard
        session={session}
        report={summarizeSessionReport(tenProblemSessionReport())}
        isDark={false}
        onClick={() => {}}
      />,
      { wrapper: wrapperOf(client()) }
    )
    const header = container.querySelector('[data-element="active-session-header"]')
    expect(textOf(header)).toMatchInlineSnapshot(`"15m since last activity10/10 · 70% first try"`)
  })

  it('from the live fixture: the position (7/10), not a count of tries (9)', () => {
    const live = summarizeSessionReport(reportOf(liveTenProblemSession()))
    const { container } = render(
      <ActiveSessionCard
        session={{ ...session, id: 'fx-live' }}
        report={live}
        isDark={false}
        onClick={() => {}}
      />,
      { wrapper: wrapperOf(client()) }
    )
    const header = container.querySelector('[data-element="active-session-header"]')
    expect(textOf(header)).toMatchInlineSnapshot(`"15m since last activity7/10 · 71% first try"`)
  })
})

describe('session-ended', () => {
  it('removes the active card (parent view)', async () => {
    const live = reportOf(liveTenProblemSession())
    api.mockImplementation(async () =>
      json({
        session: {
          sessionId: 'fx-live',
          status: 'in_progress',
          startedAt: new Date(T0).toISOString(),
          completedProblems: live.position!.progress.done,
          totalProblems: live.position!.progress.total,
          totals: live.totals,
        },
      })
    )
    const childIds = ['kid-1']
    const { result } = renderHook(() => useChildSessionsSocket('parent-1', childIds), {
      wrapper: wrapperOf(client()),
    })
    await waitFor(() => expect(result.current.sessionMap.get('kid-1')).toBeDefined())
    expect(result.current.sessionMap.get('kid-1')).toMatchObject({
      planId: 'fx-live',
      completedSlots: 7,
      totalSlots: 10,
      startedAt: new Date(T0).toISOString(),
    })

    // A late end of some other session leaves the card alone
    act(() => sockets[0].fire('session-ended', { playerId: 'kid-1', sessionId: 'older' }))
    expect(result.current.sessionMap.has('kid-1')).toBe(true)

    act(() =>
      sockets[0].fire('session-ended', {
        playerId: 'kid-1',
        sessionId: 'fx-live',
        reason: 'completed',
      })
    )
    expect(result.current.sessionMap.has('kid-1')).toBe(false)
  })

  it('invalidates the session history (dashboard list)', async () => {
    api.mockResolvedValue(json({ sessions: [], nextCursor: null, hasMore: false }))
    const qc = client()
    renderHook(() => useSessionHistory('kid-1'), { wrapper: wrapperOf(qc) })
    await waitFor(() =>
      expect(qc.getQueryState(sessionHistoryKeys.list('kid-1'))?.status).toBe('success')
    )
    const socket = sockets[0]
    act(() => socket.fire('connect'))
    expect(socket.emit).toHaveBeenCalledWith('join-player', { playerId: 'kid-1' })

    // Another player's end: no refetch
    act(() => socket.fire('session-ended', { playerId: 'kid-2', sessionId: 's2' }))
    expect(qc.getQueryState(sessionHistoryKeys.list('kid-1'))?.isInvalidated).toBe(false)

    const calls = api.mock.calls.length
    act(() =>
      socket.fire('session-ended', { playerId: 'kid-1', sessionId: 's1', reason: 'completed' })
    )
    await waitFor(() => expect(api.mock.calls.length).toBe(calls + 1))
  })
})
