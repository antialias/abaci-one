/**
 * Unit tests for useSessionObserver flow state + break context handling
 *
 * The observer now receives break state exclusively via the `session-flow-state`
 * event (authoritative flow state from the server-side state machine).
 * Legacy game-break-started/phase/ended events have been removed.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionFlowStateEvent } from '@/lib/classroom/socket-events'
import { useSessionObserver } from '../useSessionObserver'

// Mock socket.io-client
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

describe('useSessionObserver - flow state + break context', () => {
  let eventHandlers: Map<string, (data: unknown) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    eventHandlers = new Map()

    mockSocket.on.mockImplementation((event: string, handler: unknown) => {
      eventHandlers.set(event, handler as (data: unknown) => void)
      return mockSocket
    })
  })

  const SESSION_ID = 'session-123'
  const OBSERVER_ID = 'observer-456'
  const PLAYER_ID = 'player-789'

  describe('flowState', () => {
    it('initially returns null flowState', () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      expect(result.current.flowState).toBeNull()
    })

    it('updates flowState from session-flow-state event', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'practicing',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('practicing')
      })
    })

    it('ignores session-flow-state from a different session', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: 'other-session',
          flowState: 'break_active',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBeNull()
      })
    })
  })

  describe('breakState from flow state', () => {
    it('sets breakState when flow state is break_active with breakContext', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'playing',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_active')
        expect(result.current.breakState).toEqual({
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
          phase: 'playing',
        })
      })
    })

    it('sets breakState when flow state is break_pending', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_pending',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'selecting',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_pending')
        expect(result.current.breakState).not.toBeNull()
        expect(result.current.breakState?.phase).toBe('selecting')
      })
    })

    it('clears breakState when flow state transitions to practicing', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'playing',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })

      // Transition back to practicing
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'practicing',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('practicing')
        expect(result.current.breakState).toBeNull()
      })
    })

    it('clears breakState when flow state transitions to break_results', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'playing',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })

      // Transition to break results
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_results',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_results')
        expect(result.current.breakState).toBeNull()
      })
    })

    it('clears breakState when flow state transitions to completed', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'playing',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })

      // Session completes
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'completed',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('completed')
        expect(result.current.breakState).toBeNull()
      })
    })
  })

  describe('full lifecycle via flow state', () => {
    it('handles break_pending → break_active → break_results → practicing', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // 1. Break pending
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_pending',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Card Sorting',
            gameId: 'card-sorting',
            phase: 'selecting',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_pending')
        expect(result.current.breakState?.gameName).toBe('Card Sorting')
      })

      // 2. Break active (playing)
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Card Sorting',
            gameId: 'card-sorting',
            phase: 'playing',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_active')
        expect(result.current.breakState?.phase).toBe('playing')
      })

      // 3. Break results
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_results',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_results')
        expect(result.current.breakState).toBeNull()
      })

      // 4. Back to practicing
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'practicing',
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('practicing')
        expect(result.current.breakState).toBeNull()
      })
    })
  })

  describe('no legacy game-break events', () => {
    it('does not register game-break-started listener', () => {
      renderHook(() => useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true))

      expect(eventHandlers.has('game-break-started')).toBe(false)
    })

    it('does not register game-break-phase listener', () => {
      renderHook(() => useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true))

      expect(eventHandlers.has('game-break-phase')).toBe(false)
    })

    it('does not register game-break-ended listener', () => {
      renderHook(() => useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true))

      expect(eventHandlers.has('game-break-ended')).toBe(false)
    })
  })

  describe('stopObserving clears state', () => {
    it('clears flowState and breakState when stopObserving is called', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Set some state
      act(() => {
        eventHandlers.get('session-flow-state')?.({
          sessionId: SESSION_ID,
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'playing',
          },
        } satisfies SessionFlowStateEvent)
      })

      await waitFor(() => {
        expect(result.current.flowState).toBe('break_active')
        expect(result.current.breakState).not.toBeNull()
      })

      // Stop observing
      act(() => {
        result.current.stopObserving()
      })

      await waitFor(() => {
        expect(result.current.flowState).toBeNull()
        expect(result.current.breakState).toBeNull()
      })
    })
  })
})
