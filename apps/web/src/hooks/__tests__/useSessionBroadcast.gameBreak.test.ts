/**
 * Unit tests for useSessionBroadcast game break broadcasting
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BroadcastState } from '@/components/practice'
import { useSessionBroadcast } from '../useSessionBroadcast'

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

describe('useSessionBroadcast - game break broadcasting', () => {
  let connectHandler: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    connectHandler = undefined

    mockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'connect') {
        connectHandler = handler as () => void
      }
      return mockSocket
    })
  })

  const SESSION_ID = 'session-123'
  const PLAYER_ID = 'player-456'

  const createMockBroadcastState = (): BroadcastState => ({
    currentProblem: { terms: [5, 3], answer: 8 },
    phase: 'problem',
    studentAnswer: '',
    isCorrect: null,
    startedAt: Date.now(),
    purpose: 'focus',
    complexity: undefined,
    currentProblemNumber: 1,
    totalProblems: 10,
    sessionParts: [],
    currentPartIndex: 0,
    currentSlotIndex: 0,
    slotResults: [],
  })

  function renderAndConnect() {
    const result = renderHook(() =>
      useSessionBroadcast(SESSION_ID, PLAYER_ID, createMockBroadcastState(), 'practicing')
    )

    // Trigger connect
    act(() => {
      connectHandler?.()
    })

    return result
  }

  describe('sendGameBreakStarted', () => {
    it('returns sendGameBreakStarted function', () => {
      const { result } = renderAndConnect()
      expect(typeof result.current.sendGameBreakStarted).toBe('function')
    })

    it('emits game-break-started event with correct payload', () => {
      const { result } = renderAndConnect()

      act(() => {
        result.current.sendGameBreakStarted('room-abc', 'Memory Match', 'matching')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-started', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        gameName: 'Memory Match',
        gameId: 'matching',
      })
    })

    it('does not emit when sessionId is undefined', () => {
      const { result } = renderHook(() =>
        useSessionBroadcast(undefined, PLAYER_ID, createMockBroadcastState(), 'practicing')
      )

      act(() => {
        result.current.sendGameBreakStarted('room-abc', 'Memory Match', 'matching')
      })

      const gameBreakEmits = mockSocket.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'game-break-started'
      )
      expect(gameBreakEmits).toHaveLength(0)
    })
  })

  describe('sendGameBreakPhase', () => {
    it('emits game-break-phase event with correct payload', () => {
      const { result } = renderAndConnect()

      act(() => {
        result.current.sendGameBreakPhase('room-abc', 'playing')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-phase', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        phase: 'playing',
      })
    })

    it('emits different phases correctly', () => {
      const { result } = renderAndConnect()

      act(() => {
        result.current.sendGameBreakPhase('room-abc', 'selecting')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-phase', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        phase: 'selecting',
      })

      act(() => {
        result.current.sendGameBreakPhase('room-abc', 'completed')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-phase', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        phase: 'completed',
      })
    })
  })

  describe('sendGameBreakEnded', () => {
    it('emits game-break-ended event with reason only', () => {
      const { result } = renderAndConnect()

      act(() => {
        result.current.sendGameBreakEnded('room-abc', 'timeout')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-ended', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        reason: 'timeout',
        summary: undefined,
      })
    })

    it('emits game-break-ended event with summary', () => {
      const { result } = renderAndConnect()

      act(() => {
        result.current.sendGameBreakEnded('room-abc', 'gameFinished', {
          gameName: 'Memory Match',
          headline: 'Perfect Game!',
        })
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-ended', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        reason: 'gameFinished',
        summary: {
          gameName: 'Memory Match',
          headline: 'Perfect Game!',
        },
      })
    })

    it('emits game-break-ended for skipped reason', () => {
      const { result } = renderAndConnect()

      act(() => {
        result.current.sendGameBreakEnded('room-abc', 'skipped')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('game-break-ended', {
        sessionId: SESSION_ID,
        roomId: 'room-abc',
        reason: 'skipped',
        summary: undefined,
      })
    })
  })

  describe('full lifecycle', () => {
    it('emits all three events in sequence', () => {
      const { result } = renderAndConnect()

      // 1. Break starts
      act(() => {
        result.current.sendGameBreakStarted('room-abc', 'Memory Match', 'matching')
      })

      // 2. Phase changes
      act(() => {
        result.current.sendGameBreakPhase('room-abc', 'playing')
      })

      // 3. Break ends
      act(() => {
        result.current.sendGameBreakEnded('room-abc', 'gameFinished', {
          gameName: 'Memory Match',
          headline: 'Great job!',
        })
      })

      const gameBreakCalls = mockSocket.emit.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).startsWith('game-break-')
      )

      expect(gameBreakCalls).toHaveLength(3)
      expect(gameBreakCalls[0][0]).toBe('game-break-started')
      expect(gameBreakCalls[1][0]).toBe('game-break-phase')
      expect(gameBreakCalls[2][0]).toBe('game-break-ended')
    })
  })
})
