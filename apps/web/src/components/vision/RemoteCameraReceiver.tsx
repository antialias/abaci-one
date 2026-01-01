'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRemoteCameraDesktop, type FrameMode } from '@/hooks/useRemoteCameraDesktop'
import type { CalibrationGrid, QuadCorners } from '@/types/vision'
import { css } from '../../../styled-system/css'
import { CalibrationOverlay } from './CalibrationOverlay'
import { RemoteCameraQRCode } from './RemoteCameraQRCode'

export interface RemoteCameraReceiverProps {
  /** Session ID to receive frames for */
  sessionId: string | null
  /** Number of abacus columns to detect */
  columnCount: number
  /** Whether to show calibration controls */
  showCalibrationControls?: boolean
  /** Called when a frame is received (for processing) */
  onFrame?: (imageData: string, timestamp: number) => void
  /** Called when session ID is available (from QR code creation) */
  onSessionCreated?: (sessionId: string) => void
  /** Called when calibration is complete */
  onCalibrationComplete?: (grid: CalibrationGrid) => void
  /** Size of the QR code when showing (default 200) */
  qrCodeSize?: number
}

/**
 * Desktop component for receiving remote camera frames
 *
 * Shows a QR code when no phone is connected, then displays
 * the frames sent from the phone. Supports desktop-side calibration
 * when in raw mode.
 */
export function RemoteCameraReceiver({
  sessionId,
  columnCount,
  showCalibrationControls = true,
  onFrame,
  onSessionCreated,
  onCalibrationComplete,
  qrCodeSize = 200,
}: RemoteCameraReceiverProps) {
  const {
    isPhoneConnected,
    latestFrame,
    frameRate,
    frameMode,
    videoDimensions,
    error,
    subscribe,
    unsubscribe,
    setPhoneFrameMode,
    sendCalibration,
  } = useRemoteCameraDesktop()

  // Calibration state
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  // Subscribe when sessionId changes
  useEffect(() => {
    if (sessionId) {
      subscribe(sessionId)
      return () => {
        unsubscribe()
      }
    }
  }, [sessionId, subscribe, unsubscribe])

  // Notify parent when frame received
  useEffect(() => {
    if (latestFrame && onFrame) {
      onFrame(latestFrame.imageData, latestFrame.timestamp)
    }
  }, [latestFrame, onFrame])

  // Track container dimensions
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setContainerDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [isCalibrating])

  // Track image dimensions when it loads
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
  }, [])

  // Create image src from base64 data
  const imageSrc = useMemo(() => {
    if (!latestFrame) return null
    return `data:image/jpeg;base64,${latestFrame.imageData}`
  }, [latestFrame])

  // Handle starting calibration
  const handleStartCalibration = useCallback(() => {
    // Switch phone to raw mode so we get uncropped frames
    setPhoneFrameMode('raw')
    setIsCalibrating(true)
  }, [setPhoneFrameMode])

  // Handle calibration complete
  const handleCalibrationComplete = useCallback(
    (grid: CalibrationGrid) => {
      setCalibration(grid)
      setIsCalibrating(false)

      // Send calibration to phone
      if (grid.corners) {
        sendCalibration(grid.corners)
      }

      // Notify parent
      if (onCalibrationComplete) {
        onCalibrationComplete(grid)
      }
    },
    [sendCalibration, onCalibrationComplete]
  )

  // Handle calibration cancel
  const handleCalibrationCancel = useCallback(() => {
    setIsCalibrating(false)
    // If we have a previous calibration, switch back to cropped mode
    if (calibration?.corners) {
      setPhoneFrameMode('cropped')
    }
  }, [calibration, setPhoneFrameMode])

  // Handle corners change during calibration (for live preview)
  const handleCornersChange = useCallback((corners: QuadCorners) => {
    // Could update preview here if needed
  }, [])

  // Show QR code if no session yet
  if (!sessionId) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
        })}
        data-component="remote-camera-receiver-qr"
      >
        <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          Connect Phone Camera
        </h3>
        <RemoteCameraQRCode onSessionCreated={onSessionCreated} size={qrCodeSize} />
      </div>
    )
  }

  // Show error if any
  if (error) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          bg: 'red.50',
          borderRadius: 'lg',
          border: '1px solid',
          borderColor: 'red.200',
        })}
        data-component="remote-camera-receiver-error"
      >
        <span className={css({ color: 'red.600', fontSize: 'sm' })}>{error}</span>
      </div>
    )
  }

  // Show waiting for phone
  if (!isPhoneConnected) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
        })}
        data-component="remote-camera-receiver-waiting"
      >
        <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          Waiting for Phone...
        </h3>
        <p
          className={css({
            color: 'gray.500',
            fontSize: 'sm',
            mb: 4,
            textAlign: 'center',
          })}
        >
          Scan the QR code with your phone to connect
        </p>
        <RemoteCameraQRCode onSessionCreated={onSessionCreated} size={qrCodeSize} />
      </div>
    )
  }

  // Show received frame
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      })}
      data-component="remote-camera-receiver-connected"
    >
      {/* Frame display */}
      <div
        ref={containerRef}
        className={css({
          position: 'relative',
          width: '100%',
          bg: 'gray.900',
          borderRadius: 'lg',
          overflow: 'hidden',
        })}
      >
        {imageSrc ? (
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Remote camera view"
            className={css({
              width: '100%',
              height: 'auto',
              display: 'block',
            })}
            onLoad={handleImageLoad}
          />
        ) : (
          <div
            className={css({
              width: '100%',
              aspectRatio: '2/1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'gray.400',
            })}
          >
            Waiting for frames...
          </div>
        )}

        {/* Calibration overlay */}
        {isCalibrating &&
          imageDimensions.width > 0 &&
          containerDimensions.width > 0 &&
          videoDimensions && (
            <CalibrationOverlay
              columnCount={columnCount}
              videoWidth={videoDimensions.width}
              videoHeight={videoDimensions.height}
              containerWidth={containerDimensions.width}
              containerHeight={containerDimensions.height}
              initialCalibration={calibration}
              onComplete={handleCalibrationComplete}
              onCancel={handleCalibrationCancel}
              onCornersChange={handleCornersChange}
            />
          )}

        {/* Loading state while waiting for raw frames */}
        {isCalibrating && !videoDimensions && (
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              gap: 3,
            })}
          >
            <div
              className={css({
                width: 8,
                height: 8,
                border: '3px solid',
                borderColor: 'gray.600',
                borderTopColor: 'blue.400',
                borderRadius: 'full',
              })}
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p className={css({ fontSize: 'sm' })}>Waiting for camera dimensions...</p>
            <p className={css({ fontSize: 'xs', color: 'gray.400' })}>
              Frame mode: {frameMode} | FPS: {frameRate} | Has dims:{' '}
              {latestFrame?.videoDimensions ? 'yes' : 'no'}
            </p>
            <button
              type="button"
              onClick={handleCalibrationCancel}
              className={css({
                px: 3,
                py: 1.5,
                bg: 'gray.600',
                color: 'white',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'sm',
                _hover: { bg: 'gray.500' },
              })}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          mt: 2,
          px: 2,
          py: 1,
          bg: 'gray.100',
          borderRadius: 'md',
          fontSize: 'xs',
          color: 'gray.600',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
          <span
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            })}
          >
            <span
              className={css({
                width: 2,
                height: 2,
                borderRadius: 'full',
                bg: isPhoneConnected ? 'green.500' : 'red.500',
              })}
            />
            {isPhoneConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span>{frameRate} fps</span>
          <span
            className={css({
              px: 1.5,
              py: 0.5,
              bg: frameMode === 'raw' ? 'yellow.100' : 'green.100',
              color: frameMode === 'raw' ? 'yellow.700' : 'green.700',
              borderRadius: 'sm',
            })}
          >
            {frameMode === 'raw' ? 'Raw' : 'Cropped'}
          </span>
        </div>

        {/* Calibration button */}
        {showCalibrationControls && !isCalibrating && (
          <button
            type="button"
            onClick={handleStartCalibration}
            className={css({
              px: 2,
              py: 1,
              bg: calibration ? 'gray.200' : 'blue.500',
              color: calibration ? 'gray.700' : 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'xs',
              fontWeight: 'medium',
              _hover: { bg: calibration ? 'gray.300' : 'blue.600' },
            })}
          >
            {calibration ? 'Recalibrate' : 'Calibrate'}
          </button>
        )}
      </div>
    </div>
  )
}
