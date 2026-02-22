'use client'

/**
 * Global Error Boundary
 *
 * Catches errors that happen in the ROOT LAYOUT — e.g. when database queries
 * for feature flags or billing tier fail during server-side rendering.
 *
 * Unlike error.tsx (which renders inside the layout), this replaces the
 * entire <html> tree. It CANNOT use Panda CSS or any providers because
 * the layout that loads those is the thing that crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Detect connection-related errors for a friendlier message
  const msg = error.message || ''
  const isConnectionError =
    msg.includes('max connections') ||
    msg.includes('Too Many Requests') ||
    msg.includes('SQLITE_BUSY') ||
    msg.includes('Service Unavailable') ||
    msg.includes('503') ||
    msg.includes('429')

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Abaci One — Something went wrong</title>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#0d1117',
          color: '#c9d1d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '32px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '520px' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>
            {isConnectionError ? '\u{1F50C}' : '\u26A0\uFE0F'}
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '12px',
              color: '#e6edf3',
            }}
          >
            {isConnectionError ? 'Temporarily Unavailable' : 'Something Went Wrong'}
          </h1>

          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: '#8b949e',
              marginBottom: '32px',
            }}
          >
            {isConnectionError
              ? 'The server is experiencing high demand. This usually resolves in a few seconds.'
              : 'The application encountered an unexpected error. You can try reloading the page.'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{
                padding: '12px 28px',
                backgroundColor: '#238636',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>

            <a
              href="/"
              style={{
                padding: '12px 28px',
                backgroundColor: '#21262d',
                color: '#c9d1d9',
                border: '1px solid #30363d',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Return Home
            </a>
          </div>

          <details
            style={{
              marginTop: '40px',
              textAlign: 'left',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '13px',
                color: '#8b949e',
              }}
            >
              Technical details
            </summary>
            <pre
              style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#161b22',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#8b949e',
                overflow: 'auto',
                maxHeight: '160px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid #21262d',
              }}
            >
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
          </details>
        </div>
      </body>
    </html>
  )
}
