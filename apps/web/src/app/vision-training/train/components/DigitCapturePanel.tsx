'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import { CameraCapture, type CameraSource } from '@/components/vision/CameraCapture'
import type { CalibrationGrid } from '@/types/vision'

interface CapturedColumn {
  id: string
  imageUrl: string
  timestamp: number
}

interface DigitCapturePanelProps {
  /** The digit to capture */
  digit: number
  /** Called when capture is successful with count of new images */
  onCaptureSuccess: (capturedCount: number) => void
  /** Number of physical abacus columns (default 4) */
  columnCount?: number
}

/** Minimum time between auto-captures in ms */
const AUTO_CAPTURE_INTERVAL = 600

/**
 * Capture panel for a specific digit.
 * Shows instructions, camera feed, and live preview of captured columns.
 *
 * Layout: Fixed header + flexible camera + fixed footer (no scrolling)
 */
export function DigitCapturePanel({
  digit,
  onCaptureSuccess,
  columnCount = 4,
}: DigitCapturePanelProps) {
  // Camera state
  const [isPhoneConnected, setIsPhoneConnected] = useState(false)
  const [cameraSource, setCameraSource] = useState<CameraSource>('local')
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null)
  const [markersVisible, setMarkersVisible] = useState(false)

  // Capture state
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureStatus, setCaptureStatus] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Recently captured columns (for live preview)
  const [recentCaptures, setRecentCaptures] = useState<CapturedColumn[]>([])
  const [sessionCaptureCount, setSessionCaptureCount] = useState(0)

  // Auto-capture state
  const [autoCapture, setAutoCapture] = useState(false)
  const [autoCaptureCount, setAutoCaptureCount] = useState(0)
  const lastAutoCaptureTimeRef = useRef<number>(0)
  const isAutoCapturingRef = useRef(false)
  const markersVisibleRef = useRef(false)
  const captureTrainingDataRef = useRef<(() => Promise<void>) | null>(null)

  const captureElementRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null>(
    null
  )

  // Handle capture element from camera (may be video, image, or rectified canvas)
  const handleCapture = useCallback(
    (element: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
      const prevElement = captureElementRef.current
      const prevType = prevElement?.constructor?.name ?? 'null'
      const newType = element?.constructor?.name ?? 'null'
      const dimensions =
        element instanceof HTMLCanvasElement
          ? `${element.width}x${element.height}`
          : element instanceof HTMLVideoElement
            ? `${element.videoWidth}x${element.videoHeight}`
            : element instanceof HTMLImageElement
              ? `${element.naturalWidth}x${element.naturalHeight}`
              : ''

      console.log(
        `[DigitCapturePanel] handleCapture: ${prevType} → ${newType}`,
        dimensions,
        element === prevElement ? '(same element)' : '(NEW element)'
      )
      captureElementRef.current = element
    },
    []
  )

  // Perform capture
  const captureTrainingData = useCallback(async () => {
    const element = captureElementRef.current
    console.log(
      '[DigitCapturePanel] captureTrainingData - element:',
      element?.constructor?.name,
      element instanceof HTMLCanvasElement ? `${element.width}x${element.height}` : ''
    )

    if (!element) {
      console.log('[DigitCapturePanel] captureTrainingData - NO ELEMENT!')
      setCaptureStatus({
        success: false,
        message: 'No camera frame available',
      })
      return
    }

    // Check if this is a rectified canvas (already perspective-corrected)
    const isRectifiedCanvas = element instanceof HTMLCanvasElement
    console.log('[DigitCapturePanel] isRectifiedCanvas:', isRectifiedCanvas)

    // Validate element readiness
    if (element instanceof HTMLVideoElement && element.readyState < 2) {
      setCaptureStatus({ success: false, message: 'Camera not ready' })
      return
    }
    if (element instanceof HTMLImageElement && (!element.complete || element.naturalWidth === 0)) {
      setCaptureStatus({ success: false, message: 'Camera frame not ready' })
      return
    }
    if (isRectifiedCanvas && (element.width === 0 || element.height === 0)) {
      setCaptureStatus({ success: false, message: 'Canvas not ready' })
      return
    }

    setIsCapturing(true)
    setCaptureStatus(null)

    try {
      // Import frame processor dynamically
      const { processImageFrame } = await import('@/lib/vision/frameProcessor')
      const { imageDataToBase64Png } = await import('@/lib/vision/trainingData')

      // Convert element to image for processing
      let imageElement: HTMLImageElement

      if (isRectifiedCanvas) {
        // Canvas is already rectified - convert to image
        imageElement = new Image()
        imageElement.src = element.toDataURL('image/jpeg')
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve
          imageElement.onerror = reject
        })
      } else if (element instanceof HTMLVideoElement) {
        // Raw video - capture to canvas first
        const canvas = document.createElement('canvas')
        canvas.width = element.videoWidth
        canvas.height = element.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to create canvas context')
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

      // Slice image into columns
      // When it's a rectified canvas, pass null for calibration - image is already corrected,
      // just slice into equal columns. When it's raw video/image, use calibration for perspective.
      console.log(
        '[DigitCapturePanel] Calling processImageFrame, imageElement size:',
        imageElement.width || imageElement.naturalWidth,
        'x',
        imageElement.height || imageElement.naturalHeight
      )
      const columnImages = processImageFrame(
        imageElement,
        isRectifiedCanvas ? null : calibration,
        columnCount
      )
      console.log('[DigitCapturePanel] processImageFrame returned', columnImages.length, 'columns')
      if (columnImages.length === 0) {
        throw new Error('Failed to slice image into columns')
      }

      // Convert to base64
      const columns = columnImages.map((imgData: ImageData, index: number) => ({
        columnIndex: index,
        imageData: imageDataToBase64Png(imgData),
      }))

      // Send to collect API - we send the digit for each column
      const response = await fetch('/api/vision-training/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns,
          correctAnswer: parseInt(String(digit).repeat(columnCount), 10) || digit,
          playerId: 'training-wizard',
          sessionId: `digit-capture-${digit}`,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const savedCount = result.savedCount || columnCount
        setSessionCaptureCount((c) => c + savedCount)
        setCaptureStatus({
          success: true,
          message: `+${savedCount} saved`,
        })

        // Add to recent captures preview
        const newCaptures: CapturedColumn[] = columns.map(
          (col: { columnIndex: number; imageData: string }, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            imageUrl: `data:image/png;base64,${col.imageData}`,
            timestamp: Date.now(),
          })
        )
        setRecentCaptures((prev) => [...newCaptures, ...prev].slice(0, 8))

        onCaptureSuccess(savedCount)
      } else {
        throw new Error(result.error || 'Failed to save')
      }
    } catch (error) {
      console.error('[DigitCapturePanel] Error:', error)
      setCaptureStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to capture',
      })
    } finally {
      setIsCapturing(false)
    }
  }, [digit, columnCount, calibration, onCaptureSuccess])

  // Keep refs in sync for auto-capture (avoids interval restarts)
  useEffect(() => {
    console.log('[DigitCapturePanel] markersVisible changed:', markersVisible, {
      captureElementType: captureElementRef.current?.constructor?.name ?? 'null',
    })
    markersVisibleRef.current = markersVisible
  }, [markersVisible])

  useEffect(() => {
    captureTrainingDataRef.current = captureTrainingData
  }, [captureTrainingData])

  // Auto-capture effect - only restarts when autoCapture toggles
  useEffect(() => {
    if (!autoCapture) {
      console.log('[AutoCapture] Disabled')
      isAutoCapturingRef.current = false
      return
    }

    console.log('[AutoCapture] Enabled, starting polling loop')

    // Set up polling interval
    const intervalId = setInterval(async () => {
      // Skip if markers not currently visible - use ref to avoid restarts
      if (!markersVisibleRef.current) {
        // Only log occasionally to avoid spam
        if (Date.now() % 2000 < 100) {
          console.log('[AutoCapture] Waiting for markers (currently not visible)...')
        }
        return
      }

      // Skip if already capturing
      if (isAutoCapturingRef.current) {
        return // Skip silently - we're already in progress
      }

      // Validate capture element exists and has dimensions
      const element = captureElementRef.current
      if (!element) {
        console.log('[AutoCapture] No capture element available yet (ref is null)')
        return
      }

      // Check element has valid dimensions
      if (element instanceof HTMLCanvasElement) {
        if (element.width === 0 || element.height === 0) {
          console.log('[AutoCapture] Canvas has zero dimensions, skipping')
          return
        }
      } else if (element instanceof HTMLVideoElement) {
        if (element.videoWidth === 0 || element.videoHeight === 0) {
          console.log('[AutoCapture] Video has zero dimensions, skipping')
          return
        }
      }

      // Throttle captures
      const now = Date.now()
      const timeSinceLastCapture = now - lastAutoCaptureTimeRef.current
      if (timeSinceLastCapture < AUTO_CAPTURE_INTERVAL) {
        return // Don't log this - too spammy
      }

      // Perform capture using ref
      const captureFn = captureTrainingDataRef.current
      if (!captureFn) {
        console.log('[AutoCapture] No capture function available')
        return
      }

      console.log('[AutoCapture] Starting capture...', {
        elementType: element.constructor.name,
        dimensions:
          element instanceof HTMLCanvasElement
            ? `${element.width}x${element.height}`
            : element instanceof HTMLVideoElement
              ? `${element.videoWidth}x${element.videoHeight}`
              : 'unknown',
      })
      isAutoCapturingRef.current = true
      lastAutoCaptureTimeRef.current = now

      try {
        await captureFn()
        setAutoCaptureCount((c) => {
          console.log('[AutoCapture] Capture complete, count:', c + 1)
          return c + 1
        })
      } catch (err) {
        console.error('[AutoCapture] Capture failed:', err)
      } finally {
        isAutoCapturingRef.current = false
      }
    }, 100) // Poll frequently, but actual captures are throttled

    return () => {
      console.log('[AutoCapture] Cleanup - clearing interval')
      clearInterval(intervalId)
      isAutoCapturingRef.current = false
    }
  }, [autoCapture]) // Only restart when autoCapture toggles

  // Reset auto-capture count when digit changes
  useEffect(() => {
    setAutoCaptureCount(0)
  }, [digit])

  // Toggle auto-capture mode
  const toggleAutoCapture = useCallback(() => {
    setAutoCapture((prev) => !prev)
    if (!autoCapture) {
      // Starting auto-capture - reset count
      setAutoCaptureCount(0)
    }
  }, [autoCapture])

  // Handle keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isCapturing) {
        e.preventDefault()
        captureTrainingData()
      }
    },
    [captureTrainingData, isCapturing]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const canCapture = cameraSource === 'local' || isPhoneConnected

  return (
    <div
      ref={containerRef}
      data-component="digit-capture-panel"
      data-digit={digit}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden', // No scrolling in capture panel
      })}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: needed for programmatic focus to receive keyboard events
      tabIndex={0}
      onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          COMPACT INSTRUCTION HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        data-element="capture-instruction-header"
        className={css({
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          py: 2,
          px: 3,
          bg: 'blue.900/30',
          borderBottom: '1px solid',
          borderColor: 'blue.800/50',
        })}
      >
        <span
          data-element="instruction-text"
          className={css({ fontSize: 'sm', color: 'gray.400' })}
        >
          Set abacus to all
        </span>
        <span
          data-element="target-digit-badge"
          data-digit={digit}
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            fontFamily: 'mono',
            color: 'blue.300',
            px: 3,
            py: 1,
            bg: 'blue.900/50',
            borderRadius: 'lg',
            border: '2px solid',
            borderColor: 'blue.600',
          })}
        >
          {digit}
        </span>
        {sessionCaptureCount > 0 && (
          <span
            data-element="session-capture-count"
            className={css({ fontSize: 'sm', color: 'green.400' })}
          >
            +{sessionCaptureCount}
          </span>
        )}
        {calibration && (
          <span
            data-element="calibration-indicator"
            className={css({ fontSize: 'xs', color: 'green.500' })}
            title="Markers detected"
          >
            ✓
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CAMERA FEED - Takes all available space, contains footer overlay
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        data-element="camera-feed-container"
        className={css({
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        <CameraCapture
          initialSource="local"
          onCapture={handleCapture}
          onSourceChange={setCameraSource}
          onPhoneConnected={setIsPhoneConnected}
          compact
          enableMarkerDetection
          columnCount={columnCount}
          onCalibrationChange={setCalibration}
          onMarkersVisible={setMarkersVisible}
          showRectifiedView
        />

        {/* Footer - absolutely positioned so it doesn't affect width */}
        {canCapture && (
          <div
            data-element="capture-footer"
            className={css({
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              borderTop: '1px solid',
              borderColor: 'gray.800',
              bg: 'gray.900/95',
              backdropFilter: 'blur(4px)',
            })}
          >
            {/* Recent captures strip */}
            {recentCaptures.length > 0 && (
              <div
                data-element="recent-captures-strip"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 3,
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'gray.800',
                })}
              >
                <span
                  data-element="recent-captures-label"
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.500',
                    flexShrink: 0,
                  })}
                >
                  Just captured:
                </span>
                <div
                  data-element="recent-captures-thumbnails"
                  className={css({
                    display: 'flex',
                    gap: 1,
                    overflow: 'hidden',
                  })}
                >
                  {recentCaptures.map((capture) => (
                    <div
                      key={capture.id}
                      data-element="capture-thumbnail"
                      data-capture-id={capture.id}
                      className={css({
                        flexShrink: 0,
                        width: '32px',
                        height: '32px',
                        borderRadius: 'sm',
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'green.600',
                      })}
                    >
                      <img
                        src={capture.imageUrl}
                        alt={`Captured ${digit}`}
                        className={css({
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Capture button row */}
            <div
              data-element="capture-button-row"
              className={css({
                p: 3,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
              })}
            >
              {/* Manual capture button */}
              <button
                type="button"
                data-action="capture"
                data-capturing={isCapturing}
                onClick={captureTrainingData}
                disabled={isCapturing || autoCapture}
                className={css({
                  flex: 1,
                  py: 3,
                  bg: autoCapture ? 'gray.700' : isCapturing ? 'gray.700' : 'green.600',
                  color: autoCapture ? 'gray.500' : 'white',
                  borderRadius: 'lg',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  border: 'none',
                  cursor: isCapturing || autoCapture ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: 'md',
                  transition: 'all 0.15s ease',
                  _hover: isCapturing || autoCapture ? {} : { bg: 'green.500' },
                })}
              >
                {isCapturing ? '⏳...' : `📸 Capture`}
              </button>

              {/* Auto-capture toggle button */}
              <button
                type="button"
                data-action="toggle-auto-capture"
                data-active={autoCapture}
                data-paused={autoCapture && !markersVisible}
                onClick={toggleAutoCapture}
                className={css({
                  py: 3,
                  px: 4,
                  bg: autoCapture ? (markersVisible ? 'blue.600' : 'yellow.700') : 'gray.700',
                  color: 'white',
                  borderRadius: 'lg',
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: 'md',
                  transition: 'all 0.15s ease',
                  animation:
                    autoCapture && markersVisible ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  _hover: {
                    bg: autoCapture ? (markersVisible ? 'blue.500' : 'yellow.600') : 'gray.600',
                  },
                })}
                title={
                  autoCapture
                    ? markersVisible
                      ? 'Click to stop auto-capture'
                      : 'Waiting for markers...'
                    : 'Enable auto-capture'
                }
              >
                {autoCapture ? (
                  markersVisible ? (
                    <>🔄 {autoCaptureCount > 0 ? autoCaptureCount : 'Auto'}</>
                  ) : (
                    <>⏸️ No markers</>
                  )
                ) : (
                  <>🔁 Auto</>
                )}
              </button>
            </div>

            {/* Status indicator */}
            {(captureStatus || (autoCapture && markersVisible)) && (
              <div
                data-element="capture-status-bar"
                className={css({
                  px: 3,
                  pb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                })}
              >
                {autoCapture && markersVisible && (
                  <span
                    data-element="auto-capture-indicator"
                    className={css({
                      fontSize: 'sm',
                      color: 'blue.400',
                    })}
                  >
                    Auto-capturing every {AUTO_CAPTURE_INTERVAL}ms
                  </span>
                )}
                {captureStatus && !autoCapture && (
                  <span
                    data-element="capture-status"
                    data-success={captureStatus.success}
                    className={css({
                      fontSize: 'sm',
                      color: captureStatus.success ? 'green.400' : 'red.400',
                    })}
                  >
                    {captureStatus.success ? '✓' : '✗'} {captureStatus.message}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DigitCapturePanel
