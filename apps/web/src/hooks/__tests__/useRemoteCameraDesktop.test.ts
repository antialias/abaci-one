/**
 * Tests for useRemoteCameraDesktop hook
 *
 * Tests session persistence, auto-reconnection, and Socket.IO event handling.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteCameraDesktop } from '../useRemoteCameraDesktop'

// Mock socket.io-client - use vi.hoisted for variables referenced in vi.mock
const { mockSocket, mockIo } = vi.hoisted(() => {
  const socket = {
    id: 'test-socket-id',
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  }
  return {
    mockSocket: socket,
    mockIo: vi.fn(() => socket),
  }
})

vi.mock('socket.io-client', () => ({
  io: mockIo,
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useRemoteCameraDesktop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    // Reset mock socket handlers
    mockIo.mockClear()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    mockSocket.emit.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      expect(result.current.isPhoneConnected).toBe(false)
      expect(result.current.latestFrame).toBeNull()
      expect(result.current.frameRate).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.currentSessionId).toBeNull()
      expect(result.current.isReconnecting).toBe(false)
    })

    it('should set up socket with reconnection config', () => {
      renderHook(() => useRemoteCameraDesktop())

      expect(mockIo).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/socket',
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
        })
      )
    })
  })

  describe('localStorage persistence', () => {
    it('should persist session ID when subscribing', async () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      // Simulate socket connect
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      if (connectHandler) {
        act(() => {
          connectHandler()
        })
      }

      // Subscribe to a session
      act(() => {
        result.current.subscribe('test-session-123')
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'remote-camera-session-id',
        'test-session-123'
      )
    })

    it('should return persisted session ID from getPersistedSessionId', () => {
      localStorageMock.getItem.mockReturnValue('persisted-session-456')

      const { result } = renderHook(() => useRemoteCameraDesktop())

      const persistedId = result.current.getPersistedSessionId()

      expect(persistedId).toBe('persisted-session-456')
    })

    it('should clear persisted session ID on clearSession', async () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      act(() => {
        result.current.clearSession()
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('remote-camera-session-id')
    })
  })

  describe('auto-reconnect on socket reconnect', () => {
    it('should re-subscribe to persisted session on socket connect', () => {
      localStorageMock.getItem.mockReturnValue('persisted-session-789')

      renderHook(() => useRemoteCameraDesktop())

      // Find the connect handler
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      expect(connectHandler).toBeDefined()

      // Simulate socket connect
      act(() => {
        connectHandler()
      })

      // Should emit subscribe with persisted session
      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:subscribe', {
        sessionId: 'persisted-session-789',
      })
    })

    it('should not subscribe if no persisted session', () => {
      localStorageMock.getItem.mockReturnValue(null)

      renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      // Should not emit subscribe
      expect(mockSocket.emit).not.toHaveBeenCalledWith('remote-camera:subscribe', expect.anything())
    })
  })

  describe('session subscription', () => {
    it('should emit subscribe event with session ID', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.subscribe('new-session-id')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:subscribe', {
        sessionId: 'new-session-id',
      })
    })

    it('should update currentSessionId on subscribe', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.subscribe('my-session')
      })

      expect(result.current.currentSessionId).toBe('my-session')
    })
  })

  describe('event handling', () => {
    it('should handle phone connected event', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      // Find the event handler setup
      const setupHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:connected'
      )?.[1]

      if (setupHandler) {
        act(() => {
          setupHandler({ phoneConnected: true })
        })
      }

      expect(result.current.isPhoneConnected).toBe(true)
    })

    it('should handle phone disconnected event', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      // Set connected first
      const connectedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:connected'
      )?.[1]
      if (connectedHandler) {
        act(() => {
          connectedHandler({ phoneConnected: true })
        })
      }

      // Then disconnect
      const disconnectedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:disconnected'
      )?.[1]
      if (disconnectedHandler) {
        act(() => {
          disconnectedHandler({ phoneConnected: false })
        })
      }

      expect(result.current.isPhoneConnected).toBe(false)
    })

    it('should handle frame events', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const frameHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:frame'
      )?.[1]

      const testFrame = {
        imageData: 'base64-image-data',
        timestamp: Date.now(),
        mode: 'cropped' as const,
      }

      if (frameHandler) {
        act(() => {
          frameHandler(testFrame)
        })
      }

      expect(result.current.latestFrame).toEqual(testFrame)
    })

    it('should handle error events and clear invalid sessions', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:error'
      )?.[1]

      if (errorHandler) {
        act(() => {
          errorHandler({ error: 'Invalid session' })
        })
      }

      expect(result.current.error).toBe('Invalid session')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('remote-camera-session-id')
    })

    it('should handle torch state events', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const torchHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:torch-state'
      )?.[1]

      if (torchHandler) {
        act(() => {
          torchHandler({ isTorchOn: true, isTorchAvailable: true })
        })
      }

      expect(result.current.isTorchOn).toBe(true)
      expect(result.current.isTorchAvailable).toBe(true)
    })
  })

  describe('calibration commands', () => {
    it('should emit calibration to phone', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      // Simulate connection and subscription
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('calibration-session')
      })

      const corners = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 100, y: 0 },
        bottomLeft: { x: 0, y: 100 },
        bottomRight: { x: 100, y: 100 },
      }

      act(() => {
        result.current.sendCalibration(corners, 13)
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:set-calibration', {
        sessionId: 'calibration-session',
        corners,
        columnCount: 13,
        preview: undefined,
      })
    })

    it('should emit clear calibration to phone', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('clear-cal-session')
      })

      act(() => {
        result.current.clearCalibration()
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:clear-calibration', {
        sessionId: 'clear-cal-session',
      })
    })
  })

  describe('frame mode control', () => {
    it('should emit frame mode change to phone', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('mode-session')
      })

      act(() => {
        result.current.setPhoneFrameMode('raw')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:set-mode', {
        sessionId: 'mode-session',
        mode: 'raw',
      })
    })
  })

  describe('torch control', () => {
    it('should emit torch command to phone', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('torch-session')
      })

      act(() => {
        result.current.setRemoteTorch(true)
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:set-torch', {
        sessionId: 'torch-session',
        on: true,
      })
    })

    it('should optimistically update torch state', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('torch-session-2')
      })

      act(() => {
        result.current.setRemoteTorch(true)
      })

      expect(result.current.isTorchOn).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should emit leave on unsubscribe', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('leave-session')
      })

      act(() => {
        result.current.unsubscribe()
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:leave', {
        sessionId: 'leave-session',
      })
    })

    it('should reset state on unsubscribe', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('reset-session')
      })

      // Set some state
      const connectedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:connected'
      )?.[1]
      if (connectedHandler) {
        act(() => {
          connectedHandler({ phoneConnected: true })
        })
      }

      act(() => {
        result.current.unsubscribe()
      })

      expect(result.current.isPhoneConnected).toBe(false)
      expect(result.current.latestFrame).toBeNull()
      expect(result.current.frameRate).toBe(0)
    })

    it('should clear all state on clearSession', () => {
      const { result } = renderHook(() => useRemoteCameraDesktop())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })
      act(() => {
        result.current.subscribe('clear-session')
      })

      act(() => {
        result.current.clearSession()
      })

      expect(result.current.currentSessionId).toBeNull()
      expect(result.current.isPhoneConnected).toBe(false)
      expect(result.current.isReconnecting).toBe(false)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('remote-camera-session-id')
    })
  })
})
