'use client'

import { useCallback, useRef, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import { CameraCapture, type CameraSource } from '@/components/vision/CameraCapture'
import { useColumnClassifier } from '@/hooks/useColumnClassifier'
import type { CalibrationGrid } from '@/types/vision'

interface ModelTesterProps {
  /** Number of physical abacus columns (default 4) */
  columnCount?: number
}

/**
 * Test the trained model with live camera feed
 *
 * Shows the camera with marker detection, runs inference on each frame,
 * and displays the detected value with confidence.
 */
export function ModelTester({ columnCount = 4 }: ModelTesterProps) {
  const [cameraSource, setCameraSource] = useState<CameraSource>('local')
  const [isPhoneConnected, setIsPhoneConnected] = useState(false)
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null)
  const [detectedValue, setDetectedValue] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)

  const captureElementRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  const inferenceLoopRef = useRef<number | null>(null)
  const lastInferenceTimeRef = useRef<number>(0)

  const classifier = useColumnClassifier()

  // Handle capture from camera
  const handleCapture = useCallback((element: HTMLImageElement | HTMLVideoElement) => {
    captureElementRef.current = element
  }, [])

  // Run inference on current frame
  const runInference = useCallback(async () => {
    const element = captureElementRef.current
    if (!element) return

    // For video, check if ready
    if (element instanceof HTMLVideoElement && element.readyState < 2) return
    // For image, check if loaded
    if (element instanceof HTMLImageElement && (!element.complete || element.naturalWidth === 0))
      return

    try {
      // Import frame processor dynamically
      const { processImageFrame } = await import('@/lib/vision/frameProcessor')

      // For video, draw to temp image
      let imageElement: HTMLImageElement
      if (element instanceof HTMLVideoElement) {
        const canvas = document.createElement('canvas')
        canvas.width = element.videoWidth
        canvas.height = element.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(element, 0, 0)

        imageElement = new Image()
        imageElement.src = canvas.toDataURL('image/jpeg')
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve
          imageElement.onerror = reject
        })
      } else {
        imageElement = element
      }

      // Slice into columns (using calibration if available)
      const columnImages = processImageFrame(imageElement, calibration, columnCount)

      if (columnImages.length === 0) return

      // Run classification
      const result = await classifier.classifyColumns(columnImages)

      if (result) {
        // Combine digits into number
        const value = result.digits.reduce((acc, d) => acc * 10 + d, 0)
        const minConfidence = Math.min(...result.confidences)

        setDetectedValue(value)
        setConfidence(minConfidence)
      }
    } catch (err) {
      console.error('[ModelTester] Inference error:', err)
    }
  }, [calibration, columnCount, classifier])

  // Start/stop inference loop
  const toggleTesting = useCallback(() => {
    if (isRunning) {
      // Stop
      if (inferenceLoopRef.current) {
        cancelAnimationFrame(inferenceLoopRef.current)
        inferenceLoopRef.current = null
      }
      setIsRunning(false)
      setDetectedValue(null)
      setConfidence(0)
    } else {
      // Start
      setIsRunning(true)

      const loop = () => {
        const now = performance.now()
        // Run inference at ~10 FPS
        if (now - lastInferenceTimeRef.current > 100) {
          lastInferenceTimeRef.current = now
          runInference()
        }
        inferenceLoopRef.current = requestAnimationFrame(loop)
      }

      loop()
    }
  }, [isRunning, runInference])

  // Check if camera is ready
  const canTest = cameraSource === 'local' || isPhoneConnected

  return (
    <div
      data-component="model-tester"
      className={css({
        p: 3,
        bg: 'purple.900/20',
        border: '1px solid',
        borderColor: 'purple.700/50',
        borderRadius: 'lg',
      })}
    >
      {/* Header */}
      <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 3 })}>
        <span>🔬</span>
        <span className={css({ fontWeight: 'medium', color: 'purple.300' })}>Test Model</span>
        {classifier.isModelLoaded && (
          <span className={css({ fontSize: 'xs', color: 'green.400', ml: 'auto' })}>
            Model loaded
          </span>
        )}
      </div>

      {/* Camera */}
      <CameraCapture
        initialSource="local"
        onCapture={handleCapture}
        onSourceChange={setCameraSource}
        onPhoneConnected={setIsPhoneConnected}
        compact
        enableMarkerDetection
        columnCount={columnCount}
        onCalibrationChange={setCalibration}
        showRectifiedView
      />

      {/* Results display */}
      {isRunning && (
        <div
          className={css({
            mt: 3,
            p: 4,
            bg: 'gray.900',
            borderRadius: 'lg',
            textAlign: 'center',
          })}
        >
          <div
            className={css({
              fontSize: '4xl',
              fontWeight: 'bold',
              fontFamily: 'mono',
              color: confidence > 0.8 ? 'green.400' : confidence > 0.5 ? 'yellow.400' : 'red.400',
              mb: 1,
            })}
          >
            {detectedValue !== null ? detectedValue : '—'}
          </div>
          <div className={css({ fontSize: 'sm', color: 'gray.500' })}>
            Confidence: {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Controls */}
      {canTest && (
        <div className={css({ mt: 3, display: 'flex', justifyContent: 'center' })}>
          <button
            type="button"
            onClick={toggleTesting}
            disabled={classifier.isLoading}
            className={css({
              px: 6,
              py: 2,
              bg: isRunning ? 'red.600' : 'purple.600',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'medium',
              _hover: { bg: isRunning ? 'red.500' : 'purple.500' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {classifier.isLoading ? 'Loading...' : isRunning ? 'Stop Testing' : 'Start Testing'}
          </button>
        </div>
      )}

      {/* Calibration status */}
      <div className={css({ fontSize: 'xs', color: 'gray.500', mt: 3, textAlign: 'center' })}>
        {calibration ? (
          <span className={css({ color: 'green.400' })}>✓ Markers detected</span>
        ) : (
          <span>Point camera at abacus with markers</span>
        )}
      </div>
    </div>
  )
}
