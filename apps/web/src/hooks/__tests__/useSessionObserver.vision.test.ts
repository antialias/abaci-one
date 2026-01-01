/**
 * Unit tests for useSessionObserver vision frame receiving
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VisionFrameEvent } from '@/lib/classroom/socket-events'
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

describe('useSessionObserver - vision frame receiving', () => {
  let eventHandlers: Map<string, (data: unknown) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    eventHandlers = new Map()

    // Capture event handlers
    mockSocket.on.mockImplementation((event: string, handler: unknown) => {
      eventHandlers.set(event, handler as (data: unknown) => void)
      return mockSocket
    })
  })

  describe('visionFrame state', () => {
    it('initially returns null visionFrame', () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      expect(result.current.visionFrame).toBeNull()
    })

    it('updates visionFrame when vision-frame event is received', async () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      // Simulate receiving a vision frame event
      const visionFrameData: VisionFrameEvent = {
        sessionId: 'session-123',
        imageData: 'base64ImageData==',
        detectedValue: 456,
        confidence: 0.92,
        timestamp: Date.now(),
      }

      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.(visionFrameData)
      })

      await waitFor(() => {
        expect(result.current.visionFrame).not.toBeNull()
        expect(result.current.visionFrame?.imageData).toBe('base64ImageData==')
        expect(result.current.visionFrame?.detectedValue).toBe(456)
        expect(result.current.visionFrame?.confidence).toBe(0.92)
        expect(result.current.visionFrame?.receivedAt).toBeDefined()
      })
    })

    it('sets receivedAt to current time when frame is received', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      const visionFrameData: VisionFrameEvent = {
        sessionId: 'session-123',
        imageData: 'imageData',
        detectedValue: 123,
        confidence: 0.9,
        timestamp: now - 100, // Sent 100ms ago
      }

      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.(visionFrameData)
      })

      await waitFor(() => {
        expect(result.current.visionFrame?.receivedAt).toBe(now)
      })

      vi.useRealTimers()
    })

    it('updates visionFrame with new frames', async () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      // First frame
      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.({
          sessionId: 'session-123',
          imageData: 'firstFrame',
          detectedValue: 100,
          confidence: 0.8,
          timestamp: Date.now(),
        })
      })

      await waitFor(() => {
        expect(result.current.visionFrame?.detectedValue).toBe(100)
      })

      // Second frame
      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.({
          sessionId: 'session-123',
          imageData: 'secondFrame',
          detectedValue: 200,
          confidence: 0.95,
          timestamp: Date.now(),
        })
      })

      await waitFor(() => {
        expect(result.current.visionFrame?.detectedValue).toBe(200)
        expect(result.current.visionFrame?.imageData).toBe('secondFrame')
      })
    })

    it('handles null detectedValue in frames', async () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      const visionFrameData: VisionFrameEvent = {
        sessionId: 'session-123',
        imageData: 'imageData',
        detectedValue: null,
        confidence: 0,
        timestamp: Date.now(),
      }

      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.(visionFrameData)
      })

      await waitFor(() => {
        expect(result.current.visionFrame?.detectedValue).toBeNull()
        expect(result.current.visionFrame?.confidence).toBe(0)
      })
    })
  })

  describe('cleanup', () => {
    it('clears visionFrame on stopObserving', async () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      // Receive a frame
      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.({
          sessionId: 'session-123',
          imageData: 'imageData',
          detectedValue: 123,
          confidence: 0.9,
          timestamp: Date.now(),
        })
      })

      await waitFor(() => {
        expect(result.current.visionFrame).not.toBeNull()
      })

      // Stop observing
      act(() => {
        result.current.stopObserving()
      })

      await waitFor(() => {
        expect(result.current.visionFrame).toBeNull()
      })
    })
  })

  describe('result interface', () => {
    it('includes visionFrame in the result', () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      expect(result.current).toHaveProperty('visionFrame')
      expect(result.current).toHaveProperty('state')
      expect(result.current).toHaveProperty('results')
      expect(result.current).toHaveProperty('transitionState')
      expect(result.current).toHaveProperty('isConnected')
      expect(result.current).toHaveProperty('isObserving')
      expect(result.current).toHaveProperty('error')
    })
  })

  describe('negative cases', () => {
    it('does not update visionFrame when observer is disabled', () => {
      const { result } = renderHook(
        () => useSessionObserver('session-123', 'observer-456', 'player-789', false) // disabled
      )

      // The socket won't be created when disabled
      expect(eventHandlers.size).toBe(0)
      expect(result.current.visionFrame).toBeNull()
    })

    it('does not update visionFrame when sessionId is undefined', () => {
      const { result } = renderHook(() =>
        useSessionObserver(undefined, 'observer-456', 'player-789', true)
      )

      expect(result.current.visionFrame).toBeNull()
      expect(result.current.isObserving).toBe(false)
    })

    it('handles empty imageData gracefully', async () => {
      const { result } = renderHook(() =>
        useSessionObserver('session-123', 'observer-456', 'player-789', true)
      )

      act(() => {
        const handler = eventHandlers.get('vision-frame')
        handler?.({
          sessionId: 'session-123',
          imageData: '',
          detectedValue: 123,
          confidence: 0.9,
          timestamp: Date.now(),
        })
      })

      await waitFor(() => {
        expect(result.current.visionFrame?.imageData).toBe('')
      })
    })
  })
})
