'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { addOpenCVScript } from '@/lib/vision/opencv/addScript'
import { checkWindowCv } from '@/lib/vision/opencv/checkCv'

/**
 * Test just adding script tag - no waiting.
 */
export default function LoaderTestScriptPage() {
  const [added, setAdded] = useState(false)
  const [cvStatus, setCvStatus] = useState<{ exists: boolean; hasImread: boolean } | null>(null)

  const handleAddScript = () => {
    console.log('[LoaderTestScript] Add Script clicked')
    const result = addOpenCVScript()
    console.log('[LoaderTestScript] addOpenCVScript returned:', result)
    setAdded(result)
  }

  const handleCheckCv = () => {
    console.log('[LoaderTestScript] Check CV clicked')
    const result = checkWindowCv()
    console.log('[LoaderTestScript] checkWindowCv returned:', result)
    setCvStatus(result)
  }

  return (
    <div
      data-component="loader-test-script-page"
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
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>Script Tag Test (No Waiting)</h1>
      <p className={css({ color: 'gray.400', mb: 4 })}>
        Step 1: Add script tag. Step 2: Check if cv loaded.
      </p>

      <div className={css({ display: 'flex', gap: 4 })}>
        <button
          type="button"
          onClick={handleAddScript}
          className={css({
            px: 6,
            py: 3,
            bg: 'emerald.600',
            color: 'white',
            borderRadius: 'lg',
            fontSize: 'lg',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            _hover: { bg: 'emerald.500' },
          })}
        >
          1. Add Script Tag
        </button>

        <button
          type="button"
          onClick={handleCheckCv}
          className={css({
            px: 6,
            py: 3,
            bg: 'sky.600',
            color: 'white',
            borderRadius: 'lg',
            fontSize: 'lg',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            _hover: { bg: 'sky.500' },
          })}
        >
          2. Check window.cv
        </button>
      </div>

      <div className={css({ mt: 4, textAlign: 'center' })}>
        <div>Script added: {added ? 'yes' : 'no'}</div>
        {cvStatus && (
          <>
            <div>cv exists: {cvStatus.exists ? 'yes' : 'no'}</div>
            <div>cv.imread exists: {cvStatus.hasImread ? 'yes' : 'no'}</div>
          </>
        )}
      </div>
    </div>
  )
}
