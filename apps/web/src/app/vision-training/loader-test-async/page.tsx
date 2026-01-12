'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { simpleDelay } from '@/lib/vision/opencv/simpleAsync'

/**
 * Test simple async function from separate file.
 * No OpenCV - just a delay.
 */
export default function LoaderTestAsyncPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [time, setTime] = useState<number | null>(null)

  const handleTest = async () => {
    console.log('[LoaderTestAsync] Button clicked')
    setStatus('loading')
    const start = Date.now()

    try {
      console.log('[LoaderTestAsync] Calling simpleDelay...')
      const result = await simpleDelay(500)
      console.log('[LoaderTestAsync] simpleDelay returned:', result)
      setTime(Date.now() - start)
      setStatus('success')
    } catch (err) {
      console.log('[LoaderTestAsync] Error:', err)
      setStatus('error')
    }
  }

  return (
    <div
      data-component="loader-test-async-page"
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
        Simple Async Test (No OpenCV)
      </h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        Tests if async functions from separate files work at all.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === 'loading'}
        className={css({
          px: 6,
          py: 3,
          bg: 'indigo.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'indigo.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {status === 'loading' ? 'Loading...' : 'Test Simple Async'}
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
        {time !== null && <div>Completed in {time}ms</div>}
      </div>
    </div>
  )
}
