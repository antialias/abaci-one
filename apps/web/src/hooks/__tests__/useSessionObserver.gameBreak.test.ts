/**
 * Unit tests for useSessionObserver game break state management
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GameBreakStartedEvent,
  GameBreakPhaseEvent,
  GameBreakEndedEvent,
} from '@/lib/classroom/socket-events'
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

describe('useSessionObserver - game break state', () => {
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

  describe('breakState', () => {
    it('initially returns null breakState', () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      expect(result.current.breakState).toBeNull()
    })

    it('sets breakState when game-break-started event is received', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      const startedData: GameBreakStartedEvent = {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        gameName: 'Memory Match',
        gameId: 'matching',
      }

      act(() => {
        eventHandlers.get('game-break-started')?.(startedData)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
        expect(result.current.breakState).toEqual({
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
          phase: 'selecting',
        })
      })
    })

    it('ignores game-break-started from a different session', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: 'other-session',
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
        })
      })

      await waitFor(() => {
        expect(result.current.breakState).toBeNull()
      })
    })

    it('updates phase when game-break-phase event is received', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break first
      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
        } satisfies GameBreakStartedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('selecting')
      })

      // Transition to playing
      act(() => {
        eventHandlers.get('game-break-phase')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          phase: 'playing',
        } satisfies GameBreakPhaseEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('playing')
        // Other fields should remain unchanged
        expect(result.current.breakState?.roomId).toBe('room-abc')
        expect(result.current.breakState?.gameName).toBe('Memory Match')
        expect(result.current.breakState?.gameId).toBe('matching')
      })
    })

    it('ignores phase update for a different room', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
        } satisfies GameBreakStartedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('selecting')
      })

      // Phase update for a DIFFERENT room
      act(() => {
        eventHandlers.get('game-break-phase')?.({
          sessionId: SESSION_ID,
          roomId: 'room-DIFFERENT',
          phase: 'playing',
        } satisfies GameBreakPhaseEvent)
      })

      // Phase should remain 'selecting' since room doesn't match
      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('selecting')
      })
    })

    it('clears breakState when game-break-ended event is received', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
        } satisfies GameBreakStartedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })

      // End the break
      act(() => {
        eventHandlers.get('game-break-ended')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          reason: 'gameFinished',
          summary: { gameName: 'Memory Match', headline: 'Perfect Game!' },
        } satisfies GameBreakEndedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).toBeNull()
      })
    })

    it('ignores game-break-ended from a different session', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
        } satisfies GameBreakStartedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })

      // End event from different session — should be ignored
      act(() => {
        eventHandlers.get('game-break-ended')?.({
          sessionId: 'other-session',
          roomId: 'room-abc',
          reason: 'gameFinished',
        } satisfies GameBreakEndedEvent)
      })

      // breakState should still be set
      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })
    })

    it('handles full lifecycle: started → selecting → playing → ended', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // 1. Break starts
      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          gameName: 'Card Sorting',
          gameId: 'card-sorting',
        } satisfies GameBreakStartedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('selecting')
        expect(result.current.breakState?.gameName).toBe('Card Sorting')
      })

      // 2. Game starts playing
      act(() => {
        eventHandlers.get('game-break-phase')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          phase: 'playing',
        } satisfies GameBreakPhaseEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('playing')
      })

      // 3. Game completes
      act(() => {
        eventHandlers.get('game-break-phase')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          phase: 'completed',
        } satisfies GameBreakPhaseEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState?.phase).toBe('completed')
      })

      // 4. Break ends
      act(() => {
        eventHandlers.get('game-break-ended')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          reason: 'gameFinished',
        } satisfies GameBreakEndedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).toBeNull()
      })
    })

    it('clears breakState when stopObserving is called', async () => {
      const { result } = renderHook(() =>
        useSessionObserver(SESSION_ID, OBSERVER_ID, PLAYER_ID, true)
      )

      // Start a break
      act(() => {
        eventHandlers.get('game-break-started')?.({
          sessionId: SESSION_ID,
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
        } satisfies GameBreakStartedEvent)
      })

      await waitFor(() => {
        expect(result.current.breakState).not.toBeNull()
      })

      // Stop observing
      act(() => {
        result.current.stopObserving()
      })

      await waitFor(() => {
        expect(result.current.breakState).toBeNull()
      })
    })
  })
})
