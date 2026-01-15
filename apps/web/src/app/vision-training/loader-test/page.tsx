'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { loadOpenCV } from '@/lib/vision/opencv'

/**
 * Minimal test page that ONLY uses the standalone loader.
 * No useDocumentDetection - to isolate the issue.
 */
export default function LoaderTestPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState<number | null>(null)

  const handleTest = async () => {
    console.log('[LoaderTest] Button clicked')
    setStatus('loading')
    setError(null)
    const start = Date.now()

    try {
      console.log('[LoaderTest] Calling loadOpenCV...')
      const cv = await loadOpenCV()
      console.log('[LoaderTest] loadOpenCV returned:', !!cv)
      setTime(Date.now() - start)
      setStatus(cv?.imread ? 'success' : 'error')
    } catch (err) {
      console.log('[LoaderTest] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div
      data-component="loader-test-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        p: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      })}
    >
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>Minimal OpenCV Loader Test</h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        This page ONLY imports the standalone loader. No useDocumentDetection.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'loading'}
        className={css({
          px: 6,
          py: 3,
          bg: 'blue.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'blue.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {status === 'loading' ? 'Loading...' : 'Test Standalone Loader'}
      </button>

      <div className={css({ mt: 4, textAlign: 'center' })}>
        <div className={css({ fontSize: 'lg' })}>
          Status:{' '}
          <span
            className={css({
              color:
                status === 'success' ? 'green.400' : status === 'error' ? 'red.400' : 'gray.400',
            })}
          >
            {status}
          </span>
        </div>
        {time !== null && <div>Loaded in {time}ms</div>}
        {error && <div className={css({ color: 'red.400' })}>{error}</div>}
      </div>
    </div>
  )
}
