'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import {
  cleanupArucoDetector,
  detectMarkers,
  initArucoDetector,
  isArucoAvailable,
  loadAruco,
} from '@/lib/vision/arucoDetection'
import { useFrameStability } from '@/hooks/useFrameStability'
import { VisionCameraFeed } from './VisionCameraFeed'
import { css } from '../../../styled-system/css'
import type { CalibrationGrid } from '@/types/vision'

/**
 * Feature flag: Enable automatic abacus value detection from video feed.
 *
 * When enabled:
 * - Runs CV-based bead detection on video frames
 * - Shows detected value overlay
 * - Calls setDockedValue and onValueDetected with detected values
 *
 * When disabled:
 * - Only shows the video feed (no detection)
 * - Hides the detection overlay
 * - Does not interfere with student's manual input
 *
 * Set to true when ready to work on improving detection accuracy.
 */
const ENABLE_AUTO_DETECTION = false

// Only import detection modules when auto-detection is enabled
// This ensures the detection code is tree-shaken when disabled
let analyzeColumns: typeof import('@/lib/vision/beadDetector').analyzeColumns
let analysesToDigits: typeof import('@/lib/vision/beadDetector').analysesToDigits
let digitsToNumber: typeof import('@/lib/vision/beadDetector').digitsToNumber
let processVideoFrame: typeof import('@/lib/vision/frameProcessor').processVideoFrame
let processImageFrame: typeof import('@/lib/vision/frameProcessor').processImageFrame

if (ENABLE_AUTO_DETECTION) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const beadDetector = require('@/lib/vision/beadDetector')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const frameProcessor = require('@/lib/vision/frameProcessor')
  analyzeColumns = beadDetector.analyzeColumns
  analysesToDigits = beadDetector.analysesToDigits
  digitsToNumber = beadDetector.digitsToNumber
  processVideoFrame = frameProcessor.processVideoFrame
  processImageFrame = frameProcessor.processImageFrame
}

interface DockedVisionFeedProps {
  /** Called when a stable value is detected */
  onValueDetected?: (value: number) => void
  /** Number of columns to detect */
  columnCount?: number
}

/**
 * Renders the processed camera feed in place of the docked abacus
 *
 * When vision is enabled in MyAbacusContext, this component:
 * - For local camera: Opens the saved camera, applies calibration, runs detection
 * - For remote camera: Receives frames from phone, runs detection
 * - Shows the video feed with detection overlay
 */
export function DockedVisionFeed({ onValueDetected, columnCount = 5 }: DockedVisionFeedProps) {
  const { visionConfig, setDockedValue, setVisionEnabled, setVisionCalibration, emitVisionFrame } =
    useMyAbacus()

  const videoRef = useRef<HTMLVideoElement>(null)
  const remoteImageRef = useRef<HTMLImageElement>(null)
  const rectifiedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const markerDetectionFrameRef = useRef<number | null>(null)
  const lastInferenceTimeRef = useRef<number>(0)
  const lastBroadcastTimeRef = useRef<number>(0)

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [detectedValue, setDetectedValue] = useState<number | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [isArucoReady, setIsArucoReady] = useState(false)
  const [markersFound, setMarkersFound] = useState(0)

  // Stability tracking for detected values (hook must be called unconditionally)
  const stability = useFrameStability()

  // Determine camera source (must be before effects that use these)
  // Prioritize local camera if configured - remote camera only if no local camera
  const isLocalCamera = visionConfig.cameraDeviceId !== null
  const isRemoteCamera = !isLocalCamera && visionConfig.remoteCameraSessionId !== null

  // Load and initialize ArUco on mount (for local camera auto-calibration)
  useEffect(() => {
    if (!isLocalCamera) return

    let cancelled = false

    const initAruco = async () => {
      try {
        await loadAruco()
        if (cancelled) return

        const available = isArucoAvailable()
        if (available) {
          initArucoDetector()
          setIsArucoReady(true)
        }
      } catch (err) {
        console.error('[DockedVisionFeed] Failed to load ArUco:', err)
      }
    }

    initAruco()
    return () => {
      cancelled = true
    }
  }, [isLocalCamera])

  // Cleanup ArUco detector on unmount
  useEffect(() => {
    return () => {
      cleanupArucoDetector()
    }
  }, [])

  // Auto-calibration loop using ArUco markers (for local camera)
  useEffect(() => {
    if (!visionConfig.enabled || !isLocalCamera || !videoStream || !isArucoReady) {
      if (markerDetectionFrameRef.current) {
        cancelAnimationFrame(markerDetectionFrameRef.current)
        markerDetectionFrameRef.current = null
      }
      return
    }

    const video = videoRef.current
    if (!video) return

    let running = true

    const detectLoop = () => {
      if (!running || !video || video.readyState < 2) {
        if (running) {
          markerDetectionFrameRef.current = requestAnimationFrame(detectLoop)
        }
        return
      }

      const result = detectMarkers(video)
      setMarkersFound(result.markersFound)

      // Auto-update calibration when all 4 markers found
      if (result.allMarkersFound && result.quadCorners) {
        const grid: CalibrationGrid = {
          roi: {
            x: Math.min(result.quadCorners.topLeft.x, result.quadCorners.bottomLeft.x),
            y: Math.min(result.quadCorners.topLeft.y, result.quadCorners.topRight.y),
            width:
              Math.max(result.quadCorners.topRight.x, result.quadCorners.bottomRight.x) -
              Math.min(result.quadCorners.topLeft.x, result.quadCorners.bottomLeft.x),
            height:
              Math.max(result.quadCorners.bottomLeft.y, result.quadCorners.bottomRight.y) -
              Math.min(result.quadCorners.topLeft.y, result.quadCorners.topRight.y),
          },
          corners: result.quadCorners,
          columnCount,
          columnDividers: Array.from({ length: columnCount - 1 }, (_, i) => (i + 1) / columnCount),
          rotation: 0,
        }
        // Update calibration in context
        setVisionCalibration(grid)
      }

      markerDetectionFrameRef.current = requestAnimationFrame(detectLoop)
    }

    detectLoop()

    return () => {
      running = false
      if (markerDetectionFrameRef.current) {
        cancelAnimationFrame(markerDetectionFrameRef.current)
        markerDetectionFrameRef.current = null
      }
    }
  }, [
    visionConfig.enabled,
    isLocalCamera,
    videoStream,
    isArucoReady,
    columnCount,
    setVisionCalibration,
  ])

  // Remote camera hook
  const {
    isPhoneConnected: remoteIsPhoneConnected,
    latestFrame: remoteLatestFrame,
    subscribe: remoteSubscribe,
    unsubscribe: remoteUnsubscribe,
  } = useRemoteCameraDesktop()

  const INFERENCE_INTERVAL_MS = 100 // 10fps

  // Start local camera when component mounts (only for local camera)
  useEffect(() => {
    if (!visionConfig.enabled || !isLocalCamera || !visionConfig.cameraDeviceId) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: visionConfig.cameraDeviceId! },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setVideoStream(stream)
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('[DockedVisionFeed] Failed to start camera:', err)
        setError('Failed to access camera')
        setIsLoading(false)
      }
    }

    startCamera()

    return () => {
      cancelled = true
    }
  }, [visionConfig.enabled, isLocalCamera, visionConfig.cameraDeviceId])

  // Stop camera when stream changes or component unmounts
  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [videoStream])

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream
    }
  }, [videoStream])

  // Subscribe to remote camera session
  useEffect(() => {
    if (!visionConfig.enabled || !isRemoteCamera || !visionConfig.remoteCameraSessionId) {
      return
    }

    setIsLoading(true)
    remoteSubscribe(visionConfig.remoteCameraSessionId)

    return () => {
      remoteUnsubscribe()
    }
  }, [
    visionConfig.enabled,
    isRemoteCamera,
    visionConfig.remoteCameraSessionId,
    remoteSubscribe,
    remoteUnsubscribe,
  ])

  // Update loading state when remote camera connects
  useEffect(() => {
    if (isRemoteCamera && remoteIsPhoneConnected) {
      setIsLoading(false)
    }
  }, [isRemoteCamera, remoteIsPhoneConnected])

  // Process local camera frames for detection (only when enabled)
  const processLocalFrame = useCallback(() => {
    // Skip detection when feature is disabled
    if (!ENABLE_AUTO_DETECTION) return

    const now = performance.now()
    if (now - lastInferenceTimeRef.current < INFERENCE_INTERVAL_MS) {
      return
    }
    lastInferenceTimeRef.current = now

    const video = videoRef.current
    if (!video || video.readyState < 2) return
    if (!visionConfig.calibration) return

    // Process video frame into column strips
    const columnImages = processVideoFrame(video, visionConfig.calibration)
    if (columnImages.length === 0) return

    // Use CV-based bead detection
    const analyses = analyzeColumns(columnImages)
    const { digits, minConfidence } = analysesToDigits(analyses)

    // Convert to number
    const value = digitsToNumber(digits)

    // Push to stability buffer
    stability.pushFrame(value, minConfidence)
  }, [visionConfig.calibration, stability])

  // Process remote camera frames for detection (only when enabled)
  useEffect(() => {
    // Skip detection when feature is disabled
    if (!ENABLE_AUTO_DETECTION) return

    if (!isRemoteCamera || !remoteIsPhoneConnected || !remoteLatestFrame) {
      return
    }

    const now = performance.now()
    if (now - lastInferenceTimeRef.current < INFERENCE_INTERVAL_MS) {
      return
    }
    lastInferenceTimeRef.current = now

    const image = remoteImageRef.current
    if (!image || !image.complete || image.naturalWidth === 0) {
      return
    }

    // Phone sends pre-cropped frames in auto mode, so no calibration needed
    const columnImages = processImageFrame(image, null, columnCount)
    if (columnImages.length === 0) return

    // Use CV-based bead detection
    const analyses = analyzeColumns(columnImages)
    const { digits, minConfidence } = analysesToDigits(analyses)

    // Convert to number
    const value = digitsToNumber(digits)

    // Push to stability buffer
    stability.pushFrame(value, minConfidence)
  }, [isRemoteCamera, remoteIsPhoneConnected, remoteLatestFrame, columnCount, stability])

  // Local camera detection loop (only when enabled)
  useEffect(() => {
    // Skip detection loop when feature is disabled
    if (!ENABLE_AUTO_DETECTION) return

    if (!visionConfig.enabled || !isLocalCamera || !videoStream || !visionConfig.calibration) {
      return
    }

    let running = true

    const loop = () => {
      if (!running) return

      processLocalFrame()
      animationFrameRef.current = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      running = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [
    visionConfig.enabled,
    isLocalCamera,
    videoStream,
    visionConfig.calibration,
    processLocalFrame,
  ])

  // Handle stable value changes (only when auto-detection is enabled)
  useEffect(() => {
    // Skip value updates when feature is disabled
    if (!ENABLE_AUTO_DETECTION) return

    if (stability.stableValue !== null && stability.stableValue !== detectedValue) {
      setDetectedValue(stability.stableValue)
      setConfidence(stability.currentConfidence)
      setDockedValue(stability.stableValue)
      onValueDetected?.(stability.stableValue)
    }
  }, [
    stability.stableValue,
    stability.currentConfidence,
    detectedValue,
    setDockedValue,
    onValueDetected,
  ])

  // Broadcast vision frames to observers (5fps to save bandwidth)
  const BROADCAST_INTERVAL_MS = 200
  useEffect(() => {
    if (!visionConfig.enabled) return

    let running = true

    const broadcastLoop = () => {
      if (!running) return

      const now = performance.now()
      if (now - lastBroadcastTimeRef.current >= BROADCAST_INTERVAL_MS) {
        lastBroadcastTimeRef.current = now

        // Capture from rectified canvas (local camera) or remote image
        let imageData: string | null = null

        if (isLocalCamera && rectifiedCanvasRef.current) {
          const canvas = rectifiedCanvasRef.current
          if (canvas.width > 0 && canvas.height > 0) {
            // Convert canvas to JPEG (quality 0.7 for bandwidth)
            imageData = canvas.toDataURL('image/jpeg', 0.7).replace('data:image/jpeg;base64,', '')
          }
        } else if (isRemoteCamera && remoteLatestFrame) {
          // Remote camera already sends base64 JPEG
          imageData = remoteLatestFrame.imageData
        }

        if (imageData) {
          emitVisionFrame({
            imageData,
            detectedValue,
            confidence,
          })
        }
      }

      requestAnimationFrame(broadcastLoop)
    }

    broadcastLoop()

    return () => {
      running = false
    }
  }, [
    visionConfig.enabled,
    isLocalCamera,
    isRemoteCamera,
    remoteLatestFrame,
    detectedValue,
    confidence,
    emitVisionFrame,
  ])

  const handleDisableVision = (e: React.MouseEvent) => {
    e.stopPropagation()
    setVisionEnabled(false)
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop())
    }
  }

  if (error) {
    return (
      <div
        data-component="docked-vision-feed"
        data-status="error"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          bg: 'red.900/30',
          borderRadius: 'lg',
          color: 'red.400',
          textAlign: 'center',
        })}
      >
        <span className={css({ fontSize: 'xl' })}>⚠️</span>
        <span className={css({ fontSize: 'sm' })}>{error}</span>
        <button
          type="button"
          onClick={handleDisableVision}
          className={css({
            mt: 2,
            px: 3,
            py: 1,
            bg: 'gray.700',
            color: 'white',
            borderRadius: 'md',
            fontSize: 'xs',
            border: 'none',
            cursor: 'pointer',
          })}
        >
          Disable Vision
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        data-component="docked-vision-feed"
        data-status="loading"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          bg: 'gray.800/50',
          borderRadius: 'lg',
          color: 'gray.400',
        })}
      >
        <span className={css({ fontSize: 'xl' })}>📷</span>
        <span className={css({ fontSize: 'sm' })}>
          {isRemoteCamera ? 'Connecting to phone...' : 'Starting camera...'}
        </span>
      </div>
    )
  }

  return (
    <div
      data-component="docked-vision-feed"
      data-status="active"
      data-source={isRemoteCamera ? 'remote' : 'local'}
      className={css({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 'lg',
        bg: 'black',
        width: '100%',
        height: '100%',
      })}
    >
      {/* Rectified video feed - local camera */}
      {isLocalCamera && (
        <VisionCameraFeed
          videoStream={videoStream}
          calibration={visionConfig.calibration}
          showRectifiedView={true}
          videoRef={(el) => {
            videoRef.current = el
          }}
          rectifiedCanvasRef={(el) => {
            rectifiedCanvasRef.current = el
          }}
        />
      )}

      {/* Remote camera feed */}
      {isRemoteCamera && remoteLatestFrame && (
        <img
          ref={remoteImageRef}
          src={`data:image/jpeg;base64,${remoteLatestFrame.imageData}`}
          alt="Phone camera view"
          className={css({
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
          })}
        />
      )}

      {/* Waiting for remote frames */}
      {isRemoteCamera && !remoteLatestFrame && remoteIsPhoneConnected && (
        <div
          className={css({
            width: '100%',
            aspectRatio: '2/1',
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

      {/* Detection overlay - only shown when auto-detection is enabled */}
      {ENABLE_AUTO_DETECTION && (
        <div
          data-element="detection-overlay"
          className={css({
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            bg: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          })}
        >
          {/* Detected value */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
            <span
              className={css({
                fontSize: 'lg',
                fontWeight: 'bold',
                color: 'white',
                fontFamily: 'mono',
              })}
            >
              {detectedValue !== null ? detectedValue : '---'}
            </span>
            {detectedValue !== null && (
              <span className={css({ fontSize: 'xs', color: 'gray.400' })}>
                {Math.round(confidence * 100)}%
              </span>
            )}
          </div>

          {/* Stability indicator */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: 1 })}>
            {stability.consecutiveFrames > 0 && (
              <div className={css({ display: 'flex', gap: 0.5 })}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={css({
                      w: '6px',
                      h: '6px',
                      borderRadius: 'full',
                      bg: i < stability.consecutiveFrames ? 'green.500' : 'gray.600',
                    })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disable button */}
      <button
        type="button"
        data-action="disable-vision"
        onClick={handleDisableVision}
        title="Disable vision mode"
        className={css({
          position: 'absolute',
          top: '4px',
          right: '4px',
          w: '24px',
          h: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 'md',
          color: 'white',
          fontSize: 'xs',
          cursor: 'pointer',
          zIndex: 10,
          opacity: 0.7,
          _hover: {
            bg: 'rgba(239, 68, 68, 0.8)',
            opacity: 1,
          },
        })}
      >
        ✕
      </button>
    </div>
  )
}
