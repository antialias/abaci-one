'use client'

import { useEffect } from 'react'
import { AbacusQRCode } from '@/components/common/AbacusQRCode'
import { useRemoteCameraSession } from '@/hooks/useRemoteCameraSession'
import { css } from '../../../styled-system/css'

export interface RemoteCameraQRCodeProps {
  /** Called when a session is created with the session ID */
  onSessionCreated?: (sessionId: string) => void
  /** Size of the QR code in pixels */
  size?: number
}

/**
 * Displays a QR code for phone camera connection
 *
 * Automatically creates a remote camera session and shows a QR code
 * that phones can scan to connect as a remote camera source.
 */
export function RemoteCameraQRCode({ onSessionCreated, size = 200 }: RemoteCameraQRCodeProps) {
  const { session, isCreating, error, createSession, getPhoneUrl } = useRemoteCameraSession()

  // Create session on mount
  useEffect(() => {
    if (!session && !isCreating) {
      createSession().then((newSession) => {
        if (newSession && onSessionCreated) {
          onSessionCreated(newSession.sessionId)
        }
      })
    }
  }, [session, isCreating, createSession, onSessionCreated])

  const phoneUrl = getPhoneUrl()

  if (isCreating) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          p: 4,
        })}
        data-component="remote-camera-qr-loading"
      >
        <div
          className={css({
            width: `${size}px`,
            height: `${size}px`,
            bg: 'gray.100',
            borderRadius: 'lg',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <span className={css({ color: 'gray.500', fontSize: 'sm' })}>Creating session...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          p: 4,
        })}
        data-component="remote-camera-qr-error"
      >
        <div
          className={css({
            width: `${size}px`,
            height: `${size}px`,
            bg: 'red.50',
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'red.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            textAlign: 'center',
          })}
        >
          <span className={css({ color: 'red.600', fontSize: 'sm' })}>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => createSession()}
          className={css({
            px: 4,
            py: 2,
            bg: 'blue.600',
            color: 'white',
            borderRadius: 'lg',
            fontWeight: 'medium',
            cursor: 'pointer',
            border: 'none',
            _hover: { bg: 'blue.700' },
          })}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!session || !phoneUrl) {
    return null
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      })}
      data-component="remote-camera-qr"
    >
      {/* QR Code */}
      <div
        className={css({
          bg: 'white',
          p: 4,
          borderRadius: 'xl',
          shadow: 'md',
        })}
      >
        <AbacusQRCode value={phoneUrl} size={size} />
      </div>

      {/* Instructions */}
      <div className={css({ textAlign: 'center' })}>
        <p className={css({ fontSize: 'sm', color: 'gray.600', mb: 1 })}>
          Scan with your phone to use it as a camera
        </p>
        <p className={css({ fontSize: 'xs', color: 'gray.400' })}>
          Session expires in 10 minutes
        </p>
      </div>

      {/* URL for manual entry */}
      <div
        className={css({
          fontSize: 'xs',
          color: 'gray.500',
          bg: 'gray.100',
          px: 3,
          py: 2,
          borderRadius: 'md',
          fontFamily: 'mono',
          wordBreak: 'break-all',
          maxWidth: '280px',
          textAlign: 'center',
        })}
      >
        {phoneUrl}
      </div>
    </div>
  )
}
