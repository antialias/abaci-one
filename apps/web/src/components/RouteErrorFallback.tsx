'use client'

import { useEffect } from 'react'
import { css } from '../../styled-system/css'

interface RouteErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  /** Label for the error boundary, used in console logging */
  label: string
  /** Text for the secondary "go back" button */
  backLabel?: string
  /** URL for the secondary "go back" button */
  backHref?: string
}

/**
 * Shared error fallback UI for Next.js route error.tsx files.
 * Renders inline within the existing layout (nav stays visible).
 */
export function RouteErrorFallback({
  error,
  reset,
  label,
  backLabel = 'Return Home',
  backHref = '/',
}: RouteErrorFallbackProps) {
  useEffect(() => {
    console.error(`[${label}]`, error)
  }, [error, label])

  return (
    <div
      data-component="route-error-fallback"
      data-error-boundary={label}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px',
        textAlign: 'center',
      })}
    >
      <div className={css({ fontSize: '48px', marginBottom: '16px' })}>
        Something broke
      </div>

      <p
        className={css({
          fontSize: '16px',
          color: 'gray.600',
          marginBottom: '24px',
          maxWidth: '500px',
        })}
      >
        This section encountered an error. The rest of the app should still work.
      </p>

      <div
        className={css({
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        })}
      >
        <button
          onClick={reset}
          data-action="retry-section"
          className={css({
            padding: '10px 24px',
            backgroundColor: 'blue.600',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: { backgroundColor: 'blue.700' },
          })}
        >
          Try Again
        </button>

        <a
          href={backHref}
          data-action="error-go-back"
          className={css({
            padding: '10px 24px',
            backgroundColor: 'gray.200',
            color: 'gray.800',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'background-color 0.2s',
            _hover: { backgroundColor: 'gray.300' },
          })}
        >
          {backLabel}
        </a>
      </div>

      <details
        className={css({
          marginTop: '32px',
          maxWidth: '500px',
          width: '100%',
        })}
      >
        <summary
          className={css({
            cursor: 'pointer',
            fontSize: '12px',
            color: 'gray.500',
            _hover: { color: 'gray.700' },
          })}
        >
          Technical details
        </summary>

        <div
          className={css({
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'gray.100',
            borderRadius: '8px',
            textAlign: 'left',
          })}
        >
          <div
            className={css({
              fontSize: '13px',
              fontWeight: 'bold',
              marginBottom: '6px',
            })}
          >
            {error.message}
          </div>

          {error.digest && (
            <div
              className={css({
                fontSize: '11px',
                color: 'gray.500',
                marginBottom: '6px',
              })}
            >
              Digest: {error.digest}
            </div>
          )}

          {error.stack && (
            <pre
              className={css({
                fontSize: '11px',
                fontFamily: 'monospace',
                color: 'gray.600',
                overflow: 'auto',
                maxHeight: '180px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              })}
            >
              {error.stack}
            </pre>
          )}
        </div>
      </details>
    </div>
  )
}
