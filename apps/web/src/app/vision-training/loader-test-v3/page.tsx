'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { loadOpenCVv3 } from '@/lib/vision/opencv/loaderV3'

export default function LoaderTestV3Page() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [time, setTime] = useState<number | null>(null)

  const handleTest = async () => {
    console.log('[LoaderTestV3] Button clicked')
    setStatus('loading')
    const start = Date.now()

    try {
      console.log('[LoaderTestV3] Calling loadOpenCVv3...')
      const cv = await loadOpenCVv3()
      console.log('[LoaderTestV3] loadOpenCVv3 returned:', !!cv)
      setTime(Date.now() - start)
      const hasImread = cv && typeof (cv as { imread?: unknown }).imread === 'function'
      setStatus(hasImread ? 'success' : 'error')
    } catch (err) {
      console.log('[LoaderTestV3] Error:', err)
      setStatus('error')
    }
  }

  return (
    <div
      data-component="loader-test-v3-page"
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
        Loader V3 Test (No State, No Types)
      </h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        Combined addScript + waitForReady, no module state.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'loading'}
        className={css({
          px: 6,
          py: 3,
          bg: 'amber.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'amber.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {status === 'loading' ? 'Loading...' : 'Test Loader V3'}
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
        {time !== null && <div>Loaded in {time}ms</div>}
      </div>
    </div>
  )
}
