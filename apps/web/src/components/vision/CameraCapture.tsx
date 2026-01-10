'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeskViewCamera } from '@/hooks/useDeskViewCamera'
import { useMarkerDetection } from '@/hooks/useMarkerDetection'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import {
  detectMarkersFromCanvas,
  initArucoDetector,
  isArucoAvailable,
  loadAruco,
} from '@/lib/vision/arucoDetection'
import { css } from '../../../styled-system/css'
import { RemoteCameraQRCode } from './RemoteCameraQRCode'
import { VisionCameraFeed } from './VisionCameraFeed'
import type { CalibrationGrid } from '@/types/vision'

export type CameraSource = 'local' | 'phone'

export interface CameraCaptureProps {
  /** Initial camera source (default: 'local') */
  initialSource?: CameraSource
  /** Called when a frame is captured (either from local video or phone, or rectified canvas) */
  onCapture?: (element: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => void
  /** Called when camera source changes */
  onSourceChange?: (source: CameraSource) => void
  /** Called when phone connection status changes */
  onPhoneConnected?: (connected: boolean) => void
  /** Show source selector tabs (default: true) */
  showSourceSelector?: boolean
  /** Compact mode - smaller QR code, less padding */
  compact?: boolean
  /** Enable ArUco marker detection for auto-calibration (default: false) */
  enableMarkerDetection?: boolean
  /** Number of columns for the abacus (used for calibration grid) */
  columnCount?: number
  /** Called when calibration is updated from marker detection */
  onCalibrationChange?: (calibration: CalibrationGrid | null) => void
  /** Called on each detection frame with current marker visibility (true = all 4 markers found) */
  onMarkersVisible?: (visible: boolean) => void
  /** Show rectified (perspective-corrected) view when calibrated (default: false) */
  showRectifiedView?: boolean
  /**
   * Force phone to send raw (uncropped) frames instead of auto-cropping.
   * Use this for boundary detector training where you need the full frame with markers visible.
   * When true, the phone won't auto-switch to cropped mode when it detects markers.
   * (default: false)
   */
  forceRawMode?: boolean
}

/**
 * CameraCapture - Reusable component for capturing frames from local or phone camera
 *
 * Provides:
 * - Camera source tabs (local/phone)
 * - Local camera feed with device selection
 * - Phone camera via QR code connection
 * - Access to current frame for capture
 *
 * Used by:
 * - TrainingDataCapture (vision training wizard)
 * - AbacusVisionBridge (practice sessions) - uses separate implementation for calibration
 */
export function CameraCapture({
  initialSource = 'local',
  onCapture,
  onSourceChange,
  onPhoneConnected,
  showSourceSelector = true,
  compact = false,
  enableMarkerDetection = false,
  columnCount = 4,
  onCalibrationChange,
  onMarkersVisible,
  showRectifiedView = false,
  forceRawMode = false,
}: CameraCaptureProps) {
  const [cameraSource, setCameraSource] = useState<CameraSource>(initialSource)

  // Local camera
  const camera = useDeskViewCamera()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rectifiedCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Track video element in state so hook can react to it
  // (refs don't trigger re-renders, so we need state for the hook)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

  // ArUco marker detection for LOCAL camera (using shared hook)
  const {
    markersFound: localMarkersFound,
    calibration: localCalibration,
    isCalibrated: localIsCalibrated,
  } = useMarkerDetection({
    enabled: enableMarkerDetection && cameraSource === 'local',
    videoElement,
    columnCount,
    onCalibrationChange,
  })

  // Phone camera marker detection state (runs separately from hook)
  const [phoneMarkersFound, setPhoneMarkersFound] = useState(0)
  const [phoneCalibration, setPhoneCalibration] = useState<CalibrationGrid | null>(null)
  const [arucoReadyForPhone, setArucoReadyForPhone] = useState(false)
  const lastPhoneCalibrationRef = useRef<CalibrationGrid | null>(null)

  // Unified marker detection state based on camera source
  const markersFound = cameraSource === 'local' ? localMarkersFound : phoneMarkersFound
  const calibration = cameraSource === 'local' ? localCalibration : phoneCalibration
  const isCalibrated = cameraSource === 'local' ? localIsCalibrated : phoneCalibration !== null

  // Load ArUco when phone camera is active and marker detection is enabled
  useEffect(() => {
    if (cameraSource !== 'phone' || !enableMarkerDetection) {
      setArucoReadyForPhone(false)
      return
    }

    let cancelled = false

    const initAruco = async () => {
      try {
        await loadAruco()
        if (cancelled) return

        if (isArucoAvailable()) {
          initArucoDetector()
          setArucoReadyForPhone(true)
        }
      } catch (err) {
        console.error('[CameraCapture] Failed to load ArUco for phone:', err)
      }
    }

    initAruco()

    return () => {
      cancelled = true
    }
  }, [cameraSource, enableMarkerDetection])

  // Notify marker visibility changes (all 4 markers = visible)
  useEffect(() => {
    onMarkersVisible?.(markersFound === 4)
  }, [markersFound, onMarkersVisible])

  // Phone camera canvas (for unified capture path)
  const phoneCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Phone camera
  const {
    isPhoneConnected,
    latestFrame,
    frameRate,
    currentSessionId,
    subscribe,
    unsubscribe,
    getPersistedSessionId,
    clearSession,
    setPhoneFrameMode,
    // Note: We use latestFrame.detectedCorners directly instead of phoneDetectedCorners state
    // to ensure corners are always in sync with the frame they came from
  } = useRemoteCameraDesktop()
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Notify phone connection changes
  useEffect(() => {
    if (cameraSource === 'phone') {
      onPhoneConnected?.(isPhoneConnected)
    }
  }, [cameraSource, isPhoneConnected, onPhoneConnected])

  // Request raw mode from phone when forceRawMode is enabled
  // This tells the phone not to auto-crop when it detects markers
  useEffect(() => {
    if (cameraSource === 'phone' && isPhoneConnected && forceRawMode) {
      setPhoneFrameMode('raw')
    }
  }, [cameraSource, isPhoneConnected, forceRawMode, setPhoneFrameMode])

  // Start local camera when source is local
  useEffect(() => {
    if (cameraSource === 'local') {
      camera.requestCamera()
    }
    return () => {
      if (cameraSource === 'local') {
        camera.stopCamera()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraSource])

  // Handle camera source change
  const handleSourceChange = useCallback(
    (source: CameraSource) => {
      if (source === cameraSource) return

      setCameraSource(source)
      onSourceChange?.(source)

      if (source === 'local') {
        // Stop phone camera, start local
        if (currentSessionId) {
          unsubscribe()
        }
        camera.requestCamera()
      } else {
        // Stop local camera
        camera.stopCamera()
        // Check for persisted session
        const persistedSessionId = getPersistedSessionId()
        if (persistedSessionId) {
          setSessionId(persistedSessionId)
        }
      }
    },
    [cameraSource, currentSessionId, unsubscribe, camera, getPersistedSessionId, onSourceChange]
  )

  // Handle session created by QR code
  const handleSessionCreated = useCallback(
    (newSessionId: string) => {
      setSessionId(newSessionId)
      subscribe(newSessionId)
    },
    [subscribe]
  )

  // Subscribe when session is set and source is phone
  useEffect(() => {
    if (sessionId && cameraSource === 'phone' && !currentSessionId) {
      subscribe(sessionId)
    }
  }, [sessionId, cameraSource, currentSessionId, subscribe])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSessionId) {
        unsubscribe()
      }
    }
  }, [currentSessionId, unsubscribe])

  // Start fresh phone session
  const handleStartFreshSession = useCallback(() => {
    clearSession()
    setSessionId(null)
  }, [clearSession])

  // Track rectified canvas element in state for onCapture updates
  const [rectifiedCanvasElement, setRectifiedCanvasElement] = useState<HTMLCanvasElement | null>(
    null
  )

  // Video ref callback for VisionCameraFeed - also calls onCapture
  // Only call onCapture with video if NOT showing rectified view
  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el
      setVideoElement(el) // Update state so marker detection hook can react
      // Only pass video to onCapture if we're NOT in rectified view mode
      // When rectified view is active, we'll pass the canvas instead
      if (el && onCapture && !showRectifiedView) {
        onCapture(el)
      }
    },
    [onCapture, showRectifiedView]
  )

  // Rectified canvas ref callback - call onCapture with canvas when in rectified mode
  const handleRectifiedCanvasRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      rectifiedCanvasRef.current = el
      setRectifiedCanvasElement(el)
      if (el && onCapture && showRectifiedView) {
        onCapture(el)
      }
    },
    [onCapture, showRectifiedView]
  )

  // When switching to rectified view, update onCapture with the canvas
  useEffect(() => {
    if (showRectifiedView && isCalibrated && rectifiedCanvasElement && onCapture) {
      onCapture(rectifiedCanvasElement)
    } else if (!showRectifiedView && videoRef.current && onCapture) {
      onCapture(videoRef.current)
    }
  }, [showRectifiedView, isCalibrated, rectifiedCanvasElement, onCapture])

  // Phone canvas ref callback - stores ref and calls onCapture
  const handlePhoneCanvasRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      phoneCanvasRef.current = el
      if (el && onCapture && cameraSource === 'phone') {
        onCapture(el)
      }
    },
    [onCapture, cameraSource]
  )

  // Draw phone frames to canvas when they arrive
  // Use phone's detected corners instead of re-detecting locally
  useEffect(() => {
    if (cameraSource !== 'phone' || !isPhoneConnected || !latestFrame) {
      return
    }

    const canvas = phoneCanvasRef.current
    if (!canvas) return

    // Create an image from the frame data and draw to canvas
    const img = new Image()
    img.onload = () => {
      // Set canvas size to match image (only if changed)
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width
        canvas.height = img.height
      }
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        // Update onCapture with the canvas after drawing
        if (onCapture) {
          onCapture(canvas)
        }

        // Use phone's detected corners instead of re-detecting locally
        // This is more reliable because phone detects on high-quality video,
        // not compressed JPEG frames
        if (enableMarkerDetection) {
          // Use corners from frame data directly to avoid stale closure issues
          const frameCorners = latestFrame.detectedCorners
          console.log(
            '[CAMERA-CAPTURE] enableMarkerDetection=true, frameCorners:',
            frameCorners ? 'has corners' : 'null/undefined'
          )
          if (frameCorners) {
            // Phone detected all 4 markers - use its corners
            console.log(
              '[CAMERA-CAPTURE] Setting phoneMarkersFound=4, corners:',
              JSON.stringify(frameCorners)
            )
            setPhoneMarkersFound(4)

            const grid: CalibrationGrid = {
              roi: {
                x: Math.min(frameCorners.topLeft.x, frameCorners.bottomLeft.x),
                y: Math.min(frameCorners.topLeft.y, frameCorners.topRight.y),
                width:
                  Math.max(frameCorners.topRight.x, frameCorners.bottomRight.x) -
                  Math.min(frameCorners.topLeft.x, frameCorners.bottomLeft.x),
                height:
                  Math.max(frameCorners.bottomLeft.y, frameCorners.bottomRight.y) -
                  Math.min(frameCorners.topLeft.y, frameCorners.topRight.y),
              },
              corners: frameCorners,
              columnCount,
              columnDividers: Array.from(
                { length: columnCount - 1 },
                (_, i) => (i + 1) / columnCount
              ),
              rotation: 0,
            }

            // Only update if changed to avoid infinite loops
            const prev = lastPhoneCalibrationRef.current
            const changed =
              prev === null || JSON.stringify(prev.corners) !== JSON.stringify(grid.corners)

            if (changed) {
              console.log('[CAMERA-CAPTURE] Calibration changed, calling onCalibrationChange')
              lastPhoneCalibrationRef.current = grid
              setPhoneCalibration(grid)
              onCalibrationChange?.(grid)
            }
          } else {
            // Phone didn't detect all markers
            console.log('[CAMERA-CAPTURE] No frameCorners, setting phoneMarkersFound=0')
            setPhoneMarkersFound(0)
          }
        }
      }
    }
    img.src = `data:image/jpeg;base64,${latestFrame.imageData}`
  }, [
    cameraSource,
    isPhoneConnected,
    latestFrame,
    onCapture,
    enableMarkerDetection,
    // Note: We use latestFrame.detectedCorners directly instead of phoneDetectedCorners state
    // to ensure corners are always in sync with the frame they came from
    columnCount,
    onCalibrationChange,
  ])

  // Determine if we have a usable frame
  const hasFrame =
    cameraSource === 'local'
      ? camera.videoStream !== null
      : isPhoneConnected && latestFrame !== null

  return (
    <div
      data-component="camera-capture"
      data-source={cameraSource}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 2 : 3,
        height: '100%',
        minHeight: 0,
      })}
    >
      {/* Camera feed - contains the source selector overlay */}
      <div
        data-element="camera-feed"
        className={css({
          position: 'relative',
          borderRadius: 'lg',
          overflow: 'hidden',
          bg: 'gray.800',
          flex: 1,
          minHeight: 0,
          display: 'flex',
        })}
      >
        {/* Source selector - absolutely positioned so it doesn't affect width */}
        {showSourceSelector && (
          <div
            data-element="source-selector"
            className={css({
              position: 'absolute',
              top: 2,
              left: 2,
              right: 2,
              zIndex: 10,
              display: 'flex',
              gap: 0,
              bg: 'gray.800/90',
              backdropFilter: 'blur(4px)',
              borderRadius: 'lg',
              p: 1,
            })}
          >
            <button
              type="button"
              data-source="local"
              data-active={cameraSource === 'local' ? 'true' : 'false'}
              onClick={() => handleSourceChange('local')}
              className={css({
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                py: 1.5,
                px: 2,
                bg: cameraSource === 'local' ? 'gray.700' : 'transparent',
                color: cameraSource === 'local' ? 'white' : 'gray.400',
                border: 'none',
                borderRadius: 'md',
                cursor: 'pointer',
                fontSize: 'xs',
                fontWeight: cameraSource === 'local' ? 'medium' : 'normal',
                transition: 'all 0.15s',
                _hover: {
                  color: 'white',
                  bg: cameraSource === 'local' ? 'gray.700' : 'gray.750',
                },
              })}
            >
              <span>💻</span>
              <span>Local</span>
            </button>
            <button
              type="button"
              data-source="phone"
              data-active={cameraSource === 'phone' ? 'true' : 'false'}
              onClick={() => handleSourceChange('phone')}
              className={css({
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                py: 1.5,
                px: 2,
                bg: cameraSource === 'phone' ? 'gray.700' : 'transparent',
                color: cameraSource === 'phone' ? 'white' : 'gray.400',
                border: 'none',
                borderRadius: 'md',
                cursor: 'pointer',
                fontSize: 'xs',
                fontWeight: cameraSource === 'phone' ? 'medium' : 'normal',
                transition: 'all 0.15s',
                _hover: {
                  color: 'white',
                  bg: cameraSource === 'phone' ? 'gray.700' : 'gray.750',
                },
              })}
            >
              <span>📱</span>
              <span>Phone</span>
            </button>
          </div>
        )}
        {cameraSource === 'local' ? (
          /* Local camera feed */
          <>
            <VisionCameraFeed
              videoStream={camera.videoStream}
              isLoading={camera.isLoading}
              videoRef={handleVideoRef}
              calibration={enableMarkerDetection ? calibration : undefined}
              showRectifiedView={showRectifiedView && isCalibrated}
              rectifiedCanvasRef={handleRectifiedCanvasRef}
              columnCount={columnCount}
            />

            {/* Local camera toolbar */}
            {camera.videoStream && (
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
                {/* Marker status indicator (when marker detection is enabled) */}
                {enableMarkerDetection && (
                  <div
                    data-element="marker-status"
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      fontSize: 'xs',
                      color: isCalibrated ? 'green.400' : 'gray.400',
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        gap: 0.5,
                      })}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={css({
                            width: '6px',
                            height: '6px',
                            borderRadius: 'full',
                            bg: i < markersFound ? 'green.500' : 'gray.600',
                            transition: 'background 0.15s',
                          })}
                        />
                      ))}
                    </div>
                    <span>
                      {isCalibrated
                        ? 'Calibrated'
                        : markersFound > 0
                          ? `${markersFound}/4`
                          : 'No markers'}
                    </span>
                  </div>
                )}

                {/* Camera selector */}
                {camera.availableDevices.length > 0 && (
                  <select
                    data-element="camera-selector"
                    value={camera.currentDevice?.deviceId ?? ''}
                    onChange={(e) => camera.requestCamera(e.target.value)}
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
                    {camera.availableDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                )}

                {/* Toolbar buttons */}
                <div className={css({ display: 'flex', gap: 1 })}>
                  {camera.availableDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => camera.flipCamera()}
                      data-action="flip-camera"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        bg: 'rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        fontSize: 'sm',
                        _hover: { bg: 'rgba(255, 255, 255, 0.25)' },
                      })}
                      title="Switch camera"
                    >
                      🔄
                    </button>
                  )}
                  {camera.isTorchAvailable && (
                    <button
                      type="button"
                      onClick={() => camera.toggleTorch()}
                      data-action="toggle-torch"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        bg: camera.isTorchOn ? 'yellow.600' : 'rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        fontSize: 'sm',
                        _hover: {
                          bg: camera.isTorchOn ? 'yellow.500' : 'rgba(255, 255, 255, 0.25)',
                        },
                      })}
                      title={camera.isTorchOn ? 'Turn off flash' : 'Turn on flash'}
                    >
                      {camera.isTorchOn ? '🔦' : '💡'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Camera error */}
            {camera.error && (
              <div
                className={css({
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 4,
                  bg: 'red.900/80',
                  color: 'red.200',
                  fontSize: 'sm',
                  textAlign: 'center',
                })}
              >
                {camera.error}
              </div>
            )}
          </>
        ) : /* Phone camera feed */ !sessionId ? (
          /* Show QR code to connect phone */
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: compact ? 4 : 6,
            })}
          >
            <RemoteCameraQRCode
              onSessionCreated={handleSessionCreated}
              size={compact ? 140 : 180}
            />
            <p
              className={css({
                color: 'gray.400',
                fontSize: 'sm',
                textAlign: 'center',
                mt: 3,
              })}
            >
              Scan with your phone to connect
            </p>
          </div>
        ) : !isPhoneConnected ? (
          /* Waiting for phone */
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
              onSessionCreated={handleSessionCreated}
              existingSessionId={sessionId}
              size={compact ? 120 : 150}
            />
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                color: 'gray.400',
                fontSize: 'xs',
              })}
            >
              <span
                className={css({
                  width: 1.5,
                  height: 1.5,
                  borderRadius: 'full',
                  bg: 'gray.500',
                  animation: 'pulse 1.5s infinite',
                })}
              />
              Waiting for phone
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
          /* Show camera frames on canvas (unified capture path) */
          <div
            className={css({
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'flex',
            })}
          >
            <canvas
              ref={handlePhoneCanvasRef}
              data-element="phone-camera-canvas"
              className={css({
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: latestFrame ? 'block' : 'none',
              })}
            />
            {!latestFrame && (
              <div
                className={css({
                  width: '100%',
                  aspectRatio: '4/3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'gray.400',
                  fontSize: 'sm',
                })}
              >
                Waiting for frames...
              </div>
            )}

            {/* Phone camera toolbar */}
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
              {/* Marker status indicator (when marker detection is enabled) */}
              {enableMarkerDetection && (
                <div
                  data-element="marker-status"
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    fontSize: 'xs',
                    color: isCalibrated ? 'green.400' : 'gray.400',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      gap: 0.5,
                    })}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={css({
                          width: '6px',
                          height: '6px',
                          borderRadius: 'full',
                          bg: i < phoneMarkersFound ? 'green.500' : 'gray.600',
                          transition: 'background 0.15s',
                        })}
                      />
                    ))}
                  </div>
                  <span>
                    {isCalibrated
                      ? 'Calibrated'
                      : phoneMarkersFound > 0
                        ? `${phoneMarkersFound}/4`
                        : 'No markers'}
                  </span>
                </div>
              )}

              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: 'xs',
                  color: 'white',
                  ml: enableMarkerDetection ? 'auto' : undefined,
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
                {frameRate} fps
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
