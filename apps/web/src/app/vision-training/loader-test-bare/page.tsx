'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { loadOpenCVBare } from '@/lib/vision/opencv/loaderBare'

/**
 * Test bare loader with NO imports at all.
 */
export default function LoaderTestBarePage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState<number | null>(null)

  const handleTest = async () => {
    console.log('[LoaderTestBare] Button clicked')
    setStatus('loading')
    setError(null)
    const start = Date.now()

    try {
      console.log('[LoaderTestBare] Calling loadOpenCVBare...')
      const cv = await loadOpenCVBare()
      console.log('[LoaderTestBare] loadOpenCVBare returned:', !!cv)
      setTime(Date.now() - start)
      const hasImread = cv && typeof (cv as { imread?: unknown }).imread === 'function'
      setStatus(hasImread ? 'success' : 'error')
    } catch (err) {
      console.log('[LoaderTestBare] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div
      data-component="loader-test-bare-page"
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
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
        Bare Loader Test (No Imports)
      </h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        Completely self-contained loader with zero imports.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'loading'}
        className={css({
          px: 6,
          py: 3,
          bg: 'cyan.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'cyan.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {status === 'loading' ? 'Loading...' : 'Test Bare Loader'}
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
