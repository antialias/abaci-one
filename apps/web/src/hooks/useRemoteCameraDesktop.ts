'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { QuadCorners } from '@/types/vision'

/** Frame mode: raw sends uncropped frames, cropped applies calibration */
export type FrameMode = 'raw' | 'cropped'

interface RemoteCameraFrame {
  imageData: string // Base64 JPEG
  timestamp: number
  mode?: FrameMode // What mode the frame was captured in
  videoDimensions?: { width: number; height: number } // Original video dimensions (for raw mode)
}

interface UseRemoteCameraDesktopReturn {
  /** Whether the phone is connected */
  isPhoneConnected: boolean
  /** Latest frame from the phone */
  latestFrame: RemoteCameraFrame | null
  /** Frame rate (frames per second) */
  frameRate: number
  /** Current frame mode */
  frameMode: FrameMode
  /** Video dimensions from the phone (only available in raw mode) */
  videoDimensions: { width: number; height: number } | null
  /** Error message if connection failed */
  error: string | null
  /** Subscribe to receive frames for a session */
  subscribe: (sessionId: string) => void
  /** Unsubscribe from the session */
  unsubscribe: () => void
  /** Set the phone's frame mode (raw = uncropped for calibration, cropped = use calibration) */
  setPhoneFrameMode: (mode: FrameMode) => void
  /** Send calibration to the phone */
  sendCalibration: (corners: QuadCorners) => void
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
  const [frameRate, setFrameRate] = useState(0)
  const [frameMode, setFrameMode] = useState<FrameMode>('raw')
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentSessionId = useRef<string | null>(null)

  // Frame rate calculation
  const frameTimestamps = useRef<number[]>([])

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io({
      path: '/api/socket',
      autoConnect: true,
    })

    socketInstance.on('connect', () => {
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

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
      setIsPhoneConnected(phoneConnected)
      setError(null)
    }

    const handleDisconnected = ({ phoneConnected }: { phoneConnected: boolean }) => {
      setIsPhoneConnected(phoneConnected)
      setLatestFrame(null)
      setFrameRate(0)
    }

    const handleStatus = ({ phoneConnected }: { phoneConnected: boolean }) => {
      setIsPhoneConnected(phoneConnected)
    }

    const handleFrame = (frame: RemoteCameraFrame) => {
      setLatestFrame(frame)
      frameTimestamps.current.push(Date.now())
      calculateFrameRate()

      // Track video dimensions from raw frames
      if (frame.mode === 'raw' && frame.videoDimensions) {
        setVideoDimensions(frame.videoDimensions)
      }
      // Track frame mode
      if (frame.mode) {
        setFrameMode(frame.mode)
      }
    }

    const handleError = ({ error: errorMsg }: { error: string }) => {
      setError(errorMsg)
    }

    socket.on('remote-camera:connected', handleConnected)
    socket.on('remote-camera:disconnected', handleDisconnected)
    socket.on('remote-camera:status', handleStatus)
    socket.on('remote-camera:frame', handleFrame)
    socket.on('remote-camera:error', handleError)

    return () => {
      socket.off('remote-camera:connected', handleConnected)
      socket.off('remote-camera:disconnected', handleDisconnected)
      socket.off('remote-camera:status', handleStatus)
      socket.off('remote-camera:frame', handleFrame)
      socket.off('remote-camera:error', handleError)
    }
  }, [socket, calculateFrameRate])

  // Frame rate update interval
  useEffect(() => {
    const interval = setInterval(calculateFrameRate, 500)
    return () => clearInterval(interval)
  }, [calculateFrameRate])

  const subscribe = useCallback(
    (sessionId: string) => {
      if (!socket || !isConnected) {
        setError('Socket not connected')
        return
      }

      currentSessionId.current = sessionId
      setError(null)
      socket.emit('remote-camera:subscribe', { sessionId })
    },
    [socket, isConnected]
  )

  const unsubscribe = useCallback(() => {
    if (!socket || !currentSessionId.current) return

    socket.emit('remote-camera:leave', { sessionId: currentSessionId.current })
    currentSessionId.current = null
    setIsPhoneConnected(false)
    setLatestFrame(null)
    setFrameRate(0)
    setError(null)
    setVideoDimensions(null)
    setFrameMode('raw')
  }, [socket])

  /**
   * Set the phone's frame mode
   * - raw: Phone sends uncropped frames (for calibration)
   * - cropped: Phone applies calibration and sends cropped frames
   */
  const setPhoneFrameMode = useCallback(
    (mode: FrameMode) => {
      if (!socket || !currentSessionId.current) return

      socket.emit('remote-camera:set-mode', {
        sessionId: currentSessionId.current,
        mode,
      })
      setFrameMode(mode)
    },
    [socket]
  )

  /**
   * Send calibration corners to the phone
   * This will also automatically switch the phone to cropped mode
   */
  const sendCalibration = useCallback(
    (corners: QuadCorners) => {
      if (!socket || !currentSessionId.current) return

      socket.emit('remote-camera:set-calibration', {
        sessionId: currentSessionId.current,
        corners,
      })
      // Phone will automatically switch to cropped mode when it receives calibration
      setFrameMode('cropped')
    },
    [socket]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket && currentSessionId.current) {
        socket.emit('remote-camera:leave', {
          sessionId: currentSessionId.current,
        })
      }
    }
  }, [socket])

  return {
    isPhoneConnected,
    latestFrame,
    frameRate,
    frameMode,
    videoDimensions,
    error,
    subscribe,
    unsubscribe,
    setPhoneFrameMode,
    sendCalibration,
  }
}
