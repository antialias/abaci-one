'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAbacusVision } from '@/hooks/useAbacusVision'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import { isOpenCVReady, loadOpenCV, rectifyQuadrilateral } from '@/lib/vision/perspectiveTransform'
import type { CalibrationGrid, QuadCorners } from '@/types/vision'
import { DEFAULT_STABILITY_CONFIG } from '@/types/vision'
import { css } from '../../../styled-system/css'
import { CalibrationOverlay } from './CalibrationOverlay'
import { RemoteCameraQRCode } from './RemoteCameraQRCode'
import { VisionCameraFeed } from './VisionCameraFeed'
import { VisionStatusIndicator } from './VisionStatusIndicator'

type CameraSource = 'local' | 'phone'

export interface AbacusVisionBridgeProps {
  /** Number of abacus columns to detect */
  columnCount: number
  /** Called when a stable value is detected */
  onValueDetected: (value: number) => void
  /** Called when vision mode is closed */
  onClose: () => void
  /** Called on error */
  onError?: (error: string) => void
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
  const [cameraSource, setCameraSource] = useState<CameraSource>('local')
  const [remoteCameraSessionId, setRemoteCameraSessionId] = useState<string | null>(null)

  // Remote camera state
  const [remoteCalibrationMode, setRemoteCalibrationMode] = useState<'auto' | 'manual'>('auto')
  const [remoteIsCalibrating, setRemoteIsCalibrating] = useState(false)
  const [remoteCalibration, setRemoteCalibration] = useState<CalibrationGrid | null>(null)

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
    error: remoteError,
    subscribe: remoteSubscribe,
    unsubscribe: remoteUnsubscribe,
    setPhoneFrameMode: remoteSetPhoneFrameMode,
    sendCalibration: remoteSendCalibration,
    clearCalibration: remoteClearCalibration,
  } = useRemoteCameraDesktop()

  // Handle switching to phone camera
  const handleCameraSourceChange = useCallback(
    (source: CameraSource) => {
      setCameraSource(source)
      if (source === 'phone') {
        // Stop local camera - session will be created by RemoteCameraQRCode
        vision.disable()
      } else {
        // Stop remote session and start local camera
        setRemoteCameraSessionId(null)
        vision.enable()
      }
    },
    [vision]
  )

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
        setRemoteContainerDimensions({ width: rect.width, height: rect.height })
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

  return (
    <div
      ref={containerRef}
      data-component="abacus-vision-bridge"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        p: 3,
        bg: 'gray.900',
        borderRadius: 'xl',
        maxWidth: '400px',
        width: '100%',
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

      {/* Camera source selector */}
      <div
        data-element="camera-source"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bg: 'gray.800',
          borderRadius: 'md',
        })}
      >
        <span className={css({ color: 'gray.400', fontSize: 'sm' })}>Source:</span>
        <button
          type="button"
          onClick={() => handleCameraSourceChange('local')}
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg: cameraSource === 'local' ? 'blue.600' : 'gray.700',
            color: 'white',
            _hover: { bg: cameraSource === 'local' ? 'blue.500' : 'gray.600' },
          })}
        >
          Local Camera
        </button>
        <button
          type="button"
          onClick={() => handleCameraSourceChange('phone')}
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg: cameraSource === 'phone' ? 'blue.600' : 'gray.700',
            color: 'white',
            _hover: { bg: cameraSource === 'phone' ? 'blue.500' : 'gray.600' },
          })}
        >
          Phone Camera
        </button>
      </div>

      {/* Camera controls (local camera only) */}
      {cameraSource === 'local' && (
        <div
          data-element="camera-controls"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          })}
        >
          {/* Camera selector (if multiple cameras) */}
          {vision.availableDevices.length > 1 && (
            <select
              data-element="camera-selector"
              value={vision.selectedDeviceId ?? ''}
              onChange={handleCameraSelect}
              className={css({
                flex: 1,
                p: 2,
                bg: 'gray.800',
                color: 'white',
                border: '1px solid',
                borderColor: 'gray.600',
                borderRadius: 'md',
                fontSize: 'sm',
                minWidth: '150px',
              })}
            >
              {vision.availableDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}

          {/* Flip camera button */}
          <button
            type="button"
            onClick={() => vision.flipCamera()}
            data-action="flip-camera"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              bg: 'gray.700',
              color: 'white',
              border: 'none',
              borderRadius: 'md',
              cursor: 'pointer',
              fontSize: 'lg',
              _hover: { bg: 'gray.600' },
            })}
            title={`Switch to ${vision.facingMode === 'environment' ? 'front' : 'back'} camera`}
          >
            🔄
          </button>

          {/* Torch toggle button (only if available) */}
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
                width: '40px',
                height: '40px',
                bg: vision.isTorchOn ? 'yellow.600' : 'gray.700',
                color: 'white',
                border: 'none',
                borderRadius: 'md',
                cursor: 'pointer',
                fontSize: 'lg',
                _hover: { bg: vision.isTorchOn ? 'yellow.500' : 'gray.600' },
              })}
              title={vision.isTorchOn ? 'Turn off flash' : 'Turn on flash'}
            >
              {vision.isTorchOn ? '🔦' : '💡'}
            </button>
          )}
        </div>
      )}

      {/* Calibration mode toggle (both local and phone camera) */}
      <div
        data-element="calibration-mode"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bg: 'gray.800',
          borderRadius: 'md',
        })}
      >
        <span className={css({ color: 'gray.400', fontSize: 'sm' })}>Mode:</span>
        <button
          type="button"
          onClick={() =>
            cameraSource === 'local'
              ? vision.setCalibrationMode('auto')
              : handleRemoteModeChange('auto')
          }
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg:
              (cameraSource === 'local' ? vision.calibrationMode : remoteCalibrationMode) === 'auto'
                ? 'blue.600'
                : 'gray.700',
            color: 'white',
            _hover: {
              bg:
                (cameraSource === 'local' ? vision.calibrationMode : remoteCalibrationMode) ===
                'auto'
                  ? 'blue.500'
                  : 'gray.600',
            },
          })}
        >
          Auto (Markers)
        </button>
        <button
          type="button"
          onClick={() =>
            cameraSource === 'local'
              ? vision.setCalibrationMode('manual')
              : handleRemoteModeChange('manual')
          }
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg:
              (cameraSource === 'local' ? vision.calibrationMode : remoteCalibrationMode) ===
              'manual'
                ? 'blue.600'
                : 'gray.700',
            color: 'white',
            _hover: {
              bg:
                (cameraSource === 'local' ? vision.calibrationMode : remoteCalibrationMode) ===
                'manual'
                  ? 'blue.500'
                  : 'gray.600',
            },
          })}
        >
          Manual
        </button>
      </div>

      {/* Marker detection status (in auto mode) */}
      {((cameraSource === 'local' && vision.calibrationMode === 'auto') ||
        (cameraSource === 'phone' && remoteCalibrationMode === 'auto')) && (
        <div
          data-element="marker-status"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            bg:
              cameraSource === 'local'
                ? vision.markerDetection.allMarkersFound
                  ? 'green.900'
                  : 'gray.800'
                : remoteFrameMode === 'cropped'
                  ? 'green.900'
                  : 'gray.800',
            borderRadius: 'md',
            transition: 'background-color 0.2s',
          })}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
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
                  ? 'All markers detected'
                  : `Markers: ${vision.markerDetection.markersFound}/4`
                : remoteFrameMode === 'cropped'
                  ? 'Phone auto-cropping active'
                  : 'Waiting for phone markers...'}
            </span>
          </div>
          <a
            href="/create/vision-markers"
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              color: 'blue.300',
              fontSize: 'xs',
              textDecoration: 'underline',
              _hover: { color: 'blue.200' },
            })}
          >
            Get markers
          </a>
        </div>
      )}

      {/* Camera feed */}
      <div ref={cameraFeedContainerRef} className={css({ position: 'relative' })}>
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
          </>
        ) : (
          /* Phone camera - unified UI matching local camera */
          <div
            data-element="phone-camera-feed"
            className={css({
              position: 'relative',
              width: '100%',
              bg: 'gray.800',
              borderRadius: 'lg',
              overflow: 'hidden',
              minHeight: '200px',
              userSelect: 'none', // Prevent text selection from spanning into video feed
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
              </div>
            ) : !remoteIsPhoneConnected ? (
              /* Waiting for phone to connect/reconnect - reuse existing session */
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 6,
                  color: 'gray.400',
                })}
              >
                <p className={css({ mb: 4 })}>Waiting for phone to connect...</p>
                <RemoteCameraQRCode
                  onSessionCreated={handleRemoteSessionCreated}
                  existingSessionId={remoteCameraSessionId}
                  size={150}
                />
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

                {/* Connection status */}
                <div
                  className={css({
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    px: 2,
                    py: 1,
                    bg: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: 'md',
                    fontSize: 'xs',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
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

      {/* Actions (manual mode - both local and phone camera) */}
      {((cameraSource === 'local' && vision.calibrationMode === 'manual') ||
        (cameraSource === 'phone' && remoteCalibrationMode === 'manual')) && (
        <div
          data-element="actions"
          className={css({
            display: 'flex',
            gap: 2,
          })}
        >
          {cameraSource === 'local' ? (
            /* Local camera actions */
            !vision.isCalibrated ? (
              <button
                type="button"
                onClick={vision.startCalibration}
                disabled={!videoDimensions}
                className={css({
                  flex: 1,
                  py: 2,
                  bg: 'blue.600',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.500' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Calibrate
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={vision.startCalibration}
                  className={css({
                    flex: 1,
                    py: 2,
                    bg: 'gray.700',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    _hover: { bg: 'gray.600' },
                  })}
                >
                  Recalibrate
                </button>
                <button
                  type="button"
                  onClick={vision.resetCalibration}
                  className={css({
                    py: 2,
                    px: 3,
                    bg: 'red.700',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    _hover: { bg: 'red.600' },
                  })}
                >
                  Reset
                </button>
              </>
            )
          ) : /* Phone camera actions */
          !remoteCalibration ? (
            <button
              type="button"
              onClick={handleRemoteStartCalibration}
              disabled={!remoteIsPhoneConnected}
              className={css({
                flex: 1,
                py: 2,
                bg: 'blue.600',
                color: 'white',
                border: 'none',
                borderRadius: 'md',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { bg: 'blue.500' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Calibrate
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRemoteStartCalibration}
                className={css({
                  flex: 1,
                  py: 2,
                  bg: 'gray.700',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  _hover: { bg: 'gray.600' },
                })}
              >
                Recalibrate
              </button>
              <button
                type="button"
                onClick={handleRemoteResetCalibration}
                className={css({
                  py: 2,
                  px: 3,
                  bg: 'red.700',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  _hover: { bg: 'red.600' },
                })}
              >
                Reset
              </button>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {cameraSource === 'local' && !vision.isCalibrated && !vision.isCalibrating && (
        <p
          className={css({
            color: 'gray.400',
            fontSize: 'sm',
            textAlign: 'center',
          })}
        >
          {vision.calibrationMode === 'auto'
            ? 'Place ArUco markers on your abacus corners for automatic detection'
            : 'Point your camera at a soroban and click Calibrate to set up detection'}
        </p>
      )}

      {cameraSource === 'phone' && !remoteCameraSessionId && (
        <p
          className={css({
            color: 'gray.400',
            fontSize: 'sm',
            textAlign: 'center',
          })}
        >
          Scan the QR code with your phone to use it as a remote camera
        </p>
      )}

      {cameraSource === 'phone' &&
        remoteIsPhoneConnected &&
        !remoteCalibration &&
        !remoteIsCalibrating && (
          <p
            className={css({
              color: 'gray.400',
              fontSize: 'sm',
              textAlign: 'center',
            })}
          >
            {remoteCalibrationMode === 'auto'
              ? 'Place ArUco markers on your abacus corners for automatic detection'
              : 'Point your phone camera at a soroban and click Calibrate to set up detection'}
          </p>
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
    </div>
  )
}

export default AbacusVisionBridge
