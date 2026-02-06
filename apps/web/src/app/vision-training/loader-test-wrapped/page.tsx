'use client'

import { useCallback, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { loadOpenCV } from '@/lib/vision/opencv/loader'

/**
 * Test wrapping the imported loadOpenCV in useCallback.
 */
export default function LoaderTestWrappedPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState<number | null>(null)

  // Wrap the imported function in useCallback
  const wrappedLoadOpenCV = useCallback(async () => {
    return loadOpenCV()
  }, [])

  const handleTest = async () => {
    console.log('[LoaderTestWrapped] Button clicked')
    setStatus('loading')
    setError(null)
    const start = Date.now()

    try {
      console.log('[LoaderTestWrapped] Calling wrappedLoadOpenCV...')
      const cv = await wrappedLoadOpenCV()
      console.log('[LoaderTestWrapped] wrappedLoadOpenCV returned:', !!cv)
      setTime(Date.now() - start)
      setStatus(cv && typeof cv.imread === 'function' ? 'success' : 'error')
    } catch (err) {
      console.log('[LoaderTestWrapped] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div
      data-component="loader-test-wrapped-page"
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
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>Wrapped Import Test</h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        Imported loadOpenCV wrapped in useCallback.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'loading'}
        className={css({
          px: 6,
          py: 3,
          bg: 'teal.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'teal.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {status === 'loading' ? 'Loading...' : 'Test Wrapped Import'}
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
