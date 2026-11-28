/**
 * Phase 4d (session architecture §4, §7): the dashboard list row, the active
 * card, the classroom active-sessions query and the end event, from the
 * shared report fixture, so these screens show the same numbers as every
 * other view of the session.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionHistoryEntry } from '@/lib/curriculum/progress-manager'
import { summarizeSessionReport } from '@/lib/curriculum/session-report'
import { classroomKeys, sessionHistoryKeys } from '@/lib/queryKeys'
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
  off: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connected: boolean
  /** The socket's manager: its reconnect delays and its transport */
  io: {
    reconnectionDelay: ReturnType<typeof vi.fn>
    reconnectionDelayMax: ReturnType<typeof vi.fn>
    engine: { close: ReturnType<typeof vi.fn> }
  }
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
      off: vi.fn((event: string, h: Handler) => {
        handlers[event] = (handlers[event] ?? []).filter((x) => x !== h)
      }) as ReturnType<typeof vi.fn>,
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
      io: {
        reconnectionDelay: vi.fn((v?: number) => (v === undefined ? 1000 : undefined)),
        reconnectionDelayMax: vi.fn((v?: number) => (v === undefined ? 5000 : undefined)),
        engine: { close: vi.fn() },
      },
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

import { ClassroomLiveNotice } from '@/components/classroom/ClassroomLiveNotice'
import { useChildSessionsSocket } from '@/hooks/useChildSessionsSocket'
import { type ActiveSessionInfo, useActiveSessionsInClassroom } from '@/hooks/useClassroom'
import { useClassroomSocket } from '@/hooks/useClassroomSocket'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { ActiveSessionCard, SessionItem } from '../VirtualizedSessionList'

/** The practice page's teacher notice, fed by the hook. */
function LiveNoticePage() {
  const { live } = useClassroomSocket('cls-1')
  return <ClassroomLiveNotice state={live} isDark={false} />
}

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

describe('classroom active sessions: no poll', () => {
  it('the active-sessions query has no refetchInterval (push invalidates it)', async () => {
    api.mockResolvedValue(json({ sessions: [] }))
    const qc = client()
    renderHook(() => useActiveSessionsInClassroom('cls-1'), { wrapper: wrapperOf(qc) })
    const query = qc.getQueryCache().find({ queryKey: classroomKeys.activeSessions('cls-1') })
    expect(query).toBeDefined()
    expect((query!.options as { refetchInterval?: unknown }).refetchInterval).toBeUndefined()
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

describe('teacher cards: the teacher-only classroom room (no poll)', () => {
  /** The teacher's card for the live fixture, as the active-sessions route answers it */
  function seededCard(qc: QueryClient): void {
    const live = reportOf(liveTenProblemSession())
    const card: ActiveSessionInfo = {
      sessionId: 'fx-live',
      playerId: 'kid-1',
      startedAt: new Date(T0).toISOString(),
      currentPartIndex: 2,
      currentSlotIndex: 0,
      totalParts: 3,
      completedProblems: live.position!.progress.done,
      totalProblems: live.position!.progress.total,
      outcome: 'in_progress',
      totals: live.totals,
      rowVersion: live.rowVersion,
    }
    qc.setQueryData(classroomKeys.activeSessions('cls-1'), [card])
  }
  const cardOf = (qc: QueryClient) =>
    qc.getQueryData<ActiveSessionInfo[]>(classroomKeys.activeSessions('cls-1'))![0]
  const summary = (completedProblems: number, rowVersion: number, outcome = 'in_progress') => ({
    sessionId: 'fx-live',
    playerId: 'kid-1',
    outcome,
    completedProblems,
    totalProblems: 10,
    totals: { ...reportOf(liveTenProblemSession()).totals, problems: completedProblems },
    rowVersion,
  })

  it('joins the teacher room; a pushed write moves the card', () => {
    const qc = client()
    seededCard(qc)
    renderHook(() => useClassroomSocket('cls-1'), { wrapper: wrapperOf(qc) })
    const socket = sockets[0]
    act(() => socket.fire('connect'))
    expect(socket.emit).toHaveBeenCalledWith('join-classroom', { classroomId: 'cls-1' })
    expect(cardOf(qc).completedProblems).toBe(7)

    act(() => socket.fire('classroom-session-summary', summary(8, 12)))
    expect(cardOf(qc)).toMatchObject({ completedProblems: 8, rowVersion: 12 })
    expect(cardOf(qc).totals?.problems).toBe(8)

    // An older push (out of order) changes nothing
    act(() => socket.fire('classroom-session-summary', summary(7, 11)))
    expect(cardOf(qc)).toMatchObject({ completedProblems: 8, rowVersion: 12 })
  })

  it('an unknown or ended session refetches the list instead of patching it', () => {
    const qc = client()
    seededCard(qc)
    renderHook(() => useClassroomSocket('cls-1'), { wrapper: wrapperOf(qc) })
    act(() => sockets[0].fire('classroom-session-summary', summary(10, 20, 'completed')))
    expect(qc.getQueryState(classroomKeys.activeSessions('cls-1'))?.isInvalidated).toBe(true)
  })

  it('every accepted join refetches (first and reconnect); a student entering refetches', () => {
    const qc = client()
    seededCard(qc)
    renderHook(() => useClassroomSocket('cls-1'), { wrapper: wrapperOf(qc) })
    const socket = sockets[0]
    const invalidated = () => qc.getQueryState(classroomKeys.activeSessions('cls-1'))?.isInvalidated
    act(() => socket.fire('connect'))
    expect(invalidated()).toBe(false) // not in the teacher room yet
    // Another channel's ack (a player channel, another classroom) is not this join
    act(() => socket.fire('channel-joined', { channel: 'player', id: 'cls-1' }))
    act(() => socket.fire('channel-joined', { channel: 'classroom', id: 'cls-2' }))
    expect(invalidated()).toBe(false)
    act(() => socket.fire('channel-joined', { channel: 'classroom', id: 'cls-1' }))
    expect(invalidated()).toBe(true)

    seededCard(qc)
    act(() => socket.fire('disconnect'))
    act(() => socket.fire('connect'))
    act(() => socket.fire('channel-joined', { channel: 'classroom', id: 'cls-1' }))
    expect(invalidated()).toBe(true)

    seededCard(qc)
    expect(invalidated()).toBe(false)
    act(() => socket.fire('student-entered', { playerName: 'Kid' }))
    expect(invalidated()).toBe(true)
  })

  it('a transient join failure pauses the feed, rejoins on socket.io’s next connect, and refetches', () => {
    const qc = client()
    seededCard(qc)
    const { result } = renderHook(() => useClassroomSocket('cls-1'), { wrapper: wrapperOf(qc) })
    const socket = sockets[0]
    const joins = () =>
      socket.emit.mock.calls.filter(([event]: [string]) => event === 'join-classroom').length
    const invalidated = () => qc.getQueryState(classroomKeys.activeSessions('cls-1'))?.isInvalidated
    expect(result.current.live).toBe('connecting')
    act(() => socket.fire('connect'))
    expect(joins()).toBe(1)

    act(() =>
      socket.fire('channel-error', {
        channel: 'classroom',
        id: 'cls-1',
        error: 'Failed to join classroom',
        code: 'transient',
      })
    )
    expect(result.current.live).toBe('paused')
    // The transport is dropped so socket.io's own backoff reconnects, slower each time
    expect(socket.io.engine.close).toHaveBeenCalledTimes(1)
    expect(socket.io.reconnectionDelay).toHaveBeenCalledWith(2000)
    expect(socket.disconnect).not.toHaveBeenCalled()
    expect(invalidated()).toBe(false)

    act(() => socket.fire('disconnect', 'forced close'))
    act(() => socket.fire('connect'))
    expect(joins()).toBe(2)
    act(() => socket.fire('channel-joined', { channel: 'classroom', id: 'cls-1' }))
    expect(result.current.live).toBe('live')
    expect(invalidated()).toBe(true)
    expect(socket.io.reconnectionDelay).toHaveBeenLastCalledWith(1000)
  })

  it('a refused join does not retry and says the feed is off', () => {
    const qc = client()
    const { result } = renderHook(() => useClassroomSocket('cls-1'), { wrapper: wrapperOf(qc) })
    const socket = sockets[0]
    act(() => socket.fire('connect'))
    // Another classroom's refusal is not this one's
    act(() =>
      socket.fire('channel-error', {
        channel: 'classroom',
        id: 'cls-2',
        error: 'x',
        code: 'refused',
      })
    )
    expect(result.current.live).toBe('connecting')
    act(() =>
      socket.fire('channel-error', {
        channel: 'classroom',
        id: 'cls-1',
        error: 'Not the teacher of this classroom',
        code: 'refused',
      })
    )
    expect(result.current.live).toBe('refused')
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
    expect(socket.io.engine.close).not.toHaveBeenCalled()
    act(() => socket.fire('connect'))
    expect(socket.emit.mock.calls.filter(([e]: [string]) => e === 'join-classroom')).toHaveLength(1)
    act(() => socket.fire('disconnect'))
    expect(result.current.live).toBe('refused')
  })

  it('the practice page shows the paused feed plainly, and nothing once live', () => {
    const qc = client()
    const view = render(<LiveNoticePage />, { wrapper: wrapperOf(qc) })
    const socket = sockets[0]
    expect(view.queryByRole('status')).toBeNull() // first connect: no flash
    act(() => socket.fire('connect'))
    act(() => socket.fire('disconnect', 'transport close'))
    expect(view.getByRole('status').textContent).toBe('Live updates paused, reconnecting…')
    act(() => socket.fire('connect'))
    act(() =>
      socket.fire('channel-error', {
        channel: 'classroom',
        id: 'cls-1',
        error: 'x',
        code: 'transient',
      })
    )
    expect(view.getByRole('status').textContent).toBe('Live updates paused, reconnecting…')
    act(() => socket.fire('connect'))
    act(() => socket.fire('channel-joined', { channel: 'classroom', id: 'cls-1' }))
    expect(view.queryByRole('status')).toBeNull()
  })

  it('an end pushed before the join completed is still reflected (the join refetches)', async () => {
    const live = reportOf(liveTenProblemSession())
    const card = {
      sessionId: 'fx-live',
      playerId: 'kid-1',
      startedAt: new Date(T0).toISOString(),
      currentPartIndex: 2,
      currentSlotIndex: 0,
      totalParts: 3,
      completedProblems: 7,
      totalProblems: 10,
      outcome: 'in_progress',
      totals: live.totals,
      rowVersion: 11,
    }
    api.mockResolvedValueOnce(json({ sessions: [card] }))
    const qc = client()
    const { result } = renderHook(
      () => {
        useClassroomSocket('cls-1')
        return useActiveSessionsInClassroom('cls-1')
      },
      { wrapper: wrapperOf(qc) }
    )
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    // The session ends while the socket is not yet in the teacher room: the
    // end is pushed to nobody
    api.mockImplementation(async () => json({ sessions: [] }))
    act(() => sockets[0].fire('connect'))
    act(() => sockets[0].fire('channel-joined', { channel: 'classroom', id: 'cls-1' }))
    await waitFor(() => expect(result.current.data).toEqual([]))
  })

  it('a refetch older than a pushed summary keeps the pushed numbers', async () => {
    const live = reportOf(liveTenProblemSession())
    const card = {
      sessionId: 'fx-live',
      playerId: 'kid-1',
      startedAt: new Date(T0).toISOString(),
      currentPartIndex: 2,
      currentSlotIndex: 0,
      totalParts: 3,
      completedProblems: 7,
      totalProblems: 10,
      outcome: 'in_progress',
      totals: live.totals,
      rowVersion: 11,
    }
    api.mockImplementation(async () => json({ sessions: [card] }))
    const qc = client()
    const { result } = renderHook(
      () => {
        useClassroomSocket('cls-1')
        return useActiveSessionsInClassroom('cls-1')
      },
      { wrapper: wrapperOf(qc) }
    )
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    act(() => sockets[0].fire('classroom-session-summary', summary(8, 12)))
    await waitFor(() =>
      expect(result.current.data?.[0]).toMatchObject({ completedProblems: 8, rowVersion: 12 })
    )

    // A refetch that read the row before that write (rowVersion 11) lands after it
    const calls = api.mock.calls.length
    await act(() => qc.invalidateQueries({ queryKey: classroomKeys.activeSessions('cls-1') }))
    await waitFor(() => expect(api.mock.calls.length).toBe(calls + 1))
    await waitFor(() =>
      expect(qc.getQueryState(classroomKeys.activeSessions('cls-1'))?.fetchStatus).toBe('idle')
    )
    expect(
      qc.getQueryData<ActiveSessionInfo[]>(classroomKeys.activeSessions('cls-1'))?.[0]
    ).toMatchObject({ completedProblems: 8, rowVersion: 12 })
    expect(qc.getQueryState(classroomKeys.activeSessions('cls-1'))?.status).toBe('success')

    // A newer refetch wins
    api.mockImplementation(async () =>
      json({ sessions: [{ ...card, completedProblems: 9, rowVersion: 13 }] })
    )
    await act(() => qc.invalidateQueries({ queryKey: classroomKeys.activeSessions('cls-1') }))
    await waitFor(() => expect(result.current.data?.[0]).toMatchObject({ rowVersion: 13 }))
  })
})
