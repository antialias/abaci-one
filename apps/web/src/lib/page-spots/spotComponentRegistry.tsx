'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'

export interface SpotComponentEntry {
  label: string
  description: string
  component: ComponentType
}

/**
 * Registry of React components available for page content spots.
 * Each entry uses next/dynamic for code splitting.
 */
export const SPOT_COMPONENTS: Record<string, SpotComponentEntry> = {
  'practice-showcase': {
    label: 'Practice Showcase',
    description: 'Row of practice problems in various states (correct, active, waiting)',
    component: dynamic(
      () => import('@/components/page-spots/PracticeShowcase').then((m) => m.PracticeShowcase),
      { ssr: false }
    ),
  },
  'start-practice-modal': {
    label: 'Start Practice Modal',
    description: 'Static showcase of the session configuration modal',
    component: dynamic(
      () =>
        import('@/components/page-spots/StartPracticeShowcase').then(
          (m) => m.StartPracticeShowcase
        ),
      { ssr: false }
    ),
  },
  'practice-showcase-compact': {
    label: 'Practice Showcase (Compact)',
    description: 'Compact row of 3 practice problems for tighter layouts',
    component: dynamic(
      () =>
        import('@/components/page-spots/PracticeShowcase').then((m) => m.PracticeShowcaseCompact),
      { ssr: false }
    ),
  },
  'ten-frames-demo': {
    label: 'Ten-Frames Demo',
    description: 'Interactive ten-frames addition demonstration',
    component: dynamic(() => import('@/components/blog/heroes/TenFramesHero'), { ssr: false }),
  },
  'multi-digit-demo': {
    label: 'Multi-Digit Demo',
    description: 'Multi-digit addition with place value scaffolding',
    component: dynamic(() => import('@/components/blog/heroes/MultiDigitHero'), { ssr: false }),
  },
  'start-practice-modal-expanded': {
    label: 'Start Practice Modal (Expanded)',
    description: 'Expanded view of the session configuration modal with all settings visible',
    component: dynamic(
      () =>
        import('@/components/page-spots/StartPracticeShowcase').then(
          (m) => m.StartPracticeShowcaseExpanded
        ),
      { ssr: false }
    ),
  },
}

// For server-safe component list (admin dropdowns), use spotComponentList.ts
