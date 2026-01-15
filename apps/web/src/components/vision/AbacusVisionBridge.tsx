'use client'

import { motion, useDragControls } from 'framer-motion'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAbacusVision } from '@/hooks/useAbacusVision'
import { useFrameStability } from '@/hooks/useFrameStability'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import { analyzeColumns, analysesToDigits } from '@/lib/vision/beadDetector'
import { processImageFrame } from '@/lib/vision/frameProcessor'
import { isOpenCVReady, loadOpenCV, rectifyQuadrilateral } from '@/lib/vision/perspectiveTransform'
import type { CalibrationGrid, Point, QuadCorners, ROI } from '@/types/vision'
import { DEFAULT_STABILITY_CONFIG } from '@/types/vision'
import { css } from '../../../styled-system/css'
import { CalibrationQuadEditor } from './CalibrationQuadEditor'
import { RemoteCameraQRCode } from './RemoteCameraQRCode'
import { VisionCameraFeed } from './VisionCameraFeed'
import { VisionStatusIndicator } from './VisionStatusIndicator'

type CameraSource = 'local' | 'phone'

/**
 * Configuration change payload for onConfigurationChange callback
 */
export interface VisionConfigurationChange {
  /** Camera device ID (for local camera) */
  cameraDeviceId?: string | null
  /** Calibration grid */
  calibration?: import('@/types/vision').CalibrationGrid | null
  /** Remote camera session ID (for phone camera) */
  remoteCameraSessionId?: string | null
  /** Active camera source (tracks which camera is in use) */
  activeCameraSource?: CameraSource | null
}

export interface AbacusVisionBridgeProps {
  /** Number of abacus columns to detect */
  columnCount: number
  /** Called when a stable value is detected */
  onValueDetected: (value: number) => void
  /** Called when vision mode is closed */
  onClose: () => void
  /** Called on error */
  onError?: (error: string) => void
  /** Called when configuration changes (camera, calibration, or remote session) */
  onConfigurationChange?: (config: VisionConfigurationChange) => void
  /** Initial camera source to show (defaults to 'local', but should be 'phone' if remote session is active) */
  initialCameraSource?: CameraSource
  /** Whether to show vision control buttons (enable/disable, clear settings) */
  showVisionControls?: boolean
  /** Whether vision is currently enabled (for showVisionControls) */
  isVisionEnabled?: boolean
  /** Whether vision setup is complete (for showVisionControls) */
  isVisionSetupComplete?: boolean
  /** Called when user toggles vision on/off */
  onToggleVision?: () => void
  /** Called when user clicks clear settings */
  onClearSettings?: () => void
  /** Ref to the container element for drag constraints */
  dragConstraintRef?: React.RefObject<HTMLDivElement>
}

// ============================================================================
// Calibration Helper Functions
// ============================================================================

/**
 * Get default corners for a video of given dimensions
 * Creates a slightly trapezoidal shape (wider at bottom for typical desk perspective)
 */
function getDefaultCorners(videoWidth: number, videoHeight: number): QuadCorners {
  const topMargin = 0.15
  const bottomMargin = 0.2
  const sideMargin = 0.15
  const topInset = 0.03
  return {
    topLeft: {
      x: videoWidth * (sideMargin + topInset),
      y: videoHeight * topMargin,
    },
    topRight: {
      x: videoWidth * (1 - sideMargin - topInset),
      y: videoHeight * topMargin,
    },
    bottomLeft: {
      x: videoWidth * sideMargin,
      y: videoHeight * (1 - bottomMargin),
    },
    bottomRight: {
      x: videoWidth * (1 - sideMargin),
      y: videoHeight * (1 - bottomMargin),
    },
  }
}

/**
 * Get default column dividers (evenly spaced)
 */
function getDefaultDividers(columnCount: number): number[] {
  const dividers: number[] = []
  for (let i = 1; i < columnCount; i++) {
    dividers.push(i / columnCount)
  }
  return dividers
}

/**
 * Rotate corners 90° in the given direction
 */
function rotateCorners(corners: QuadCorners, direction: 'left' | 'right'): QuadCorners {
  if (direction === 'right') {
    // Rotate 90° clockwise: TL→TR, TR→BR, BR→BL, BL→TL
    return {
      topLeft: corners.bottomLeft,
      topRight: corners.topLeft,
      bottomRight: corners.topRight,
      bottomLeft: corners.bottomRight,
    }
  } else {
    // Rotate 90° counter-clockwise: TL→BL, BL→BR, BR→TR, TR→TL
    return {
      topLeft: corners.topRight,
      topRight: corners.bottomRight,
      bottomRight: corners.bottomLeft,
      bottomLeft: corners.topLeft,
    }
  }
}

/**
 * Convert QuadCorners to legacy ROI format (bounding box)
 */
function cornersToROI(corners: QuadCorners): ROI {
  const minX = Math.min(corners.topLeft.x, corners.bottomLeft.x)
  const maxX = Math.max(corners.topRight.x, corners.bottomRight.x)
  const minY = Math.min(corners.topLeft.y, corners.topRight.y)
  const maxY = Math.max(corners.bottomLeft.y, corners.bottomRight.y)
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

// ============================================================================
// Rotation Animation Helpers
// ============================================================================

/** Animation duration for rotation in milliseconds */
const ROTATION_DURATION_MS = 300

/** State for tracking a rotation animation */
interface RotationAnimation {
  startCorners: QuadCorners
  endCorners: QuadCorners
  startTime: number
}

/** Easing function: easeOutCubic for smooth deceleration */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** Interpolate between two points */
function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

/** Interpolate between two sets of corners */
function lerpCorners(a: QuadCorners, b: QuadCorners, t: number): QuadCorners {
  return {
    topLeft: lerpPoint(a.topLeft, b.topLeft, t),
    topRight: lerpPoint(a.topRight, b.topRight, t),
    bottomLeft: lerpPoint(a.bottomLeft, b.bottomLeft, t),
    bottomRight: lerpPoint(a.bottomRight, b.bottomRight, t),
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * AbacusVisionBridge - Main UI for physical abacus detection
 *
 * Provides:
 * - Camera feed with Desk View auto-detection
 * - Interactive calibration UI
 * - Real-time detection status
 * - Stable value output to control digital abacus
 */
export function AbacusVisionBridge({
  columnCount,
  onValueDetected,
  onClose,
  onError,
  onConfigurationChange,
  initialCameraSource = 'local',
  showVisionControls = false,
  isVisionEnabled = false,
  isVisionSetupComplete = false,
  onToggleVision,
  onClearSettings,
  dragConstraintRef,
}: AbacusVisionBridgeProps): ReactNode {
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number
    height: number
    containerWidth: number
    containerHeight: number
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const cameraFeedContainerRef = useRef<HTMLDivElement>(null)
  const remoteFeedContainerRef = useRef<HTMLDivElement>(null)
  const remoteImageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  // Local calibration editing state (managed here, passed to CalibrationQuadEditor)
  const [localEditingCorners, setLocalEditingCorners] = useState<QuadCorners | null>(null)
  const [localEditingDividers, setLocalEditingDividers] = useState<number[] | null>(null)
  // Local rotation animation state
  const [localRotationAnimation, setLocalRotationAnimation] = useState<RotationAnimation | null>(
    null
  )

  // Track remote image container dimensions for calibration
  const [remoteContainerDimensions, setRemoteContainerDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const [calibrationCorners, setCalibrationCorners] = useState<QuadCorners | null>(null)
  const [opencvReady, setOpencvReady] = useState(false)

  // Camera source selection
  const [cameraSource, setCameraSource] = useState<CameraSource>(initialCameraSource)
  const [remoteCameraSessionId, setRemoteCameraSessionId] = useState<string | null>(null)
  // Track whether we've checked localStorage for persisted session - prevents race condition
  // where RemoteCameraQRCode creates a new session before we read the persisted one
  const [hasCheckedPersistence, setHasCheckedPersistence] = useState(false)

  // Remote camera state
  const [remoteCalibrationMode, setRemoteCalibrationMode] = useState<'auto' | 'manual'>('auto')
  const [remoteIsCalibrating, setRemoteIsCalibrating] = useState(false)
  const [remoteCalibration, setRemoteCalibration] = useState<CalibrationGrid | null>(null)

  // Remote calibration editing state (managed here, passed to CalibrationQuadEditor)
  const [remoteEditingCorners, setRemoteEditingCorners] = useState<QuadCorners | null>(null)
  const [remoteEditingDividers, setRemoteEditingDividers] = useState<number[] | null>(null)
  // Remote rotation animation state
  const [remoteRotationAnimation, setRemoteRotationAnimation] = useState<RotationAnimation | null>(
    null
  )

  // Crop settings expansion state
  const [isCropSettingsExpanded, setIsCropSettingsExpanded] = useState(false)

  const vision = useAbacusVision({
    columnCount,
    onValueDetected,
  })

  // Remote camera hook - destructure to get stable function references
  const {
    isPhoneConnected: remoteIsPhoneConnected,
    latestFrame: remoteLatestFrame,
    latestRawFrame: remoteLatestRawFrame,
    latestCroppedFrame: remoteLatestCroppedFrame,
    frameRate: remoteFrameRate,
    frameMode: remoteFrameMode,
    videoDimensions: remoteVideoDimensions,
    isTorchOn: remoteIsTorchOn,
    isTorchAvailable: remoteIsTorchAvailable,
    error: remoteError,
    currentSessionId: remoteCurrentSessionId,
    isReconnecting: remoteIsReconnecting,
    subscribe: remoteSubscribe,
    unsubscribe: remoteUnsubscribe,
    setPhoneFrameMode: remoteSetPhoneFrameMode,
    sendCalibration: remoteSendCalibration,
    clearCalibration: remoteClearCalibration,
    setRemoteTorch,
    getPersistedSessionId: remoteGetPersistedSessionId,
    clearSession: remoteClearSession,
  } = useRemoteCameraDesktop()

  // Refs for stable access in animation effects (avoid stale closures)
  const remoteSendCalibrationRef = useRef(remoteSendCalibration)
  remoteSendCalibrationRef.current = remoteSendCalibration
  const columnCountRef = useRef(columnCount)
  columnCountRef.current = columnCount

  // Stability tracking for remote frames
  const remoteStability = useFrameStability()

  // Track last stable value for remote camera to avoid duplicate callbacks
  const lastRemoteStableValueRef = useRef<number | null>(null)

  // Throttle remote frame processing
  const lastRemoteInferenceTimeRef = useRef<number>(0)
  const REMOTE_INFERENCE_INTERVAL_MS = 100 // 10fps

  // Track last reported configuration to avoid redundant callbacks
  const lastReportedCameraRef = useRef<string | null>(null)
  const lastReportedCalibrationRef = useRef<CalibrationGrid | null>(null)
  const lastReportedRemoteSessionRef = useRef<string | null>(null)

  // Initialize remote camera session from localStorage on mount
  // IMPORTANT: Must complete before rendering RemoteCameraQRCode to prevent race condition
  useEffect(() => {
    const persistedSessionId = remoteGetPersistedSessionId()
    if (persistedSessionId) {
      console.log('[AbacusVisionBridge] Found persisted remote session:', persistedSessionId)
      setRemoteCameraSessionId(persistedSessionId)
      // Also notify parent about the persisted session
      // This ensures the parent context stays in sync with localStorage
      onConfigurationChange?.({ remoteCameraSessionId: persistedSessionId })
    }
    // Mark that we've checked - now safe to render RemoteCameraQRCode
    setHasCheckedPersistence(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteGetPersistedSessionId]) // onConfigurationChange is intentionally omitted - only run on mount

  // Handle switching to phone camera
  const handleCameraSourceChange = useCallback(
    (source: CameraSource) => {
      setCameraSource(source)
      if (source === 'phone') {
        // Stop local camera
        vision.disable()
        // Set active camera source to phone and clear local camera config
        // (but keep local config in storage for when we switch back)
        onConfigurationChange?.({ activeCameraSource: 'phone' })
        // Check for persisted session and reuse it
        const persistedSessionId = remoteGetPersistedSessionId()
        if (persistedSessionId) {
          console.log('[AbacusVisionBridge] Reusing persisted remote session:', persistedSessionId)
          setRemoteCameraSessionId(persistedSessionId)
          // Notify parent about the reused session
          onConfigurationChange?.({
            remoteCameraSessionId: persistedSessionId,
          })
        }
        // If no persisted session, RemoteCameraQRCode will create one
      } else {
        // Switching to local camera
        // Set active camera source to local
        // The remote session still persists in localStorage (via useRemoteCameraDesktop) for when we switch back
        setRemoteCameraSessionId(null)
        onConfigurationChange?.({ activeCameraSource: 'local' })
        vision.enable()
      }
    },
    [vision, onConfigurationChange, remoteGetPersistedSessionId]
  )

  // Handle starting a fresh session (clear persisted and create new)
  const handleStartFreshSession = useCallback(() => {
    remoteClearSession()
    setRemoteCameraSessionId(null)
  }, [remoteClearSession])

  // Handle session created by QR code component
  const handleRemoteSessionCreated = useCallback((sessionId: string) => {
    setRemoteCameraSessionId(sessionId)
  }, [])

  // Subscribe to remote camera session when sessionId changes
  useEffect(() => {
    if (remoteCameraSessionId && cameraSource === 'phone') {
      remoteSubscribe(remoteCameraSessionId)
      return () => remoteUnsubscribe()
    }
  }, [remoteCameraSessionId, cameraSource, remoteSubscribe, remoteUnsubscribe])

  // Handle remote camera mode change
  const handleRemoteModeChange = useCallback(
    (mode: 'auto' | 'manual') => {
      setRemoteCalibrationMode(mode)
      if (mode === 'auto') {
        // Tell phone to use its auto-calibration (cropped frames)
        remoteSetPhoneFrameMode('cropped')
        setRemoteIsCalibrating(false)
        // Clear desktop calibration on phone so it goes back to auto-detection
        remoteClearCalibration()
        setRemoteCalibration(null)
      } else {
        // Tell phone to send raw frames for desktop calibration
        remoteSetPhoneFrameMode('raw')
      }
    },
    [remoteSetPhoneFrameMode, remoteClearCalibration]
  )

  // Start remote camera calibration
  const handleRemoteStartCalibration = useCallback(() => {
    remoteSetPhoneFrameMode('raw')
    setRemoteIsCalibrating(true)
    // Initialize editing corners/dividers from existing calibration or defaults
    // Compute corners first so we can send them to phone immediately
    let corners: QuadCorners
    let dividers: number[]
    if (remoteCalibration?.corners) {
      corners = remoteCalibration.corners
      dividers = remoteCalibration.columnDividers ?? getDefaultDividers(columnCount)
    } else if (remoteVideoDimensions) {
      corners = getDefaultCorners(remoteVideoDimensions.width, remoteVideoDimensions.height)
      dividers = getDefaultDividers(columnCount)
    } else {
      // No video dimensions yet, can't initialize
      return
    }
    setRemoteEditingCorners(corners)
    setRemoteEditingDividers(dividers)
    // Send initial calibration to phone so overlay shows immediately
    remoteSendCalibration(corners, columnCount, true)
  }, [
    remoteSetPhoneFrameMode,
    remoteCalibration,
    remoteVideoDimensions,
    columnCount,
    remoteSendCalibration,
  ])

  // Complete remote camera calibration (build grid from editing state)
  const handleRemoteCalibrationComplete = useCallback(() => {
    if (!remoteEditingCorners || !remoteEditingDividers) return

    const grid: CalibrationGrid = {
      roi: cornersToROI(remoteEditingCorners),
      corners: remoteEditingCorners,
      columnCount,
      columnDividers: remoteEditingDividers,
      rotation: 0,
    }
    setRemoteCalibration(grid)
    setRemoteIsCalibrating(false)
    setRemoteEditingCorners(null)
    setRemoteEditingDividers(null)
    // Send calibration to phone
    remoteSendCalibration(remoteEditingCorners, columnCount)
  }, [remoteEditingCorners, remoteEditingDividers, columnCount, remoteSendCalibration])

  // Cancel remote camera calibration
  const handleRemoteCancelCalibration = useCallback(() => {
    setRemoteIsCalibrating(false)
    setRemoteEditingCorners(null)
    setRemoteEditingDividers(null)
    // Go back to previous mode
    if (remoteCalibrationMode === 'auto') {
      remoteSetPhoneFrameMode('cropped')
    }
  }, [remoteCalibrationMode, remoteSetPhoneFrameMode])

  // Rotate remote calibration corners (with animation)
  const handleRemoteRotate = useCallback(
    (direction: 'left' | 'right') => {
      // Don't start a new animation if one is already in progress
      if (remoteRotationAnimation || !remoteEditingCorners) return

      const endCorners = rotateCorners(remoteEditingCorners, direction)
      setRemoteRotationAnimation({
        startCorners: remoteEditingCorners,
        endCorners,
        startTime: performance.now(),
      })
    },
    [remoteRotationAnimation, remoteEditingCorners]
  )

  // Animate remote rotation
  useEffect(() => {
    if (!remoteRotationAnimation) return

    let animationId: number

    const animate = () => {
      const elapsed = performance.now() - remoteRotationAnimation.startTime
      const progress = Math.min(elapsed / ROTATION_DURATION_MS, 1)
      const easedProgress = easeOutCubic(progress)

      const interpolatedCorners = lerpCorners(
        remoteRotationAnimation.startCorners,
        remoteRotationAnimation.endCorners,
        easedProgress
      )

      setRemoteEditingCorners(interpolatedCorners)
      setCalibrationCorners(interpolatedCorners) // Update preview

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        // Animation complete - ensure we're exactly at the end position
        setRemoteEditingCorners(remoteRotationAnimation.endCorners)
        setCalibrationCorners(remoteRotationAnimation.endCorners)
        setRemoteRotationAnimation(null)
        // Send rotated corners to phone for cropped preview
        remoteSendCalibrationRef.current(
          remoteRotationAnimation.endCorners,
          columnCountRef.current,
          true
        )
      }
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [remoteRotationAnimation])

  // Initialize remote editing corners when dimensions become available during calibration
  useEffect(() => {
    if (remoteIsCalibrating && remoteVideoDimensions && !remoteEditingCorners) {
      if (remoteCalibration?.corners) {
        setRemoteEditingCorners(remoteCalibration.corners)
        setRemoteEditingDividers(
          remoteCalibration.columnDividers ?? getDefaultDividers(columnCount)
        )
      } else {
        setRemoteEditingCorners(
          getDefaultCorners(remoteVideoDimensions.width, remoteVideoDimensions.height)
        )
        setRemoteEditingDividers(getDefaultDividers(columnCount))
      }
    }
  }, [
    remoteIsCalibrating,
    remoteVideoDimensions,
    remoteEditingCorners,
    remoteCalibration,
    columnCount,
  ])

  // Reset remote calibration
  const handleRemoteResetCalibration = useCallback(() => {
    setRemoteCalibration(null)
    remoteSetPhoneFrameMode('cropped')
  }, [remoteSetPhoneFrameMode])

  // Start camera on mount (only for local source)
  useEffect(() => {
    if (cameraSource === 'local') {
      vision.enable()
    }
    return () => vision.disable()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount/unmount - vision functions are stable

  // Report errors
  useEffect(() => {
    if (vision.cameraError && onError) {
      onError(vision.cameraError)
    }
  }, [vision.cameraError, onError])

  // Notify about local camera device changes and ensure activeCameraSource is set
  useEffect(() => {
    if (
      cameraSource === 'local' &&
      vision.selectedDeviceId &&
      vision.selectedDeviceId !== lastReportedCameraRef.current
    ) {
      lastReportedCameraRef.current = vision.selectedDeviceId
      // Set both the camera device ID and the active camera source
      onConfigurationChange?.({
        cameraDeviceId: vision.selectedDeviceId,
        activeCameraSource: 'local',
      })
    }
  }, [cameraSource, vision.selectedDeviceId, onConfigurationChange])

  // Notify about local calibration changes
  useEffect(() => {
    if (
      cameraSource === 'local' &&
      vision.calibrationGrid &&
      vision.calibrationGrid !== lastReportedCalibrationRef.current
    ) {
      lastReportedCalibrationRef.current = vision.calibrationGrid
      onConfigurationChange?.({ calibration: vision.calibrationGrid })
    }
  }, [cameraSource, vision.calibrationGrid, onConfigurationChange])

  // Notify about remote camera session changes
  // Reset the lastReportedRemoteSessionRef when switching away from phone camera
  // so that the next time we switch to phone, we'll notify the parent again
  useEffect(() => {
    if (cameraSource !== 'phone') {
      // When switching away from phone camera, reset the ref
      // This ensures we'll notify the parent again when switching back
      lastReportedRemoteSessionRef.current = null
    } else if (
      remoteCameraSessionId &&
      remoteCameraSessionId !== lastReportedRemoteSessionRef.current
    ) {
      lastReportedRemoteSessionRef.current = remoteCameraSessionId
      onConfigurationChange?.({ remoteCameraSessionId })
    }
  }, [cameraSource, remoteCameraSessionId, onConfigurationChange])

  // Notify about remote calibration changes (manual mode)
  useEffect(() => {
    if (
      cameraSource === 'phone' &&
      remoteCalibration &&
      remoteCalibration !== lastReportedCalibrationRef.current
    ) {
      lastReportedCalibrationRef.current = remoteCalibration
      onConfigurationChange?.({ calibration: remoteCalibration })
    }
  }, [cameraSource, remoteCalibration, onConfigurationChange])

  // Process remote camera frames through CV pipeline
  useEffect(() => {
    // Only process when using phone camera and connected
    if (cameraSource !== 'phone' || !remoteIsPhoneConnected || !remoteLatestFrame) {
      return
    }

    // Don't process during calibration
    if (remoteIsCalibrating) {
      return
    }

    // In manual mode, need calibration to process
    if (remoteCalibrationMode === 'manual' && !remoteCalibration) {
      return
    }

    // Throttle processing
    const now = performance.now()
    if (now - lastRemoteInferenceTimeRef.current < REMOTE_INFERENCE_INTERVAL_MS) {
      return
    }
    lastRemoteInferenceTimeRef.current = now

    // Get image element
    const image = remoteImageRef.current
    if (!image || !image.complete || image.naturalWidth === 0) {
      return
    }

    // Determine calibration to use
    // In auto mode (cropped frames), no calibration needed - phone already cropped
    // In manual mode, use the desktop calibration
    const calibration = remoteCalibrationMode === 'auto' ? null : remoteCalibration

    // Process frame through CV pipeline
    const columnImages = processImageFrame(image, calibration, columnCount)
    if (columnImages.length === 0) return

    // Run CV-based bead detection
    const analyses = analyzeColumns(columnImages)
    const { digits, minConfidence } = analysesToDigits(analyses)

    // Convert digits to number
    const detectedValue = digits.reduce((acc, d) => acc * 10 + d, 0)

    // Log for debugging
    console.log(
      '[Remote CV] Bead analysis:',
      analyses.map((a) => ({
        digit: a.digit,
        conf: a.confidence.toFixed(2),
        heaven: a.heavenActive ? '5' : '0',
        earth: a.earthActiveCount,
      }))
    )

    // Push to stability buffer
    remoteStability.pushFrame(detectedValue, minConfidence)
  }, [
    cameraSource,
    remoteIsPhoneConnected,
    remoteLatestFrame,
    remoteIsCalibrating,
    remoteCalibrationMode,
    remoteCalibration,
    columnCount,
    remoteStability,
  ])

  // Notify when remote stable value changes
  useEffect(() => {
    if (
      cameraSource === 'phone' &&
      remoteStability.stableValue !== null &&
      remoteStability.stableValue !== lastRemoteStableValueRef.current
    ) {
      lastRemoteStableValueRef.current = remoteStability.stableValue
      onValueDetected(remoteStability.stableValue)
    }
  }, [cameraSource, remoteStability.stableValue, onValueDetected])

  // Load OpenCV when calibrating (local or remote)
  useEffect(() => {
    const isCalibrating = vision.isCalibrating || remoteIsCalibrating
    if (isCalibrating && !opencvReady) {
      loadOpenCV()
        .then(() => setOpencvReady(true))
        .catch((err) => console.error('Failed to load OpenCV:', err))
    }
  }, [vision.isCalibrating, remoteIsCalibrating, opencvReady])

  // Track remote image container dimensions for calibration overlay
  useEffect(() => {
    const container = remoteFeedContainerRef.current
    if (!container || !remoteIsCalibrating) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setRemoteContainerDimensions({
          width: rect.width,
          height: rect.height,
        })
      }
    }

    // Update immediately
    updateDimensions()

    // Also update on resize
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [remoteIsCalibrating, remoteLatestFrame])

  // Render preview when calibrating
  useEffect(() => {
    if (
      !vision.isCalibrating ||
      !calibrationCorners ||
      !videoRef.current ||
      !previewCanvasRef.current
    ) {
      return
    }

    let running = true
    const video = videoRef.current
    const canvas = previewCanvasRef.current

    const drawPreview = () => {
      if (!running || video.readyState < 2) {
        if (running) requestAnimationFrame(drawPreview)
        return
      }

      if (opencvReady && isOpenCVReady()) {
        rectifyQuadrilateral(video, calibrationCorners, canvas, {
          outputWidth: 200,
          outputHeight: 133,
        })
      }

      requestAnimationFrame(drawPreview)
    }

    drawPreview()
    return () => {
      running = false
    }
  }, [vision.isCalibrating, calibrationCorners, opencvReady])

  // Handle video ready - get dimensions
  const handleVideoReady = useCallback(
    (width: number, height: number) => {
      const feedContainer = cameraFeedContainerRef.current
      if (!feedContainer) return

      const rect = feedContainer.getBoundingClientRect()
      setVideoDimensions({
        width,
        height,
        containerWidth: rect.width,
        containerHeight: rect.height,
      })

      // Initialize calibration with default grid if not already calibrated
      if (!vision.isCalibrated) {
        // Will start calibration on user action
      }
    },
    [vision.isCalibrated]
  )

  // Update container dimensions when container resizes (e.g., when entering/exiting calibration mode)
  useEffect(() => {
    const feedContainer = cameraFeedContainerRef.current
    if (!feedContainer || !videoDimensions) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        // Only update if dimensions actually changed
        if (
          width !== videoDimensions.containerWidth ||
          height !== videoDimensions.containerHeight
        ) {
          setVideoDimensions((prev) =>
            prev
              ? {
                  ...prev,
                  containerWidth: width,
                  containerHeight: height,
                }
              : null
          )
        }
      }
    })

    resizeObserver.observe(feedContainer)
    return () => resizeObserver.disconnect()
  }, [videoDimensions?.containerWidth, videoDimensions?.containerHeight])

  // Initialize local editing state when calibration starts
  useEffect(() => {
    if (vision.isCalibrating && videoDimensions) {
      if (vision.calibrationGrid?.corners) {
        setLocalEditingCorners(vision.calibrationGrid.corners)
        setLocalEditingDividers(
          vision.calibrationGrid.columnDividers ?? getDefaultDividers(columnCount)
        )
      } else {
        setLocalEditingCorners(getDefaultCorners(videoDimensions.width, videoDimensions.height))
        setLocalEditingDividers(getDefaultDividers(columnCount))
      }
    } else if (!vision.isCalibrating) {
      setLocalEditingCorners(null)
      setLocalEditingDividers(null)
    }
  }, [vision.isCalibrating, vision.calibrationGrid, videoDimensions, columnCount])

  // Handle calibration complete (build grid from editing state)
  const handleLocalCalibrationComplete = useCallback(() => {
    if (!localEditingCorners || !localEditingDividers) return

    const grid: CalibrationGrid = {
      roi: cornersToROI(localEditingCorners),
      corners: localEditingCorners,
      columnCount,
      columnDividers: localEditingDividers,
      rotation: 0,
    }
    vision.finishCalibration(grid)
    setLocalEditingCorners(null)
    setLocalEditingDividers(null)
  }, [localEditingCorners, localEditingDividers, columnCount, vision])

  // Rotate local calibration corners (with animation)
  const handleLocalRotate = useCallback(
    (direction: 'left' | 'right') => {
      // Don't start a new animation if one is already in progress
      if (localRotationAnimation || !localEditingCorners) return

      const endCorners = rotateCorners(localEditingCorners, direction)
      setLocalRotationAnimation({
        startCorners: localEditingCorners,
        endCorners,
        startTime: performance.now(),
      })
    },
    [localRotationAnimation, localEditingCorners]
  )

  // Animate local rotation
  useEffect(() => {
    if (!localRotationAnimation) return

    let animationId: number

    const animate = () => {
      const elapsed = performance.now() - localRotationAnimation.startTime
      const progress = Math.min(elapsed / ROTATION_DURATION_MS, 1)
      const easedProgress = easeOutCubic(progress)

      const interpolatedCorners = lerpCorners(
        localRotationAnimation.startCorners,
        localRotationAnimation.endCorners,
        easedProgress
      )

      setLocalEditingCorners(interpolatedCorners)
      setCalibrationCorners(interpolatedCorners) // Update preview

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        // Animation complete - ensure we're exactly at the end position
        setLocalEditingCorners(localRotationAnimation.endCorners)
        setCalibrationCorners(localRotationAnimation.endCorners)
        setLocalRotationAnimation(null)
      }
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [localRotationAnimation])

  // Camera selector
  const handleCameraSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      vision.selectCamera(e.target.value)
    },
    [vision]
  )

  // Determine if any calibration is active
  const isCalibrating = vision.isCalibrating || remoteIsCalibrating

  // Drag controls allow dragging from header even during calibration
  const dragControls = useDragControls()

  return (
    <motion.div
      ref={containerRef}
      data-component="abacus-vision-bridge"
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.1}
      // Keep modal within parent container bounds
      dragConstraints={dragConstraintRef}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 3,
        bg: 'gray.900',
        borderRadius: 'xl',
        maxWidth: '400px',
        width: '100%',
        // Constrain height to fit on small screens (leaving room for buttons)
        // Using dvh for mobile-friendly dynamic viewport, with vh fallback
        maxHeight: 'calc(100dvh - 140px)',
        overflow: 'auto',
      })}
    >
      {/* Header - drag handle for repositioning modal */}
      <div
        data-element="header"
        onPointerDown={(e) => dragControls.start(e)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
          touchAction: 'none',
          _active: { cursor: 'grabbing' },
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span className={css({ fontSize: 'lg' })}>{isCalibrating ? '✂️' : '📷'}</span>
          <span className={css({ color: 'white', fontWeight: 'medium' })}>
            {isCalibrating ? 'Adjust Crop Region' : 'Abacus Vision'}
          </span>
          {!isCalibrating && vision.isDeskViewDetected && (
            <span
              className={css({
                px: 2,
                py: 0.5,
                bg: 'green.900',
                color: 'green.300',
                fontSize: 'xs',
                borderRadius: 'full',
              })}
            >
              Desk View
            </span>
          )}
        </div>
        {/* Show close button only when not calibrating (Cancel is in overlay) */}
        {!isCalibrating && (
          <button
            type="button"
            onClick={onClose}
            className={css({
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'gray.700',
              color: 'white',
              border: 'none',
              borderRadius: 'full',
              cursor: 'pointer',
              fontSize: 'lg',
              _hover: { bg: 'gray.600' },
            })}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Camera feed - HERO ELEMENT */}
      <div
        ref={cameraFeedContainerRef}
        data-element="camera-feed-container"
        data-calibrating={isCalibrating ? 'true' : 'false'}
        className={css({
          position: 'relative',
          // Fixed aspect ratio container - content inside uses object-fit: contain
          aspectRatio: '4/3',
          // Expand height during calibration for easier corner dragging
          maxHeight: isCalibrating ? 'min(60vh, 450px)' : 'min(40vh, 300px)',
          borderRadius: 'lg',
          overflow: 'hidden',
          bg: 'gray.800',
          transition: 'max-height 0.2s ease-out',
        })}
      >
        {cameraSource === 'local' ? (
          <>
            <VisionCameraFeed
              videoStream={vision.videoStream}
              isLoading={vision.isCameraLoading}
              calibration={vision.calibrationGrid}
              showCalibrationGrid={!vision.isCalibrating && !vision.isCalibrated}
              showRectifiedView={vision.isCalibrated && !vision.isCalibrating}
              videoRef={(el) => {
                videoRef.current = el
              }}
              onVideoReady={handleVideoReady}
            >
              {/* Calibration quad editor when calibrating (SVG + handles only) */}
              {vision.isCalibrating &&
                videoDimensions &&
                localEditingCorners &&
                localEditingDividers && (
                  <CalibrationQuadEditor
                    columnCount={columnCount}
                    videoWidth={videoDimensions.width}
                    videoHeight={videoDimensions.height}
                    containerWidth={videoDimensions.containerWidth}
                    containerHeight={videoDimensions.containerHeight}
                    corners={localEditingCorners}
                    columnDividers={localEditingDividers}
                    onCornersChange={(corners) => {
                      setLocalEditingCorners(corners)
                      setCalibrationCorners(corners)
                    }}
                    onDividersChange={setLocalEditingDividers}
                  />
                )}
            </VisionCameraFeed>

            {/* Status indicator */}
            {vision.isEnabled && !vision.isCalibrating && (
              <div
                className={css({
                  position: 'absolute',
                  top: 2,
                  left: 2,
                })}
              >
                <VisionStatusIndicator
                  isCalibrated={vision.isCalibrated}
                  isDetecting={vision.isDetecting}
                  confidence={vision.confidence}
                  handDetected={vision.isHandDetected}
                  detectedValue={vision.currentDetectedValue}
                  consecutiveFrames={vision.consecutiveFrames}
                  minFrames={DEFAULT_STABILITY_CONFIG.minConsecutiveFrames}
                />
              </div>
            )}

            {/* Toolbar docked to feed - local camera */}
            {!vision.isCalibrating && (
              <div
                data-element="feed-toolbar"
                className={css({
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  p: 2,
                  bg: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(4px)',
                })}
              >
                {/* Camera selector - compact */}
                {vision.availableDevices.length > 0 && (
                  <select
                    data-element="camera-selector"
                    value={vision.selectedDeviceId ?? ''}
                    onChange={handleCameraSelect}
                    className={css({
                      flex: 1,
                      py: 1.5,
                      px: 2,
                      bg: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: '1px solid',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 'md',
                      fontSize: 'xs',
                      maxWidth: '180px',
                      cursor: 'pointer',
                    })}
                  >
                    {vision.availableDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                )}

                {/* Toolbar buttons */}
                <div className={css({ display: 'flex', gap: 1 })}>
                  {/* Flip camera */}
                  {vision.availableDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => vision.flipCamera()}
                      data-action="flip-camera"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        bg: 'rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        fontSize: 'md',
                        _hover: { bg: 'rgba(255, 255, 255, 0.25)' },
                      })}
                      title={`Switch to ${vision.facingMode === 'environment' ? 'front' : 'back'} camera`}
                    >
                      🔄
                    </button>
                  )}

                  {/* Torch toggle */}
                  {vision.isTorchAvailable && (
                    <button
                      type="button"
                      onClick={() => vision.toggleTorch()}
                      data-action="toggle-torch"
                      data-status={vision.isTorchOn ? 'on' : 'off'}
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        bg: vision.isTorchOn ? 'yellow.600' : 'rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        fontSize: 'md',
                        _hover: {
                          bg: vision.isTorchOn ? 'yellow.500' : 'rgba(255, 255, 255, 0.25)',
                        },
                      })}
                      title={vision.isTorchOn ? 'Turn off flash' : 'Turn on flash'}
                    >
                      {vision.isTorchOn ? '🔦' : '💡'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Phone camera feed */
          <div
            data-element="phone-camera-feed"
            className={css({
              position: 'absolute',
              inset: 0,
              bg: 'gray.800',
              borderRadius: 'lg',
              userSelect: 'none',
            })}
          >
            {!hasCheckedPersistence ? (
              /* Still checking localStorage for persisted session - show loading state */
              <div
                className={css({
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'gray.400',
                  fontSize: 'sm',
                })}
              >
                Loading...
              </div>
            ) : !remoteCameraSessionId ? (
              /* Show QR code to connect phone */
              <div
                className={css({
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  p: 3,
                })}
              >
                <RemoteCameraQRCode
                  onSessionCreated={handleRemoteSessionCreated}
                  size={120}
                  compact
                />
                <p
                  className={css({
                    color: 'gray.400',
                    fontSize: 'xs',
                    textAlign: 'center',
                  })}
                >
                  Scan with your phone
                </p>
              </div>
            ) : !remoteIsPhoneConnected ? (
              /* Waiting for phone - show QR code with URL for copy/paste */
              <div
                className={css({
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  p: 2,
                })}
              >
                <RemoteCameraQRCode
                  onSessionCreated={handleRemoteSessionCreated}
                  existingSessionId={remoteCameraSessionId}
                  size={120}
                  compact
                />
                <CompactUrlCopy sessionId={remoteCameraSessionId} />
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    color: remoteIsReconnecting ? 'blue.300' : 'gray.400',
                    fontSize: 'xs',
                  })}
                >
                  <span
                    className={css({
                      width: 1.5,
                      height: 1.5,
                      borderRadius: 'full',
                      bg: remoteIsReconnecting ? 'blue.400' : 'gray.500',
                      animation: 'pulse 1.5s infinite',
                    })}
                  />
                  {remoteIsReconnecting ? 'Reconnecting...' : 'Waiting for phone'}
                  <span className={css({ color: 'gray.600' })}>·</span>
                  <button
                    type="button"
                    onClick={handleStartFreshSession}
                    className={css({
                      color: 'gray.500',
                      bg: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'xs',
                      textDecoration: 'underline',
                      _hover: { color: 'gray.300' },
                    })}
                  >
                    new session
                  </button>
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
                </div>
              </div>
            ) : (
              /* Show camera frames */
              <div
                ref={remoteFeedContainerRef}
                className={css({
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {/* During calibration, prefer raw frames for the editing view */}
                {(() => {
                  const frameToShow = remoteIsCalibrating
                    ? remoteLatestRawFrame || remoteLatestFrame
                    : remoteLatestFrame
                  if (frameToShow) {
                    return (
                      <img
                        ref={remoteImageRef}
                        src={`data:image/jpeg;base64,${frameToShow.imageData}`}
                        alt="Remote camera view"
                        className={css({
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          display: 'block',
                        })}
                      />
                    )
                  }
                  return (
                    <div
                      className={css({
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'gray.400',
                      })}
                    >
                      Waiting for frames...
                    </div>
                  )
                })()}

                {/* Calibration quad editor when calibrating (SVG + handles only) */}
                {remoteIsCalibrating &&
                  remoteVideoDimensions &&
                  remoteContainerDimensions &&
                  remoteEditingCorners &&
                  remoteEditingDividers && (
                    <CalibrationQuadEditor
                      columnCount={columnCount}
                      videoWidth={remoteVideoDimensions.width}
                      videoHeight={remoteVideoDimensions.height}
                      containerWidth={remoteContainerDimensions.width}
                      containerHeight={remoteContainerDimensions.height}
                      corners={remoteEditingCorners}
                      columnDividers={remoteEditingDividers}
                      onCornersChange={(corners) => {
                        setRemoteEditingCorners(corners)
                        setCalibrationCorners(corners)
                        // Send preview calibration to phone so it can generate cropped preview
                        // preview=true keeps phone in raw mode while sending cropped previews
                        remoteSendCalibration(corners, columnCount, true)
                      }}
                      onDividersChange={setRemoteEditingDividers}
                    />
                  )}


                {/* Detection status indicator */}
                {!remoteIsCalibrating && (
                  <div
                    className={css({
                      position: 'absolute',
                      top: 2,
                      left: 2,
                    })}
                  >
                    <VisionStatusIndicator
                      isCalibrated={remoteCalibrationMode === 'auto' || remoteCalibration !== null}
                      isDetecting={remoteLatestFrame !== null}
                      confidence={remoteStability.currentConfidence}
                      handDetected={remoteStability.isHandDetected}
                      detectedValue={remoteStability.stableValue}
                      consecutiveFrames={remoteStability.consecutiveFrames}
                      minFrames={DEFAULT_STABILITY_CONFIG.minConsecutiveFrames}
                    />
                  </div>
                )}

                {/* Toolbar docked to feed - phone camera */}
                {!remoteIsCalibrating && (
                  <div
                    data-element="feed-toolbar"
                    className={css({
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      p: 2,
                      bg: 'rgba(0, 0, 0, 0.6)',
                      backdropFilter: 'blur(4px)',
                    })}
                  >
                    {/* Connection status */}
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        fontSize: 'xs',
                        color: 'white',
                      })}
                    >
                      <span
                        className={css({
                          width: 2,
                          height: 2,
                          borderRadius: 'full',
                          bg: 'green.500',
                        })}
                      />
                      {remoteFrameRate} fps
                    </div>

                    {/* Toolbar buttons */}
                    <div className={css({ display: 'flex', gap: 1 })}>
                      {/* Torch toggle - if available on phone */}
                      {remoteIsTorchAvailable && (
                        <button
                          type="button"
                          onClick={() => setRemoteTorch(!remoteIsTorchOn)}
                          data-action="toggle-torch"
                          data-status={remoteIsTorchOn ? 'on' : 'off'}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            bg: remoteIsTorchOn ? 'yellow.600' : 'rgba(255, 255, 255, 0.15)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'md',
                            cursor: 'pointer',
                            fontSize: 'md',
                            _hover: {
                              bg: remoteIsTorchOn ? 'yellow.500' : 'rgba(255, 255, 255, 0.25)',
                            },
                          })}
                          title={remoteIsTorchOn ? 'Turn off flash' : 'Turn on flash'}
                        >
                          {remoteIsTorchOn ? '🔦' : '💡'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calibration controls area (local camera) */}
      {cameraSource === 'local' && vision.isCalibrating && (
        <div
          data-element="calibration-preview"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            p: 3,
            bg: 'gray.800',
            borderRadius: 'md',
          })}
        >
          {/* Instructions and preview row */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: 3,
            })}
          >
            {/* Preview canvas */}
            <div className={css({ flexShrink: 0 })}>
              <canvas
                ref={previewCanvasRef}
                className={css({
                  borderRadius: 'sm',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  bg: 'gray.900',
                })}
                width={120}
                height={80}
              />
            </div>

            {/* Instructions */}
            <div
              data-element="calibration-instructions"
              className={css({
                fontSize: 'xs',
                color: 'gray.400',
                lineHeight: 1.5,
              })}
            >
              <p>Drag inside to move. Drag corners to resize.</p>
              <p className={css({ color: 'yellow.400' })}>Yellow lines = column dividers</p>
            </div>
          </div>

          {/* Control buttons row */}
          <div
            data-element="calibration-controls"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            })}
          >
            {/* Rotate buttons */}
            <div className={css({ display: 'flex', gap: 1 })}>
              <button
                type="button"
                onClick={() => handleLocalRotate('left')}
                data-action="rotate-left"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  bg: 'gray.700',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  fontSize: 'md',
                  _hover: { bg: 'gray.600' },
                })}
                title="Rotate left 90°"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={() => handleLocalRotate('right')}
                data-action="rotate-right"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  bg: 'gray.700',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  fontSize: 'md',
                  _hover: { bg: 'gray.600' },
                })}
                title="Rotate right 90°"
              >
                ↷
              </button>
            </div>

            {/* Cancel / Done buttons */}
            <div className={css({ display: 'flex', gap: 2 })}>
              <button
                type="button"
                onClick={vision.cancelCalibration}
                data-action="cancel-calibration"
                className={css({
                  px: 3,
                  py: 2,
                  bg: 'gray.700',
                  color: 'gray.300',
                  border: 'none',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  _hover: { bg: 'gray.600' },
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLocalCalibrationComplete}
                data-action="complete-calibration"
                className={css({
                  px: 3,
                  py: 2,
                  bg: 'green.600',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { bg: 'green.500' },
                })}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calibration controls area (phone camera) */}
      {cameraSource === 'phone' && remoteIsCalibrating && (
        <div
          data-element="calibration-preview"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            p: 3,
            bg: 'gray.800',
            borderRadius: 'md',
          })}
        >
          {/* Instructions and preview row */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: 3,
            })}
          >
            {/* Cropped preview image */}
            <div data-element="cropped-preview" className={css({ flexShrink: 0 })}>
              {remoteLatestCroppedFrame ? (
                <img
                  src={`data:image/jpeg;base64,${remoteLatestCroppedFrame.imageData}`}
                  alt="Cropped preview"
                  className={css({
                    width: '120px',
                    height: '160px',
                    borderRadius: 'sm',
                    border: '1px solid',
                    borderColor: 'gray.600',
                    bg: 'gray.900',
                    objectFit: 'contain',
                  })}
                />
              ) : (
                <div
                  className={css({
                    width: '120px',
                    height: '160px',
                    borderRadius: 'sm',
                    border: '1px dashed',
                    borderColor: 'gray.600',
                    bg: 'gray.900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    color: 'gray.500',
                    textAlign: 'center',
                    p: 2,
                  })}
                >
                  Preview will appear here
                </div>
              )}
            </div>

            {/* Instructions */}
            <div
              data-element="calibration-instructions"
              className={css({
                fontSize: 'xs',
                color: 'gray.400',
                lineHeight: 1.5,
              })}
            >
              <p>Drag inside to move. Drag corners to resize.</p>
              <p className={css({ color: 'yellow.400' })}>Yellow lines = column dividers</p>
              <p className={css({ mt: 2 })}>
                The preview shows what will be captured during practice.
              </p>
            </div>
          </div>

          {/* Control buttons row */}
          <div
            data-element="calibration-controls"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            })}
          >
            {/* Rotate buttons */}
            <div className={css({ display: 'flex', gap: 1 })}>
              <button
                type="button"
                onClick={() => handleRemoteRotate('left')}
                data-action="rotate-left"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  bg: 'gray.700',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  fontSize: 'md',
                  _hover: { bg: 'gray.600' },
                })}
                title="Rotate left 90°"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={() => handleRemoteRotate('right')}
                data-action="rotate-right"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  bg: 'gray.700',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  fontSize: 'md',
                  _hover: { bg: 'gray.600' },
                })}
                title="Rotate right 90°"
              >
                ↷
              </button>
            </div>

            {/* Cancel / Done buttons */}
            <div className={css({ display: 'flex', gap: 2 })}>
              <button
                type="button"
                onClick={handleRemoteCancelCalibration}
                data-action="cancel-calibration"
                className={css({
                  px: 3,
                  py: 2,
                  bg: 'gray.700',
                  color: 'gray.300',
                  border: 'none',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  _hover: { bg: 'gray.600' },
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoteCalibrationComplete}
                data-action="complete-calibration"
                className={css({
                  px: 3,
                  py: 2,
                  bg: 'green.600',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { bg: 'green.500' },
                })}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera source selector - segmented tabs (hidden during calibration) */}
      {!isCalibrating && (
        <div
          data-element="source-selector"
          className={css({
            display: 'flex',
            gap: 0,
            bg: 'gray.800',
            borderRadius: 'lg',
            p: 1,
          })}
        >
          <button
            type="button"
            data-source="local"
            data-active={cameraSource === 'local' ? 'true' : 'false'}
            onClick={() => handleCameraSourceChange('local')}
            className={css({
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              py: 2,
              px: 3,
              bg: cameraSource === 'local' ? 'gray.700' : 'transparent',
              color: cameraSource === 'local' ? 'white' : 'gray.400',
              border: 'none',
              borderRadius: 'md',
              cursor: 'pointer',
              fontSize: 'sm',
              fontWeight: cameraSource === 'local' ? 'medium' : 'normal',
              transition: 'all 0.15s',
              _hover: {
                color: 'white',
                bg: cameraSource === 'local' ? 'gray.700' : 'gray.750',
              },
            })}
          >
            <span>💻</span>
            <span>This Device</span>
          </button>
          <button
            type="button"
            data-source="phone"
            data-active={cameraSource === 'phone' ? 'true' : 'false'}
            onClick={() => handleCameraSourceChange('phone')}
            className={css({
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              py: 2,
              px: 3,
              bg: cameraSource === 'phone' ? 'gray.700' : 'transparent',
              color: cameraSource === 'phone' ? 'white' : 'gray.400',
              border: 'none',
              borderRadius: 'md',
              cursor: 'pointer',
              fontSize: 'sm',
              fontWeight: cameraSource === 'phone' ? 'medium' : 'normal',
              transition: 'all 0.15s',
              _hover: {
                color: 'white',
                bg: cameraSource === 'phone' ? 'gray.700' : 'gray.750',
              },
            })}
          >
            <span>📱</span>
            <span>Phone Camera</span>
          </button>
        </div>
      )}

      {/* Crop settings - collapsible (hidden during calibration and when phone not connected) */}
      {!isCalibrating && (cameraSource === 'local' || remoteIsPhoneConnected) && (
        <div
          data-element="crop-settings"
          className={css({
            bg: 'gray.800',
            borderRadius: 'md',
          })}
        >
          {/* Collapsible header - shows summary */}
          <button
            type="button"
            onClick={() => setIsCropSettingsExpanded(!isCropSettingsExpanded)}
            data-element="crop-settings-header"
            className={css({
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              bg: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'white',
              _hover: { bg: 'gray.750' },
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              })}
            >
              <span
                className={css({
                  fontSize: 'xs',
                  color: 'gray.400',
                  transition: 'transform 0.15s',
                  transform: isCropSettingsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                })}
              >
                ▶
              </span>
              <span className={css({ fontSize: 'sm', fontWeight: 'medium' })}>Crop</span>
              <span className={css({ color: 'gray.400', fontSize: 'sm' })}>·</span>
              {/* Status summary */}
              {(cameraSource === 'local' && vision.isCalibrated) ||
              (cameraSource === 'phone' && remoteCalibration) ? (
                <span className={css({ color: 'blue.300', fontSize: 'sm' })}>Manual</span>
              ) : (
                <span
                  className={css({
                    color:
                      cameraSource === 'local'
                        ? vision.markerDetection.allMarkersFound
                          ? 'green.300'
                          : 'yellow.300'
                        : remoteFrameMode === 'cropped'
                          ? 'green.300'
                          : 'yellow.300',
                    fontSize: 'sm',
                  })}
                >
                  {cameraSource === 'local'
                    ? vision.markerDetection.allMarkersFound
                      ? 'Auto'
                      : `${vision.markerDetection.markersFound}/4 markers`
                    : remoteFrameMode === 'cropped'
                      ? 'Auto'
                      : 'Detecting...'}
                </span>
              )}
            </div>
          </button>

          {/* Expanded content */}
          {isCropSettingsExpanded && (
            <div
              data-element="crop-settings-content"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                px: 2,
                pb: 2,
                borderTop: '1px solid',
                borderColor: 'gray.700',
              })}
            >
              {/* Manual crop indicator (if set) */}
              {((cameraSource === 'local' && vision.isCalibrated) ||
                (cameraSource === 'phone' && remoteCalibration)) && (
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pt: 2,
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    })}
                  >
                    <span
                      className={css({
                        width: '8px',
                        height: '8px',
                        borderRadius: 'full',
                        bg: 'blue.400',
                      })}
                    />
                    <span className={css({ color: 'white', fontSize: 'sm' })}>
                      Using manual crop region
                    </span>
                  </div>
                  <div className={css({ display: 'flex', gap: 2 })}>
                    <button
                      type="button"
                      data-action="adjust-crop"
                      onClick={() => {
                        if (cameraSource === 'local') {
                          vision.startCalibration()
                        } else {
                          handleRemoteStartCalibration()
                        }
                      }}
                      className={css({
                        px: 2,
                        py: 1,
                        fontSize: 'xs',
                        bg: 'blue.600',
                        color: 'white',
                        border: '1px solid',
                        borderColor: 'blue.500',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        _hover: { bg: 'blue.500' },
                      })}
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      data-action="reset-to-auto"
                      onClick={() => {
                        if (cameraSource === 'local') {
                          vision.resetCalibration()
                        } else {
                          handleRemoteResetCalibration()
                        }
                      }}
                      className={css({
                        px: 2,
                        py: 1,
                        fontSize: 'xs',
                        bg: 'transparent',
                        color: 'gray.400',
                        border: '1px solid',
                        borderColor: 'gray.600',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        _hover: { borderColor: 'gray.500', color: 'gray.300' },
                      })}
                    >
                      Reset to auto
                    </button>
                  </div>
                </div>
              )}

              {/* Auto crop status (when no manual crop) */}
              {!(
                (cameraSource === 'local' && vision.isCalibrated) ||
                (cameraSource === 'phone' && remoteCalibration)
              ) && (
                <>
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      pt: 2,
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      })}
                    >
                      <span
                        className={css({
                          width: '8px',
                          height: '8px',
                          borderRadius: 'full',
                          bg:
                            cameraSource === 'local'
                              ? vision.markerDetection.allMarkersFound
                                ? 'green.400'
                                : 'yellow.400'
                              : remoteFrameMode === 'cropped'
                                ? 'green.400'
                                : 'yellow.400',
                        })}
                      />
                      <span className={css({ color: 'white', fontSize: 'sm' })}>
                        {cameraSource === 'local'
                          ? vision.markerDetection.allMarkersFound
                            ? 'Auto-crop using markers'
                            : `Looking for markers (${vision.markerDetection.markersFound}/4 found)`
                          : remoteFrameMode === 'cropped'
                            ? 'Phone auto-cropping'
                            : 'Looking for markers...'}
                      </span>
                    </div>
                  </div>

                  {/* Get markers link */}
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    })}
                  >
                    <a
                      href="/create/vision-markers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={css({
                        color: 'blue.300',
                        fontSize: 'sm',
                        textDecoration: 'underline',
                        _hover: { color: 'blue.200' },
                      })}
                    >
                      Print markers →
                    </a>
                  </div>

                  {/* Manual crop button */}
                  {!(cameraSource === 'local' ? vision.isCalibrating : remoteIsCalibrating) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (cameraSource === 'local') {
                          vision.setCalibrationMode('manual')
                          vision.startCalibration()
                        } else {
                          handleRemoteModeChange('manual')
                          handleRemoteStartCalibration()
                        }
                      }}
                      disabled={
                        cameraSource === 'local' ? !vision.videoStream : !remoteIsPhoneConnected
                      }
                      className={css({
                        px: 3,
                        py: 1.5,
                        fontSize: 'sm',
                        bg: 'transparent',
                        color: 'gray.300',
                        border: '1px solid',
                        borderColor: 'gray.600',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        _hover: { borderColor: 'gray.500', bg: 'gray.700' },
                        _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                      })}
                    >
                      Set crop manually instead
                    </button>
                  )}
                </>
              )}

              {/* Troubleshooting - clear all settings */}
              {showVisionControls && isVisionSetupComplete && (
                <div
                  className={css({
                    pt: 2,
                    mt: 2,
                    borderTop: '1px solid',
                    borderColor: 'gray.700',
                  })}
                >
                  <button
                    type="button"
                    data-action="clear-settings"
                    onClick={onClearSettings}
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      bg: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      _hover: { color: 'gray.300' },
                    })}
                  >
                    Clear all settings
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {cameraSource === 'local' && vision.cameraError && (
        <div
          className={css({
            p: 3,
            bg: 'red.900',
            color: 'red.200',
            borderRadius: 'md',
            fontSize: 'sm',
          })}
        >
          {vision.cameraError}
        </div>
      )}

      {/* Vision control buttons (when embedded in modal, hidden during calibration) */}
      {showVisionControls && !isCalibrating && (
        <div
          data-element="vision-controls"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'gray.700',
          })}
        >
          {/* Always show button, but disabled with explanation if setup not complete */}
          <button
            type="button"
            onClick={isVisionSetupComplete ? onToggleVision : undefined}
            disabled={!isVisionSetupComplete}
            className={css({
              px: 4,
              py: 2.5,
              bg: !isVisionSetupComplete ? 'gray.600' : isVisionEnabled ? 'red.600' : 'green.600',
              color: 'white',
              borderRadius: 'lg',
              fontWeight: 'semibold',
              fontSize: 'sm',
              border: 'none',
              cursor: isVisionSetupComplete ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: isVisionSetupComplete ? 1 : 0.7,
              _hover: isVisionSetupComplete
                ? {
                    bg: isVisionEnabled ? 'red.700' : 'green.700',
                    transform: 'scale(1.02)',
                  }
                : {},
            })}
          >
            {isVisionEnabled ? 'Disable Vision' : 'Enable Vision'}
          </button>

          {/* Explanation when setup is not complete */}
          {!isVisionSetupComplete && (
            <p
              data-element="setup-required-message"
              className={css({
                fontSize: 'sm',
                color: 'gray.400',
                textAlign: 'center',
              })}
            >
              {cameraSource === 'local'
                ? 'Waiting for camera access...'
                : !remoteIsPhoneConnected
                  ? 'Connect your phone to enable vision'
                  : 'Setting up camera...'}
            </p>
          )}

          {/* Training data collection disclaimer - only show when setup complete */}
          {isVisionSetupComplete && (
            <div
              data-element="training-data-disclaimer"
              className={css({
                p: 2,
                bg: 'blue.900/50',
                borderRadius: 'md',
                fontSize: '10px',
                color: 'blue.200',
                lineHeight: 1.3,
              })}
            >
              <strong>Training Data:</strong> Column images may be saved on correct answers to
              improve bead detection. No personal data is collected.
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/**
 * Compact URL display with copy button for phone camera connection
 */
function CompactUrlCopy({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)

  // Construct the phone URL
  const getPhoneUrl = (): string => {
    if (typeof window === 'undefined') return ''
    const lanHost = process.env.NEXT_PUBLIC_LAN_HOST
    let baseUrl: string
    if (lanHost) {
      baseUrl = lanHost.startsWith('http') ? lanHost : `https://${lanHost}`
    } else {
      baseUrl = window.location.origin
    }
    return `${baseUrl}/remote-camera/${sessionId}`
  }

  const url = getPhoneUrl()
  // Show shortened URL for display
  const shortUrl = url.replace(/^https?:\/\//, '').slice(0, 30) + '...'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-action="copy-phone-url"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bg: copied ? 'green.700' : 'gray.700',
        border: 'none',
        borderRadius: 'md',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        _hover: { bg: copied ? 'green.600' : 'gray.600' },
      })}
      title={url}
    >
      <span
        className={css({
          fontSize: '10px',
          color: 'gray.300',
          fontFamily: 'mono',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}
      >
        {shortUrl}
      </span>
      <span className={css({ fontSize: 'xs', color: 'white' })}>{copied ? '✓' : '📋'}</span>
    </button>
  )
}

export default AbacusVisionBridge
