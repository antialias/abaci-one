'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentDetection } from '@/components/practice/useDocumentDetection'
import { css } from '../../../../../styled-system/css'

// Dynamic import for DocumentAdjuster (pulls in OpenCV)
const DocumentAdjuster = dynamic(
  () => import('@/components/practice/DocumentAdjuster').then((m) => m.DocumentAdjuster),
  { ssr: false }
)

interface FullscreenCameraProps {
  /** Called with cropped file, original file, corners, and rotation for later re-editing */
  onCapture: (
    croppedFile: File,
    originalFile: File,
    corners: Array<{ x: number; y: number }>,
    rotation: 0 | 90 | 180 | 270
  ) => void
  onClose: () => void
}

export function FullscreenCamera({ onCapture, onClose }: FullscreenCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastDetectionRef = useRef<number>(0)
  const autoCaptureTriggeredRef = useRef(false)

  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [documentDetected, setDocumentDetected] = useState(false)

  // Adjustment mode state
  const [adjustmentMode, setAdjustmentMode] = useState<{
    sourceCanvas: HTMLCanvasElement
    corners: Array<{ x: number; y: number }>
  } | null>(null)

  // Document detection hook (lazy loads OpenCV.js)
  const {
    isLoading: isScannerLoading,
    isReady: isScannerReady,
    ensureOpenCVLoaded,
    isStable: isDetectionStable,
    isLocked: isDetectionLocked,
    debugInfo: scannerDebugInfo,
    cv: opencvRef,
    getBestQuadCorners,
    captureSourceFrame,
    highlightDocument,
    detectQuadsInImage: detectQuadsInCamera,
  } = useDocumentDetection()

  useEffect(() => {
    let cancelled = false

    const startCamera = async () => {
      try {
        // Start loading OpenCV in parallel with camera setup
        // (this component requires OpenCV for document detection)
        const opencvPromise = ensureOpenCVLoaded()

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (!cancelled) {
            setIsReady(true)
          }
        }

        // Wait for OpenCV to finish loading (should already be done or almost done)
        await opencvPromise
      } catch (err) {
        if (cancelled) return
        console.error('Camera access error:', err)
        setError('Camera access denied. Please allow camera access and try again.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [ensureOpenCVLoaded])

  // Detection loop - runs when camera and scanner are ready
  useEffect(() => {
    if (!isReady || !isScannerReady) return

    const video = videoRef.current
    const overlay = overlayCanvasRef.current
    if (!video || !overlay) return

    // Sync overlay canvas size with video
    const syncCanvasSize = () => {
      if (overlay && video) {
        overlay.width = video.clientWidth
        overlay.height = video.clientHeight
      }
    }
    syncCanvasSize()

    const detectLoop = () => {
      const now = Date.now()
      // Throttle detection to every 150ms for performance
      if (now - lastDetectionRef.current > 150) {
        if (video && overlay) {
          const detected = highlightDocument(video, overlay)
          setDocumentDetected(detected)
        }
        lastDetectionRef.current = now
      }
      animationFrameRef.current = requestAnimationFrame(detectLoop)
    }

    // Start detection loop
    animationFrameRef.current = requestAnimationFrame(detectLoop)

    // Sync on resize
    window.addEventListener('resize', syncCanvasSize)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      window.removeEventListener('resize', syncCanvasSize)
    }
  }, [isReady, isScannerReady, highlightDocument])

  // Enter adjustment mode with captured frame and detected corners
  // Always shows the adjustment UI - uses fallback corners if no quad detected
  const enterAdjustmentMode = useCallback(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    const sourceCanvas = captureSourceFrame(video)
    const detectedCorners = getBestQuadCorners()

    if (!sourceCanvas) return

    // Stop detection loop while adjusting
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Use detected corners if available, otherwise use full image bounds as fallback
    // This allows user to manually define crop area even when detection fails
    const corners = detectedCorners || [
      { x: 0, y: 0 },
      { x: sourceCanvas.width, y: 0 },
      { x: sourceCanvas.width, y: sourceCanvas.height },
      { x: 0, y: sourceCanvas.height },
    ]

    setAdjustmentMode({ sourceCanvas, corners })
  }, [captureSourceFrame, getBestQuadCorners])

  // Handle capture button - enters adjustment mode if document detected
  const capturePhoto = () => {
    if (isCapturing) return
    setIsCapturing(true)
    enterAdjustmentMode()
    setIsCapturing(false)
  }

  // Auto-capture when detection is locked and stable
  useEffect(() => {
    if (
      isDetectionLocked &&
      isReady &&
      isScannerReady &&
      !isCapturing &&
      !adjustmentMode &&
      !autoCaptureTriggeredRef.current
    ) {
      // Add a small delay to ensure stability
      const timeout = setTimeout(() => {
        if (isDetectionLocked && !autoCaptureTriggeredRef.current) {
          autoCaptureTriggeredRef.current = true
          console.log('Auto-capturing document...')
          enterAdjustmentMode()
        }
      }, 500) // 500ms delay after lock to ensure stability

      return () => clearTimeout(timeout)
    }
  }, [isDetectionLocked, isReady, isScannerReady, isCapturing, adjustmentMode, enterAdjustmentMode])

  // Handle adjustment confirm - pass cropped file, original file, corners, and rotation for later re-editing
  const handleAdjustmentConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270
    ) => {
      if (!adjustmentMode) return

      // Convert source canvas to file for original preservation
      const originalBlob = await new Promise<Blob>((resolve, reject) => {
        adjustmentMode.sourceCanvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create original blob'))
          },
          'image/jpeg',
          0.95
        )
      })
      const originalFile = new File([originalBlob], `original-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      setAdjustmentMode(null)
      onCapture(croppedFile, originalFile, corners, rotation)
    },
    [onCapture, adjustmentMode]
  )

  // Handle adjustment cancel - return to camera
  const handleAdjustmentCancel = useCallback(() => {
    setAdjustmentMode(null)
    autoCaptureTriggeredRef.current = false // Allow auto-capture again
    // Restart detection loop
    if (videoRef.current && overlayCanvasRef.current && isScannerReady) {
      const detectLoop = () => {
        const now = Date.now()
        if (now - lastDetectionRef.current > 150) {
          if (videoRef.current && overlayCanvasRef.current) {
            const detected = highlightDocument(videoRef.current, overlayCanvasRef.current)
            setDocumentDetected(detected)
          }
          lastDetectionRef.current = now
        }
        animationFrameRef.current = requestAnimationFrame(detectLoop)
      }
      animationFrameRef.current = requestAnimationFrame(detectLoop)
    }
  }, [isScannerReady, highlightDocument])

  // Show adjustment UI if in adjustment mode
  if (adjustmentMode && opencvRef) {
    return (
      <DocumentAdjuster
        sourceCanvas={adjustmentMode.sourceCanvas}
        initialCorners={adjustmentMode.corners}
        onConfirm={handleAdjustmentConfirm}
        onCancel={handleAdjustmentCancel}
        cv={opencvRef}
        detectQuadsInImage={detectQuadsInCamera}
      />
    )
  }

  return (
    <div
      data-component="fullscreen-camera"
      className={css({
        position: 'absolute',
        inset: 0,
        bg: 'black',
      })}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        })}
      />

      {/* Overlay canvas for document detection visualization */}
      <canvas
        ref={overlayCanvasRef}
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        })}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!isReady && !error && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'black',
          })}
        >
          <div className={css({ color: 'white', fontSize: 'xl' })}>Starting camera...</div>
        </div>
      )}

      {error && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'black',
            p: 6,
          })}
        >
          <div
            className={css({
              color: 'red.400',
              fontSize: 'lg',
              textAlign: 'center',
              mb: 4,
            })}
          >
            {error}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              px: 6,
              py: 3,
              bg: 'white',
              color: 'black',
              borderRadius: 'full',
              fontSize: 'lg',
              fontWeight: 'bold',
              cursor: 'pointer',
            })}
          >
            Close
          </button>
        </div>
      )}

      {!error && (
        <>
          <button
            type="button"
            onClick={onClose}
            className={css({
              position: 'absolute',
              top: 4,
              right: 4,
              width: '48px',
              height: '48px',
              bg: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              borderRadius: 'full',
              fontSize: '2xl',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              _hover: { bg: 'rgba(0, 0, 0, 0.7)' },
            })}
          >
            ×
          </button>

          {/* Debug overlay panel - always shown to help diagnose detection */}
          <div
            data-element="scanner-debug-panel"
            className={css({
              position: 'absolute',
              top: 4,
              left: 4,
              p: 3,
              bg: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'lg',
              color: 'white',
              fontSize: 'xs',
              fontFamily: 'monospace',
              maxWidth: '280px',
              zIndex: 10,
            })}
          >
            <div
              className={css({
                fontWeight: 'bold',
                mb: 2,
                color: 'yellow.400',
              })}
            >
              Document Scanner Debug
            </div>
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              })}
            >
              <div>
                Scanner:{' '}
                <span
                  className={css({
                    color: isScannerReady ? 'green.400' : 'orange.400',
                  })}
                >
                  {isScannerLoading ? 'Loading...' : isScannerReady ? 'Ready' : 'Failed'}
                </span>
              </div>
              <div>
                Camera:{' '}
                <span
                  className={css({
                    color: isReady ? 'green.400' : 'orange.400',
                  })}
                >
                  {isReady ? 'Ready' : 'Starting...'}
                </span>
              </div>
              <div>
                Document:{' '}
                <span
                  className={css({
                    color: isDetectionLocked
                      ? 'green.400'
                      : isDetectionStable
                        ? 'green.300'
                        : documentDetected
                          ? 'yellow.400'
                          : 'gray.400',
                  })}
                >
                  {isDetectionLocked
                    ? 'LOCKED'
                    : isDetectionStable
                      ? 'Stable'
                      : documentDetected
                        ? 'Unstable'
                        : 'Not detected'}
                </span>
              </div>
              <div>
                Quads: {scannerDebugInfo.quadsDetected} detected, {scannerDebugInfo.trackedQuads}{' '}
                tracked
              </div>
              <div>
                Best: {scannerDebugInfo.bestQuadFrameCount} frames,{' '}
                {Math.round(scannerDebugInfo.bestQuadStability * 100)}% stable
              </div>
              {scannerDebugInfo.loadTimeMs !== null && (
                <div>Load time: {scannerDebugInfo.loadTimeMs}ms</div>
              )}
              {scannerDebugInfo.lastDetectionMs !== null && (
                <div>Detection: {scannerDebugInfo.lastDetectionMs}ms</div>
              )}
              {scannerDebugInfo.lastDetectionError && (
                <div className={css({ color: 'red.400', wordBreak: 'break-word' })}>
                  Error: {scannerDebugInfo.lastDetectionError}
                </div>
              )}
            </div>
          </div>

          <div
            className={css({
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            })}
          >
            {/* Helper text for detection status */}
            <div
              data-element="detection-status"
              className={css({
                px: 4,
                py: 2,
                bg: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: 'full',
                color: 'white',
                fontSize: 'sm',
                fontWeight: 'medium',
                textAlign: 'center',
                transition: 'all 0.2s',
              })}
            >
              {isScannerLoading ? (
                'Loading scanner...'
              ) : isDetectionLocked ? (
                <span className={css({ color: 'green.400', fontWeight: 'bold' })}>
                  ✓ Hold steady - Ready to capture!
                </span>
              ) : isDetectionStable ? (
                <span className={css({ color: 'green.300' })}>
                  Document detected - Hold steady...
                </span>
              ) : documentDetected ? (
                <span className={css({ color: 'yellow.400' })}>
                  Detecting... hold camera steady
                </span>
              ) : (
                'Point camera at document'
              )}
            </div>

            <button
              type="button"
              onClick={capturePhoto}
              disabled={isCapturing || !isReady}
              className={css({
                width: '80px',
                height: '80px',
                bg: 'white',
                borderRadius: 'full',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isDetectionLocked
                  ? '0 4px 30px rgba(0, 255, 100, 0.5)'
                  : '0 4px 20px rgba(0, 0, 0, 0.3)',
                border: '4px solid',
                borderColor: isDetectionLocked
                  ? 'green.400'
                  : isDetectionStable
                    ? 'green.300'
                    : documentDetected
                      ? 'yellow.400'
                      : 'gray.300',
                transition: 'all 0.15s',
                _hover: { transform: 'scale(1.05)' },
                _active: { transform: 'scale(0.95)' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isCapturing ? (
                <div className={css({ fontSize: 'sm', color: 'gray.600' })}>...</div>
              ) : (
                <div
                  className={css({
                    width: '64px',
                    height: '64px',
                    bg: 'white',
                    borderRadius: 'full',
                    border: '2px solid',
                    borderColor: isDetectionLocked
                      ? 'green.400'
                      : isDetectionStable
                        ? 'green.300'
                        : documentDetected
                          ? 'yellow.400'
                          : 'gray.400',
                  })}
                />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default FullscreenCamera
