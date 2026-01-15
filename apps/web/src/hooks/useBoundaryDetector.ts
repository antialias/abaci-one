'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectBoundary,
  isModelLoaded,
  isModelUnavailable,
  preloadModel,
  resetModelState,
  type BoundaryDetectionResult,
} from '@/lib/vision/boundaryDetector'
import type { QuadCorners, CalibrationGrid } from '@/types/vision'

export interface UseBoundaryDetectorOptions {
  /** Whether detection should be active */
  enabled?: boolean
  /** Number of abacus columns (for calibration grid) */
  columnCount?: number
  /** Called when corners are detected with good confidence */
  onCornersDetected?: (corners: QuadCorners) => void
  /** Minimum confidence threshold (0-1) to accept detection */
  confidenceThreshold?: number
  /** Number of consecutive stable frames required */
  stabilityFrames?: number
}

export interface UseBoundaryDetectorReturn {
  /** Whether the model is loaded and ready */
  isReady: boolean
  /** Whether the model is currently loading */
  isLoading: boolean
  /** Whether the model is unavailable (not trained) */
  isUnavailable: boolean
  /** Error message if any */
  error: string | null
  /** Current detected corners (if stable) */
  detectedCorners: QuadCorners | null
  /** Current detection confidence */
  confidence: number
  /** Number of consecutive frames with same detection */
  consecutiveFrames: number
  /** Detect corners from a video element */
  detectFromVideo: (video: HTMLVideoElement) => Promise<BoundaryDetectionResult | null>
  /** Detect corners from an image element */
  detectFromImage: (image: HTMLImageElement) => Promise<BoundaryDetectionResult | null>
  /** Create a CalibrationGrid from the current detection */
  createCalibrationGrid: () => CalibrationGrid | null
  /** Preload the model */
  preload: () => Promise<boolean>
  /** Reset model state (allows retrying after update) */
  resetModel: () => void
}

/**
 * Hook for using the boundary detector ML model
 *
 * Provides lazy-loading of the TensorFlow.js model and stable detection
 * of abacus corners from video or image frames.
 */
export function useBoundaryDetector(
  options: UseBoundaryDetectorOptions = {}
): UseBoundaryDetectorReturn {
  const {
    enabled = false,
    columnCount = 5,
    onCornersDetected,
    confidenceThreshold = 0.7,
    stabilityFrames = 3,
  } = options

  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUnavailable, setIsUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedCorners, setDetectedCorners] = useState<QuadCorners | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [consecutiveFrames, setConsecutiveFrames] = useState(0)

  // Stability tracking
  const lastCornersRef = useRef<QuadCorners | null>(null)
  const consecutiveFramesRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Create canvas for extracting image data
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
  }, [])

  // Preload model when enabled
  useEffect(() => {
    if (enabled && !isReady && !isLoading && !isUnavailable) {
      preload()
    }
  }, [enabled, isReady, isLoading, isUnavailable])

  /**
   * Preload the boundary detector model
   */
  const preload = useCallback(async (): Promise<boolean> => {
    if (isModelLoaded()) {
      setIsReady(true)
      return true
    }

    if (isModelUnavailable()) {
      setIsUnavailable(true)
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await preloadModel()
      setIsReady(success)
      setIsUnavailable(!success)
      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model'
      setError(message)
      setIsUnavailable(true)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Reset model state to allow retrying
   */
  const resetModel = useCallback(() => {
    resetModelState()
    setIsReady(false)
    setIsLoading(false)
    setIsUnavailable(false)
    setError(null)
  }, [])

  /**
   * Extract ImageData from a video element
   */
  const getImageDataFromVideo = useCallback((video: HTMLVideoElement): ImageData | null => {
    if (!canvasRef.current || video.readyState < 2) return null

    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [])

  /**
   * Extract ImageData from an image element
   */
  const getImageDataFromImage = useCallback((image: HTMLImageElement): ImageData | null => {
    if (!canvasRef.current || !image.complete) return null

    const canvas = canvasRef.current
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(image, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [])

  /**
   * Check if two corner sets are "similar" (for stability detection)
   */
  const cornersAreSimilar = useCallback(
    (a: QuadCorners, b: QuadCorners, threshold = 0.02): boolean => {
      const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const
      for (const corner of corners) {
        const dx = Math.abs(a[corner].x - b[corner].x)
        const dy = Math.abs(a[corner].y - b[corner].y)
        if (dx > threshold || dy > threshold) {
          return false
        }
      }
      return true
    },
    []
  )

  /**
   * Update stability tracking
   */
  const updateStability = useCallback(
    (corners: QuadCorners | null, conf: number) => {
      if (!corners || conf < confidenceThreshold) {
        // Reset stability
        consecutiveFramesRef.current = 0
        lastCornersRef.current = null
        setConsecutiveFrames(0)
        return
      }

      if (lastCornersRef.current && cornersAreSimilar(corners, lastCornersRef.current)) {
        // Similar to last detection - increment stability
        consecutiveFramesRef.current++
        setConsecutiveFrames(consecutiveFramesRef.current)

        if (consecutiveFramesRef.current >= stabilityFrames) {
          // Stable detection achieved
          setDetectedCorners(corners)
          onCornersDetected?.(corners)
        }
      } else {
        // Different from last detection - reset
        consecutiveFramesRef.current = 1
        lastCornersRef.current = corners
        setConsecutiveFrames(1)
      }

      setConfidence(conf)
    },
    [confidenceThreshold, stabilityFrames, cornersAreSimilar, onCornersDetected]
  )

  /**
   * Detect corners from a video element
   */
  const detectFromVideo = useCallback(
    async (video: HTMLVideoElement): Promise<BoundaryDetectionResult | null> => {
      const imageData = getImageDataFromVideo(video)
      if (!imageData) return null

      const result = await detectBoundary(imageData)
      if (result) {
        updateStability(result.corners, result.confidence)
      }
      return result
    },
    [getImageDataFromVideo, updateStability]
  )

  /**
   * Detect corners from an image element
   */
  const detectFromImage = useCallback(
    async (image: HTMLImageElement): Promise<BoundaryDetectionResult | null> => {
      const imageData = getImageDataFromImage(image)
      if (!imageData) return null

      const result = await detectBoundary(imageData)
      if (result) {
        updateStability(result.corners, result.confidence)
      }
      return result
    },
    [getImageDataFromImage, updateStability]
  )

  /**
   * Create a CalibrationGrid from the current stable detection
   */
  const createCalibrationGrid = useCallback((): CalibrationGrid | null => {
    if (!detectedCorners) return null

    // Calculate ROI from corners
    const left = Math.min(detectedCorners.topLeft.x, detectedCorners.bottomLeft.x)
    const right = Math.max(detectedCorners.topRight.x, detectedCorners.bottomRight.x)
    const top = Math.min(detectedCorners.topLeft.y, detectedCorners.topRight.y)
    const bottom = Math.max(detectedCorners.bottomLeft.y, detectedCorners.bottomRight.y)

    return {
      roi: {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      },
      corners: detectedCorners,
      columnCount,
      columnDividers: Array.from({ length: columnCount - 1 }, (_, i) => (i + 1) / columnCount),
      rotation: 0,
    }
  }, [detectedCorners, columnCount])

  return {
    isReady,
    isLoading,
    isUnavailable,
    error,
    detectedCorners,
    confidence,
    consecutiveFrames,
    detectFromVideo,
    detectFromImage,
    createCalibrationGrid,
    preload,
    resetModel,
  }
}
