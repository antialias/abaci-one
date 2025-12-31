'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import type { CalibrationGrid, QuadCorners } from '@/types/vision'
import { isOpenCVReady, loadOpenCV, rectifyQuadrilateral } from '@/lib/vision/perspectiveTransform'

export interface VisionCameraFeedProps {
  /** Video stream to display */
  videoStream: MediaStream | null
  /** Whether camera is currently loading */
  isLoading?: boolean
  /** Calibration grid to visualize (optional) */
  calibration?: CalibrationGrid | null
  /** Whether to show the calibration grid overlay */
  showCalibrationGrid?: boolean
  /** Whether to show rectified (perspective-corrected) view */
  showRectifiedView?: boolean
  /** Video element ref callback for external access */
  videoRef?: (el: HTMLVideoElement | null) => void
  /** Called when video metadata is loaded (provides dimensions) */
  onVideoReady?: (width: number, height: number) => void
  /** Children rendered over the video (e.g., CalibrationOverlay) */
  children?: ReactNode
}

/**
 * Get corners from calibration (prefer QuadCorners, fall back to ROI rectangle)
 */
function getCornersFromCalibration(calibration: CalibrationGrid): QuadCorners {
  if (calibration.corners) {
    return calibration.corners
  }
  const roi = calibration.roi
  return {
    topLeft: { x: roi.x, y: roi.y },
    topRight: { x: roi.x + roi.width, y: roi.y },
    bottomLeft: { x: roi.x, y: roi.y + roi.height },
    bottomRight: { x: roi.x + roi.width, y: roi.y + roi.height },
  }
}

/**
 * VisionCameraFeed - Displays camera video with optional calibration grid overlay
 *
 * Renders the video stream and optionally draws the calibration grid
 * showing the ROI and column dividers. Can also show a rectified
 * (perspective-corrected) view of the calibrated region.
 */
export function VisionCameraFeed({
  videoStream,
  isLoading = false,
  calibration,
  showCalibrationGrid = false,
  showRectifiedView = false,
  videoRef: externalVideoRef,
  onVideoReady,
  children,
}: VisionCameraFeedProps): ReactNode {
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rectifiedCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const [opencvReady, setOpencvReady] = useState(false)

  // Load OpenCV when rectified view is needed
  useEffect(() => {
    if (showRectifiedView && !opencvReady) {
      loadOpenCV()
        .then(() => setOpencvReady(true))
        .catch((err) => console.error('[VisionCameraFeed] Failed to load OpenCV:', err))
    }
  }, [showRectifiedView, opencvReady])

  // Set video ref for external access
  useEffect(() => {
    if (externalVideoRef) {
      externalVideoRef(internalVideoRef.current)
    }
  }, [externalVideoRef])

  // Attach stream to video element
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video) return

    let isMounted = true

    if (videoStream) {
      video.srcObject = videoStream
      video.play().catch((err) => {
        // Ignore AbortError - happens when component unmounts during play()
        if (isMounted && err.name !== 'AbortError') {
          console.error('Failed to play video:', err)
        }
      })
    } else {
      video.srcObject = null
    }

    return () => {
      isMounted = false
    }
  }, [videoStream])

  // Handle video metadata loaded
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video || !videoStream) return

    const handleLoadedMetadata = () => {
      if (onVideoReady && video.videoWidth > 0 && video.videoHeight > 0) {
        onVideoReady(video.videoWidth, video.videoHeight)
      }
    }

    // Check if already loaded (e.g., from cache or fast load)
    if (video.readyState >= 1 && video.videoWidth > 0) {
      handleLoadedMetadata()
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoStream, onVideoReady])

  // Rectified view processing loop
  useEffect(() => {
    if (!showRectifiedView || !calibration || !opencvReady) {
      return
    }

    const video = internalVideoRef.current
    const canvas = rectifiedCanvasRef.current
    if (!video || !canvas) return

    const corners = getCornersFromCalibration(calibration)
    let running = true

    const processFrame = () => {
      if (!running) return

      if (video.readyState >= 2 && isOpenCVReady()) {
        rectifyQuadrilateral(video, corners, canvas)
      }

      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    processFrame()

    return () => {
      running = false
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [showRectifiedView, calibration, opencvReady])

  // Draw calibration grid overlay (only when not in rectified mode)
  useEffect(() => {
    if (!showCalibrationGrid || !calibration || showRectifiedView) return

    const canvas = canvasRef.current
    const video = internalVideoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawGrid = () => {
      // Match canvas size to video display size
      const rect = video.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      // Calculate scale factors
      const scaleX = rect.width / video.videoWidth
      const scaleY = rect.height / video.videoHeight

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const corners = getCornersFromCalibration(calibration)

      // Scale corners to display coordinates
      const displayCorners = {
        topLeft: { x: corners.topLeft.x * scaleX, y: corners.topLeft.y * scaleY },
        topRight: { x: corners.topRight.x * scaleX, y: corners.topRight.y * scaleY },
        bottomLeft: { x: corners.bottomLeft.x * scaleX, y: corners.bottomLeft.y * scaleY },
        bottomRight: { x: corners.bottomRight.x * scaleX, y: corners.bottomRight.y * scaleY },
      }

      // Draw quadrilateral border
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(displayCorners.topLeft.x, displayCorners.topLeft.y)
      ctx.lineTo(displayCorners.topRight.x, displayCorners.topRight.y)
      ctx.lineTo(displayCorners.bottomRight.x, displayCorners.bottomRight.y)
      ctx.lineTo(displayCorners.bottomLeft.x, displayCorners.bottomLeft.y)
      ctx.closePath()
      ctx.stroke()

      // Draw column dividers (interpolate along top and bottom edges)
      ctx.setLineDash([])
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 1

      for (const divider of calibration.columnDividers) {
        const topX =
          displayCorners.topLeft.x +
          divider * (displayCorners.topRight.x - displayCorners.topLeft.x)
        const topY =
          displayCorners.topLeft.y +
          divider * (displayCorners.topRight.y - displayCorners.topLeft.y)
        const bottomX =
          displayCorners.bottomLeft.x +
          divider * (displayCorners.bottomRight.x - displayCorners.bottomLeft.x)
        const bottomY =
          displayCorners.bottomLeft.y +
          divider * (displayCorners.bottomRight.y - displayCorners.bottomLeft.y)

        ctx.beginPath()
        ctx.moveTo(topX, topY)
        ctx.lineTo(bottomX, bottomY)
        ctx.stroke()
      }

      // Draw beam line (20% from top, interpolated along left and right edges)
      ctx.strokeStyle = '#ffff00'
      ctx.setLineDash([3, 3])
      const beamT = 0.2
      const beamLeftX =
        displayCorners.topLeft.x + beamT * (displayCorners.bottomLeft.x - displayCorners.topLeft.x)
      const beamLeftY =
        displayCorners.topLeft.y + beamT * (displayCorners.bottomLeft.y - displayCorners.topLeft.y)
      const beamRightX =
        displayCorners.topRight.x +
        beamT * (displayCorners.bottomRight.x - displayCorners.topRight.x)
      const beamRightY =
        displayCorners.topRight.y +
        beamT * (displayCorners.bottomRight.y - displayCorners.topRight.y)
      ctx.beginPath()
      ctx.moveTo(beamLeftX, beamLeftY)
      ctx.lineTo(beamRightX, beamRightY)
      ctx.stroke()
    }

    // Draw on next frame
    const animationId = requestAnimationFrame(drawGrid)
    return () => cancelAnimationFrame(animationId)
  }, [showCalibrationGrid, calibration, showRectifiedView])

  // Draw column dividers on rectified view
  const drawRectifiedOverlay = useCallback(() => {
    if (!showRectifiedView || !calibration) return

    const canvas = rectifiedCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Draw column dividers on rectified canvas
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 1
    ctx.setLineDash([])

    for (const divider of calibration.columnDividers) {
      const x = divider * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Draw beam line
    ctx.strokeStyle = '#ffff00'
    ctx.setLineDash([3, 3])
    const beamY = height * 0.2
    ctx.beginPath()
    ctx.moveTo(0, beamY)
    ctx.lineTo(width, beamY)
    ctx.stroke()
  }, [showRectifiedView, calibration])

  // Draw overlay after each rectification frame
  useEffect(() => {
    if (!showRectifiedView || !calibration || !opencvReady) return

    // Set up a loop to draw overlay after rectification
    let running = true
    const overlayLoop = () => {
      if (!running) return
      drawRectifiedOverlay()
      requestAnimationFrame(overlayLoop)
    }
    // Delay slightly to let rectification happen first
    const timeoutId = setTimeout(() => {
      overlayLoop()
    }, 100)

    return () => {
      running = false
      clearTimeout(timeoutId)
    }
  }, [showRectifiedView, calibration, opencvReady, drawRectifiedOverlay])

  if (!videoStream) {
    return (
      <div
        data-component="vision-camera-feed"
        data-status={isLoading ? 'loading' : 'no-stream'}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          bg: 'gray.900',
          color: 'gray.400',
          borderRadius: 'lg',
          aspectRatio: '4/3',
          fontSize: 'sm',
        })}
      >
        {isLoading ? (
          <>
            <div
              className={css({
                width: '24px',
                height: '24px',
                border: '2px solid',
                borderColor: 'gray.600',
                borderTopColor: 'blue.400',
                borderRadius: 'full',
              })}
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span>Requesting camera...</span>
          </>
        ) : (
          'No camera feed'
        )}
      </div>
    )
  }

  // Show loading indicator while keeping video element mounted (so stream stays attached)
  const isLoadingOpenCV = showRectifiedView && !opencvReady

  return (
    <div
      ref={containerRef}
      data-component="vision-camera-feed"
      data-status={showRectifiedView ? 'rectified' : 'active'}
      className={css({
        position: 'relative',
        borderRadius: 'lg',
        overflow: 'hidden',
        bg: 'black',
      })}
    >
      {/* Video element - always mounted (may be hidden when showing rectified view) */}
      <video
        ref={internalVideoRef}
        autoPlay
        playsInline
        muted
        className={css({
          width: '100%',
          height: 'auto',
          display: showRectifiedView && !isLoadingOpenCV ? 'none' : 'block',
        })}
      />

      {/* Loading OpenCV indicator (overlays video) */}
      {isLoadingOpenCV && (
        <div
          data-element="opencv-loading-overlay"
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bg: 'rgba(0, 0, 0, 0.7)',
            color: 'gray.400',
            fontSize: 'sm',
          })}
        >
          <div
            className={css({
              width: '24px',
              height: '24px',
              border: '2px solid',
              borderColor: 'gray.600',
              borderTopColor: 'blue.400',
              borderRadius: 'full',
            })}
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span>Loading vision processing...</span>
        </div>
      )}

      {/* Rectified view canvas */}
      {showRectifiedView && !isLoadingOpenCV && (
        <canvas
          ref={rectifiedCanvasRef}
          data-element="rectified-canvas"
          className={css({
            width: '100%',
            height: 'auto',
            display: 'block',
          })}
        />
      )}

      {/* Calibration grid overlay (only when not in rectified mode) */}
      {showCalibrationGrid && !showRectifiedView && (
        <canvas
          ref={canvasRef}
          data-element="calibration-grid-canvas"
          className={css({
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          })}
        />
      )}

      {/* Children (e.g., CalibrationOverlay during calibration) */}
      {children}
    </div>
  )
}

export default VisionCameraFeed
