'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalibrationGrid, UseAbacusVisionReturn } from '@/types/vision'
import { useCameraCalibration } from './useCameraCalibration'
import { useDeskViewCamera } from './useDeskViewCamera'
import { useFrameStability } from './useFrameStability'

export interface UseAbacusVisionOptions {
  /** Number of abacus columns to detect */
  columnCount?: number
  /** Called when a stable value is detected */
  onValueDetected?: (value: number) => void
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
  const { columnCount = 5, onValueDetected } = options

  // State
  const [isEnabled, setIsEnabled] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)

  // Sub-hooks
  const camera = useDeskViewCamera()
  const calibration = useCameraCalibration()
  const stability = useFrameStability()

  // Video element ref for frame capture
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Track previous stable value to avoid duplicate callbacks
  const lastStableValueRef = useRef<number | null>(null)

  // Sync device ID to calibration hook when camera device changes
  useEffect(() => {
    if (camera.currentDevice?.deviceId) {
      calibration.setDeviceId(camera.currentDevice.deviceId)
    }
  }, [camera.currentDevice?.deviceId, calibration])

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
   * Process a video frame for detection
   * (Stub - actual classification will be added when model is ready)
   */
  const processFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !calibration.isCalibrated || !calibration.calibration) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Get full frame for motion detection
    const roi = calibration.calibration.roi
    const frameData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height)
    stability.pushFrameData(frameData)

    // TODO: When model is ready, slice into columns and classify
    // For now, we'll simulate detection with a placeholder
    // This will be replaced with actual TensorFlow.js inference

    // Placeholder: Read "value" from a simple heuristic or return null
    // Real implementation will use useColumnClassifier
  }, [calibration.isCalibrated, calibration.calibration, stability])

  /**
   * Detection loop
   */
  const runDetectionLoop = useCallback(() => {
    if (!isEnabled || !calibration.isCalibrated || calibration.isCalibrating) {
      return
    }

    setIsDetecting(true)
    processFrame()

    animationFrameRef.current = requestAnimationFrame(runDetectionLoop)
  }, [isEnabled, calibration.isCalibrated, calibration.isCalibrating, processFrame])

  // Start/stop detection loop based on state
  useEffect(() => {
    if (isEnabled && calibration.isCalibrated && !calibration.isCalibrating && camera.videoStream) {
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
    columnConfidences: [], // TODO: per-column confidences from classifier

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
  }
}
