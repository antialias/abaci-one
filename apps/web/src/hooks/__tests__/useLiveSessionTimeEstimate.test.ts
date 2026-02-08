import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('socket.io-client', () => ({ io: vi.fn() }))

type SocketHandler = (...args: any[]) => void

interface MockSocketInstance {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connected: boolean
  handlers: Record<string, SocketHandler[]>
  fire: (event: string, ...args: any[]) => void
}

let latestSocket: MockSocketInstance | null = null

function createMockSocketInstance(): MockSocketInstance {
  const handlers: Record<string, SocketHandler[]> = {}
  const instance: MockSocketInstance = {
    on: vi.fn((event: string, handler: SocketHandler) => {
      if (!handlers[event]) handlers[event] = []
      handlers[event].push(handler)
    }) as ReturnType<typeof vi.fn>,
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    handlers,
    fire: (event: string, ...args: any[]) => {
      for (const handler of handlers[event] ?? []) {
        handler(...args)
      }
    },
  }
  return instance
}

vi.mock('@/lib/socket', () => ({
  createSocket: vi.fn(() => {
    latestSocket = createMockSocketInstance()
    return latestSocket
  }),
}))

import { useLiveSessionTimeEstimate } from '../useLiveSessionTimeEstimate'
import { createSocket } from '@/lib/socket'

// ============================================================================
// Helpers
// ============================================================================

function makeResult(
  responseTimeMs: number,
  partNumber: 1 | 2 | 3 = 1,
  isCorrect = true
): SlotResult {
  return {
    responseTimeMs,
    partNumber,
    isCorrect,
    slotIndex: 0,
    problem: { terms: [1, 2], answer: 3 },
    studentAnswer: isCorrect ? 3 : 99,
    timestamp: new Date(),
    skillsExercised: ['basic'],
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
  } as SlotResult
}

function makePart(
  type: SessionPart['type'],
  slotCount: number,
  partNumber: 1 | 2 | 3 = 1
): SessionPart {
  return {
    type,
    partNumber,
    format: 'vertical' as const,
    useAbacus: false,
    estimatedMinutes: 5,
    slots: Array.from({ length: slotCount }, (_, i) => ({
      index: i,
      purpose: 'focus' as const,
      constraints: {},
    })),
  } as SessionPart
}

// Stable empty arrays to avoid infinite rerenders from default [] params
const EMPTY_RESULTS: SlotResult[] = []
const EMPTY_PARTS: SessionPart[] = []

// ============================================================================
// Tests
// ============================================================================

describe('useLiveSessionTimeEstimate', () => {
  beforeEach(() => {
    latestSocket = null
    vi.clearAllMocks()
  })

  it('returns initial state with static data before WebSocket connects', () => {
    const initialResults = [makeResult(5000), makeResult(6000)]
    const initialParts = [makePart('abacus', 10)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults,
        initialParts,
      })
    )

    expect(result.current.totalProblems).toBe(10)
    expect(result.current.completedProblems).toBe(2)
    expect(result.current.problemsRemaining).toBe(8)
    expect(result.current.correctCount).toBe(2)
    expect(result.current.accuracy).toBe(1)
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isLive).toBe(false)
    expect(result.current.lastActivityAt).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('sets isConnected to true when socket connects', () => {
    const initialParts = [makePart('abacus', 5)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    act(() => {
      latestSocket!.fire('connect')
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.error).toBeNull()
    expect(latestSocket!.emit).toHaveBeenCalledWith('subscribe-session-stats', {
      sessionId: 'session-123',
    })
  })

  it('handles disconnect event', () => {
    const initialParts = [makePart('abacus', 5)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    act(() => {
      latestSocket!.fire('connect')
    })
    expect(result.current.isConnected).toBe(true)

    act(() => {
      latestSocket!.fire('disconnect')
    })
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isLive).toBe(false)
  })

  it('handles connect_error event', () => {
    const initialParts = [makePart('abacus', 5)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    act(() => {
      latestSocket!.fire('connect_error', new Error('Connection refused'))
    })

    expect(result.current.error).toBe('Failed to connect')
    expect(result.current.isConnected).toBe(false)
  })

  it('updates data when receiving practice-state events', () => {
    const initialParts = [makePart('abacus', 10)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    act(() => {
      latestSocket!.fire('connect')
    })

    const liveResults = [
      makeResult(5000, 1, true),
      makeResult(6000, 1, true),
      makeResult(7000, 1, false),
    ]

    act(() => {
      latestSocket!.fire('practice-state', {
        currentProblemNumber: 4,
        totalProblems: 10,
        slotResults: liveResults,
      })
    })

    expect(result.current.isLive).toBe(true)
    expect(result.current.completedProblems).toBe(3)
    expect(result.current.correctCount).toBe(2)
    expect(result.current.accuracy).toBeCloseTo(2 / 3)
    expect(result.current.lastActivityAt).toBeInstanceOf(Date)
  })

  it('updates parts when receiving practice-state with sessionParts', () => {
    const initialParts = [makePart('abacus', 5)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    expect(result.current.totalProblems).toBe(5)

    act(() => {
      latestSocket!.fire('connect')
    })

    act(() => {
      latestSocket!.fire('practice-state', {
        currentProblemNumber: 1,
        totalProblems: 8,
        sessionParts: [makePart('abacus', 8)],
        slotResults: [],
      })
    })

    expect(result.current.totalProblems).toBe(8)
  })

  it('handles session-ended event', () => {
    const initialParts = [makePart('abacus', 5)]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    act(() => {
      latestSocket!.fire('connect')
    })

    act(() => {
      latestSocket!.fire('practice-state', {
        currentProblemNumber: 1,
        totalProblems: 5,
        slotResults: [makeResult(5000)],
      })
    })

    expect(result.current.isLive).toBe(true)

    act(() => {
      latestSocket!.fire('session-ended')
    })

    expect(result.current.isLive).toBe(false)
  })

  it('does not connect when sessionId is undefined', () => {
    vi.mocked(createSocket).mockClear()

    renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: undefined,
        initialResults: EMPTY_RESULTS,
        initialParts: EMPTY_PARTS,
      })
    )

    expect(createSocket).not.toHaveBeenCalled()
  })

  it('does not connect when enabled is false', () => {
    vi.mocked(createSocket).mockClear()

    renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts: EMPTY_PARTS,
        enabled: false,
      })
    )

    expect(createSocket).not.toHaveBeenCalled()
  })

  it('cleans up socket on unmount', () => {
    const initialParts = [makePart('abacus', 5)]

    const { unmount } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts,
      })
    )

    const socket = latestSocket!
    unmount()

    expect(socket.emit).toHaveBeenCalledWith('unsubscribe-session-stats', {
      sessionId: 'session-123',
    })
    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('calculates accuracy correctly with mixed results', () => {
    const results = [
      makeResult(5000, 1, true),
      makeResult(6000, 1, false),
      makeResult(7000, 1, true),
      makeResult(8000, 1, true),
    ]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: results,
        initialParts: [makePart('abacus', 10)],
      })
    )

    expect(result.current.correctCount).toBe(3)
    expect(result.current.accuracy).toBe(0.75)
  })

  it('returns zero accuracy when no results', () => {
    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts: [makePart('abacus', 10)],
      })
    )

    expect(result.current.accuracy).toBe(0)
    expect(result.current.correctCount).toBe(0)
  })

  it('provides formatted time remaining', () => {
    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts: [makePart('abacus', 30)],
      })
    )

    // 30 problems * 10000ms default = 300000ms = 5 minutes
    expect(result.current.estimatedTimeRemainingFormatted).toBe('~5 min')
  })

  it('computes timing stats from results', () => {
    const results = [
      makeResult(4000),
      makeResult(5000),
      makeResult(6000),
      makeResult(7000),
      makeResult(8000),
    ]

    const { result } = renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: results,
        initialParts: [makePart('abacus', 10)],
      })
    )

    expect(result.current.timingStats.hasEnoughData).toBe(true)
    expect(result.current.timingStats.mean).toBe(6000)
    expect(result.current.timingStats.count).toBe(5)
    expect(result.current.estimatedTimeRemainingMs).toBe(30_000)
  })

  it('defaults enabled to true', () => {
    vi.mocked(createSocket).mockClear()

    renderHook(() =>
      useLiveSessionTimeEstimate({
        sessionId: 'session-123',
        initialResults: EMPTY_RESULTS,
        initialParts: [makePart('abacus', 5)],
      })
    )

    expect(createSocket).toHaveBeenCalled()
  })
})
