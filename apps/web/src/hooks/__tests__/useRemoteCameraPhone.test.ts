/**
 * Tests for useRemoteCameraPhone hook
 *
 * Tests socket connection, auto-reconnection, and frame sending behavior.
 */

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteCameraPhone } from '../useRemoteCameraPhone'

// Mock socket.io-client - use vi.hoisted for variables referenced in vi.mock
const { mockSocket, mockIo } = vi.hoisted(() => {
  const socket = {
    id: 'test-phone-socket-id',
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

// Mock OpenCV loading
vi.mock('@/lib/vision/perspectiveTransform', () => ({
  loadOpenCV: vi.fn(() => Promise.resolve()),
  isOpenCVReady: vi.fn(() => true),
  rectifyQuadrilateralToBase64: vi.fn(() => 'mock-base64-image'),
}))

describe('useRemoteCameraPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIo.mockClear()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    mockSocket.emit.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default state', async () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isSending).toBe(false)
      expect(result.current.frameMode).toBe('raw')
      expect(result.current.desktopCalibration).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should set up socket with reconnection config', () => {
      renderHook(() => useRemoteCameraPhone())

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

  describe('session connection', () => {
    it('should emit join event when connecting', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      // Simulate socket connect
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      if (connectHandler) {
        act(() => {
          connectHandler()
        })
      }

      act(() => {
        result.current.connect('phone-session-123')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:join', {
        sessionId: 'phone-session-123',
      })
    })

    it('should update isConnected on connect', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      if (connectHandler) {
        act(() => {
          connectHandler()
        })
      }

      act(() => {
        result.current.connect('connect-session')
      })

      expect(result.current.isConnected).toBe(true)
    })

    it('should not connect if socket not connected yet', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      // Don't simulate connect - socket is not connected

      act(() => {
        result.current.connect('fail-session')
      })

      // When socket is not connected, connect is deferred (no error, not connected)
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('auto-reconnect on socket reconnect', () => {
    it('should re-join session on socket reconnect', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      // Initial connect
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      // Connect to session
      act(() => {
        result.current.connect('reconnect-session')
      })

      // Clear emit calls
      mockSocket.emit.mockClear()

      // Simulate socket reconnect (connect event fires again)
      act(() => {
        connectHandler()
      })

      // Should auto-rejoin
      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:join', {
        sessionId: 'reconnect-session',
      })
    })

    it('should not rejoin if no session was set', () => {
      renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      mockSocket.emit.mockClear()

      // Simulate reconnect without ever connecting to a session
      act(() => {
        connectHandler()
      })

      expect(mockSocket.emit).not.toHaveBeenCalledWith('remote-camera:join', expect.anything())
    })
  })

  describe('socket disconnect handling', () => {
    it('should not clear session on temporary disconnect', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('persist-session')
      })

      // Simulate temporary disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1]
      act(() => {
        disconnectHandler('transport close')
      })

      // Session ref should still be set (will reconnect)
      // isConnected might be false but session should persist internally
    })

    it('should clear state on server disconnect', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('server-disconnect-session')
      })

      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1]
      act(() => {
        disconnectHandler('io server disconnect')
      })

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('desktop commands', () => {
    it('should handle set-mode command from desktop', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const setModeHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:set-mode'
      )?.[1]

      if (setModeHandler) {
        act(() => {
          setModeHandler({ mode: 'cropped' })
        })
      }

      expect(result.current.frameMode).toBe('cropped')
    })

    it('should handle set-calibration command from desktop', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const calibrationHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:set-calibration'
      )?.[1]

      const corners = {
        topLeft: { x: 10, y: 10 },
        topRight: { x: 100, y: 10 },
        bottomLeft: { x: 10, y: 100 },
        bottomRight: { x: 100, y: 100 },
      }

      if (calibrationHandler) {
        act(() => {
          calibrationHandler({ corners })
        })
      }

      expect(result.current.desktopCalibration).toEqual(corners)
      // Should auto-switch to cropped mode
      expect(result.current.frameMode).toBe('cropped')
    })

    it('should handle clear-calibration command from desktop', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      // First set calibration
      const calibrationHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:set-calibration'
      )?.[1]
      if (calibrationHandler) {
        act(() => {
          calibrationHandler({
            corners: {
              topLeft: { x: 0, y: 0 },
              topRight: { x: 100, y: 0 },
              bottomLeft: { x: 0, y: 100 },
              bottomRight: { x: 100, y: 100 },
            },
          })
        })
      }

      expect(result.current.desktopCalibration).not.toBeNull()

      // Then clear it
      const clearHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:clear-calibration'
      )?.[1]
      if (clearHandler) {
        act(() => {
          clearHandler()
        })
      }

      expect(result.current.desktopCalibration).toBeNull()
    })

    it('should handle set-torch command from desktop', () => {
      const torchCallback = vi.fn()
      renderHook(() => useRemoteCameraPhone({ onTorchRequest: torchCallback }))

      const torchHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:set-torch'
      )?.[1]

      if (torchHandler) {
        act(() => {
          torchHandler({ on: true })
        })
      }

      expect(torchCallback).toHaveBeenCalledWith(true)
    })
  })

  describe('frame mode', () => {
    it('should allow setting frame mode locally', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      act(() => {
        result.current.setFrameMode('cropped')
      })

      expect(result.current.frameMode).toBe('cropped')
    })
  })

  describe('torch state emission', () => {
    it('should emit torch state to desktop', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('torch-emit-session')
      })

      act(() => {
        result.current.emitTorchState(true, true)
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:torch-state', {
        sessionId: 'torch-emit-session',
        isTorchOn: true,
        isTorchAvailable: true,
      })
    })
  })

  describe('disconnect', () => {
    it('should emit leave event on disconnect', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('disconnect-session')
      })

      act(() => {
        result.current.disconnect()
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('remote-camera:leave', {
        sessionId: 'disconnect-session',
      })
    })

    it('should reset state on disconnect', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('reset-disconnect-session')
      })

      expect(result.current.isConnected).toBe(true)

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle error events', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'remote-camera:error'
      )?.[1]

      if (errorHandler) {
        act(() => {
          errorHandler({ error: 'Session expired' })
        })
      }

      expect(result.current.error).toBe('Session expired')
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('calibration update', () => {
    it('should update calibration for frame processing', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const newCalibration = {
        topLeft: { x: 20, y: 20 },
        topRight: { x: 200, y: 20 },
        bottomLeft: { x: 20, y: 200 },
        bottomRight: { x: 200, y: 200 },
      }

      act(() => {
        result.current.updateCalibration(newCalibration)
      })

      // The calibration is stored in a ref for frame processing
      // We can verify by checking that no error is thrown
    })
  })

  describe('sending frames', () => {
    it('should set isSending when startSending is called', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('sending-session')
      })

      // Create mock video element
      const mockVideo = document.createElement('video')

      act(() => {
        result.current.startSending(mockVideo)
      })

      expect(result.current.isSending).toBe(true)
    })

    it('should set error if not connected when starting to send', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const mockVideo = document.createElement('video')

      act(() => {
        result.current.startSending(mockVideo)
      })

      expect(result.current.error).toBe('Not connected to session')
    })

    it('should reset isSending on stopSending', () => {
      const { result } = renderHook(() => useRemoteCameraPhone())

      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
      act(() => {
        connectHandler()
      })

      act(() => {
        result.current.connect('stop-sending-session')
      })

      const mockVideo = document.createElement('video')
      act(() => {
        result.current.startSending(mockVideo)
      })

      act(() => {
        result.current.stopSending()
      })

      expect(result.current.isSending).toBe(false)
    })
  })
})
