'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  isOpenCVReady,
  loadOpenCV,
  rectifyQuadrilateralToBase64,
} from '@/lib/vision/perspectiveTransform'
import type { QuadCorners } from '@/types/vision'

interface UseRemoteCameraPhoneOptions {
  /** Target frame rate (default 10) */
  targetFps?: number
  /** JPEG quality (0-1, default 0.8) */
  jpegQuality?: number
  /** Target width for cropped image (default 400) */
  targetWidth?: number
}

interface UseRemoteCameraPhoneReturn {
  /** Whether connected to the session */
  isConnected: boolean
  /** Whether currently sending frames */
  isSending: boolean
  /** Error message if any */
  error: string | null
  /** Connect to a session */
  connect: (sessionId: string) => void
  /** Disconnect from session */
  disconnect: () => void
  /** Start sending frames with current calibration */
  startSending: (video: HTMLVideoElement, calibration: QuadCorners) => void
  /** Stop sending frames */
  stopSending: () => void
  /** Update calibration while sending */
  updateCalibration: (calibration: QuadCorners) => void
}

/**
 * Hook for sending remote camera frames from phone
 *
 * Handles connecting to a session, capturing video frames,
 * applying perspective crop, and sending to the desktop.
 */
export function useRemoteCameraPhone(
  options: UseRemoteCameraPhoneOptions = {}
): UseRemoteCameraPhoneReturn {
  const { targetFps = 10, jpegQuality = 0.8, targetWidth = 400 } = options

  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opencvReady, setOpencvReady] = useState(false)

  // Use refs for values that need to be accessed in animation loop
  // to avoid stale closure issues
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)
  const opencvReadyRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const calibrationRef = useRef<QuadCorners | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef(0)

  // Keep refs in sync with state
  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  useEffect(() => {
    opencvReadyRef.current = opencvReady
  }, [opencvReady])

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io({
      path: '/api/socket',
      autoConnect: true,
    })

    socketInstance.on('connect', () => {
      setIsSocketConnected(true)
    })

    socketInstance.on('disconnect', () => {
      setIsSocketConnected(false)
      setIsConnected(false)
      isConnectedRef.current = false
    })

    socketRef.current = socketInstance

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // Load OpenCV on mount
  useEffect(() => {
    loadOpenCV()
      .then(() => {
        setOpencvReady(true)
      })
      .catch((err) => {
        console.error('[RemoteCameraPhone] Failed to load OpenCV:', err)
        setError('Failed to load image processing library')
      })
  }, [])

  // Set up Socket.IO event listeners
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleError = ({ error: errorMsg }: { error: string }) => {
      setError(errorMsg)
      setIsConnected(false)
      isConnectedRef.current = false
    }

    socket.on('remote-camera:error', handleError)

    return () => {
      socket.off('remote-camera:error', handleError)
    }
  }, [isSocketConnected]) // Re-run when socket connects

  /**
   * Apply perspective transform and extract the quadrilateral region
   * Uses OpenCV for proper perspective correction
   */
  const cropToQuad = useCallback(
    (video: HTMLVideoElement, quad: QuadCorners): string | null => {
      if (!isOpenCVReady()) {
        console.warn('[RemoteCameraPhone] OpenCV not ready for perspective transform')
        return null
      }

      return rectifyQuadrilateralToBase64(video, quad, {
        outputWidth: targetWidth,
        jpegQuality,
      })
    },
    [targetWidth, jpegQuality]
  )

  /**
   * Frame capture loop - uses refs to avoid stale closure issues
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const calibration = calibrationRef.current
    const sessionId = sessionIdRef.current
    const socket = socketRef.current
    const isConnected = isConnectedRef.current
    const cvReady = opencvReadyRef.current

    if (!video || !calibration || !sessionId || !socket || !isConnected || !cvReady) {
      animationFrameRef.current = requestAnimationFrame(captureFrame)
      return
    }

    const now = performance.now()
    const frameInterval = 1000 / targetFps

    if (now - lastFrameTimeRef.current < frameInterval) {
      animationFrameRef.current = requestAnimationFrame(captureFrame)
      return
    }

    lastFrameTimeRef.current = now

    // Crop and encode frame
    const imageData = cropToQuad(video, calibration)
    if (imageData) {
      socket.emit('remote-camera:frame', {
        sessionId,
        imageData,
        timestamp: Date.now(),
      })
    }

    animationFrameRef.current = requestAnimationFrame(captureFrame)
  }, [targetFps, cropToQuad])

  const connect = useCallback(
    (sessionId: string) => {
      const socket = socketRef.current
      if (!socket || !isSocketConnected) {
        setError('Socket not connected')
        return
      }

      sessionIdRef.current = sessionId
      setError(null)

      socket.emit('remote-camera:join', { sessionId })
      setIsConnected(true)
      isConnectedRef.current = true
    },
    [isSocketConnected]
  )

  const disconnect = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !sessionIdRef.current) return

    // Stop sending first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsSending(false)

    socket.emit('remote-camera:leave', { sessionId: sessionIdRef.current })
    sessionIdRef.current = null
    setIsConnected(false)
    isConnectedRef.current = false
    videoRef.current = null
    calibrationRef.current = null
  }, [])

  const startSending = useCallback(
    (video: HTMLVideoElement, calibration: QuadCorners) => {
      if (!isConnected) {
        setError('Not connected to session')
        return
      }

      videoRef.current = video
      calibrationRef.current = calibration
      setIsSending(true)

      // Start capture loop
      animationFrameRef.current = requestAnimationFrame(captureFrame)
    },
    [isConnected, captureFrame]
  )

  const stopSending = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsSending(false)
  }, [])

  const updateCalibration = useCallback((calibration: QuadCorners) => {
    calibrationRef.current = calibration
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      const socket = socketRef.current
      if (socket && sessionIdRef.current) {
        socket.emit('remote-camera:leave', { sessionId: sessionIdRef.current })
      }
    }
  }, [])

  return {
    isConnected,
    isSending,
    error,
    connect,
    disconnect,
    startSending,
    stopSending,
    updateCalibration,
  }
}
