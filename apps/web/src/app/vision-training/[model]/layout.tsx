'use client'

import type { ReactNode } from 'react'
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

  return (
    <PageWithNav navSlot={<VisionTrainingNavSlot />}>
      <div
        data-component="vision-training-layout"
        className={css({
          minHeight: '100vh',
          bg: 'gray.900',
          color: 'gray.100',
        })}
      >
        <main data-element="vision-content">{children}</main>
      </div>
    </PageWithNav>
  )
}
