'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenCvProvider, useOpenCv } from 'opencv-react'
import { css } from '../../../../styled-system/css'
import { createQuadDetector, type DetectedQuad, type Point } from '@/lib/vision/quadDetector'
import type { CV } from '@/lib/vision/opencv/types'

/**
 * Test page for quad detection.
 * Uses opencv-react for loading OpenCV, and the new modular quadDetector for detection.
 *
 * Step 3: Testing quadDetector.ts with static images using opencv-react loaded cv
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

  // opencv-react for loading
  const { loaded: opencvLoaded, cv } = useOpenCv()

  // Track load time for opencv-react
  const [loadStartTime] = useState(() => Date.now())
  const [opencvLoadTime, setOpencvLoadTime] = useState<number | null>(null)

  useEffect(() => {
    if (opencvLoaded && !opencvLoadTime) {
      setOpencvLoadTime(Date.now() - loadStartTime)
    }
  }, [opencvLoaded, opencvLoadTime, loadStartTime])

  // Create quad detector when cv is available
  const detector = useMemo(() => {
    if (!opencvLoaded || !cv) return null
    try {
      return createQuadDetector(cv as CV)
    } catch (err) {
      console.error('Failed to create quad detector:', err)
      return null
    }
  }, [opencvLoaded, cv])

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

      if (!detector) {
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
        const quads = detector.detect(canvas)
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
    [detector, loadImageToCanvas]
  )

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)

      if (!detector) {
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
  }, [detector])

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
  const [cameraDebugInfo, setCameraDebugInfo] = useState({
    quadsDetected: 0,
    detectionTimeMs: 0,
  })

  // Detection loop for camera
  useEffect(() => {
    if (!isCameraActive || !detector) return

    const runDetection = () => {
      if (videoRef.current && overlayRef.current) {
        const frame = captureVideoFrame(videoRef.current)
        if (frame) {
          const startTime = performance.now()
          try {
            const quads = detector.detect(frame)
            const detectionTimeMs = performance.now() - startTime

            setCameraDebugInfo({
              quadsDetected: quads.length,
              detectionTimeMs,
            })

            // Draw overlay
            drawQuadOverlay(overlayRef.current, frame.width, frame.height, quads)
          } catch (err) {
            console.error('Detection error:', err)
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
  }, [isCameraActive, detector, captureVideoFrame])

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
    drawQuadOverlay(overlayCanvas, staticImageCanvas.width, staticImageCanvas.height, staticDetectionResult.quads)

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
        <StatusBadge label="quadDetector" status={detector ? 'ready' : opencvLoaded ? 'error' : 'idle'} />
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
        <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 })}>
          <div>
            opencv-react load: {opencvLoadTime ?? '-'}ms
            {opencvLoaded && !!cv && <span className={css({ color: 'green.400', ml: 2 })}>✓ cv available</span>}
          </div>
          <div>
            quadDetector: {detector ? <span className={css({ color: 'green.400' })}>✓ created</span> : <span className={css({ color: 'gray.500' })}>waiting...</span>}
          </div>
          {isCameraActive && (
            <>
              <div>Camera quads: {cameraDebugInfo.quadsDetected}</div>
              <div>Camera detection: {cameraDebugInfo.detectionTimeMs.toFixed(1)}ms</div>
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
      <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' }, gap: 4 })}>
        {/* Camera section */}
        <div className={css({ bg: 'gray.800', borderRadius: 'lg', p: 4 })}>
          <h2 className={css({ fontSize: 'lg', fontWeight: 'bold', mb: 3 })}>
            Camera Feed (Real-time Detection)
          </h2>

          <div className={css({ mb: 3 })}>
            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={!detector}
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
                {!opencvLoaded ? 'Loading OpenCV...' : !detector ? 'Creating detector...' : 'Start Camera'}
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
          </div>

          <div className={css({ position: 'relative', bg: 'black', borderRadius: 'md', overflow: 'hidden' })}>
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
                bg: detector ? 'purple.600' : 'gray.600',
                color: 'white',
                borderRadius: 'md',
                cursor: detector ? 'pointer' : 'not-allowed',
                opacity: detector ? 1 : 0.5,
                _hover: detector ? { bg: 'purple.500' } : {},
              })}
            >
              {detector ? 'Upload Image' : 'Loading...'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={!detector}
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
            <div className={css({ mt: 3, p: 2, bg: 'gray.700', borderRadius: 'md', fontSize: 'sm' })}>
              <div>
                Detection:{' '}
                <span className={css({ color: staticDetectionResult.detected ? 'green.400' : 'yellow.400' })}>
                  {staticDetectionResult.detected
                    ? `${staticDetectionResult.quads.length} quad${staticDetectionResult.quads.length !== 1 ? 's' : ''} found`
                    : 'No quads found'}
                </span>
              </div>
              <div className={css({ fontFamily: 'mono', fontSize: 'xs', mt: 1 })}>
                Corners: {JSON.stringify(staticDetectionResult.corners.map((c) => [Math.round(c.x), Math.round(c.y)]))}
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
          Current Architecture (Step 3: Using modular quadDetector)
        </h3>
        <ul className={css({ listStyleType: 'disc', pl: 4, lineHeight: 1.6 })}>
          <li><strong>OpenCvProvider</strong> wraps the page and loads OpenCV via opencv-react</li>
          <li><strong>useOpenCv()</strong> provides the loaded state and cv instance</li>
          <li><strong>createQuadDetector(cv)</strong> creates detector from @/lib/vision/quadDetector</li>
          <li>Detection now uses the modular quadDetector (no useDocumentDetection)</li>
          <li>Next step: Add QuadTracker for temporal stability tracking</li>
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
