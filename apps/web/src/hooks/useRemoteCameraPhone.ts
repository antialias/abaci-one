'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  isOpenCVReady,
  loadOpenCV,
  rectifyQuadrilateralToBase64,
} from '@/lib/vision/perspectiveTransform'
import type { QuadCorners } from '@/types/vision'

/** Frame mode: raw sends uncropped frames, cropped applies calibration */
export type FrameMode = 'raw' | 'cropped'

interface UseRemoteCameraPhoneOptions {
  /** Target frame rate (default 10) */
  targetFps?: number
  /** JPEG quality (0-1, default 0.8) */
  jpegQuality?: number
  /** Target width for cropped image (default 300) */
  targetWidth?: number
  /** Target width for raw frames (default 640) */
  rawWidth?: number
  /** Callback when desktop requests torch change */
  onTorchRequest?: (on: boolean) => void
}

/**
 * Fixed aspect ratio for cropped abacus images.
 * Abacus is 4 units high by 3 units wide, giving a 4:3 height:width ratio.
 */
const ABACUS_ASPECT_RATIO = 4 / 3

interface UseRemoteCameraPhoneReturn {
  /** Whether connected to the session */
  isConnected: boolean
  /** Whether currently sending frames */
  isSending: boolean
  /** Current frame mode (raw or cropped) */
  frameMode: FrameMode
  /** Current calibration from desktop (if any) */
  desktopCalibration: QuadCorners | null
  /** Error message if any */
  error: string | null
  /** Connect to a session */
  connect: (sessionId: string) => void
  /** Disconnect from session */
  disconnect: () => void
  /** Start sending frames */
  startSending: (video: HTMLVideoElement, calibration?: QuadCorners) => void
  /** Stop sending frames */
  stopSending: () => void
  /** Update calibration while sending (from phone UI) */
  updateCalibration: (calibration: QuadCorners) => void
  /** Set frame mode locally */
  setFrameMode: (mode: FrameMode) => void
  /** Emit torch state to desktop */
  emitTorchState: (isTorchOn: boolean, isTorchAvailable: boolean) => void
}

/**
 * Hook for sending remote camera frames from phone
 *
 * Handles connecting to a session, capturing video frames,
 * applying perspective crop, and sending to the desktop.
 * Supports receiving calibration commands from the desktop.
 */
export function useRemoteCameraPhone(
  options: UseRemoteCameraPhoneOptions = {}
): UseRemoteCameraPhoneReturn {
  const { targetFps = 10, jpegQuality = 0.8, targetWidth = 300, rawWidth = 640, onTorchRequest } =
    options

  // Keep onTorchRequest in a ref to avoid stale closures
  const onTorchRequestRef = useRef(onTorchRequest)
  useEffect(() => {
    onTorchRequestRef.current = onTorchRequest
  }, [onTorchRequest])

  // Calculate fixed output height based on aspect ratio (4 units tall by 3 units wide)
  const targetHeight = Math.round(targetWidth * ABACUS_ASPECT_RATIO)

  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opencvReady, setOpencvReady] = useState(false)
  const [frameMode, setFrameModeState] = useState<FrameMode>('raw')
  const [desktopCalibration, setDesktopCalibration] = useState<QuadCorners | null>(null)

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
  const frameModeRef = useRef<FrameMode>('raw')

  // Keep refs in sync with state
  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  useEffect(() => {
    opencvReadyRef.current = opencvReady
  }, [opencvReady])

  useEffect(() => {
    frameModeRef.current = frameMode
  }, [frameMode])

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

    // Handle mode change from desktop
    const handleSetMode = ({ mode }: { mode: FrameMode }) => {
      console.log('[RemoteCameraPhone] Desktop set mode to:', mode)
      setFrameModeState(mode)
      frameModeRef.current = mode
    }

    // Handle calibration from desktop
    const handleSetCalibration = ({ corners }: { corners: QuadCorners }) => {
      console.log('[RemoteCameraPhone] Received calibration from desktop')
      setDesktopCalibration(corners)
      calibrationRef.current = corners
      // Auto-switch to cropped mode when calibration is received
      setFrameModeState('cropped')
      frameModeRef.current = 'cropped'
    }

    // Handle clear calibration from desktop (go back to auto-detection)
    const handleClearCalibration = () => {
      console.log('[RemoteCameraPhone] Desktop cleared calibration - returning to auto-detection')
      setDesktopCalibration(null)
      calibrationRef.current = null
    }

    // Handle torch command from desktop
    const handleSetTorch = ({ on }: { on: boolean }) => {
      console.log('[RemoteCameraPhone] Desktop requested torch:', on)
      onTorchRequestRef.current?.(on)
    }

    socket.on('remote-camera:error', handleError)
    socket.on('remote-camera:set-mode', handleSetMode)
    socket.on('remote-camera:set-calibration', handleSetCalibration)
    socket.on('remote-camera:clear-calibration', handleClearCalibration)
    socket.on('remote-camera:set-torch', handleSetTorch)

    return () => {
      socket.off('remote-camera:error', handleError)
      socket.off('remote-camera:set-mode', handleSetMode)
      socket.off('remote-camera:set-calibration', handleSetCalibration)
      socket.off('remote-camera:clear-calibration', handleClearCalibration)
      socket.off('remote-camera:set-torch', handleSetTorch)
    }
  }, [isSocketConnected]) // Re-run when socket connects

  /**
   * Apply perspective transform and extract the quadrilateral region
   * Uses OpenCV for proper perspective correction
   *
   * Output is fixed at 4:3 height:width aspect ratio (abacus is 4 units tall by 3 units wide)
   */
  const cropToQuad = useCallback(
    (video: HTMLVideoElement, quad: QuadCorners): string | null => {
      if (!isOpenCVReady()) {
        console.warn('[RemoteCameraPhone] OpenCV not ready for perspective transform')
        return null
      }

      return rectifyQuadrilateralToBase64(video, quad, {
        outputWidth: targetWidth,
        outputHeight: targetHeight, // Fixed 4:3 aspect ratio
        jpegQuality,
        rotate180: false, // Phone camera: no rotation needed, direct mapping
      })
    },
    [targetWidth, targetHeight, jpegQuality]
  )

  /**
   * Capture raw (uncropped) frame as base64 JPEG
   */
  const captureRawFrame = useCallback(
    (video: HTMLVideoElement): string | null => {
      try {
        const canvas = document.createElement('canvas')
        // Scale down to target width while maintaining aspect ratio
        const scale = rawWidth / video.videoWidth
        canvas.width = rawWidth
        canvas.height = Math.round(video.videoHeight * scale)

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality)
        // Remove the data:image/jpeg;base64, prefix
        return dataUrl.split(',')[1]
      } catch (err) {
        console.error('[RemoteCameraPhone] Failed to capture raw frame:', err)
        return null
      }
    },
    [rawWidth, jpegQuality]
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
    const mode = frameModeRef.current

    // For raw mode, we don't need calibration or OpenCV
    if (!video || !sessionId || !socket || !isConnected) {
      animationFrameRef.current = requestAnimationFrame(captureFrame)
      return
    }

    // For cropped mode, we need calibration and OpenCV
    if (mode === 'cropped' && (!calibration || !cvReady)) {
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

    // Capture frame based on mode
    let imageData: string | null = null
    if (mode === 'raw') {
      imageData = captureRawFrame(video)
    } else if (calibration) {
      imageData = cropToQuad(video, calibration)
    }

    if (imageData) {
      socket.emit('remote-camera:frame', {
        sessionId,
        imageData,
        timestamp: Date.now(),
        mode, // Include mode so desktop knows what it's receiving
        videoDimensions:
          mode === 'raw' ? { width: video.videoWidth, height: video.videoHeight } : undefined,
      })
    }

    animationFrameRef.current = requestAnimationFrame(captureFrame)
  }, [targetFps, cropToQuad, captureRawFrame])

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
    (video: HTMLVideoElement, calibration?: QuadCorners) => {
      if (!isConnected) {
        setError('Not connected to session')
        return
      }

      videoRef.current = video
      if (calibration) {
        calibrationRef.current = calibration
      }
      setIsSending(true)

      // Start capture loop
      animationFrameRef.current = requestAnimationFrame(captureFrame)
    },
    [isConnected, captureFrame]
  )

  const setFrameMode = useCallback((mode: FrameMode) => {
    setFrameModeState(mode)
    frameModeRef.current = mode
  }, [])

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

  /**
   * Emit torch state to desktop
   */
  const emitTorchState = useCallback((isTorchOn: boolean, isTorchAvailable: boolean) => {
    const socket = socketRef.current
    const sessionId = sessionIdRef.current
    if (!socket || !sessionId) return

    socket.emit('remote-camera:torch-state', {
      sessionId,
      isTorchOn,
      isTorchAvailable,
    })
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
    frameMode,
    desktopCalibration,
    error,
    connect,
    disconnect,
    startSending,
    stopSending,
    updateCalibration,
    setFrameMode,
    emitTorchState,
  }
}
