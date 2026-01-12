'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { useDocumentDetection } from '@/components/practice/useDocumentDetection'

/**
 * Minimal test page that uses useDocumentDetection to load OpenCV.
 * This mirrors how the working camera feed loads OpenCV.
 */
export default function LoaderTestHookPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState<number | null>(null)

  const { ensureOpenCVLoaded, isReady } = useDocumentDetection()

  const handleTest = async () => {
    console.log('[LoaderTestHook] Button clicked')
    setStatus('loading')
    setError(null)
    const start = Date.now()

    try {
      console.log('[LoaderTestHook] Calling ensureOpenCVLoaded...')
      const loaded = await ensureOpenCVLoaded()
      console.log('[LoaderTestHook] ensureOpenCVLoaded returned:', loaded)
      setTime(Date.now() - start)
      setStatus(loaded ? 'success' : 'error')
    } catch (err) {
      console.log('[LoaderTestHook] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div
      data-component="loader-test-hook-page"
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
        useDocumentDetection Loader Test
      </h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        This page uses useDocumentDetection.ensureOpenCVLoaded() - the working approach.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'loading'}
        className={css({
          px: 6,
          py: 3,
          bg: 'green.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'green.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {status === 'loading' ? 'Loading...' : 'Test useDocumentDetection Loader'}
      </button>

      <div className={css({ mt: 4, textAlign: 'center' })}>
        <div className={css({ fontSize: 'lg' })}>
          Status:{' '}
          <span
            className={css({
              color: status === 'success' ? 'green.400' : status === 'error' ? 'red.400' : 'gray.400',
            })}
          >
            {status}
          </span>
        </div>
        <div>isReady from hook: {isReady ? 'true' : 'false'}</div>
        {time !== null && <div>Loaded in {time}ms</div>}
        {error && <div className={css({ color: 'red.400' })}>{error}</div>}
      </div>
    </div>
  )
}
