/**
 * Unit tests for useSessionBroadcast flow state + break context broadcasting
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BroadcastState } from '@/components/practice'
import type { BreakContext } from '../useSessionBroadcast'
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

describe('useSessionBroadcast - flow state + break context broadcasting', () => {
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

  function renderAndConnect(breakContext: BreakContext | null = null) {
    const result = renderHook(() =>
      useSessionBroadcast(
        SESSION_ID,
        PLAYER_ID,
        createMockBroadcastState(),
        'practicing',
        breakContext
      )
    )

    // Trigger connect
    act(() => {
      connectHandler?.()
    })

    return result
  }

  describe('session-flow-state broadcasting', () => {
    it('emits session-flow-state on connect', () => {
      renderAndConnect()

      const flowStateCalls = mockSocket.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'session-flow-state'
      )
      expect(flowStateCalls.length).toBeGreaterThan(0)
      expect(flowStateCalls[0][1]).toEqual(
        expect.objectContaining({
          sessionId: SESSION_ID,
          flowState: 'practicing',
        })
      )
    })

    it('includes breakContext when provided', () => {
      const breakContext: BreakContext = {
        roomId: 'room-abc',
        gameName: 'Memory Match',
        gameId: 'matching',
        phase: 'playing',
      }

      renderAndConnect(breakContext)

      const flowStateCalls = mockSocket.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'session-flow-state'
      )
      expect(flowStateCalls.length).toBeGreaterThan(0)

      const lastCall = flowStateCalls[flowStateCalls.length - 1]
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          sessionId: SESSION_ID,
          flowState: 'practicing',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Memory Match',
            gameId: 'matching',
            phase: 'playing',
          },
        })
      )
    })

    it('omits breakContext when null', () => {
      renderAndConnect(null)

      const flowStateCalls = mockSocket.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'session-flow-state'
      )
      expect(flowStateCalls.length).toBeGreaterThan(0)

      const lastCall = flowStateCalls[flowStateCalls.length - 1]
      expect(lastCall[1].breakContext).toBeUndefined()
    })
  })

  describe('no legacy game-break events', () => {
    it('does not have sendGameBreakStarted/Phase/Ended functions', () => {
      const { result } = renderAndConnect()

      expect(result.current).not.toHaveProperty('sendGameBreakStarted')
      expect(result.current).not.toHaveProperty('sendGameBreakPhase')
      expect(result.current).not.toHaveProperty('sendGameBreakEnded')
    })

    it('never emits game-break-* events', () => {
      renderAndConnect({
        roomId: 'room-abc',
        gameName: 'Memory Match',
        gameId: 'matching',
        phase: 'playing',
      })

      const gameBreakCalls = mockSocket.emit.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).startsWith('game-break-')
      )

      expect(gameBreakCalls).toHaveLength(0)
    })
  })

  describe('re-broadcast on observer-joined', () => {
    it('broadcasts flow state when observer joins', () => {
      let observerJoinedHandler: ((data: { observerId: string }) => void) | undefined

      mockSocket.on.mockImplementation((event: string, handler: unknown) => {
        if (event === 'connect') {
          connectHandler = handler as () => void
        }
        if (event === 'observer-joined') {
          observerJoinedHandler = handler as (data: { observerId: string }) => void
        }
        return mockSocket
      })

      renderAndConnect()

      // Clear emit calls from connect
      mockSocket.emit.mockClear()

      // Simulate observer joining
      act(() => {
        observerJoinedHandler?.({ observerId: 'observer-1' })
      })

      const flowStateCalls = mockSocket.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'session-flow-state'
      )
      expect(flowStateCalls.length).toBeGreaterThan(0)
    })
  })
})
