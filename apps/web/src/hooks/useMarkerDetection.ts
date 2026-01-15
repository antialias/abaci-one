'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalibrationGrid } from '@/types/vision'
import {
  cleanupArucoDetector,
  detectMarkers,
  initArucoDetector,
  isArucoAvailable,
  loadAruco,
} from '@/lib/vision/arucoDetection'

export interface UseMarkerDetectionOptions {
  /** Whether marker detection is enabled */
  enabled: boolean
  /** Video element to detect markers from */
  videoElement: HTMLVideoElement | null
  /** Number of columns for the calibration grid */
  columnCount: number
  /** Callback when calibration changes */
  onCalibrationChange?: (calibration: CalibrationGrid | null) => void
}

export interface UseMarkerDetectionResult {
  /** Whether ArUco library is loaded and ready */
  isReady: boolean
  /** Number of markers currently detected (0-4) */
  markersFound: number
  /** Current calibration grid (null if not all 4 markers found) */
  calibration: CalibrationGrid | null
  /** Whether all 4 markers are detected and calibration is valid */
  isCalibrated: boolean
}

/**
 * Hook for ArUco marker detection and automatic calibration
 *
 * Detects 4 ArUco markers in the video feed and creates a calibration grid
 * for perspective correction. Used by:
 * - CameraCapture (training data capture)
 * - DockedVisionFeed (practice sessions)
 *
 * @example
 * ```tsx
 * const { isCalibrated, calibration, markersFound } = useMarkerDetection({
 *   enabled: true,
 *   videoElement: videoRef.current,
 *   columnCount: 4,
 *   onCalibrationChange: (cal) => console.log('Calibration updated:', cal),
 * })
 * ```
 */
export function useMarkerDetection({
  enabled,
  videoElement,
  columnCount,
  onCalibrationChange,
}: UseMarkerDetectionOptions): UseMarkerDetectionResult {
  const [isReady, setIsReady] = useState(false)
  const [markersFound, setMarkersFound] = useState(0)
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null)

  const detectionFrameRef = useRef<number | null>(null)
  const lastCalibrationRef = useRef<CalibrationGrid | null>(null)

  // Load and initialize ArUco library
  useEffect(() => {
    if (!enabled) {
      setIsReady(false)
      return
    }

    let cancelled = false

    const initAruco = async () => {
      try {
        await loadAruco()
        if (cancelled) return

        const available = isArucoAvailable()
        if (available) {
          initArucoDetector()
          setIsReady(true)
        }
      } catch (err) {
        console.error('[useMarkerDetection] Failed to load ArUco:', err)
      }
    }

    initAruco()

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Cleanup detector on unmount
  useEffect(() => {
    return () => {
      cleanupArucoDetector()
    }
  }, [])

  // Update calibration and notify callback
  const updateCalibration = useCallback(
    (newCalibration: CalibrationGrid | null) => {
      // Only update if changed (avoid infinite loops)
      const prev = lastCalibrationRef.current
      const changed =
        (prev === null && newCalibration !== null) ||
        (prev !== null && newCalibration === null) ||
        (prev !== null &&
          newCalibration !== null &&
          JSON.stringify(prev.corners) !== JSON.stringify(newCalibration.corners))

      if (changed) {
        lastCalibrationRef.current = newCalibration
        setCalibration(newCalibration)
        onCalibrationChange?.(newCalibration)
      }
    },
    [onCalibrationChange]
  )

  // Detection loop
  useEffect(() => {
    if (!enabled || !isReady || !videoElement) {
      // Stop detection if disabled or not ready
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current)
        detectionFrameRef.current = null
      }
      // Reset marker count when disabled, but keep calibration
      if (!enabled) {
        setMarkersFound(0)
      }
      return
    }

    let running = true

    const detectLoop = () => {
      if (!running) return

      // Wait for video to be ready
      if (videoElement.readyState < 2) {
        detectionFrameRef.current = requestAnimationFrame(detectLoop)
        return
      }

      const result = detectMarkers(videoElement)
      setMarkersFound(result.markersFound)

      // Update calibration ONLY when all 4 markers found
      // Do NOT clear calibration when markers are lost - keep using the last good calibration
      // (This matches DockedVisionFeed behavior)
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
        updateCalibration(grid)
      }
      // When markers are lost, keep the existing calibration

      detectionFrameRef.current = requestAnimationFrame(detectLoop)
    }

    detectLoop()

    return () => {
      running = false
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current)
        detectionFrameRef.current = null
      }
    }
  }, [enabled, isReady, videoElement, columnCount, updateCalibration])

  return {
    isReady,
    markersFound,
    calibration,
    isCalibrated: calibration !== null,
  }
}
