'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cleanupArucoDetector,
  detectMarkers,
  initArucoDetector,
  isArucoAvailable,
  loadAruco,
} from '@/lib/vision/arucoDetection'
import { digitsToNumber, getMinConfidence, processVideoFrame } from '@/lib/vision/frameProcessor'
import type {
  CalibrationGrid,
  CalibrationMode,
  MarkerDetectionStatus,
  UseAbacusVisionReturn,
} from '@/types/vision'
import { useCameraCalibration } from './useCameraCalibration'
import { useColumnClassifier } from './useColumnClassifier'
import { useDeskViewCamera } from './useDeskViewCamera'
import { useFrameStability } from './useFrameStability'

export interface UseAbacusVisionOptions {
  /** Number of abacus columns to detect */
  columnCount?: number
  /** Called when a stable value is detected */
  onValueDetected?: (value: number) => void
  /** Initial calibration mode (default: 'auto') */
  initialCalibrationMode?: CalibrationMode
}

/**
 * useAbacusVision - Primary coordinator hook for abacus vision detection
 *
 * Combines camera management, calibration, and frame processing into
 * a single hook that outputs stable detected values.
 *
 * Usage:
 * ```tsx
 * const vision = useAbacusVision({
 *   columnCount: 5,
 *   onValueDetected: (value) => setDockedValue(value)
 * })
 *
 * return (
 *   <VisionCameraFeed
 *     videoStream={vision.videoStream}
 *     calibration={vision.calibrationGrid}
 *   />
 * )
 * ```
 */
export function useAbacusVision(options: UseAbacusVisionOptions = {}): UseAbacusVisionReturn {
  const { columnCount = 5, onValueDetected, initialCalibrationMode = 'auto' } = options

  // State
  const [isEnabled, setIsEnabled] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>(initialCalibrationMode)
  const [markerDetection, setMarkerDetection] = useState<MarkerDetectionStatus>({
    isAvailable: false,
    allMarkersFound: false,
    markersFound: 0,
    detectedIds: [],
  })

  // Sub-hooks
  const camera = useDeskViewCamera()
  const calibration = useCameraCalibration()
  const stability = useFrameStability()
  const classifier = useColumnClassifier()

  // Classifier state
  const [columnConfidences, setColumnConfidences] = useState<number[]>([])
  const [isClassifierReady, setIsClassifierReady] = useState(false)

  // Video element ref for frame capture
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const markerDetectionFrameRef = useRef<number | null>(null)

  // Track previous stable value to avoid duplicate callbacks
  const lastStableValueRef = useRef<number | null>(null)

  // Ref for calibration functions to avoid infinite loop in auto-calibration effect
  const calibrationRef = useRef(calibration)
  calibrationRef.current = calibration

  // Sync device ID to calibration hook when camera device changes
  useEffect(() => {
    if (camera.currentDevice?.deviceId) {
      calibration.setDeviceId(camera.currentDevice.deviceId)
    }
  }, [camera.currentDevice?.deviceId, calibration])

  // Load and initialize ArUco on mount
  useEffect(() => {
    let cancelled = false

    const initAruco = async () => {
      try {
        await loadAruco()
        if (cancelled) return

        const available = isArucoAvailable()
        setMarkerDetection((prev) => ({ ...prev, isAvailable: available }))
        if (available) {
          initArucoDetector()
        }
      } catch (err) {
        console.error('[ArUco] Failed to load:', err)
      }
    }

    initAruco()
    return () => {
      cancelled = true
    }
  }, [])

  // Cleanup ArUco detector on unmount
  useEffect(() => {
    return () => {
      cleanupArucoDetector()
    }
  }, [])

  // Auto-calibration loop using ArUco markers
  useEffect(() => {
    if (!isEnabled || !camera.videoStream || calibrationMode !== 'auto') {
      if (markerDetectionFrameRef.current) {
        cancelAnimationFrame(markerDetectionFrameRef.current)
        markerDetectionFrameRef.current = null
      }
      return
    }

    // Get video element from stream
    const videoElements = document.querySelectorAll('video')
    let video: HTMLVideoElement | null = null
    for (const el of videoElements) {
      if (el.srcObject === camera.videoStream) {
        video = el
        break
      }
    }

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

      setMarkerDetection({
        isAvailable: true,
        allMarkersFound: result.allMarkersFound,
        markersFound: result.markersFound,
        detectedIds: Array.from(result.markers.keys()),
      })

      // Auto-update calibration when all markers found
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
        calibrationRef.current.updateCalibration(grid)
        if (!calibrationRef.current.isCalibrated) {
          calibrationRef.current.finishCalibration()
        }
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
  }, [isEnabled, camera.videoStream, calibrationMode, columnCount])

  /**
   * Enable vision mode - start camera and detection
   */
  const enable = useCallback(async () => {
    setIsEnabled(true)
    await camera.requestCamera()
  }, [camera])

  /**
   * Disable vision mode - stop camera and detection
   */
  const disable = useCallback(() => {
    setIsEnabled(false)
    setIsDetecting(false)
    camera.stopCamera()
    stability.reset()

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [camera, stability])

  /**
   * Start calibration mode
   */
  const startCalibration = useCallback(() => {
    calibration.startCalibration()
  }, [calibration])

  /**
   * Finish calibration
   */
  const finishCalibration = useCallback(
    (grid: CalibrationGrid) => {
      calibration.updateCalibration(grid)
      calibration.finishCalibration()
    },
    [calibration]
  )

  /**
   * Cancel calibration
   */
  const cancelCalibration = useCallback(() => {
    calibration.cancelCalibration()
  }, [calibration])

  /**
   * Select specific camera
   */
  const selectCamera = useCallback(
    (deviceId: string) => {
      camera.requestCamera(deviceId)
    },
    [camera]
  )

  /**
   * Reset calibration
   */
  const resetCalibration = useCallback(() => {
    calibration.resetCalibration()
  }, [calibration])

  /**
   * Process a video frame for detection using TensorFlow.js classifier
   */
  const processFrame = useCallback(async () => {
    // Get video element from camera stream
    const videoElements = document.querySelectorAll('video')
    let video: HTMLVideoElement | null = null
    for (const el of videoElements) {
      if (el.srcObject === camera.videoStream) {
        video = el
        break
      }
    }

    if (!video || video.readyState < 2) return
    if (!calibration.isCalibrated || !calibration.calibration) return

    // Check if hand is detected (motion) - pause classification during motion
    if (stability.isHandDetected) return

    // Process video frame into column strips
    const columnImages = processVideoFrame(video, calibration.calibration)

    if (columnImages.length === 0) return

    // Run classification
    const result = await classifier.classifyColumns(columnImages)

    if (!result) return

    // Update column confidences
    setColumnConfidences(result.confidences)

    // Convert digits to number
    const detectedValue = digitsToNumber(result.digits)
    const minConfidence = getMinConfidence(result.confidences)

    // Push to stability buffer
    stability.pushFrame(detectedValue, minConfidence)
  }, [camera.videoStream, calibration.isCalibrated, calibration.calibration, stability, classifier])

  /**
   * Detection loop
   */
  const runDetectionLoop = useCallback(() => {
    if (!isEnabled || !calibration.isCalibrated || calibration.isCalibrating) {
      return
    }

    setIsDetecting(true)

    // Process frame asynchronously, then continue loop
    processFrame().finally(() => {
      if (isEnabled && calibration.isCalibrated && !calibration.isCalibrating) {
        animationFrameRef.current = requestAnimationFrame(runDetectionLoop)
      }
    })
  }, [isEnabled, calibration.isCalibrated, calibration.isCalibrating, processFrame])

  // Preload classifier when vision is enabled
  // Model may not exist yet (not trained) - that's ok, vision still works in manual mode
  useEffect(() => {
    if (
      isEnabled &&
      !classifier.isModelLoaded &&
      !classifier.isLoading &&
      !classifier.isModelUnavailable
    ) {
      classifier.preload().then((success) => {
        // Set ready regardless - vision can work without ML classifier
        // (manual calibration + frame capture still works)
        setIsClassifierReady(true)
        if (!success) {
          console.log('[useAbacusVision] ML classifier not available - using manual mode only')
        }
      })
    } else if (classifier.isModelUnavailable) {
      // Model doesn't exist - still allow vision in manual mode
      setIsClassifierReady(true)
    }
  }, [isEnabled, classifier])

  // Start/stop detection loop based on state
  useEffect(() => {
    if (
      isEnabled &&
      calibration.isCalibrated &&
      !calibration.isCalibrating &&
      camera.videoStream &&
      isClassifierReady
    ) {
      runDetectionLoop()
    } else {
      setIsDetecting(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [
    isEnabled,
    calibration.isCalibrated,
    calibration.isCalibrating,
    camera.videoStream,
    isClassifierReady,
    runDetectionLoop,
  ])

  // Notify when stable value changes
  useEffect(() => {
    if (stability.stableValue !== null && stability.stableValue !== lastStableValueRef.current) {
      lastStableValueRef.current = stability.stableValue
      onValueDetected?.(stability.stableValue)
    }
  }, [stability.stableValue, onValueDetected])

  // Create hidden canvas for frame processing
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
  }, [])

  // Cleanup animation frame on unmount (camera cleanup handled by disable())
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      // Note: camera.stopCamera() is called by disable() - don't duplicate
    }
  }, [])

  return {
    // Vision state
    isEnabled,
    isCalibrated: calibration.isCalibrated,
    isDetecting,
    currentDetectedValue: stability.stableValue,
    confidence: stability.currentConfidence,
    columnConfidences,

    // Classifier state
    isClassifierLoading: classifier.isLoading,
    isClassifierReady,
    classifierError: classifier.error,

    // Camera state
    isCameraLoading: camera.isLoading,
    videoStream: camera.videoStream,
    cameraError: camera.error,
    selectedDeviceId: camera.currentDevice?.deviceId ?? null,
    availableDevices: camera.availableDevices,
    isDeskViewDetected: camera.isDeskViewDetected,

    // Calibration state
    calibrationGrid: calibration.calibration,
    isCalibrating: calibration.isCalibrating,
    calibrationMode,
    markerDetection,

    // Stability state
    isHandDetected: stability.isHandDetected,
    consecutiveFrames: stability.consecutiveFrames,

    // Actions
    enable,
    disable,
    startCalibration,
    finishCalibration,
    cancelCalibration,
    selectCamera,
    resetCalibration,
    setCalibrationMode,
  }
}
