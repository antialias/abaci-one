'use client'

import { useEffect, useState } from 'react'
import { css } from '../../styled-system/css'

export interface ErrorToastProps {
  message: string
  details?: string
  onDismiss: () => void
  autoHideDuration?: number // milliseconds, default 10000 (10s)
}

/**
 * Error toast notification component
 * Shows prominent error messages to users with optional details
 */
export function ErrorToast({
  message,
  details,
  onDismiss,
  autoHideDuration = 10000,
}: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for fade-out animation
      }, autoHideDuration)

      return () => clearTimeout(timer)
    }
  }, [autoHideDuration, onDismiss])

  if (!isVisible) return null

  return (
    <div
      data-component="error-toast"
      className={css({
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        maxWidth: '400px',
        backgroundColor: 'red.700',
        color: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 20000, // Above everything
        transition: 'all 0.3s ease-out',
        '@media (max-width: 480px)': {
          left: '16px',
          right: '16px',
          bottom: '16px',
          maxWidth: 'none',
        },
      })}
    >
      {/* Header with dismiss button */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '8px',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
          })}
        >
          <span className={css({ fontSize: '20px' })} aria-label="Error">
            ⚠️
          </span>
          <strong className={css({ fontSize: '16px', fontWeight: 'bold' })}>Error</strong>
        </div>

        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onDismiss, 300)
          }}
          data-action="dismiss-error"
          className={css({
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1',
            opacity: 0.7,
            transition: 'opacity 0.2s',
            _hover: {
              opacity: 1,
            },
          })}
          aria-label="Dismiss error"
        >
          ×
        </button>
      </div>

      {/* Error message */}
      <div className={css({ fontSize: '14px', lineHeight: '1.5', marginBottom: details ? '8px' : '0' })}>
        {message}
      </div>

      {/* Optional details */}
      {details && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            data-action="toggle-error-details"
            className={css({
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 0',
              textDecoration: 'underline',
              opacity: 0.8,
              _hover: {
                opacity: 1,
              },
            })}
          >
            {showDetails ? 'Hide' : 'Show'} technical details
          </button>

          {showDetails && (
            <pre
              className={css({
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                fontSize: '11px',
                overflow: 'auto',
                maxHeight: '200px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              })}
            >
              {details}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Error toast container that manages multiple toasts
 */
export function ErrorToastContainer({ errors }: { errors: Array<{ id: string; message: string; details?: string }> }) {
  const [visibleErrors, setVisibleErrors] = useState(errors)

  useEffect(() => {
    setVisibleErrors(errors)
  }, [errors])

  return (
    <>
      {visibleErrors.map((error, index) => (
        <ErrorToast
          key={error.id}
          message={error.message}
          details={error.details}
          onDismiss={() => {
            setVisibleErrors((prev) => prev.filter((e) => e.id !== error.id))
          }}
        />
      ))}
    </>
  )
}
