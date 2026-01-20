'use client'

import { type ReactNode, useEffect } from 'react'
import { notFound } from 'next/navigation'
import { css } from '../../../../styled-system/css'
import { PageWithNav } from '@/components/PageWithNav'
import { VisionTrainingNavSlot } from '../components/VisionTrainingNavSlot'
import { isValidModelType } from '../hooks/useModelType'

interface VisionTrainingLayoutProps {
  children: ReactNode
  params: { model: string }
}

/**
 * Vision Training Layout
 *
 * Layout wrapper for all vision training pages under /vision-training/[model]/.
 *
 * Provides:
 * - Minimal nav bar with hamburger menu via PageWithNav
 * - Contextual nav content (model selector + tabs) via VisionTrainingNavSlot
 * - Model param validation (redirects to 404 if invalid)
 *
 * Uses the same PageWithNav + navSlot pattern as arcade pages for consistent UX.
 */
export default function VisionTrainingLayout({ children, params }: VisionTrainingLayoutProps) {
  // Validate model param - show 404 for invalid models
  if (!isValidModelType(params.model)) {
    notFound()
  }

  // Prevent body scrolling on vision training pages
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  return (
    <PageWithNav navSlot={<VisionTrainingNavSlot />}>
      <div
        data-component="vision-training-layout"
        className={css({
          // Fixed nav is position:fixed, so we need padding-top to push content below it
          // Then fill remaining viewport height
          pt: 'var(--app-nav-height, 72px)',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bg: 'gray.900',
          color: 'gray.100',
          overflow: 'hidden',
        })}
      >
        <main
          data-element="vision-content"
          className={css({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          })}
        >
          {children}
        </main>
      </div>
    </PageWithNav>
  )
}
