'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import type { CalibrationGrid, QuadCorners } from '@/types/vision'
import { isOpenCVReady, loadOpenCV, rectifyQuadrilateral } from '@/lib/vision/perspectiveTransform'
import { CalibrationQuadEditor } from './CalibrationQuadEditor'

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
  /** Rectified canvas ref callback for external access (only when showRectifiedView=true) */
  rectifiedCanvasRef?: (el: HTMLCanvasElement | null) => void
  /** Called when video metadata is loaded (provides dimensions) */
  onVideoReady?: (width: number, height: number) => void
  /** Children rendered over the video (e.g., CalibrationOverlay) */
  children?: ReactNode
  /** Number of abacus columns (used for fixed aspect ratio in rectified view) */
  columnCount?: number
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
  rectifiedCanvasRef: externalCanvasRef,
  onVideoReady,
  children,
  columnCount,
}: VisionCameraFeedProps): ReactNode {
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const rectifiedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Initialize opencvReady synchronously if already loaded (avoids flash on remount)
  const [opencvReady, setOpencvReady] = useState(() => isOpenCVReady())

  // Track when canvas is mounted (refs don't trigger re-renders, so we need state)
  const [canvasMounted, setCanvasMounted] = useState(false)

  // Track container and video dimensions for CalibrationQuadEditor
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })

  // Load OpenCV when rectified view is needed
  useEffect(() => {
    if (showRectifiedView && !opencvReady) {
      loadOpenCV()
        .then(() => setOpencvReady(true))
        .catch((err) => console.error('[VisionCameraFeed] Failed to load OpenCV:', err))
    }
  }, [showRectifiedView, opencvReady])

  // Track container dimensions for CalibrationQuadEditor (SVG needs explicit size)
  // NOTE: videoStream in deps ensures this re-runs when switching from "no stream" to "has stream"
  // because the container element only renders when videoStream exists
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerDimensions({ width, height })
      }
    })

    observer.observe(container)
    // Get initial dimensions
    const rect = container.getBoundingClientRect()
    setContainerDimensions({ width: rect.width, height: rect.height })

    return () => observer.disconnect()
  }, [videoStream])

  // Set video ref for external access
  // IMPORTANT: Must re-run when videoStream changes because the video element
  // only renders when videoStream exists (see early return below)
  useEffect(() => {
    if (externalVideoRef) {
      externalVideoRef(internalVideoRef.current)
    }
  }, [externalVideoRef, videoStream])

  // Combined ref callback for rectified canvas - sets internal ref AND calls external callback
  // Also updates canvasMounted state to trigger effect re-run
  const handleRectifiedCanvasRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      rectifiedCanvasRef.current = el
      setCanvasMounted(el !== null)
      if (externalCanvasRef) {
        externalCanvasRef(el)
      }
    },
    [externalCanvasRef]
  )

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
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoDimensions({ width: video.videoWidth, height: video.videoHeight })
        if (onVideoReady) {
          onVideoReady(video.videoWidth, video.videoHeight)
        }
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
  // NOTE: canvasMounted in deps ensures this re-runs when canvas becomes available after mount
  useEffect(() => {
    if (!showRectifiedView || !calibration || !opencvReady || !canvasMounted) {
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
        rectifyQuadrilateral(video, corners, canvas, { columnCount })
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
  }, [showRectifiedView, calibration, opencvReady, canvasMounted])

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
    if (!showRectifiedView || !calibration || !opencvReady || !canvasMounted) return

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
  }, [showRectifiedView, calibration, opencvReady, canvasMounted, drawRectifiedOverlay])

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
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          height: '100%',
          objectFit: 'contain',
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
          ref={handleRectifiedCanvasRef}
          data-element="rectified-canvas"
          className={css({
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          })}
        />
      )}

      {/* Calibration grid overlay (only when not in rectified mode) */}
      {/* Uses CalibrationQuadEditor for visual consistency with desktop, but non-interactive */}
      {showCalibrationGrid &&
        !showRectifiedView &&
        calibration &&
        videoDimensions.width > 0 &&
        containerDimensions.width > 0 && (
          <div
            data-element="quad-editor-wrapper"
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <CalibrationQuadEditor
              columnCount={calibration.columnCount}
              corners={getCornersFromCalibration(calibration)}
              columnDividers={calibration.columnDividers}
              videoWidth={videoDimensions.width}
              videoHeight={videoDimensions.height}
              containerWidth={containerDimensions.width}
              containerHeight={containerDimensions.height}
              onCornersChange={() => {}}
              onDividersChange={() => {}}
            />
          </div>
        )}

      {/* Children (e.g., CalibrationOverlay during calibration) */}
      {children}
    </div>
  )
}

export default VisionCameraFeed
