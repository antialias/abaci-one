'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { VisionCameraFeed } from '@/components/vision/VisionCameraFeed'
import { CalibrationOverlay } from '@/components/vision/CalibrationOverlay'
import { useDeskViewCamera } from '@/hooks/useDeskViewCamera'
import { useRemoteCameraPhone } from '@/hooks/useRemoteCameraPhone'
import {
  detectMarkers,
  initArucoDetector,
  loadAruco,
  MARKER_IDS,
} from '@/lib/vision/arucoDetection'
import type { CalibrationGrid, QuadCorners } from '@/types/vision'
import { css } from '../../../../styled-system/css'

type CalibrationMode = 'auto' | 'manual'
type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'expired'

/**
 * Phone Camera Page
 *
 * Accessed by scanning QR code on desktop.
 * Captures video, performs calibration (auto or manual),
 * and sends cropped abacus frames to the desktop.
 */
export default function RemoteCameraPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  // Session validation state
  const [sessionStatus, setSessionStatus] = useState<ConnectionStatus>('connecting')
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Camera state
  const {
    isLoading: isCameraLoading,
    error: cameraError,
    videoStream,
    currentDevice,
    requestCamera,
    stopCamera,
  } = useDeskViewCamera()

  // Remote camera connection
  const {
    isConnected,
    isSending,
    error: connectionError,
    connect,
    disconnect,
    startSending,
    stopSending,
    updateCalibration,
  } = useRemoteCameraPhone()

  // Calibration state
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>('auto')
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [markersDetected, setMarkersDetected] = useState(0)
  const [arucoReady, setArucoReady] = useState(false)

  // Video element ref
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })

  // Validate session on mount
  useEffect(() => {
    async function validateSession() {
      try {
        const response = await fetch(`/api/remote-camera?sessionId=${sessionId}`)
        if (response.ok) {
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
      requestCamera()
    }
  }, [isConnected, videoStream, isCameraLoading, requestCamera])

  // Update container dimensions
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      setContainerDimensions({ width: rect.width, height: rect.height })
    }

    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Auto-detect markers
  useEffect(() => {
    if (calibrationMode !== 'auto' || !videoStream || !arucoReady || !videoRef.current) return

    const video = videoRef.current
    let animationId: number

    const detectLoop = () => {
      if (video.readyState >= 2) {
        const result = detectMarkers(video)
        setMarkersDetected(result.markersFound)

        if (result.allMarkersFound && result.quadCorners) {
          // Auto-calibration successful!
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
            columnCount: 13, // Default column count
            columnDividers: Array.from({ length: 12 }, (_, i) => (i + 1) / 13),
            rotation: 0,
          }
          setCalibration(grid)
        }
      }

      animationId = requestAnimationFrame(detectLoop)
    }

    detectLoop()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [calibrationMode, videoStream, arucoReady])

  // Start/stop sending based on calibration
  useEffect(() => {
    if (calibration && isConnected && videoRef.current && calibration.corners) {
      startSending(videoRef.current, calibration.corners)
    }
  }, [calibration, isConnected, startSending])

  // Update calibration when corners change
  const handleCornersChange = useCallback(
    (corners: QuadCorners) => {
      if (isSending) {
        updateCalibration(corners)
      }
    },
    [isSending, updateCalibration]
  )

  // Handle manual calibration complete
  const handleCalibrationComplete = useCallback((grid: CalibrationGrid) => {
    setCalibration(grid)
    setIsCalibrating(false)
  }, [])

  // Handle calibration cancel
  const handleCalibrationCancel = useCallback(() => {
    setIsCalibrating(false)
  }, [])

  // Handle video ready
  const handleVideoReady = useCallback((width: number, height: number) => {
    setVideoDimensions({ width, height })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSending()
      disconnect()
      stopCamera()
    }
  }, [stopSending, disconnect, stopCamera])

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
            gap: 2,
            fontSize: 'sm',
          })}
        >
          <span
            className={css({
              width: 2,
              height: 2,
              borderRadius: 'full',
              bg: isConnected ? 'green.500' : 'yellow.500',
            })}
          />
          <span className={css({ color: 'gray.400' })}>
            {isConnected ? (isSending ? 'Streaming' : 'Connected') : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Camera Feed */}
      <div
        ref={containerRef}
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
          showCalibrationGrid={!!calibration && !isCalibrating}
          videoRef={(el) => {
            videoRef.current = el
          }}
          onVideoReady={handleVideoReady}
        >
          {/* Manual calibration overlay */}
          {isCalibrating &&
            videoDimensions.width > 0 &&
            containerDimensions.width > 0 && (
              <CalibrationOverlay
                columnCount={13}
                videoWidth={videoDimensions.width}
                videoHeight={videoDimensions.height}
                containerWidth={containerDimensions.width}
                containerHeight={containerDimensions.height}
                initialCalibration={calibration}
                onComplete={handleCalibrationComplete}
                onCancel={handleCalibrationCancel}
                videoElement={videoRef.current}
                onCornersChange={handleCornersChange}
              />
            )}
        </VisionCameraFeed>

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
                onClick={() => requestCamera()}
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

      {/* Controls */}
      <div
        className={css({
          px: 4,
          py: 3,
          borderTop: '1px solid',
          borderColor: 'gray.800',
        })}
      >
        {/* Mode selector */}
        <div className={css({ display: 'flex', gap: 2, mb: 3 })}>
          <button
            type="button"
            onClick={() => setCalibrationMode('auto')}
            className={css({
              flex: 1,
              px: 3,
              py: 2,
              borderRadius: 'lg',
              fontWeight: 'medium',
              border: 'none',
              cursor: 'pointer',
              bg: calibrationMode === 'auto' ? 'blue.600' : 'gray.700',
              color: 'white',
            })}
          >
            Auto (Markers)
          </button>
          <button
            type="button"
            onClick={() => setCalibrationMode('manual')}
            className={css({
              flex: 1,
              px: 3,
              py: 2,
              borderRadius: 'lg',
              fontWeight: 'medium',
              border: 'none',
              cursor: 'pointer',
              bg: calibrationMode === 'manual' ? 'blue.600' : 'gray.700',
              color: 'white',
            })}
          >
            Manual
          </button>
        </div>

        {/* Status */}
        {calibrationMode === 'auto' && (
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 3,
              p: 3,
              bg: 'gray.800',
              borderRadius: 'lg',
            })}
          >
            <span className={css({ fontSize: 'lg' })}>
              {markersDetected === 4 ? '✅' : '🔍'}
            </span>
            <div>
              <p className={css({ fontWeight: 'medium' })}>
                {markersDetected}/4 Markers Detected
              </p>
              <p className={css({ fontSize: 'sm', color: 'gray.400' })}>
                {calibration
                  ? 'Calibrated - Streaming'
                  : 'Point camera at abacus markers'}
              </p>
            </div>
          </div>
        )}

        {calibrationMode === 'manual' && !isCalibrating && (
          <button
            type="button"
            onClick={() => setIsCalibrating(true)}
            disabled={!videoStream}
            className={css({
              width: '100%',
              px: 4,
              py: 3,
              bg: 'green.600',
              color: 'white',
              borderRadius: 'lg',
              fontWeight: 'medium',
              fontSize: 'lg',
              border: 'none',
              cursor: 'pointer',
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {calibration ? 'Recalibrate' : 'Start Calibration'}
          </button>
        )}

        {/* Connection error */}
        {connectionError && (
          <p className={css({ color: 'red.400', fontSize: 'sm', mt: 2 })}>
            {connectionError}
          </p>
        )}
      </div>
    </div>
  )
}
