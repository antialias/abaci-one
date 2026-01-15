'use client'

import { useEffect } from 'react'
import { css } from '../../styled-system/css'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Root Error Boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          data-component="root-error-page"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '32px',
            textAlign: 'center',
            backgroundColor: 'gray.50',
          })}
        >
          {/* Error icon */}
          <div
            className={css({
              fontSize: '64px',
              marginBottom: '24px',
            })}
          >
            ⚠️
          </div>

          {/* Error title */}
          <h1
            className={css({
              fontSize: '32px',
              fontWeight: 'bold',
              marginBottom: '16px',
            })}
          >
            Something Went Wrong
          </h1>

          {/* Error message */}
          <p
            className={css({
              fontSize: '18px',
              color: 'gray.600',
              marginBottom: '32px',
              maxWidth: '600px',
            })}
          >
            The application encountered an unexpected error. You can try reloading the page, or
            return to the home page.
          </p>

          {/* Action buttons */}
          <div
            className={css({
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            })}
          >
            <button
              onClick={reset}
              data-action="retry-page"
              className={css({
                padding: '12px 32px',
                backgroundColor: 'blue.600',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                _hover: {
                  backgroundColor: 'blue.700',
                },
              })}
            >
              Try Again
            </button>

            <a
              href="/"
              data-action="return-home"
              className={css({
                padding: '12px 32px',
                backgroundColor: 'gray.200',
                color: 'gray.800',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background-color 0.2s',
                _hover: {
                  backgroundColor: 'gray.300',
                },
              })}
            >
              Return Home
            </a>
          </div>

          {/* Navigation links */}
          <nav
            className={css({
              marginTop: '48px',
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            })}
          >
            <a
              href="/"
              className={css({
                color: 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Home
            </a>
            <a
              href="/arcade-rooms"
              className={css({
                color: 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Arcade
            </a>
            <a
              href="/calendar"
              className={css({
                color: 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Calendar
            </a>
          </nav>

          {/* Technical details (collapsed by default) */}
          <details
            className={css({
              marginTop: '48px',
              maxWidth: '600px',
              width: '100%',
            })}
          >
            <summary
              className={css({
                cursor: 'pointer',
                fontSize: '14px',
                color: 'gray.600',
                _hover: {
                  color: 'gray.800',
                },
              })}
            >
              Show technical details
            </summary>

            <div
              className={css({
                marginTop: '16px',
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                textAlign: 'left',
                border: '1px solid',
                borderColor: 'gray.200',
              })}
            >
              <div
                className={css({
                  fontSize: '14px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                })}
              >
                Error: {error.message}
              </div>

              {error.digest && (
                <div
                  className={css({
                    fontSize: '12px',
                    color: 'gray.600',
                    marginBottom: '8px',
                  })}
                >
                  Digest: {error.digest}
                </div>
              )}

              {error.stack && (
                <pre
                  className={css({
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: 'gray.700',
                    overflow: 'auto',
                    maxHeight: '200px',
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
      </body>
    </html>
  )
}
