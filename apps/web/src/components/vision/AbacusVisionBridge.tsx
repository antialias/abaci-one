'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAbacusVision } from '@/hooks/useAbacusVision'
import { isOpenCVReady, loadOpenCV, rectifyQuadrilateral } from '@/lib/vision/perspectiveTransform'
import type { QuadCorners } from '@/types/vision'
import { DEFAULT_STABILITY_CONFIG } from '@/types/vision'
import { css } from '../../../styled-system/css'
import { CalibrationOverlay } from './CalibrationOverlay'
import { VisionCameraFeed } from './VisionCameraFeed'
import { VisionStatusIndicator } from './VisionStatusIndicator'

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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const [calibrationCorners, setCalibrationCorners] = useState<QuadCorners | null>(null)
  const [opencvReady, setOpencvReady] = useState(false)

  const vision = useAbacusVision({
    columnCount,
    onValueDetected,
  })

  // Start camera on mount
  useEffect(() => {
    vision.enable()
    return () => vision.disable()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount/unmount - vision functions are stable

  // Report errors
  useEffect(() => {
    if (vision.cameraError && onError) {
      onError(vision.cameraError)
    }
  }, [vision.cameraError, onError])

  // Load OpenCV when calibrating
  useEffect(() => {
    if (vision.isCalibrating && !opencvReady) {
      loadOpenCV()
        .then(() => setOpencvReady(true))
        .catch((err) => console.error('Failed to load OpenCV:', err))
    }
  }, [vision.isCalibrating, opencvReady])

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

      {/* Camera selector (if multiple cameras) */}
      {vision.availableDevices.length > 1 && (
        <select
          data-element="camera-selector"
          value={vision.selectedDeviceId ?? ''}
          onChange={handleCameraSelect}
          className={css({
            p: 2,
            bg: 'gray.800',
            color: 'white',
            border: '1px solid',
            borderColor: 'gray.600',
            borderRadius: 'md',
            fontSize: 'sm',
          })}
        >
          {vision.availableDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      )}

      {/* Calibration mode toggle */}
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
          onClick={() => vision.setCalibrationMode('auto')}
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg: vision.calibrationMode === 'auto' ? 'blue.600' : 'gray.700',
            color: 'white',
            _hover: { bg: vision.calibrationMode === 'auto' ? 'blue.500' : 'gray.600' },
          })}
        >
          Auto (Markers)
        </button>
        <button
          type="button"
          onClick={() => vision.setCalibrationMode('manual')}
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg: vision.calibrationMode === 'manual' ? 'blue.600' : 'gray.700',
            color: 'white',
            _hover: { bg: vision.calibrationMode === 'manual' ? 'blue.500' : 'gray.600' },
          })}
        >
          Manual
        </button>
      </div>

      {/* Marker detection status (in auto mode) */}
      {vision.calibrationMode === 'auto' && (
        <div
          data-element="marker-status"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            bg: vision.markerDetection.allMarkersFound ? 'green.900' : 'gray.800',
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
                bg: vision.markerDetection.allMarkersFound ? 'green.400' : 'yellow.400',
              })}
            />
            <span className={css({ color: 'white', fontSize: 'sm' })}>
              {vision.markerDetection.allMarkersFound
                ? 'All markers detected'
                : `Markers: ${vision.markerDetection.markersFound}/4`}
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
      </div>

      {/* Rectified preview during calibration */}
      {vision.isCalibrating && (
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

      {/* Actions (manual mode only) */}
      {vision.calibrationMode === 'manual' && (
        <div
          data-element="actions"
          className={css({
            display: 'flex',
            gap: 2,
          })}
        >
          {!vision.isCalibrated ? (
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
          )}
        </div>
      )}

      {/* Instructions */}
      {!vision.isCalibrated && !vision.isCalibrating && (
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

      {/* Error display */}
      {vision.cameraError && (
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
