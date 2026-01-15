'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClassificationResult, BeadPositionResult } from '@/lib/vision/columnClassifier'

export interface UseColumnClassifierReturn {
  /** Whether the model is loaded and ready */
  isModelLoaded: boolean
  /** Whether the model is currently loading */
  isLoading: boolean
  /** Whether the model is unavailable (doesn't exist / failed to load) */
  isModelUnavailable: boolean
  /** Error message if model failed to load */
  error: string | null

  /** Classify a single column image */
  classifyColumn: (imageData: ImageData) => Promise<ClassificationResult | null>

  /** Classify multiple column images */
  classifyColumns: (columnImages: ImageData[]) => Promise<{
    digits: number[]
    confidences: number[]
    beadPositions: BeadPositionResult[]
  } | null>

  /** Preload the model. Returns true if successful, false if unavailable */
  preload: () => Promise<boolean>

  /** Dispose of the model */
  dispose: () => void

  /** Reset model state to allow retrying after a failure */
  reset: () => Promise<void>
}

/**
 * Hook for using the TensorFlow.js column classifier
 *
 * Handles lazy loading of the model and provides classification methods.
 *
 * Usage:
 * ```tsx
 * const classifier = useColumnClassifier()
 *
 * // Preload model when component mounts
 * useEffect(() => {
 *   classifier.preload()
 * }, [])
 *
 * // Classify columns
 * const results = await classifier.classifyColumns(columnImages)
 * ```
 */
export function useColumnClassifier(): UseColumnClassifierReturn {
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isModelUnavailable, setIsModelUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lazy-loaded classifier module
  const classifierRef = useRef<typeof import('@/lib/vision/columnClassifier') | null>(null)

  /**
   * Lazy load the classifier module
   */
  const loadClassifier = useCallback(async () => {
    if (classifierRef.current) return classifierRef.current

    const classifier = await import('@/lib/vision/columnClassifier')
    classifierRef.current = classifier
    return classifier
  }, [])

  /**
   * Preload the model
   * Returns true if model loaded successfully, false if unavailable
   */
  const preload = useCallback(async (): Promise<boolean> => {
    if (isModelLoaded) return true
    if (isModelUnavailable) return false
    if (isLoading) return false

    setIsLoading(true)
    setError(null)

    try {
      const classifier = await loadClassifier()
      const success = await classifier.preloadModel()

      if (success) {
        setIsModelLoaded(true)
        return true
      } else {
        setIsModelUnavailable(true)
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model'
      setError(message)
      setIsModelUnavailable(true)
      console.error('[useColumnClassifier] Model loading failed:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isModelLoaded, isModelUnavailable, isLoading, loadClassifier])

  /**
   * Classify a single column
   */
  const classifyColumn = useCallback(
    async (imageData: ImageData): Promise<ClassificationResult | null> => {
      try {
        const classifier = await loadClassifier()

        // Auto-load model if not loaded
        if (!classifier.isModelLoaded()) {
          await classifier.preloadModel()
          setIsModelLoaded(true)
        }

        return await classifier.classifyColumn(imageData)
      } catch (err) {
        console.error('[useColumnClassifier] Classification failed:', err)
        return null
      }
    },
    [loadClassifier]
  )

  /**
   * Classify multiple columns
   */
  const classifyColumns = useCallback(
    async (
      columnImages: ImageData[]
    ): Promise<{
      digits: number[]
      confidences: number[]
      beadPositions: BeadPositionResult[]
    } | null> => {
      if (columnImages.length === 0) return { digits: [], confidences: [], beadPositions: [] }

      try {
        const classifier = await loadClassifier()

        // Auto-load model if not loaded
        if (!classifier.isModelLoaded()) {
          await classifier.preloadModel()
          setIsModelLoaded(true)
        }

        const results = await classifier.classifyColumns(columnImages)

        // Model unavailable
        if (!results) return null

        return {
          digits: results.map((r) => r.digit),
          confidences: results.map((r) => r.confidence),
          beadPositions: results.map((r) => r.beadPosition),
        }
      } catch (err) {
        console.error('[useColumnClassifier] Batch classification failed:', err)
        return null
      }
    },
    [loadClassifier]
  )

  /**
   * Dispose of the model
   */
  const dispose = useCallback(() => {
    if (classifierRef.current) {
      classifierRef.current.disposeModel()
      setIsModelLoaded(false)
    }
  }, [])

  /**
   * Reset model state to allow retrying after a failure
   */
  const reset = useCallback(async (): Promise<void> => {
    const classifier = await loadClassifier()
    classifier.resetModelState()
    setIsModelLoaded(false)
    setIsModelUnavailable(false)
    setError(null)
    setIsLoading(false)
  }, [loadClassifier])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't dispose on unmount - model can be reused
      // Only dispose explicitly when needed
    }
  }, [])

  return {
    isModelLoaded,
    isLoading,
    isModelUnavailable,
    error,
    classifyColumn,
    classifyColumns,
    preload,
    dispose,
    reset,
  }
}
