'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { VisionCameraFeed } from '@/components/vision/VisionCameraFeed'
import { usePhoneCamera } from '@/hooks/usePhoneCamera'
import { useRemoteCameraPhone } from '@/hooks/useRemoteCameraPhone'
import { detectMarkers, initArucoDetector, loadAruco } from '@/lib/vision/arucoDetection'
import type { CalibrationGrid } from '@/types/vision'
import { css } from '../../../../styled-system/css'

type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'expired'

/**
 * Phone Camera Page
 *
 * Accessed by scanning QR code on desktop.
 * Starts streaming immediately, auto-detects ArUco markers for cropping.
 * Desktop can override with manual calibration.
 */
export default function RemoteCameraPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  // Session validation state
  const [sessionStatus, setSessionStatus] = useState<ConnectionStatus>('connecting')
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Camera state - defaults to back camera (environment)
  const {
    isLoading: isCameraLoading,
    error: cameraError,
    stream: videoStream,
    facingMode,
    isTorchOn,
    isTorchAvailable,
    availableDevices,
    start: startCamera,
    stop: stopCamera,
    flipCamera,
    toggleTorch,
    setTorch,
  } = usePhoneCamera({ initialFacingMode: 'environment' })

  // Remote camera connection - pass setTorch for desktop control
  const {
    isConnected,
    isSending,
    frameMode,
    desktopCalibration,
    error: connectionError,
    connect,
    disconnect,
    startSending,
    stopSending,
    updateCalibration,
    setFrameMode,
    emitTorchState,
  } = useRemoteCameraPhone({
    onTorchRequest: setTorch,
  })

  // Auto-detection state
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null)
  const [markersDetected, setMarkersDetected] = useState(0)
  const [arucoReady, setArucoReady] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)

  // Track if we're using desktop calibration (to show in UI)
  const [usingDesktopCalibration, setUsingDesktopCalibration] = useState(false)

  // Track if desktop is actively calibrating (has requested raw mode)
  // When true, we don't auto-switch to cropped even if markers are detected
  const [desktopIsCalibrating, setDesktopIsCalibrating] = useState(false)

  // Track previous frame mode to detect changes (not just initial state)
  const prevFrameModeRef = useRef<typeof frameMode | null>(null)

  // Video element ref
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Refs for cleanup functions (to avoid stale closures in unmount effect)
  const stopSendingRef = useRef(stopSending)
  const disconnectRef = useRef(disconnect)
  const stopCameraRef = useRef(stopCamera)

  // Keep refs in sync
  useEffect(() => {
    stopSendingRef.current = stopSending
    disconnectRef.current = disconnect
    stopCameraRef.current = stopCamera
  }, [stopSending, disconnect, stopCamera])

  // Validate session on mount
  useEffect(() => {
    async function validateSession() {
      console.log('[RemoteCameraPage] Validating session:', sessionId)
      try {
        const response = await fetch(`/api/remote-camera?sessionId=${sessionId}`)
        console.log('[RemoteCameraPage] Session validation response:', response.status)
        if (response.ok) {
          const data = await response.json()
          console.log('[RemoteCameraPage] Session valid:', data)
          setSessionStatus('connected')
        } else if (response.status === 404) {
          setSessionStatus('expired')
          setSessionError('Session not found or expired')
        } else {
          setSessionStatus('error')
          const data = await response.json()
          setSessionError(data.error || 'Failed to validate session')
        }
      } catch (err) {
        console.error('[RemoteCameraPage] Session validation error:', err)
        setSessionStatus('error')
        setSessionError('Network error')
      }
    }

    validateSession()
  }, [sessionId])

  // Load ArUco library
  useEffect(() => {
    loadAruco()
      .then(() => {
        initArucoDetector()
        setArucoReady(true)
      })
      .catch((err) => {
        console.error('Failed to load ArUco:', err)
      })
  }, [])

  // Connect to session when validated
  useEffect(() => {
    if (sessionStatus === 'connected' && !isConnected) {
      connect(sessionId)
    }
  }, [sessionStatus, isConnected, sessionId, connect])

  // Request camera when connected
  useEffect(() => {
    if (isConnected && !videoStream && !isCameraLoading) {
      startCamera()
    }
  }, [isConnected, videoStream, isCameraLoading, startCamera])

  // Emit torch state to desktop when it changes or when connected
  useEffect(() => {
    if (isConnected) {
      emitTorchState(isTorchOn, isTorchAvailable)
    }
  }, [isConnected, isTorchOn, isTorchAvailable, emitTorchState])

  // Handle video ready - start sending immediately
  const handleVideoReady = useCallback(
    (width: number, height: number) => {
      setIsVideoReady(true)
      // Start sending as soon as video is ready
      if (isConnected && videoRef.current && !isSending) {
        startSending(videoRef.current)
      }
    },
    [isConnected, isSending, startSending]
  )

  // Also try to start sending when connection is established (if video already ready)
  useEffect(() => {
    if (isConnected && isVideoReady && videoRef.current && !isSending) {
      startSending(videoRef.current)
    }
  }, [isConnected, isVideoReady, isSending, startSending])

  // Sync desktop calibration to local state
  useEffect(() => {
    if (desktopCalibration) {
      const grid: CalibrationGrid = {
        roi: {
          x: Math.min(desktopCalibration.topLeft.x, desktopCalibration.bottomLeft.x),
          y: Math.min(desktopCalibration.topLeft.y, desktopCalibration.topRight.y),
          width:
            Math.max(desktopCalibration.topRight.x, desktopCalibration.bottomRight.x) -
            Math.min(desktopCalibration.topLeft.x, desktopCalibration.bottomLeft.x),
          height:
            Math.max(desktopCalibration.bottomLeft.y, desktopCalibration.bottomRight.y) -
            Math.min(desktopCalibration.topLeft.y, desktopCalibration.topRight.y),
        },
        corners: desktopCalibration,
        columnCount: 13,
        columnDividers: Array.from({ length: 12 }, (_, i) => (i + 1) / 13),
        rotation: 0,
      }
      setCalibration(grid)
      setUsingDesktopCalibration(true)
      setDesktopIsCalibrating(false) // Desktop finished calibrating
      // Update the calibration for the sending loop
      if (isSending) {
        updateCalibration(desktopCalibration)
      }
    } else if (usingDesktopCalibration) {
      // Desktop cleared calibration - go back to auto-detection
      setUsingDesktopCalibration(false)
      setCalibration(null)
    }
  }, [desktopCalibration, isSending, updateCalibration, usingDesktopCalibration])

  // Auto-detect markers (always runs unless using desktop calibration)
  useEffect(() => {
    // Don't run auto-detection if using desktop calibration
    if (usingDesktopCalibration) return
    if (!videoStream || !arucoReady || !videoRef.current) return

    const video = videoRef.current
    let animationId: number

    const detectLoop = () => {
      if (video.readyState >= 2) {
        const result = detectMarkers(video)
        setMarkersDetected(result.markersFound)

        if (result.allMarkersFound && result.quadCorners) {
          // Auto-calibration successful!
          // NOTE: detectMarkers() returns corners swapped for Desk View camera (180° rotated).
          // Phone camera is NOT Desk View, so we need to swap corners back to get correct orientation.
          // detectMarkers maps: marker 2 (physical BR) → topLeft, marker 0 (physical TL) → bottomRight
          // For phone camera we need: marker 0 (physical TL) → topLeft, marker 2 (physical BR) → bottomRight
          const phoneCorners = {
            topLeft: result.quadCorners.bottomRight, // marker 0 (physical TL)
            topRight: result.quadCorners.bottomLeft, // marker 1 (physical TR)
            bottomRight: result.quadCorners.topLeft, // marker 2 (physical BR)
            bottomLeft: result.quadCorners.topRight, // marker 3 (physical BL)
          }
          const grid: CalibrationGrid = {
            roi: {
              x: Math.min(phoneCorners.topLeft.x, phoneCorners.bottomLeft.x),
              y: Math.min(phoneCorners.topLeft.y, phoneCorners.topRight.y),
              width:
                Math.max(phoneCorners.topRight.x, phoneCorners.bottomRight.x) -
                Math.min(phoneCorners.topLeft.x, phoneCorners.bottomLeft.x),
              height:
                Math.max(phoneCorners.bottomLeft.y, phoneCorners.bottomRight.y) -
                Math.min(phoneCorners.topLeft.y, phoneCorners.topRight.y),
            },
            corners: phoneCorners,
            columnCount: 13,
            columnDividers: Array.from({ length: 12 }, (_, i) => (i + 1) / 13),
            rotation: 0,
          }
          setCalibration(grid)
          // Update the calibration for the sending loop and switch to cropped mode
          // BUT: don't switch to cropped if desktop is actively calibrating (they need raw frames)
          if (isSending && !desktopIsCalibrating) {
            updateCalibration(phoneCorners)
            setFrameMode('cropped')
          }
        }
        // Note: We intentionally do NOT clear calibration when markers are lost.
        // Once calibration is set, it persists until:
        // 1. New markers are detected (updates calibration)
        // 2. Desktop sends a new calibration (override)
        // 3. Desktop requests raw mode (for manual recalibration)
      }

      animationId = requestAnimationFrame(detectLoop)
    }

    detectLoop()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [
    videoStream,
    arucoReady,
    isSending,
    updateCalibration,
    setFrameMode,
    usingDesktopCalibration,
    desktopIsCalibrating,
  ])

  // When frameMode CHANGES to 'raw' from 'cropped', mark desktop as calibrating
  // This prevents auto-switching back to cropped when markers are detected
  // We check prevFrameModeRef to avoid triggering on initial render
  useEffect(() => {
    const prevMode = prevFrameModeRef.current
    prevFrameModeRef.current = frameMode

    // Only trigger when changing from cropped to raw (not on initial load)
    if (frameMode === 'raw' && prevMode === 'cropped') {
      // Desktop requested raw mode - they're calibrating
      setDesktopIsCalibrating(true)
      if (usingDesktopCalibration) {
        setUsingDesktopCalibration(false)
        setCalibration(null)
      }
    }
  }, [frameMode, usingDesktopCalibration])

  // Cleanup on unmount only (use refs to avoid stale closures)
  useEffect(() => {
    return () => {
      stopSendingRef.current()
      disconnectRef.current()
      stopCameraRef.current()
    }
  }, [])

  // Render based on session status
  if (sessionStatus === 'connecting') {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.900',
          color: 'white',
        })}
      >
        <div className={css({ textAlign: 'center' })}>
          <div
            className={css({
              width: 10,
              height: 10,
              border: '3px solid',
              borderColor: 'gray.600',
              borderTopColor: 'blue.400',
              borderRadius: 'full',
              mx: 'auto',
              mb: 4,
            })}
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p>Connecting to session...</p>
        </div>
      </div>
    )
  }

  if (sessionStatus === 'expired' || sessionStatus === 'error') {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.900',
          color: 'white',
          px: 4,
        })}
      >
        <div className={css({ textAlign: 'center', maxWidth: '400px' })}>
          <div className={css({ fontSize: '4xl', mb: 4 })}>
            {sessionStatus === 'expired' ? '⏰' : '❌'}
          </div>
          <h1 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 2 })}>
            {sessionStatus === 'expired' ? 'Session Expired' : 'Connection Error'}
          </h1>
          <p className={css({ color: 'gray.400', mb: 4 })}>
            {sessionError || 'Please scan the QR code again on your desktop.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={css({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bg: 'gray.900',
        color: 'white',
      })}
      data-component="remote-camera-page"
    >
      {/* Header */}
      <header
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 4,
          py: 3,
          borderBottom: '1px solid',
          borderColor: 'gray.800',
        })}
      >
        <h1 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>Remote Camera</h1>
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          })}
        >
          {/* Camera controls */}
          {videoStream && (
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              })}
            >
              {/* Flip camera button - only show if multiple cameras available */}
              {availableDevices.length > 1 && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className={css({
                    p: 2,
                    bg: 'gray.700',
                    borderRadius: 'full',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    _hover: { bg: 'gray.600' },
                  })}
                  title={`Switch to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
                  data-action="flip-camera"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                    <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="m18 22-3-3 3-3" />
                    <path d="m6 2 3 3-3 3" />
                  </svg>
                </button>
              )}

              {/* Torch button - only show if available */}
              {isTorchAvailable && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={css({
                    p: 2,
                    bg: isTorchOn ? 'yellow.500' : 'gray.700',
                    borderRadius: 'full',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isTorchOn ? 'gray.900' : 'white',
                    _hover: { bg: isTorchOn ? 'yellow.400' : 'gray.600' },
                  })}
                  title={isTorchOn ? 'Turn off flash' : 'Turn on flash'}
                  data-action="toggle-torch"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={isTorchOn ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Status indicator */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 'sm',
            })}
          >
            <span
              className={css({
                width: 2,
                height: 2,
                borderRadius: 'full',
                bg: isConnected ? (isSending ? 'green.500' : 'yellow.500') : 'red.500',
              })}
            />
            <span className={css({ color: 'gray.400' })}>
              {isConnected
                ? isSending
                  ? frameMode === 'raw'
                    ? 'Streaming (Raw)'
                    : 'Streaming (Cropped)'
                  : 'Connected'
                : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Camera Feed */}
      <div
        className={css({
          flex: 1,
          position: 'relative',
          minHeight: '300px',
        })}
      >
        <VisionCameraFeed
          videoStream={videoStream}
          isLoading={isCameraLoading}
          calibration={calibration}
          showCalibrationGrid={!!calibration}
          videoRef={(el) => {
            videoRef.current = el
          }}
          onVideoReady={handleVideoReady}
        />

        {/* Camera error overlay */}
        {cameraError && (
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'rgba(0, 0, 0, 0.8)',
              p: 4,
            })}
          >
            <div className={css({ textAlign: 'center' })}>
              <p className={css({ color: 'red.400', mb: 4 })}>{cameraError}</p>
              <button
                type="button"
                onClick={() => startCamera()}
                className={css({
                  px: 4,
                  py: 2,
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: 'lg',
                  fontWeight: 'medium',
                  border: 'none',
                  cursor: 'pointer',
                })}
              >
                Retry Camera
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div
        className={css({
          px: 4,
          py: 3,
          borderTop: '1px solid',
          borderColor: 'gray.800',
        })}
      >
        {/* Marker detection status */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 3,
            bg: 'gray.800',
            borderRadius: 'lg',
          })}
        >
          <span className={css({ fontSize: 'lg' })}>
            {usingDesktopCalibration ? '🎯' : markersDetected === 4 ? '✅' : '🔍'}
          </span>
          <div>
            <p className={css({ fontWeight: 'medium' })}>
              {usingDesktopCalibration
                ? 'Using Desktop Calibration'
                : `${markersDetected}/4 Markers Detected`}
            </p>
            <p className={css({ fontSize: 'sm', color: 'gray.400' })}>
              {usingDesktopCalibration
                ? 'Cropping set by desktop'
                : calibration
                  ? 'Auto-cropping active'
                  : 'Point camera at abacus markers'}
            </p>
          </div>
        </div>

        {/* Connection error */}
        {connectionError && (
          <p className={css({ color: 'red.400', fontSize: 'sm', mt: 2 })}>{connectionError}</p>
        )}
      </div>
    </div>
  )
}
