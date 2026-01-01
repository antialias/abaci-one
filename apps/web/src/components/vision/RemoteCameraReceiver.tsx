'use client'

import { useEffect, useMemo } from 'react'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import { RemoteCameraQRCode } from './RemoteCameraQRCode'
import { css } from '../../../styled-system/css'

export interface RemoteCameraReceiverProps {
  /** Session ID to receive frames for */
  sessionId: string | null
  /** Called when a frame is received (for processing) */
  onFrame?: (imageData: string, timestamp: number) => void
  /** Called when session ID is available (from QR code creation) */
  onSessionCreated?: (sessionId: string) => void
  /** Size of the QR code when showing (default 200) */
  qrCodeSize?: number
}

/**
 * Desktop component for receiving remote camera frames
 *
 * Shows a QR code when no phone is connected, then displays
 * the cropped abacus frames sent from the phone.
 */
export function RemoteCameraReceiver({
  sessionId,
  onFrame,
  onSessionCreated,
  qrCodeSize = 200,
}: RemoteCameraReceiverProps) {
  const { isPhoneConnected, latestFrame, frameRate, error, subscribe, unsubscribe } =
    useRemoteCameraDesktop()

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

  // Create image src from base64 data
  const imageSrc = useMemo(() => {
    if (!latestFrame) return null
    return `data:image/jpeg;base64,${latestFrame.imageData}`
  }, [latestFrame])

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
        <p className={css({ color: 'gray.500', fontSize: 'sm', mb: 4, textAlign: 'center' })}>
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
            src={imageSrc}
            alt="Remote camera view"
            className={css({
              width: '100%',
              height: 'auto',
              display: 'block',
            })}
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
      </div>

      {/* Status bar */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          mt: 2,
          px: 2,
          py: 1,
          bg: 'gray.100',
          borderRadius: 'md',
          fontSize: 'xs',
          color: 'gray.600',
        })}
      >
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
      </div>
    </div>
  )
}
