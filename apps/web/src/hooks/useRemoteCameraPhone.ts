'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
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
  /** Callback when desktop requests frame mode change (called BEFORE state updates) */
  onDesktopSetMode?: (mode: FrameMode) => void
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
  /** Column count from desktop calibration */
  desktopColumnCount: number | null
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
  /** Set detected corners to include with raw frames (from phone's marker detection) */
  setDetectedCorners: (corners: QuadCorners | null) => void
  /** Capture and send a raw frame with specific corners atomically (for boundary training) */
  captureAndSendRawFrame: (video: HTMLVideoElement, corners: QuadCorners) => void
  /** Capture and send a cropped preview frame (for calibration preview during dual-stream mode) */
  captureAndSendCroppedPreviewFrame: (video: HTMLVideoElement, corners: QuadCorners) => void
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
  const {
    targetFps = 10,
    jpegQuality = 0.8,
    targetWidth = 300,
    rawWidth = 640,
    onTorchRequest,
    onDesktopSetMode,
  } = options

  // Keep callbacks in refs to avoid stale closures
  const onTorchRequestRef = useRef(onTorchRequest)
  useEffect(() => {
    onTorchRequestRef.current = onTorchRequest
  }, [onTorchRequest])

  const onDesktopSetModeRef = useRef(onDesktopSetMode)
  useEffect(() => {
    onDesktopSetModeRef.current = onDesktopSetMode
  }, [onDesktopSetMode])

  // Calculate fixed output height based on aspect ratio (4 units tall by 3 units wide)
  const targetHeight = Math.round(targetWidth * ABACUS_ASPECT_RATIO)

  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const isSocketConnectedRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opencvReady, setOpencvReady] = useState(false)
  const [frameMode, setFrameModeState] = useState<FrameMode>('raw')
  const [desktopCalibration, setDesktopCalibration] = useState<QuadCorners | null>(null)
  const [desktopColumnCount, setDesktopColumnCount] = useState<number | null>(null)

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
  // Detected corners from phone's marker detection - sent with raw frames
  const detectedCornersRef = useRef<QuadCorners | null>(null)

  // Keep refs in sync with state
  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  useEffect(() => {
    isSocketConnectedRef.current = isSocketConnected
  }, [isSocketConnected])

  useEffect(() => {
    opencvReadyRef.current = opencvReady
  }, [opencvReady])

  useEffect(() => {
    frameModeRef.current = frameMode
  }, [frameMode])

  // Initialize socket connection with reconnection support
  useEffect(() => {
    console.log('[RemoteCameraPhone] Initializing socket connection...')
    const socketInstance = createSocket({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    })

    socketInstance.on('connect', () => {
      console.log('[RemoteCameraPhone] Socket connected! ID:', socketInstance.id)
      setIsSocketConnected(true)

      // Auto-reconnect to session if we have one
      const sessionId = sessionIdRef.current
      if (sessionId) {
        console.log(
          '[RemoteCameraPhone] Auto-reconnecting to session after socket reconnect:',
          sessionId
        )
        socketInstance.emit('remote-camera:join', { sessionId })
        setIsConnected(true)
        isConnectedRef.current = true
      }
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[RemoteCameraPhone] Socket connect error:', error)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[RemoteCameraPhone] Socket disconnected:', reason)
      setIsSocketConnected(false)
      // Don't clear isConnected or sessionIdRef - we want to auto-reconnect
      // Only clear if server explicitly disconnected us
      if (reason === 'io server disconnect') {
        setIsConnected(false)
        isConnectedRef.current = false
      }
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
      // Call callback BEFORE state updates so caller can update refs immediately
      onDesktopSetModeRef.current?.(mode)
      setFrameModeState(mode)
      frameModeRef.current = mode
    }

    // Handle calibration from desktop
    const handleSetCalibration = ({
      corners,
      columnCount,
      preview,
    }: {
      corners: QuadCorners
      columnCount?: number
      preview?: boolean
    }) => {
      console.log(
        '[RemoteCameraPhone] Received calibration from desktop, columns:',
        columnCount,
        'preview:',
        preview
      )

      // Desktop sends corners in the scaled JPEG coordinate space (rawWidth).
      // We need to scale them up to native video resolution for display.
      const video = videoRef.current
      let scaledCorners = corners
      if (video && video.videoWidth > 0) {
        const scaleUp = video.videoWidth / rawWidth
        console.log(
          '[RemoteCameraPhone] Scaling corners from JPEG to native:',
          rawWidth,
          '->',
          video.videoWidth,
          'scale:',
          scaleUp
        )
        scaledCorners = {
          topLeft: { x: corners.topLeft.x * scaleUp, y: corners.topLeft.y * scaleUp },
          topRight: { x: corners.topRight.x * scaleUp, y: corners.topRight.y * scaleUp },
          bottomLeft: { x: corners.bottomLeft.x * scaleUp, y: corners.bottomLeft.y * scaleUp },
          bottomRight: { x: corners.bottomRight.x * scaleUp, y: corners.bottomRight.y * scaleUp },
        }
      }

      setDesktopCalibration(scaledCorners)
      calibrationRef.current = scaledCorners
      if (columnCount !== undefined) {
        setDesktopColumnCount(columnCount)
      }
      // Auto-switch to cropped mode when calibration is finalized (not preview)
      // During preview, stay in raw mode so desktop can see the full frame
      if (!preview) {
        setFrameModeState('cropped')
        frameModeRef.current = 'cropped'
      }
    }

    // Handle clear calibration from desktop (go back to auto-detection)
    const handleClearCalibration = () => {
      console.log('[RemoteCameraPhone] Desktop cleared calibration - returning to auto-detection')
      setDesktopCalibration(null)
      setDesktopColumnCount(null)
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
      // Scale corners to match the JPEG's coordinate space
      // The raw frame is scaled down from video dimensions to rawWidth
      // Corners are detected in video coordinates, so we need to scale them too
      let scaledCorners: typeof detectedCornersRef.current = null
      if (mode === 'raw' && detectedCornersRef.current) {
        const scale = rawWidth / video.videoWidth
        const corners = detectedCornersRef.current
        scaledCorners = {
          topLeft: {
            x: corners.topLeft.x * scale,
            y: corners.topLeft.y * scale,
          },
          topRight: {
            x: corners.topRight.x * scale,
            y: corners.topRight.y * scale,
          },
          bottomLeft: {
            x: corners.bottomLeft.x * scale,
            y: corners.bottomLeft.y * scale,
          },
          bottomRight: {
            x: corners.bottomRight.x * scale,
            y: corners.bottomRight.y * scale,
          },
        }
      }

      const frameData = {
        sessionId,
        imageData,
        timestamp: Date.now(),
        mode, // Include mode so desktop knows what it's receiving
        // Send the JPEG dimensions, not the original video dimensions
        // This matches the coordinate space of the scaled corners
        videoDimensions:
          mode === 'raw'
            ? {
                width: rawWidth,
                height: Math.round(video.videoHeight * (rawWidth / video.videoWidth)),
              }
            : undefined,
        // Include scaled corners with raw frames so desktop doesn't need to re-detect
        detectedCorners: mode === 'raw' ? scaledCorners : undefined,
      }
      // Log what we're sending (only log corners info, not full image data)
      if (mode === 'raw') {
        console.log('[PHONE-HOOK] Emitting frame:', {
          mode: frameData.mode,
          hasCorners: !!frameData.detectedCorners,
          corners: frameData.detectedCorners ? JSON.stringify(frameData.detectedCorners) : null,
          videoDimensions: frameData.videoDimensions,
        })
      }
      socket.emit('remote-camera:frame', frameData)
    }

    animationFrameRef.current = requestAnimationFrame(captureFrame)
  }, [targetFps, cropToQuad, captureRawFrame, rawWidth])

  const connect = useCallback((sessionId: string) => {
    const socket = socketRef.current
    console.log(
      '[RemoteCameraPhone] Connecting to session:',
      sessionId,
      'socket:',
      !!socket,
      'connected:',
      isSocketConnectedRef.current
    )

    // Save session ID FIRST, so auto-connect handler can use it
    // even if socket isn't connected yet
    sessionIdRef.current = sessionId
    setError(null)

    // Use ref instead of state to avoid callback recreation on socket state changes.
    // This prevents reconnection loops when connection is flaky.
    // Auto-reconnect is handled by the socket's 'connect' event handler.
    if (!socket || !isSocketConnectedRef.current) {
      console.log('[RemoteCameraPhone] Socket not connected yet, will join on connect')
      return
    }

    console.log('[RemoteCameraPhone] Emitting remote-camera:join')
    socket.emit('remote-camera:join', { sessionId })
    setIsConnected(true)
    isConnectedRef.current = true
  }, [])

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
   * Set detected corners from phone's marker detection
   * These will be sent with raw frames so desktop doesn't need to re-detect
   */
  const setDetectedCorners = useCallback((corners: QuadCorners | null) => {
    console.log('[PHONE-HOOK] setDetectedCorners called:', corners ? 'has corners' : 'null')
    detectedCornersRef.current = corners
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

  /**
   * Capture and send a raw frame with specific corners atomically.
   * This ensures the corners and frame are from the exact same video frame.
   * Used for boundary training where frame/corner sync is critical.
   */
  const captureAndSendRawFrame = useCallback(
    (video: HTMLVideoElement, corners: QuadCorners) => {
      const socket = socketRef.current
      const sessionId = sessionIdRef.current
      // Note: caller is responsible for checking isSending before calling
      if (!socket || !sessionId) return

      // Capture the frame right now
      try {
        const canvas = document.createElement('canvas')
        const scale = rawWidth / video.videoWidth
        canvas.width = rawWidth
        canvas.height = Math.round(video.videoHeight * scale)

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality)
        const imageData = dataUrl.split(',')[1]

        // Scale corners to match the JPEG's coordinate space
        const scaledCorners: QuadCorners = {
          topLeft: {
            x: corners.topLeft.x * scale,
            y: corners.topLeft.y * scale,
          },
          topRight: {
            x: corners.topRight.x * scale,
            y: corners.topRight.y * scale,
          },
          bottomLeft: {
            x: corners.bottomLeft.x * scale,
            y: corners.bottomLeft.y * scale,
          },
          bottomRight: {
            x: corners.bottomRight.x * scale,
            y: corners.bottomRight.y * scale,
          },
        }

        const frameData = {
          sessionId,
          imageData,
          timestamp: Date.now(),
          mode: 'raw' as const,
          videoDimensions: {
            width: canvas.width,
            height: canvas.height,
          },
          detectedCorners: scaledCorners,
        }

        console.log('[PHONE-HOOK] captureAndSendRawFrame: sending atomic frame+corners')
        socket.emit('remote-camera:frame', frameData)
      } catch (error) {
        console.error('[PHONE-HOOK] captureAndSendRawFrame error:', error)
      }
    },
    [rawWidth, jpegQuality]
  )

  /**
   * Capture and send a cropped (rectified) preview frame.
   * Used during calibration to show what the cropped result will look like
   * while still in raw mode for the main calibration view.
   */
  const captureAndSendCroppedPreviewFrame = useCallback(
    (video: HTMLVideoElement, corners: QuadCorners) => {
      const socket = socketRef.current
      const sessionId = sessionIdRef.current
      const cvReady = opencvReadyRef.current

      if (!socket || !sessionId) return
      if (!cvReady) {
        console.warn('[PHONE-HOOK] captureAndSendCroppedPreviewFrame: OpenCV not ready')
        return
      }

      try {
        // Use the same cropToQuad logic as regular cropped frames
        const imageData = cropToQuad(video, corners)
        if (!imageData) {
          console.warn('[PHONE-HOOK] captureAndSendCroppedPreviewFrame: cropToQuad returned null')
          return
        }

        const frameData = {
          sessionId,
          imageData,
          timestamp: Date.now(),
          mode: 'cropped' as const,
        }

        console.log('[PHONE-HOOK] captureAndSendCroppedPreviewFrame: sending cropped preview')
        socket.emit('remote-camera:frame', frameData)
      } catch (error) {
        console.error('[PHONE-HOOK] captureAndSendCroppedPreviewFrame error:', error)
      }
    },
    [cropToQuad]
  )

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
    desktopColumnCount,
    error,
    connect,
    disconnect,
    startSending,
    stopSending,
    updateCalibration,
    setFrameMode,
    emitTorchState,
    setDetectedCorners,
    captureAndSendRawFrame,
    captureAndSendCroppedPreviewFrame,
  }
}
