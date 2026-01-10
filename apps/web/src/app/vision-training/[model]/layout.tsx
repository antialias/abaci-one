'use client'

import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { css } from '../../../../styled-system/css'
import { VisionTrainingNav } from '../components/VisionTrainingNav'
import { isValidModelType } from '../hooks/useModelType'

const NAV_HEIGHT = 56

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
 * - Fixed nav bar via VisionTrainingNav
 * - CSS custom property --nav-height for child pages to use
 * - Model param validation (redirects to 404 if invalid)
 *
 * The --nav-height variable allows child pages with absolute/fixed positioning
 * to correctly offset their content below the nav bar.
 */
export default function VisionTrainingLayout({ children, params }: VisionTrainingLayoutProps) {
  // Validate model param - show 404 for invalid models
  if (!isValidModelType(params.model)) {
    notFound()
  }

  return (
    <div
      data-component="vision-training-layout"
      style={{ '--nav-height': `${NAV_HEIGHT}px` } as React.CSSProperties}
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
      })}
    >
      {/* Fixed nav - always at top */}
      <VisionTrainingNav />

      {/* Content area - pushed below nav via padding */}
      <main
        data-element="vision-content"
        className={css({
          minHeight: '100vh',
        })}
        style={{ paddingTop: 'var(--nav-height)' }}
      >
        {children}
      </main>
    </div>
  )
}
