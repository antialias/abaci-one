'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import type { QuadCorners } from '@/types/vision'

/** Frame mode: raw sends uncropped frames, cropped applies calibration */
export type FrameMode = 'raw' | 'cropped'

/** LocalStorage key for persisting session ID */
const STORAGE_KEY = 'remote-camera-session-id'

interface RemoteCameraFrame {
  imageData: string // Base64 JPEG
  timestamp: number
  mode?: FrameMode // What mode the frame was captured in
  videoDimensions?: { width: number; height: number } // Original video dimensions (for raw mode)
  detectedCorners?: QuadCorners | null // Corners detected by phone's marker detection (only in raw mode)
}

interface UseRemoteCameraDesktopReturn {
  /** Whether the phone is connected */
  isPhoneConnected: boolean
  /** Latest frame from the phone (regardless of mode) */
  latestFrame: RemoteCameraFrame | null
  /** Latest raw (uncropped) frame - useful during calibration */
  latestRawFrame: RemoteCameraFrame | null
  /** Latest cropped (rectified) frame - useful for preview during calibration */
  latestCroppedFrame: RemoteCameraFrame | null
  /** Frame rate (frames per second) */
  frameRate: number
  /** Current frame mode */
  frameMode: FrameMode
  /** Video dimensions from the phone (only available in raw mode) */
  videoDimensions: { width: number; height: number } | null
  /** Corners detected by phone's marker detection (only in raw mode) */
  phoneDetectedCorners: QuadCorners | null
  /** Whether the phone's torch is on */
  isTorchOn: boolean
  /** Whether the phone has torch available */
  isTorchAvailable: boolean
  /** Error message if connection failed */
  error: string | null
  /** Current session ID (null if not subscribed) */
  currentSessionId: string | null
  /** Whether actively trying to reconnect */
  isReconnecting: boolean
  /** Subscribe to receive frames for a session */
  subscribe: (sessionId: string) => void
  /** Unsubscribe from the session */
  unsubscribe: () => void
  /** Set the phone's frame mode (raw = uncropped for calibration, cropped = use calibration) */
  setPhoneFrameMode: (mode: FrameMode) => void
  /** Send calibration to the phone (preview=true keeps phone in raw mode for live preview) */
  sendCalibration: (corners: QuadCorners, columnCount: number, preview?: boolean) => void
  /** Clear desktop calibration on phone (go back to auto-detection) */
  clearCalibration: () => void
  /** Set phone's torch state */
  setRemoteTorch: (on: boolean) => void
  /** Get the persisted session ID (if any) */
  getPersistedSessionId: () => string | null
  /** Clear persisted session and disconnect */
  clearSession: () => void
}

/**
 * Hook for receiving remote camera frames on the desktop
 *
 * Subscribes to a remote camera session via Socket.IO and receives
 * cropped abacus images from the connected phone.
 * Supports sending calibration commands to the phone.
 */
export function useRemoteCameraDesktop(): UseRemoteCameraDesktopReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isPhoneConnected, setIsPhoneConnected] = useState(false)
  const [latestFrame, setLatestFrame] = useState<RemoteCameraFrame | null>(null)
  const [latestRawFrame, setLatestRawFrame] = useState<RemoteCameraFrame | null>(null)
  const [latestCroppedFrame, setLatestCroppedFrame] = useState<RemoteCameraFrame | null>(null)
  const [frameRate, setFrameRate] = useState(0)
  const [frameMode, setFrameMode] = useState<FrameMode>('raw')
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [phoneDetectedCorners, setPhoneDetectedCorners] = useState<QuadCorners | null>(null)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isTorchAvailable, setIsTorchAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // Refs for values needed in callbacks
  const currentSessionIdRef = useRef<string | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Frame rate calculation
  const frameTimestamps = useRef<number[]>([])

  // Helper to persist session ID
  const persistSessionId = useCallback((sessionId: string | null) => {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEY, sessionId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Helper to get persisted session ID
  const getPersistedSessionId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  }, [])

  // Initialize socket connection with reconnection support
  useEffect(() => {
    console.log('[RemoteCameraDesktop] Initializing socket connection...')
    const socketInstance = createSocket({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    })

    socketInstance.on('connect', () => {
      console.log('[RemoteCameraDesktop] Socket connected! ID:', socketInstance.id)
      setIsConnected(true)

      // If we have a session ID (either from state or localStorage), re-subscribe
      const sessionId = currentSessionIdRef.current || getPersistedSessionId()
      if (sessionId) {
        console.log('[RemoteCameraDesktop] Re-subscribing to session after reconnect:', sessionId)
        setIsReconnecting(true)
        socketInstance.emit('remote-camera:subscribe', { sessionId })
      }
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[RemoteCameraDesktop] Socket connect error:', error)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[RemoteCameraDesktop] Socket disconnected:', reason)
      setIsConnected(false)
      // Don't clear phone connected state immediately - might reconnect
      if (reason === 'io server disconnect') {
        // Server forced disconnect - clear state
        setIsPhoneConnected(false)
      }
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [getPersistedSessionId])

  const calculateFrameRate = useCallback(() => {
    const now = Date.now()
    // Keep only frames from last second
    frameTimestamps.current = frameTimestamps.current.filter((t) => now - t < 1000)
    setFrameRate(frameTimestamps.current.length)
  }, [])

  // Set up Socket.IO event listeners
  useEffect(() => {
    if (!socket) return

    const handleConnected = ({ phoneConnected }: { phoneConnected: boolean }) => {
      console.log('[RemoteCameraDesktop] Phone connected event:', phoneConnected)
      setIsPhoneConnected(phoneConnected)
      setIsReconnecting(false)
      setError(null)
      reconnectAttemptRef.current = 0
    }

    const handleDisconnected = ({ phoneConnected }: { phoneConnected: boolean }) => {
      console.log('[RemoteCameraDesktop] Phone disconnected event:', phoneConnected)
      setIsPhoneConnected(phoneConnected)
      // Don't clear frame/framerate - keep last state for visual continuity
      // Phone might reconnect quickly
    }

    const handleStatus = ({ phoneConnected }: { phoneConnected: boolean }) => {
      console.log('[RemoteCameraDesktop] Status event:', phoneConnected)
      setIsPhoneConnected(phoneConnected)
      setIsReconnecting(false)
      reconnectAttemptRef.current = 0
    }

    const handleFrame = (frame: RemoteCameraFrame) => {
      // Always update the generic latest frame
      setLatestFrame(frame)
      frameTimestamps.current.push(Date.now())
      calculateFrameRate()

      // Store in mode-specific state for dual-stream calibration support
      if (frame.mode === 'raw') {
        setLatestRawFrame(frame)
        // Track video dimensions from raw frames
        if (frame.videoDimensions) {
          setVideoDimensions(frame.videoDimensions)
        }
        // Track detected corners from phone's marker detection (raw mode only)
        setPhoneDetectedCorners(frame.detectedCorners ?? null)
      } else if (frame.mode === 'cropped') {
        setLatestCroppedFrame(frame)
        // Clear detected corners when in cropped mode
        setPhoneDetectedCorners(null)
      }

      // Track frame mode
      if (frame.mode) {
        setFrameMode(frame.mode)
      }
    }

    const handleError = ({ error: errorMsg }: { error: string }) => {
      console.log('[RemoteCameraDesktop] Error event:', errorMsg)
      // If session is invalid/expired, clear the persisted session
      if (errorMsg.includes('Invalid') || errorMsg.includes('expired')) {
        console.log('[RemoteCameraDesktop] Session invalid, clearing persisted session')
        persistSessionId(null)
        setCurrentSessionId(null)
        currentSessionIdRef.current = null
      }
      setError(errorMsg)
      setIsReconnecting(false)
    }

    const handleTorchState = ({
      isTorchOn: torchOn,
      isTorchAvailable: torchAvailable,
    }: {
      isTorchOn: boolean
      isTorchAvailable: boolean
    }) => {
      setIsTorchOn(torchOn)
      setIsTorchAvailable(torchAvailable)
    }

    socket.on('remote-camera:connected', handleConnected)
    socket.on('remote-camera:disconnected', handleDisconnected)
    socket.on('remote-camera:status', handleStatus)
    socket.on('remote-camera:frame', handleFrame)
    socket.on('remote-camera:error', handleError)
    socket.on('remote-camera:torch-state', handleTorchState)

    return () => {
      socket.off('remote-camera:connected', handleConnected)
      socket.off('remote-camera:disconnected', handleDisconnected)
      socket.off('remote-camera:status', handleStatus)
      socket.off('remote-camera:frame', handleFrame)
      socket.off('remote-camera:error', handleError)
      socket.off('remote-camera:torch-state', handleTorchState)
    }
  }, [socket, calculateFrameRate, persistSessionId])

  // Frame rate update interval
  useEffect(() => {
    const interval = setInterval(calculateFrameRate, 500)
    return () => clearInterval(interval)
  }, [calculateFrameRate])

  const subscribe = useCallback(
    (sessionId: string) => {
      console.log(
        '[RemoteCameraDesktop] Subscribing to session:',
        sessionId,
        'socket:',
        !!socket,
        'connected:',
        isConnected
      )

      // Save session ID FIRST, so auto-connect handler can use it
      // even if socket isn't connected yet
      currentSessionIdRef.current = sessionId
      setCurrentSessionId(sessionId)
      persistSessionId(sessionId)
      setError(null)

      if (!socket || !isConnected) {
        console.log('[RemoteCameraDesktop] Socket not connected yet, will subscribe on connect')
        return
      }

      console.log('[RemoteCameraDesktop] Emitting remote-camera:subscribe')
      socket.emit('remote-camera:subscribe', { sessionId })
    },
    [socket, isConnected, persistSessionId]
  )

  const unsubscribe = useCallback(() => {
    if (!socket || !currentSessionIdRef.current) return

    socket.emit('remote-camera:leave', {
      sessionId: currentSessionIdRef.current,
    })
    currentSessionIdRef.current = null
    setCurrentSessionId(null)
    // Don't clear persisted session - unsubscribe is for temporary disconnect
    setIsPhoneConnected(false)
    setLatestFrame(null)
    setLatestRawFrame(null)
    setLatestCroppedFrame(null)
    setFrameRate(0)
    setError(null)
    setVideoDimensions(null)
    setPhoneDetectedCorners(null)
    setFrameMode('raw')
    setIsTorchOn(false)
    setIsTorchAvailable(false)
  }, [socket])

  /**
   * Clear session completely (forget persisted session)
   * Use when user explicitly wants to start fresh
   */
  const clearSession = useCallback(() => {
    if (socket && currentSessionIdRef.current) {
      socket.emit('remote-camera:leave', {
        sessionId: currentSessionIdRef.current,
      })
    }
    currentSessionIdRef.current = null
    setCurrentSessionId(null)
    persistSessionId(null)
    setIsPhoneConnected(false)
    setLatestFrame(null)
    setLatestRawFrame(null)
    setLatestCroppedFrame(null)
    setFrameRate(0)
    setError(null)
    setVideoDimensions(null)
    setPhoneDetectedCorners(null)
    setFrameMode('raw')
    setIsTorchOn(false)
    setIsTorchAvailable(false)
    setIsReconnecting(false)
  }, [socket, persistSessionId])

  /**
   * Set the phone's frame mode
   * - raw: Phone sends uncropped frames (for calibration)
   * - cropped: Phone applies calibration and sends cropped frames
   */
  const setPhoneFrameMode = useCallback(
    (mode: FrameMode) => {
      if (!socket || !currentSessionIdRef.current) return

      socket.emit('remote-camera:set-mode', {
        sessionId: currentSessionIdRef.current,
        mode,
      })
      setFrameMode(mode)
    },
    [socket]
  )

  /**
   * Send calibration corners to the phone
   * @param corners - The quad corners defining the crop region
   * @param columnCount - Number of columns on the abacus
   * @param preview - If true, phone stays in raw mode for live preview during calibration.
   *                  If false (default), phone switches to cropped mode for practice.
   */
  const sendCalibration = useCallback(
    (corners: QuadCorners, columnCount: number, preview?: boolean) => {
      if (!socket || !currentSessionIdRef.current) return

      socket.emit('remote-camera:set-calibration', {
        sessionId: currentSessionIdRef.current,
        corners,
        columnCount,
        preview,
      })
      // Only switch to cropped mode locally when not in preview mode
      if (!preview) {
        setFrameMode('cropped')
      }
    },
    [socket]
  )

  /**
   * Clear desktop calibration on phone
   * This tells the phone to forget the desktop calibration and go back to auto-detection
   */
  const clearCalibration = useCallback(() => {
    if (!socket || !currentSessionIdRef.current) return

    socket.emit('remote-camera:clear-calibration', {
      sessionId: currentSessionIdRef.current,
    })
  }, [socket])

  /**
   * Set phone's torch state
   */
  const setRemoteTorch = useCallback(
    (on: boolean) => {
      if (!socket || !currentSessionIdRef.current) return

      socket.emit('remote-camera:set-torch', {
        sessionId: currentSessionIdRef.current,
        on,
      })
      // Optimistically update local state
      setIsTorchOn(on)
    },
    [socket]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket && currentSessionIdRef.current) {
        socket.emit('remote-camera:leave', {
          sessionId: currentSessionIdRef.current,
        })
      }
    }
  }, [socket])

  return {
    isPhoneConnected,
    latestFrame,
    latestRawFrame,
    latestCroppedFrame,
    frameRate,
    frameMode,
    videoDimensions,
    phoneDetectedCorners,
    isTorchOn,
    isTorchAvailable,
    error,
    currentSessionId,
    isReconnecting,
    subscribe,
    unsubscribe,
    setPhoneFrameMode,
    sendCalibration,
    clearCalibration,
    setRemoteTorch,
    getPersistedSessionId,
    clearSession,
  }
}
