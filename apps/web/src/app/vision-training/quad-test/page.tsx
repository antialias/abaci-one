'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenCvProvider, useOpenCv } from 'opencv-react'
import { css } from '../../../../styled-system/css'
import {
  useQuadDetection,
  type DetectedQuad,
  type TrackedQuad,
  type Point,
  type DebugPolygon,
  type QuadDetectorConfig,
} from '@/lib/vision/useQuadDetection'
import type { PreprocessingStrategy } from '@/lib/vision/quadDetector'

/**
 * Test page for quad detection.
 * Uses opencv-react for loading OpenCV, and the new useQuadDetection hook.
 *
 * Step 5: Testing useQuadDetection hook
 */
export default function QuadTestPage() {
  return (
    <OpenCvProvider openCvPath="/opencv.js">
      <QuadTestContent />
    </OpenCvProvider>
  )
}

function QuadTestContent() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Static image testing
  const [staticImageCanvas, setStaticImageCanvas] = useState<HTMLCanvasElement | null>(null)
  const [staticDetectionResult, setStaticDetectionResult] = useState<{
    detected: boolean
    quads: DetectedQuad[]
    corners: Point[]
    detectionTimeMs: number
  } | null>(null)

  // Debug mode toggle
  const [debugMode, setDebugMode] = useState(true)

  // Detection profiles for different scenarios
  type DetectionProfile = {
    name: string
    description: string
    strategy: PreprocessingStrategy
    histogramEqualization: boolean
    adaptiveThreshold: boolean
    morphGradient: boolean
    blockSize: number
    adaptiveC: number
    cannyLow: number
    cannyHigh: number
    houghLines: boolean
    houghThreshold: number
    houghMinLineLength: number
    houghMaxLineGap: number
    // Optional detector config overrides
    minAreaRatio?: number
    maxAreaRatio?: number
  }

  const DETECTION_PROFILES: Record<string, DetectionProfile> = {
    balanced: {
      name: 'Balanced',
      description: 'Good all-around detection for typical conditions',
      strategy: 'multi',
      histogramEqualization: true,
      adaptiveThreshold: true,
      morphGradient: true,
      blockSize: 11,
      adaptiveC: 2,
      cannyLow: 50,
      cannyHigh: 150,
      houghLines: true,
      houghThreshold: 50,
      houghMinLineLength: 50,
      houghMaxLineGap: 10,
    },
    lowContrast: {
      name: 'Low Contrast',
      description: 'For faded, washed-out, or poorly lit documents',
      strategy: 'multi',
      histogramEqualization: true,
      adaptiveThreshold: true,
      morphGradient: true,
      blockSize: 15,
      adaptiveC: 5,
      cannyLow: 20,
      cannyHigh: 80,
      houghLines: true,
      houghThreshold: 30,
      houghMinLineLength: 40,
      houghMaxLineGap: 20,
    },
    highContrast: {
      name: 'High Contrast',
      description: 'For well-lit documents with clear edges',
      strategy: 'standard',
      histogramEqualization: false,
      adaptiveThreshold: false,
      morphGradient: false,
      blockSize: 11,
      adaptiveC: 2,
      cannyLow: 80,
      cannyHigh: 200,
      houghLines: false,
      houghThreshold: 50,
      houghMinLineLength: 50,
      houghMaxLineGap: 10,
    },
    fingerOcclusion: {
      name: 'Finger Occlusion',
      description: 'When hands are covering document edges',
      strategy: 'multi',
      histogramEqualization: true,
      adaptiveThreshold: true,
      morphGradient: true,
      blockSize: 11,
      adaptiveC: 2,
      cannyLow: 40,
      cannyHigh: 120,
      houghLines: true,
      houghThreshold: 30,
      houghMinLineLength: 30,
      houghMaxLineGap: 30,
    },
    complexBackground: {
      name: 'Complex Background',
      description: 'For busy backgrounds with many edges',
      strategy: 'enhanced',
      histogramEqualization: true,
      adaptiveThreshold: false,
      morphGradient: false,
      blockSize: 11,
      adaptiveC: 2,
      cannyLow: 80,
      cannyHigh: 200,
      houghLines: true,
      houghThreshold: 70,
      houghMinLineLength: 80,
      houghMaxLineGap: 5,
      minAreaRatio: 0.2,
    },
    bookPages: {
      name: 'Book Pages',
      description: 'For detecting pages in open books',
      strategy: 'multi',
      histogramEqualization: true,
      adaptiveThreshold: true,
      morphGradient: false,
      blockSize: 9,
      adaptiveC: 3,
      cannyLow: 30,
      cannyHigh: 100,
      houghLines: true,
      houghThreshold: 40,
      houghMinLineLength: 40,
      houghMaxLineGap: 15,
      minAreaRatio: 0.08,
      maxAreaRatio: 0.6,
    },
    aggressive: {
      name: 'Aggressive',
      description: 'Maximum edge detection - may have false positives',
      strategy: 'multi',
      histogramEqualization: true,
      adaptiveThreshold: true,
      morphGradient: true,
      blockSize: 7,
      adaptiveC: 0,
      cannyLow: 15,
      cannyHigh: 50,
      houghLines: true,
      houghThreshold: 20,
      houghMinLineLength: 20,
      houghMaxLineGap: 40,
      minAreaRatio: 0.05,
    },
  }

  // Active profile
  const [activeProfile, setActiveProfile] = useState<string>('balanced')

  // Preprocessing config defaults (matches 'balanced' profile)
  const PREPROCESSING_DEFAULTS = DETECTION_PROFILES.balanced

  const STORAGE_KEY = 'quad-detection-preprocessing'

  // Preprocessing config state - initialize with defaults to avoid hydration mismatch
  const [preprocessingStrategy, setPreprocessingStrategy] = useState<PreprocessingStrategy>(
    PREPROCESSING_DEFAULTS.strategy
  )
  const [enableHistogramEqualization, setEnableHistogramEqualization] = useState(
    PREPROCESSING_DEFAULTS.histogramEqualization
  )
  const [enableAdaptiveThreshold, setEnableAdaptiveThreshold] = useState(
    PREPROCESSING_DEFAULTS.adaptiveThreshold
  )
  const [enableMorphGradient, setEnableMorphGradient] = useState(
    PREPROCESSING_DEFAULTS.morphGradient
  )
  const [adaptiveBlockSize, setAdaptiveBlockSize] = useState(PREPROCESSING_DEFAULTS.blockSize)
  const [adaptiveC, setAdaptiveC] = useState(PREPROCESSING_DEFAULTS.adaptiveC)
  const [cannyLow, setCannyLow] = useState(PREPROCESSING_DEFAULTS.cannyLow)
  const [cannyHigh, setCannyHigh] = useState(PREPROCESSING_DEFAULTS.cannyHigh)
  // Hough line detection
  const [enableHoughLines, setEnableHoughLines] = useState(PREPROCESSING_DEFAULTS.houghLines)
  const [houghThreshold, setHoughThreshold] = useState(PREPROCESSING_DEFAULTS.houghThreshold)
  const [houghMinLineLength, setHoughMinLineLength] = useState(
    PREPROCESSING_DEFAULTS.houghMinLineLength
  )
  const [houghMaxLineGap, setHoughMaxLineGap] = useState(PREPROCESSING_DEFAULTS.houghMaxLineGap)

  // Track if we've loaded from storage
  const hasLoadedFromStorage = useRef(false)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)

  // Load from localStorage on mount (client-side only, after hydration)
  useEffect(() => {
    if (hasLoadedFromStorage.current) return
    hasLoadedFromStorage.current = true

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const settings = JSON.parse(stored)
        if (settings.strategy) setPreprocessingStrategy(settings.strategy)
        if (settings.histogramEqualization !== undefined)
          setEnableHistogramEqualization(settings.histogramEqualization)
        if (settings.adaptiveThreshold !== undefined)
          setEnableAdaptiveThreshold(settings.adaptiveThreshold)
        if (settings.morphGradient !== undefined) setEnableMorphGradient(settings.morphGradient)
        if (settings.blockSize !== undefined) setAdaptiveBlockSize(settings.blockSize)
        if (settings.adaptiveC !== undefined) setAdaptiveC(settings.adaptiveC)
        if (settings.cannyLow !== undefined) setCannyLow(settings.cannyLow)
        if (settings.cannyHigh !== undefined) setCannyHigh(settings.cannyHigh)
        // Hough line settings
        if (settings.houghLines !== undefined) setEnableHoughLines(settings.houghLines)
        if (settings.houghThreshold !== undefined) setHoughThreshold(settings.houghThreshold)
        if (settings.houghMinLineLength !== undefined)
          setHoughMinLineLength(settings.houghMinLineLength)
        if (settings.houghMaxLineGap !== undefined) setHoughMaxLineGap(settings.houghMaxLineGap)
      }
    } catch {
      // Ignore parse errors
    }
    setIsSettingsLoaded(true)
  }, [])

  // Save to localStorage when settings change (skip until after initial load)
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return // Don't save until we've loaded
    const settings = {
      strategy: preprocessingStrategy,
      histogramEqualization: enableHistogramEqualization,
      adaptiveThreshold: enableAdaptiveThreshold,
      morphGradient: enableMorphGradient,
      blockSize: adaptiveBlockSize,
      adaptiveC,
      cannyLow,
      cannyHigh,
      // Hough line settings
      houghLines: enableHoughLines,
      houghThreshold,
      houghMinLineLength,
      houghMaxLineGap,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [
    preprocessingStrategy,
    enableHistogramEqualization,
    enableAdaptiveThreshold,
    enableMorphGradient,
    adaptiveBlockSize,
    adaptiveC,
    cannyLow,
    cannyHigh,
    enableHoughLines,
    houghThreshold,
    houghMinLineLength,
    houghMaxLineGap,
  ])

  // Apply a profile
  const applyProfile = useCallback((profileKey: string) => {
    const profile = DETECTION_PROFILES[profileKey]
    if (!profile) return

    setActiveProfile(profileKey)
    setPreprocessingStrategy(profile.strategy)
    setEnableHistogramEqualization(profile.histogramEqualization)
    setEnableAdaptiveThreshold(profile.adaptiveThreshold)
    setEnableMorphGradient(profile.morphGradient)
    setAdaptiveBlockSize(profile.blockSize)
    setAdaptiveC(profile.adaptiveC)
    setCannyLow(profile.cannyLow)
    setCannyHigh(profile.cannyHigh)
    setEnableHoughLines(profile.houghLines)
    setHoughThreshold(profile.houghThreshold)
    setHoughMinLineLength(profile.houghMinLineLength)
    setHoughMaxLineGap(profile.houghMaxLineGap)
  }, [])

  // Reset to defaults (balanced profile)
  const resetPreprocessingSettings = useCallback(() => {
    applyProfile('balanced')
    localStorage.removeItem(STORAGE_KEY)
  }, [applyProfile])

  // Build detector config from state - memoize to prevent detector recreation every frame
  const detectorConfig = useMemo<Partial<QuadDetectorConfig>>(() => {
    const profile = DETECTION_PROFILES[activeProfile]
    return {
      preprocessing: preprocessingStrategy,
      enableHistogramEqualization,
      enableAdaptiveThreshold,
      enableMorphGradient,
      adaptiveBlockSize,
      adaptiveC,
      cannyThresholds: [cannyLow, cannyHigh],
      // Hough line settings
      enableHoughLines,
      houghThreshold,
      houghMinLineLength,
      houghMaxLineGap,
      // Profile-specific area constraints
      ...(profile?.minAreaRatio !== undefined && {
        minAreaRatio: profile.minAreaRatio,
      }),
      ...(profile?.maxAreaRatio !== undefined && {
        maxAreaRatio: profile.maxAreaRatio,
      }),
    }
  }, [
    activeProfile,
    preprocessingStrategy,
    enableHistogramEqualization,
    enableAdaptiveThreshold,
    enableMorphGradient,
    adaptiveBlockSize,
    adaptiveC,
    cannyLow,
    cannyHigh,
    enableHoughLines,
    houghThreshold,
    houghMinLineLength,
    houghMaxLineGap,
  ])

  // Use the new combined hook with config
  const { isReady, isLoading, detectInImage, detectWithDebug, processFrame, stats, resetTracking } =
    useQuadDetection({ detector: detectorConfig })

  // Also get raw opencv for load time measurement (test page specific)
  const { loaded: opencvLoaded } = useOpenCv()

  // Track load time for opencv-react
  const [loadStartTime] = useState(() => Date.now())
  const [opencvLoadTime, setOpencvLoadTime] = useState<number | null>(null)

  useEffect(() => {
    if (opencvLoaded && !opencvLoadTime) {
      setOpencvLoadTime(Date.now() - loadStartTime)
    }
  }, [opencvLoaded, opencvLoadTime, loadStartTime])

  // Load image to canvas utility
  const loadImageToCanvas = useCallback(async (file: File): Promise<HTMLCanvasElement | null> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }

      img.src = url
    })
  }, [])

  // Capture video frame to canvas
  const captureVideoFrame = useCallback((video: HTMLVideoElement): HTMLCanvasElement | null => {
    if (!video.videoWidth || !video.videoHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas
  }, [])

  // Handle static image upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!isReady) {
        setCameraError('Detector not ready')
        return
      }

      const canvas = await loadImageToCanvas(file)
      if (!canvas) {
        setCameraError('Failed to load image')
        return
      }

      setStaticImageCanvas(canvas)

      // Run detection with timing
      const startTime = performance.now()
      try {
        const quads = detectInImage(canvas)
        const detectionTimeMs = performance.now() - startTime

        setStaticDetectionResult({
          detected: quads.length > 0,
          quads,
          corners: quads[0]?.corners ?? getFallbackCorners(canvas.width, canvas.height),
          detectionTimeMs,
        })
        setCameraError(null)
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : 'Detection failed')
        setStaticDetectionResult(null)
      }
    },
    [isReady, detectInImage, loadImageToCanvas]
  )

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)

      if (!isReady) {
        setCameraError('Detector not ready')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsCameraActive(true)
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to start camera')
    }
  }, [isReady])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCameraActive(false)
  }, [])

  // Camera detection loop state
  const [cameraDebugInfo, setCameraDebugInfo] = useState<{
    quadsDetected: number
    detectionTimeMs: number
    trackedCount: number
    bestStability: number
    bestFrameCount: number
    isStable: boolean
    isLocked: boolean
    debugPolygons: DebugPolygon[]
  }>({
    quadsDetected: 0,
    detectionTimeMs: 0,
    // QuadTracker stats
    trackedCount: 0,
    bestStability: 0,
    bestFrameCount: 0,
    isStable: false,
    isLocked: false,
    debugPolygons: [],
  })

  // Detection loop for camera
  useEffect(() => {
    if (!isCameraActive || !isReady) return

    // Reset tracker when camera starts
    resetTracking()

    let errorCount = 0
    const MAX_CONSECUTIVE_ERRORS = 5

    const runDetection = () => {
      if (videoRef.current && overlayRef.current) {
        const frame = captureVideoFrame(videoRef.current)
        if (frame) {
          const startTime = performance.now()
          try {
            if (debugMode) {
              // Use debug mode to see all candidate polygons
              const debugResult = detectWithDebug(frame)
              const detectionTimeMs = performance.now() - startTime

              setCameraDebugInfo({
                quadsDetected: debugResult.quads.length,
                detectionTimeMs,
                trackedCount: 0,
                bestStability: 0,
                bestFrameCount: 0,
                isStable: false,
                isLocked: false,
                debugPolygons: debugResult.debugPolygons,
              })

              // Draw overlay with debug polygons
              drawDebugOverlay(
                overlayRef.current,
                frame.width,
                frame.height,
                debugResult.quads,
                debugResult.debugPolygons
              )
            } else {
              // Use the hook's processFrame which handles detection + tracking
              const result = processFrame(frame)
              const detectionTimeMs = performance.now() - startTime

              setCameraDebugInfo({
                quadsDetected: result.detectedQuads.length,
                detectionTimeMs,
                trackedCount: result.stats.trackedCount,
                bestStability: result.stats.bestStability,
                bestFrameCount: result.stats.bestFrameCount,
                isStable: result.trackedQuad?.isStable ?? false,
                isLocked: result.trackedQuad?.isLocked ?? false,
                debugPolygons: [],
              })

              // Draw overlay with tracked quad
              drawTrackedQuadOverlay(
                overlayRef.current,
                frame.width,
                frame.height,
                result.detectedQuads,
                result.trackedQuad
              )
            }
            // Reset error count on success
            errorCount = 0
          } catch (err) {
            errorCount++
            // Only log occasionally to avoid console spam
            if (errorCount === 1 || errorCount === MAX_CONSECUTIVE_ERRORS) {
              console.error(
                `Detection error (${errorCount}x):`,
                typeof err === 'number' ? `OpenCV error code: ${err} (0x${err.toString(16)})` : err
              )
            }
            // If too many errors, slow down to avoid hammering
            if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
              console.warn('Too many detection errors, pausing for 1 second...')
              setTimeout(() => {
                errorCount = 0
                animationFrameRef.current = requestAnimationFrame(runDetection)
              }, 1000)
              return
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(runDetection)
    }

    runDetection()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [
    isCameraActive,
    isReady,
    debugMode,
    processFrame,
    detectWithDebug,
    resetTracking,
    captureVideoFrame,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Draw static detection result
  useEffect(() => {
    if (!staticImageCanvas || !staticDetectionResult) return

    const container = document.getElementById('static-image-container')
    if (!container) return

    container.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'
    wrapper.style.display = 'inline-block'

    // Add source image
    const imgCanvas = document.createElement('canvas')
    imgCanvas.width = staticImageCanvas.width
    imgCanvas.height = staticImageCanvas.height
    imgCanvas.style.maxWidth = '100%'
    imgCanvas.style.height = 'auto'
    const imgCtx = imgCanvas.getContext('2d')
    imgCtx?.drawImage(staticImageCanvas, 0, 0)
    wrapper.appendChild(imgCanvas)

    // Add overlay canvas
    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.width = staticImageCanvas.width
    overlayCanvas.height = staticImageCanvas.height
    overlayCanvas.style.position = 'absolute'
    overlayCanvas.style.top = '0'
    overlayCanvas.style.left = '0'
    overlayCanvas.style.maxWidth = '100%'
    overlayCanvas.style.height = 'auto'
    overlayCanvas.style.pointerEvents = 'none'
    wrapper.appendChild(overlayCanvas)

    // Draw quad on overlay
    drawQuadOverlay(
      overlayCanvas,
      staticImageCanvas.width,
      staticImageCanvas.height,
      staticDetectionResult.quads
    )

    container.appendChild(wrapper)
  }, [staticImageCanvas, staticDetectionResult])

  return (
    <div
      data-component="quad-test-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        p: 4,
      })}
    >
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 4 })}>
        Quad Detection Test Page
      </h1>

      {/* Status bar */}
      <div
        className={css({
          display: 'flex',
          gap: 4,
          mb: 4,
          p: 3,
          bg: 'gray.800',
          borderRadius: 'lg',
          flexWrap: 'wrap',
        })}
      >
        <StatusBadge label="opencv-react" status={opencvLoaded ? 'ready' : 'loading'} />
        <StatusBadge
          label="useQuadDetection"
          status={isReady ? 'ready' : isLoading ? 'loading' : 'idle'}
        />
        {cameraError && <span className={css({ color: 'red.400' })}>Error: {cameraError}</span>}
      </div>

      {/* Debug info */}
      <div
        className={css({
          mb: 4,
          p: 3,
          bg: 'gray.800',
          borderRadius: 'lg',
          fontFamily: 'mono',
          fontSize: 'sm',
        })}
      >
        <div className={css({ fontWeight: 'bold', mb: 2 })}>Debug Info:</div>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 2,
          })}
        >
          <div>
            opencv-react load: {opencvLoadTime ?? '-'}ms
            {opencvLoaded && (
              <span className={css({ color: 'green.400', ml: 2 })}>✓ cv available</span>
            )}
          </div>
          <div>
            useQuadDetection:{' '}
            {isReady ? (
              <span className={css({ color: 'green.400' })}>✓ ready</span>
            ) : (
              <span className={css({ color: 'gray.500' })}>waiting...</span>
            )}
          </div>
          {isCameraActive && (
            <>
              <div>Camera quads: {cameraDebugInfo.quadsDetected}</div>
              <div>Camera detection: {cameraDebugInfo.detectionTimeMs.toFixed(1)}ms</div>
              <div>Tracked quads: {cameraDebugInfo.trackedCount}</div>
              <div>Best stability: {(cameraDebugInfo.bestStability * 100).toFixed(0)}%</div>
              <div>Best frames: {cameraDebugInfo.bestFrameCount}</div>
              <div>
                Status:{' '}
                <span
                  className={css({
                    color: cameraDebugInfo.isLocked
                      ? 'green.400'
                      : cameraDebugInfo.isStable
                        ? 'yellow.400'
                        : 'gray.400',
                  })}
                >
                  {cameraDebugInfo.isLocked
                    ? 'LOCKED'
                    : cameraDebugInfo.isStable
                      ? 'STABLE'
                      : 'tracking...'}
                </span>
              </div>
            </>
          )}
          {staticDetectionResult && (
            <>
              <div>Static quads: {staticDetectionResult.quads.length}</div>
              <div>Static detection: {staticDetectionResult.detectionTimeMs.toFixed(1)}ms</div>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
          gap: 4,
        })}
      >
        {/* Camera section */}
        <div className={css({ bg: 'gray.800', borderRadius: 'lg', p: 4 })}>
          <h2 className={css({ fontSize: 'lg', fontWeight: 'bold', mb: 3 })}>
            Camera Feed (Real-time Detection)
          </h2>

          <div
            className={css({
              mb: 3,
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
            })}
          >
            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={!isReady}
                className={css({
                  px: 4,
                  py: 2,
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.500' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                {isLoading
                  ? 'Loading OpenCV...'
                  : !isReady
                    ? 'Creating detector...'
                    : 'Start Camera'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className={css({
                  px: 4,
                  py: 2,
                  bg: 'red.600',
                  color: 'white',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: { bg: 'red.500' },
                })}
              >
                Stop Camera
              </button>
            )}
            <button
              type="button"
              onClick={() => setDebugMode(!debugMode)}
              className={css({
                px: 4,
                py: 2,
                bg: debugMode ? 'orange.600' : 'gray.600',
                color: 'white',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                _hover: { bg: debugMode ? 'orange.500' : 'gray.500' },
              })}
            >
              {debugMode ? 'Debug ON' : 'Debug OFF'}
            </button>
          </div>

          {/* Preprocessing Controls */}
          <div
            className={css({
              mb: 3,
              p: 3,
              bg: 'gray.700',
              borderRadius: 'md',
              opacity: isSettingsLoaded ? 1 : 0,
              transition: 'opacity 0.15s ease-in',
            })}
          >
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              })}
            >
              <div className={css({ fontWeight: 'bold', fontSize: 'sm' })}>
                Preprocessing Controls
              </div>
              <button
                type="button"
                onClick={resetPreprocessingSettings}
                className={css({
                  px: 2,
                  py: 1,
                  fontSize: 'xs',
                  bg: 'gray.600',
                  color: 'gray.300',
                  borderRadius: 'sm',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: { bg: 'gray.500', color: 'white' },
                })}
              >
                Reset to Defaults
              </button>
            </div>

            {/* Profile Selector */}
            <div className={css({ mb: 3 })}>
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.300',
                  mb: 2,
                  fontWeight: 'medium',
                })}
              >
                Quick Profiles
              </div>
              <div
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                })}
              >
                {Object.entries(DETECTION_PROFILES).map(([key, profile]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyProfile(key)}
                    title={profile.description}
                    className={css({
                      px: 2,
                      py: 1,
                      fontSize: 'xs',
                      bg: activeProfile === key ? 'blue.600' : 'gray.600',
                      color: activeProfile === key ? 'white' : 'gray.300',
                      borderRadius: 'sm',
                      border: activeProfile === key ? '1px solid' : '1px solid transparent',
                      borderColor: activeProfile === key ? 'blue.400' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      _hover: {
                        bg: activeProfile === key ? 'blue.500' : 'gray.500',
                        color: 'white',
                      },
                    })}
                  >
                    {profile.name}
                  </button>
                ))}
              </div>
              {activeProfile && DETECTION_PROFILES[activeProfile] && (
                <div
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.400',
                    mt: 2,
                    lineHeight: 1.3,
                  })}
                >
                  <strong className={css({ color: 'gray.300' })}>
                    {DETECTION_PROFILES[activeProfile].name}:
                  </strong>{' '}
                  {DETECTION_PROFILES[activeProfile].description}
                </div>
              )}
            </div>

            <div
              className={css({
                fontSize: 'xs',
                color: 'gray.400',
                mb: 3,
                lineHeight: 1.4,
              })}
            >
              Select a profile above for quick setup, or adjust individual settings below.
            </div>

            {/* Strategy selector */}
            <div className={css({ mb: 3 })}>
              <label
                className={css({
                  display: 'block',
                  fontSize: 'xs',
                  color: 'gray.300',
                  mb: 1,
                  fontWeight: 'medium',
                })}
              >
                Strategy
              </label>
              <select
                value={preprocessingStrategy}
                onChange={(e) => setPreprocessingStrategy(e.target.value as PreprocessingStrategy)}
                className={css({
                  bg: 'gray.600',
                  color: 'white',
                  border: '1px solid',
                  borderColor: 'gray.500',
                  borderRadius: 'md',
                  px: 2,
                  py: 1,
                  fontSize: 'sm',
                  width: '100%',
                })}
              >
                <option value="standard">Standard - Basic edge detection</option>
                <option value="enhanced">Enhanced - Better for low contrast</option>
                <option value="adaptive">Adaptive - Best for uneven lighting</option>
                <option value="multi">Multi - Tries everything (recommended)</option>
              </select>
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.500',
                  mt: 1,
                  lineHeight: 1.3,
                })}
              >
                {preprocessingStrategy === 'standard' &&
                  'Fast but needs good lighting and clear edges.'}
                {preprocessingStrategy === 'enhanced' &&
                  'Boosts contrast first. Good for faded or washed-out images.'}
                {preprocessingStrategy === 'adaptive' &&
                  'Handles shadows and uneven lighting. Good for documents on dark surfaces.'}
                {preprocessingStrategy === 'multi' &&
                  'Combines all methods. Best detection but slightly slower.'}
              </div>
            </div>

            {/* Toggle switches with descriptions */}
            <div className={css({ mb: 3 })}>
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.300',
                  mb: 2,
                  fontWeight: 'medium',
                })}
              >
                Enhancement Options
              </div>
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                })}
              >
                <div>
                  <ToggleSwitch
                    label="Histogram Equalization"
                    checked={enableHistogramEqualization}
                    onChange={setEnableHistogramEqualization}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      ml: '44px',
                      mt: '2px',
                    })}
                  >
                    Spreads out brightness levels. Turn ON for low-contrast images.
                  </div>
                </div>
                <div>
                  <ToggleSwitch
                    label="Adaptive Threshold"
                    checked={enableAdaptiveThreshold}
                    onChange={setEnableAdaptiveThreshold}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      ml: '44px',
                      mt: '2px',
                    })}
                  >
                    Detects edges locally. Turn ON when lighting is uneven across the document.
                  </div>
                </div>
                <div>
                  <ToggleSwitch
                    label="Morphological Gradient"
                    checked={enableMorphGradient}
                    onChange={setEnableMorphGradient}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      ml: '44px',
                      mt: '2px',
                    })}
                  >
                    Finds edges by dilation-erosion. Turn ON for thick or blurry edges.
                  </div>
                </div>
              </div>
            </div>

            {/* Sliders with descriptions */}
            <div className={css({ mb: 2 })}>
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.300',
                  mb: 2,
                  fontWeight: 'medium',
                })}
              >
                Fine-Tuning
              </div>
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 3,
                })}
              >
                <div>
                  <SliderControl
                    label="Adaptive Block Size"
                    value={adaptiveBlockSize}
                    onChange={setAdaptiveBlockSize}
                    min={3}
                    max={31}
                    step={2}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      mt: 1,
                      lineHeight: 1.2,
                    })}
                  >
                    Neighborhood size for local thresholding. Larger = smoother edges, smaller =
                    more detail.
                  </div>
                </div>
                <div>
                  <SliderControl
                    label="Adaptive C"
                    value={adaptiveC}
                    onChange={setAdaptiveC}
                    min={-10}
                    max={20}
                    step={1}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      mt: 1,
                      lineHeight: 1.2,
                    })}
                  >
                    Threshold offset. Higher = fewer edges detected, lower = more noise.
                  </div>
                </div>
                <div>
                  <SliderControl
                    label="Canny Low"
                    value={cannyLow}
                    onChange={setCannyLow}
                    min={10}
                    max={150}
                    step={5}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      mt: 1,
                      lineHeight: 1.2,
                    })}
                  >
                    Weak edge threshold. Lower = detect faint edges (more noise).
                  </div>
                </div>
                <div>
                  <SliderControl
                    label="Canny High"
                    value={cannyHigh}
                    onChange={setCannyHigh}
                    min={50}
                    max={300}
                    step={10}
                  />
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      mt: 1,
                      lineHeight: 1.2,
                    })}
                  >
                    Strong edge threshold. Lower = more edges, higher = only strong edges.
                  </div>
                </div>
              </div>
            </div>

            {/* Hough Line Detection */}
            <div className={css({ mb: 3 })}>
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.300',
                  mb: 2,
                  fontWeight: 'medium',
                })}
              >
                Hough Line Detection (Finger Occlusion)
              </div>
              <div>
                <ToggleSwitch
                  label="Enable Hough Lines"
                  checked={enableHoughLines}
                  onChange={setEnableHoughLines}
                />
                <div
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.500',
                    ml: '44px',
                    mt: '2px',
                  })}
                >
                  Detects straight lines and infers corners from intersections. Fallback when
                  contours fail.
                </div>
              </div>
              {enableHoughLines && (
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 3,
                    mt: 2,
                  })}
                >
                  <div>
                    <SliderControl
                      label="Threshold"
                      value={houghThreshold}
                      onChange={setHoughThreshold}
                      min={20}
                      max={100}
                      step={5}
                    />
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.500',
                        mt: 1,
                        lineHeight: 1.2,
                      })}
                    >
                      Min votes. Lower = more lines.
                    </div>
                  </div>
                  <div>
                    <SliderControl
                      label="Min Length"
                      value={houghMinLineLength}
                      onChange={setHoughMinLineLength}
                      min={20}
                      max={150}
                      step={10}
                    />
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.500',
                        mt: 1,
                        lineHeight: 1.2,
                      })}
                    >
                      Min line segment length.
                    </div>
                  </div>
                  <div>
                    <SliderControl
                      label="Max Gap"
                      value={houghMaxLineGap}
                      onChange={setHoughMaxLineGap}
                      min={5}
                      max={50}
                      step={5}
                    />
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.500',
                        mt: 1,
                        lineHeight: 1.2,
                      })}
                    >
                      Max gap to merge segments.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick tips */}
            <div
              className={css({
                mt: 3,
                p: 2,
                bg: 'gray.800',
                borderRadius: 'sm',
                fontSize: 'xs',
                color: 'gray.400',
              })}
            >
              <strong className={css({ color: 'gray.300' })}>Tips:</strong>
              <ul
                className={css({
                  mt: 1,
                  pl: 3,
                  listStyleType: 'disc',
                  lineHeight: 1.4,
                })}
              >
                <li>Document not detected? Lower Canny thresholds or enable Histogram Eq.</li>
                <li>Too many false edges? Raise Canny thresholds or increase Adaptive C.</li>
                <li>
                  Fingers blocking edges? Enable Hough Lines - it finds edges by detecting straight
                  lines and computing their intersections.
                </li>
              </ul>
            </div>
          </div>

          <div
            className={css({
              position: 'relative',
              bg: 'black',
              borderRadius: 'md',
              overflow: 'hidden',
            })}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={css({
                width: '100%',
                height: 'auto',
                display: isCameraActive ? 'block' : 'none',
              })}
            />
            <canvas
              ref={overlayRef}
              className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              })}
            />
            {!isCameraActive && (
              <div
                className={css({
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'gray.500',
                })}
              >
                Camera not active
              </div>
            )}
          </div>

          {/* Debug polygon info */}
          {debugMode && isCameraActive && cameraDebugInfo.debugPolygons.length > 0 && (
            <div
              className={css({
                mt: 3,
                p: 2,
                bg: 'gray.700',
                borderRadius: 'md',
                fontSize: 'xs',
                maxHeight: '200px',
                overflow: 'auto',
              })}
            >
              <div className={css({ fontWeight: 'bold', mb: 2 })}>
                Candidate Polygons ({cameraDebugInfo.debugPolygons.length}):
              </div>
              {cameraDebugInfo.debugPolygons.slice(0, 10).map((poly, i) => (
                <div
                  key={i}
                  className={css({
                    mb: 1,
                    p: 1,
                    bg: poly.status === 'accepted' ? 'green.900' : 'gray.800',
                    borderRadius: 'sm',
                    fontFamily: 'mono',
                  })}
                >
                  <span
                    className={css({
                      color:
                        poly.status === 'accepted'
                          ? 'green.400'
                          : poly.status === 'too_small'
                            ? 'gray.500'
                            : poly.status === 'too_large'
                              ? 'red.400'
                              : poly.status === 'bad_aspect_ratio'
                                ? 'yellow.400'
                                : 'orange.400',
                    })}
                  >
                    [{poly.status}]
                  </span>{' '}
                  vertices: {poly.vertexCount}, area: {(poly.areaRatio * 100).toFixed(1)}%
                  {poly.hullVertices && ` → hull: ${poly.hullVertices.length}`}
                  {poly.aspectRatio && ` ratio: ${poly.aspectRatio.toFixed(2)}`}
                </div>
              ))}
              {cameraDebugInfo.debugPolygons.length > 10 && (
                <div className={css({ color: 'gray.500' })}>
                  ... and {cameraDebugInfo.debugPolygons.length - 10} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Static image section */}
        <div className={css({ bg: 'gray.800', borderRadius: 'lg', p: 4 })}>
          <h2 className={css({ fontSize: 'lg', fontWeight: 'bold', mb: 3 })}>
            Static Image (One-shot Detection)
          </h2>

          <div className={css({ mb: 3 })}>
            <label
              className={css({
                display: 'inline-block',
                px: 4,
                py: 2,
                bg: isReady ? 'purple.600' : 'gray.600',
                color: 'white',
                borderRadius: 'md',
                cursor: isReady ? 'pointer' : 'not-allowed',
                opacity: isReady ? 1 : 0.5,
                _hover: isReady ? { bg: 'purple.500' } : {},
              })}
            >
              {isReady ? 'Upload Image' : 'Loading...'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={!isReady}
                className={css({ display: 'none' })}
              />
            </label>
          </div>

          <div
            id="static-image-container"
            className={css({
              bg: 'black',
              borderRadius: 'md',
              overflow: 'hidden',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {!staticImageCanvas && (
              <span className={css({ color: 'gray.500' })}>No image loaded</span>
            )}
          </div>

          {staticDetectionResult && (
            <div
              className={css({
                mt: 3,
                p: 2,
                bg: 'gray.700',
                borderRadius: 'md',
                fontSize: 'sm',
              })}
            >
              <div>
                Detection:{' '}
                <span
                  className={css({
                    color: staticDetectionResult.detected ? 'green.400' : 'yellow.400',
                  })}
                >
                  {staticDetectionResult.detected
                    ? `${staticDetectionResult.quads.length} quad${staticDetectionResult.quads.length !== 1 ? 's' : ''} found`
                    : 'No quads found'}
                </span>
              </div>
              <div className={css({ fontFamily: 'mono', fontSize: 'xs', mt: 1 })}>
                Corners:{' '}
                {JSON.stringify(
                  staticDetectionResult.corners.map((c) => [Math.round(c.x), Math.round(c.y)])
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info section */}
      <div
        className={css({
          mt: 4,
          p: 4,
          bg: 'gray.800',
          borderRadius: 'lg',
          fontSize: 'sm',
          color: 'gray.400',
        })}
      >
        <h3 className={css({ fontWeight: 'medium', color: 'gray.200', mb: 2 })}>
          Current Architecture (Step 5: useQuadDetection Hook)
        </h3>
        <ul className={css({ listStyleType: 'disc', pl: 4, lineHeight: 1.6 })}>
          <li>
            <strong>OpenCvProvider</strong> wraps the page and loads OpenCV via opencv-react
          </li>
          <li>
            <strong>useQuadDetection()</strong> combines OpenCV loading, detection, and tracking
          </li>
          <li>
            Hook provides: <code>isReady</code>, <code>detectInImage</code>,{' '}
            <code>processFrame</code>, <code>resetTracking</code>
          </li>
          <li>
            <code>detectInImage(canvas)</code> for static images (no tracking)
          </li>
          <li>
            <code>processFrame(canvas)</code> for camera feeds (with tracking)
          </li>
          <li>
            Status: orange=tracking, yellow=stable (3+ frames), green=locked (5+ frames, high
            stability)
          </li>
          <li>Next step: Update useDocumentDetection to use new modules</li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getFallbackCorners(width: number, height: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

function drawQuadOverlay(
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number,
  quads: DetectedQuad[]
): void {
  canvas.width = frameWidth
  canvas.height = frameHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, frameWidth, frameHeight)

  // Draw all quads
  for (let i = 0; i < quads.length; i++) {
    const quad = quads[i]
    const isFirst = i === 0

    // Color: green for best quad, yellow for others
    ctx.strokeStyle = isFirst ? 'rgba(0, 255, 100, 0.9)' : 'rgba(255, 200, 0, 0.6)'
    ctx.lineWidth = isFirst ? 4 : 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw quad outline
    ctx.beginPath()
    ctx.moveTo(quad.corners[0].x, quad.corners[0].y)
    for (let j = 1; j < 4; j++) {
      ctx.lineTo(quad.corners[j].x, quad.corners[j].y)
    }
    ctx.closePath()
    ctx.stroke()

    // Draw corner circles for best quad
    if (isFirst) {
      ctx.fillStyle = 'rgba(0, 255, 100, 0.9)'
      for (const corner of quad.corners) {
        ctx.beginPath()
        ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

/**
 * Draw quad overlay with tracking status indicators
 */
function drawTrackedQuadOverlay(
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number,
  detectedQuads: DetectedQuad[],
  trackedQuad: TrackedQuad | null
): void {
  canvas.width = frameWidth
  canvas.height = frameHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, frameWidth, frameHeight)

  // Draw all detected quads in faint color
  for (const quad of detectedQuads) {
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(quad.corners[0].x, quad.corners[0].y)
    for (let j = 1; j < 4; j++) {
      ctx.lineTo(quad.corners[j].x, quad.corners[j].y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  // Draw tracked quad with status-based color
  if (trackedQuad) {
    // Color based on status: locked=green, stable=yellow, tracking=orange
    const color = trackedQuad.isLocked
      ? 'rgba(0, 255, 100, 0.95)'
      : trackedQuad.isStable
        ? 'rgba(255, 220, 0, 0.9)'
        : 'rgba(255, 140, 0, 0.8)'

    ctx.strokeStyle = color
    ctx.lineWidth = trackedQuad.isLocked ? 5 : trackedQuad.isStable ? 4 : 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw quad outline
    ctx.beginPath()
    ctx.moveTo(trackedQuad.corners[0].x, trackedQuad.corners[0].y)
    for (let j = 1; j < 4; j++) {
      ctx.lineTo(trackedQuad.corners[j].x, trackedQuad.corners[j].y)
    }
    ctx.closePath()
    ctx.stroke()

    // Draw corner circles - size based on stability
    const cornerRadius = 6 + trackedQuad.stabilityScore * 8
    ctx.fillStyle = color
    for (const corner of trackedQuad.corners) {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, cornerRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw stability bar at top
    const barWidth = 200
    const barHeight = 8
    const barX = (frameWidth - barWidth) / 2
    const barY = 20

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // Fill based on stability
    const fillWidth = barWidth * trackedQuad.stabilityScore
    ctx.fillStyle = color
    ctx.fillRect(barX, barY, fillWidth, barHeight)

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barWidth, barHeight)

    // Status text
    ctx.fillStyle = 'white'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    const statusText = trackedQuad.isLocked
      ? `LOCKED (${(trackedQuad.stabilityScore * 100).toFixed(0)}%)`
      : trackedQuad.isStable
        ? `STABLE (${(trackedQuad.stabilityScore * 100).toFixed(0)}%)`
        : `Tracking... (${trackedQuad.frameCount} frames)`
    ctx.fillText(statusText, frameWidth / 2, barY + barHeight + 18)
  }
}

/**
 * Draw debug overlay showing all candidate polygons with status-based colors
 */
function drawDebugOverlay(
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number,
  quads: DetectedQuad[],
  debugPolygons: DebugPolygon[]
): void {
  canvas.width = frameWidth
  canvas.height = frameHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, frameWidth, frameHeight)

  // Color map for each status
  const statusColors: Record<DebugPolygon['status'], { stroke: string; fill: string }> = {
    accepted: {
      stroke: 'rgba(0, 255, 100, 0.9)',
      fill: 'rgba(0, 255, 100, 0.2)',
    },
    too_small: {
      stroke: 'rgba(100, 100, 100, 0.5)',
      fill: 'rgba(100, 100, 100, 0.1)',
    },
    too_large: {
      stroke: 'rgba(255, 50, 50, 0.7)',
      fill: 'rgba(255, 50, 50, 0.1)',
    },
    too_few_vertices: {
      stroke: 'rgba(150, 150, 150, 0.5)',
      fill: 'rgba(150, 150, 150, 0.1)',
    },
    too_many_vertices: {
      stroke: 'rgba(255, 150, 0, 0.7)',
      fill: 'rgba(255, 150, 0, 0.1)',
    },
    bad_aspect_ratio: {
      stroke: 'rgba(255, 220, 0, 0.8)',
      fill: 'rgba(255, 220, 0, 0.1)',
    },
    corner_extraction_failed: {
      stroke: 'rgba(255, 100, 200, 0.7)',
      fill: 'rgba(255, 100, 200, 0.1)',
    },
  }

  // Draw all debug polygons (except too_small which clutters the view)
  for (const poly of debugPolygons) {
    if (poly.status === 'too_small') continue // Skip tiny polygons

    const colors = statusColors[poly.status]
    ctx.strokeStyle = colors.stroke
    ctx.fillStyle = colors.fill
    ctx.lineWidth = poly.status === 'accepted' ? 3 : 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw polygon outline
    if (poly.vertices.length > 0) {
      ctx.beginPath()
      ctx.moveTo(poly.vertices[0].x, poly.vertices[0].y)
      for (let j = 1; j < poly.vertices.length; j++) {
        ctx.lineTo(poly.vertices[j].x, poly.vertices[j].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Draw vertex count at centroid
      const cx = poly.vertices.reduce((s, v) => s + v.x, 0) / poly.vertices.length
      const cy = poly.vertices.reduce((s, v) => s + v.y, 0) / poly.vertices.length

      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${poly.vertexCount}v`, cx, cy)
    }

    // Draw convex hull if available (dashed line)
    if (poly.hullVertices && poly.hullVertices.length > 0) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(poly.hullVertices[0].x, poly.hullVertices[0].y)
      for (let j = 1; j < poly.hullVertices.length; j++) {
        ctx.lineTo(poly.hullVertices[j].x, poly.hullVertices[j].y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Draw accepted quads with corner markers on top
  for (const quad of quads) {
    ctx.strokeStyle = 'rgba(0, 255, 100, 1)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(quad.corners[0].x, quad.corners[0].y)
    for (let j = 1; j < 4; j++) {
      ctx.lineTo(quad.corners[j].x, quad.corners[j].y)
    }
    ctx.closePath()
    ctx.stroke()

    // Corner circles
    ctx.fillStyle = 'rgba(0, 255, 100, 1)'
    for (const corner of quad.corners) {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Draw legend
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(10, 10, 180, 130)

  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const legendItems: Array<{ color: string; label: string }> = [
    { color: statusColors['accepted'].stroke, label: 'Accepted (quad found)' },
    {
      color: statusColors['bad_aspect_ratio'].stroke,
      label: 'Bad aspect ratio',
    },
    {
      color: statusColors['too_many_vertices'].stroke,
      label: 'Too many vertices (>8)',
    },
    { color: statusColors['too_large'].stroke, label: 'Too large (>95%)' },
    { color: 'rgba(0, 200, 255, 0.8)', label: 'Convex hull (dashed)' },
  ]

  legendItems.forEach((item, i) => {
    ctx.fillStyle = item.color
    ctx.fillRect(15, 15 + i * 22, 12, 12)
    ctx.fillStyle = 'white'
    ctx.fillText(item.label, 32, 15 + i * 22)
  })
}

function StatusBadge({
  label,
  status,
}: {
  label: string
  status: 'idle' | 'loading' | 'ready' | 'error'
}) {
  const colors = {
    idle: { bg: 'gray.600', color: 'gray.300' },
    loading: { bg: 'yellow.600', color: 'yellow.100' },
    ready: { bg: 'green.600', color: 'green.100' },
    error: { bg: 'red.600', color: 'red.100' },
  }

  return (
    <span
      className={css({
        px: 2,
        py: 1,
        borderRadius: 'md',
        fontSize: 'sm',
        fontWeight: 'medium',
        ...colors[status],
      })}
    >
      {label}: {status}
    </span>
  )
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: 'pointer',
        fontSize: 'xs',
      })}
    >
      <div
        className={css({
          position: 'relative',
          width: '36px',
          height: '20px',
          bg: checked ? 'green.600' : 'gray.600',
          borderRadius: 'full',
          transition: 'background-color 0.2s',
        })}
        onClick={() => onChange(!checked)}
      >
        <div
          className={css({
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '16px',
            height: '16px',
            bg: 'white',
            borderRadius: 'full',
            transition: 'left 0.2s',
          })}
        />
      </div>
      <span className={css({ color: checked ? 'gray.200' : 'gray.400' })}>{label}</span>
    </label>
  )
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div className={css({ fontSize: 'xs' })}>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          mb: 1,
        })}
      >
        <span className={css({ color: 'gray.400' })}>{label}</span>
        <span className={css({ color: 'gray.200', fontFamily: 'mono' })}>{value}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={css({
          width: '100%',
          height: '4px',
          bg: 'gray.600',
          borderRadius: 'full',
          appearance: 'none',
          cursor: 'pointer',
          _focusVisible: {
            outline: 'none',
          },
        })}
      />
    </div>
  )
}
