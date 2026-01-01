'use client'

import { useEffect, useRef, useState } from 'react'
import { AbacusQRCode } from '@/components/common/AbacusQRCode'
import { useRemoteCameraSession } from '@/hooks/useRemoteCameraSession'
import { css } from '../../../styled-system/css'

export interface RemoteCameraQRCodeProps {
  /** Called when a session is created with the session ID */
  onSessionCreated?: (sessionId: string) => void
  /** Size of the QR code in pixels */
  size?: number
  /** Existing session ID to reuse (for reconnection scenarios) */
  existingSessionId?: string | null
}

/**
 * Displays a QR code for phone camera connection
 *
 * Automatically creates a remote camera session and shows a QR code
 * that phones can scan to connect as a remote camera source.
 *
 * If an existing session ID is provided, it will reuse that session
 * instead of creating a new one. This allows the phone to reconnect
 * after a page reload.
 */
export function RemoteCameraQRCode({
  onSessionCreated,
  size = 200,
  existingSessionId,
}: RemoteCameraQRCodeProps) {
  const { session, isCreating, error, createSession, setExistingSession, getPhoneUrl } =
    useRemoteCameraSession()

  // Ref to track if we've already initiated session creation
  // This prevents React 18 Strict Mode from creating duplicate sessions
  const creationInitiatedRef = useRef(false)

  // If we have an existing session ID, use it instead of creating a new one
  useEffect(() => {
    if (existingSessionId && !session) {
      setExistingSession(existingSessionId)
    }
  }, [existingSessionId, session, setExistingSession])

  // Create session on mount only if no existing session
  // Use ref to prevent duplicate creation in React 18 Strict Mode
  useEffect(() => {
    if (!session && !isCreating && !existingSessionId && !creationInitiatedRef.current) {
      creationInitiatedRef.current = true
      createSession().then((newSession) => {
        if (newSession && onSessionCreated) {
          onSessionCreated(newSession.sessionId)
        }
      })
    }
  }, [session, isCreating, existingSessionId, createSession, onSessionCreated])

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
        <p className={css({ fontSize: 'xs', color: 'gray.400' })}>Session expires in 10 minutes</p>
      </div>

      {/* URL for manual entry with copy button */}
      <UrlWithCopyButton url={phoneUrl} />
    </div>
  )
}

/**
 * URL display with copy button
 */
function UrlWithCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  return (
    <div
      data-element="url-copy-container"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bg: 'gray.100',
        px: 3,
        py: 2,
        borderRadius: 'md',
        maxWidth: '280px',
      })}
    >
      <span
        className={css({
          fontSize: 'xs',
          color: 'gray.500',
          fontFamily: 'mono',
          wordBreak: 'break-all',
          flex: 1,
          userSelect: 'text',
        })}
      >
        {url}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        data-action="copy-url"
        className={css({
          flexShrink: 0,
          px: 2,
          py: 1,
          bg: copied ? 'green.600' : 'gray.600',
          color: 'white',
          border: 'none',
          borderRadius: 'md',
          fontSize: 'xs',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          _hover: { bg: copied ? 'green.700' : 'gray.700' },
        })}
        title="Copy URL to clipboard"
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  )
}
