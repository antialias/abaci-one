'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAbacusVision } from '@/hooks/useAbacusVision'
import { useFrameStability } from '@/hooks/useFrameStability'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import { analyzeColumns, analysesToDigits } from '@/lib/vision/beadDetector'
import { processImageFrame } from '@/lib/vision/frameProcessor'
import { isOpenCVReady, loadOpenCV, rectifyQuadrilateral } from '@/lib/vision/perspectiveTransform'
import type { CalibrationGrid, QuadCorners } from '@/types/vision'
import { DEFAULT_STABILITY_CONFIG } from '@/types/vision'
import { css } from '../../../styled-system/css'
import { CalibrationOverlay } from './CalibrationOverlay'
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
}

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

  // Remote camera state
  const [remoteCalibrationMode, setRemoteCalibrationMode] = useState<'auto' | 'manual'>('auto')
  const [remoteIsCalibrating, setRemoteIsCalibrating] = useState(false)
  const [remoteCalibration, setRemoteCalibration] = useState<CalibrationGrid | null>(null)

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
  useEffect(() => {
    const persistedSessionId = remoteGetPersistedSessionId()
    if (persistedSessionId) {
      console.log('[AbacusVisionBridge] Found persisted remote session:', persistedSessionId)
      setRemoteCameraSessionId(persistedSessionId)
      // Also notify parent about the persisted session
      // This ensures the parent context stays in sync with localStorage
      onConfigurationChange?.({ remoteCameraSessionId: persistedSessionId })
    }
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
  }, [remoteSetPhoneFrameMode])

  // Complete remote camera calibration
  const handleRemoteCalibrationComplete = useCallback(
    (grid: CalibrationGrid) => {
      setRemoteCalibration(grid)
      setRemoteIsCalibrating(false)
      // Send calibration to phone
      if (grid.corners) {
        remoteSendCalibration(grid.corners)
      }
    },
    [remoteSendCalibration]
  )

  // Cancel remote camera calibration
  const handleRemoteCancelCalibration = useCallback(() => {
    setRemoteIsCalibrating(false)
    // Go back to previous mode
    if (remoteCalibrationMode === 'auto') {
      remoteSetPhoneFrameMode('cropped')
    }
  }, [remoteCalibrationMode, remoteSetPhoneFrameMode])

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
          outputWidth: 300,
          outputHeight: 200,
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

  // Handle calibration complete
  const handleCalibrationComplete = useCallback(
    (grid: Parameters<typeof vision.finishCalibration>[0]) => {
      vision.finishCalibration(grid)
    },
    [vision]
  )

  // Camera selector
  const handleCameraSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      vision.selectCamera(e.target.value)
    },
    [vision]
  )

  // Determine if any calibration is active (disable drag during calibration)
  const isCalibrating = vision.isCalibrating || remoteIsCalibrating

  return (
    <motion.div
      ref={containerRef}
      data-component="abacus-vision-bridge"
      drag={!isCalibrating}
      dragMomentum={false}
      dragElastic={0}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        p: 3,
        bg: 'gray.900',
        borderRadius: 'xl',
        maxWidth: '400px',
        width: '100%',
        cursor: isCalibrating ? 'default' : 'grab',
        _active: { cursor: isCalibrating ? 'default' : 'grabbing' },
      })}
    >
      {/* Header */}
      <div
        data-element="header"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span className={css({ fontSize: 'lg' })}>📷</span>
          <span className={css({ color: 'white', fontWeight: 'medium' })}>Abacus Vision</span>
          {vision.isDeskViewDetected && (
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
      </div>

      {/* Camera feed - HERO ELEMENT */}
      <div
        ref={cameraFeedContainerRef}
        data-element="camera-feed-container"
        className={css({ position: 'relative' })}
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
              {/* Calibration overlay when calibrating */}
              {vision.isCalibrating && videoDimensions && (
                <CalibrationOverlay
                  columnCount={columnCount}
                  videoWidth={videoDimensions.width}
                  videoHeight={videoDimensions.height}
                  containerWidth={videoDimensions.containerWidth}
                  containerHeight={videoDimensions.containerHeight}
                  initialCalibration={vision.calibrationGrid}
                  onComplete={handleCalibrationComplete}
                  onCancel={vision.cancelCalibration}
                  videoElement={videoRef.current}
                  onCornersChange={setCalibrationCorners}
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
              position: 'relative',
              width: '100%',
              bg: 'gray.800',
              borderRadius: 'lg',
              overflow: 'hidden',
              minHeight: '200px',
              userSelect: 'none',
            })}
          >
            {!remoteCameraSessionId ? (
              /* Show QR code to connect phone */
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 6,
                })}
              >
                <RemoteCameraQRCode onSessionCreated={handleRemoteSessionCreated} size={180} />
                <p
                  className={css({
                    color: 'gray.400',
                    fontSize: 'sm',
                    textAlign: 'center',
                    mt: 3,
                  })}
                >
                  Scan with your phone to use it as a camera
                </p>
              </div>
            ) : !remoteIsPhoneConnected ? (
              /* Waiting for phone - 4:3 aspect ratio to match camera feed */
              <div
                className={css({
                  aspectRatio: '4/3',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  p: 4,
                })}
              >
                <RemoteCameraQRCode
                  onSessionCreated={handleRemoteSessionCreated}
                  existingSessionId={remoteCameraSessionId}
                  size={150}
                />
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
              <div ref={remoteFeedContainerRef} className={css({ position: 'relative' })}>
                {remoteLatestFrame ? (
                  <img
                    ref={remoteImageRef}
                    src={`data:image/jpeg;base64,${remoteLatestFrame.imageData}`}
                    alt="Remote camera view"
                    className={css({
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    })}
                  />
                ) : (
                  <div
                    className={css({
                      width: '100%',
                      aspectRatio: '2/1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'gray.400',
                    })}
                  >
                    Waiting for frames...
                  </div>
                )}

                {/* Calibration overlay when calibrating */}
                {remoteIsCalibrating && remoteVideoDimensions && remoteContainerDimensions && (
                  <CalibrationOverlay
                    columnCount={columnCount}
                    videoWidth={remoteVideoDimensions.width}
                    videoHeight={remoteVideoDimensions.height}
                    containerWidth={remoteContainerDimensions.width}
                    containerHeight={remoteContainerDimensions.height}
                    initialCalibration={remoteCalibration}
                    onComplete={handleRemoteCalibrationComplete}
                    onCancel={handleRemoteCancelCalibration}
                    onCornersChange={setCalibrationCorners}
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

      {/* Rectified preview during calibration (local camera only) */}
      {cameraSource === 'local' && vision.isCalibrating && (
        <div
          data-element="calibration-preview"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          })}
        >
          <span className={css({ color: 'gray.400', fontSize: 'xs' })}>Rectified Preview</span>
          <canvas
            ref={previewCanvasRef}
            className={css({
              borderRadius: 'md',
              border: '1px solid',
              borderColor: 'gray.600',
              bg: 'gray.800',
            })}
            width={300}
            height={200}
          />
        </div>
      )}

      {/* Camera source selector - segmented tabs */}
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

      {/* Crop settings - collapsible */}
      <div
        data-element="crop-settings"
        className={css({
          bg: 'gray.800',
          borderRadius: 'md',
          overflow: 'hidden',
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
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
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
                <button
                  type="button"
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

      {/* Vision control buttons (when embedded in modal) */}
      {showVisionControls && (
        <div
          data-element="vision-controls"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            mt: 2,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'gray.700',
          })}
        >
          {isVisionSetupComplete && (
            <button
              type="button"
              onClick={onToggleVision}
              className={css({
                px: 4,
                py: 3,
                bg: isVisionEnabled ? 'red.600' : 'green.600',
                color: 'white',
                borderRadius: 'lg',
                fontWeight: 'semibold',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  bg: isVisionEnabled ? 'red.700' : 'green.700',
                  transform: 'scale(1.02)',
                },
              })}
            >
              {isVisionEnabled ? 'Disable Vision' : 'Enable Vision'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

export default AbacusVisionBridge
