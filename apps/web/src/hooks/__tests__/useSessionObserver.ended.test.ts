/**
 * Phase 4c (§10 P4a-4, P4c-1): at the session's end the observer keeps what
 * is on screen. `session-ended` on the session room stops listening (leave,
 * disconnect) without clearing the observed state, and says how it ended.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeStateEvent, SessionEndedEvent } from '@/lib/classroom/socket-events'
import { useSessionObserver } from '../useSessionObserver'

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

const SESSION_ID = 'session-123'

function practiceState(): PracticeStateEvent {
  return {
    sessionId: SESSION_ID,
    currentProblem: { terms: [12, 3], answer: 15 },
    phase: 'feedback',
    studentAnswer: '15',
    isCorrect: true,
    timing: { startedAt: 1, elapsed: 4000 },
    purpose: 'focus',
  }
}

function ended(reason: SessionEndedEvent['reason'], sessionId = SESSION_ID): SessionEndedEvent {
  return {
    sessionId,
    playerId: 'player-789',
    playerName: 'Alice',
    reason,
    rowVersion: 14,
    outcome: reason === 'abandoned' ? 'abandoned' : 'completed',
  }
}

describe('useSessionObserver - the session ends', () => {
  let handlers: Map<string, (data: unknown) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()
    mockSocket.on.mockImplementation((event: string, handler: unknown) => {
      handlers.set(event, handler as (data: unknown) => void)
      return mockSocket
    })
  })

  it.each(['completed', 'ended_early', 'abandoned'] as const)(
    'on %s: keeps the observed state, stops listening, reports the end',
    (reason) => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, 'observer-456', 'player-789', true)
      )
      expect(mockSocket.emit).toHaveBeenCalledWith('observe-session', {
        sessionId: SESSION_ID,
        observerId: 'observer-456',
        playerId: 'player-789',
      })
      act(() => handlers.get('practice-state')?.(practiceState()))
      expect(result.current.state?.currentProblem.answer).toBe(15)

      act(() => handlers.get('session-ended')?.(ended(reason)))

      expect(result.current.ended).toMatchObject({ sessionId: SESSION_ID, reason })
      // What was on screen stays
      expect(result.current.state?.currentProblem.answer).toBe(15)
      expect(result.current.error).toBeNull()
      // Stopped listening
      expect(mockSocket.emit).toHaveBeenCalledWith('stop-observing', { sessionId: SESSION_ID })
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(result.current.isObserving).toBe(false)
    }
  )

  it('warns once on a refused session-room join (no retry)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderHook(() => useSessionObserver(SESSION_ID, 'observer-456', 'player-789', true))
    act(() => handlers.get('session-room-error')?.({ sessionId: SESSION_ID, error: 'refused' }))
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("ignores another session's end", () => {
    const { result } = renderHook(() =>
      useSessionObserver(SESSION_ID, 'observer-456', 'player-789', true)
    )
    act(() => handlers.get('session-ended')?.(ended('completed', 'other-session')))
    expect(result.current.ended).toBeNull()
    expect(mockSocket.disconnect).not.toHaveBeenCalled()
  })

  it('no longer returns a results list (the view reads the report)', () => {
    const { result } = renderHook(() =>
      useSessionObserver(SESSION_ID, 'observer-456', 'player-789', true)
    )
    expect('results' in result.current).toBe(false)
  })
})
