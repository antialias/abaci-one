'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { checkWindowCv } from '@/lib/vision/opencv/checkCv'

/**
 * Test checking window.cv from separate file - no loading.
 */
export default function LoaderTestCheckPage() {
  const [result, setResult] = useState<{ exists: boolean; hasImread: boolean } | null>(null)

  const handleTest = () => {
    console.log('[LoaderTestCheck] Button clicked')
    const res = checkWindowCv()
    console.log('[LoaderTestCheck] checkWindowCv returned:', res)
    setResult(res)
  }

  return (
    <div
      data-component="loader-test-check-page"
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
        Check window.cv (No Loading)
      </h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        Just checks if window.cv exists - no loading.
      </p>

      <button
        type="button"
        onClick={handleTest}
        className={css({
          px: 6,
          py: 3,
          bg: 'rose.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          _hover: { bg: 'rose.500' },
        })}
      >
        Check window.cv
      </button>

      {result && (
        <div className={css({ mt: 4, textAlign: 'center' })}>
          <div>cv exists: {result.exists ? 'yes' : 'no'}</div>
          <div>cv.imread exists: {result.hasImread ? 'yes' : 'no'}</div>
        </div>
      )}
    </div>
  )
}
