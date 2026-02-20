'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'

export interface InlineComponentEntry {
  label: string
  description: string
  component: ComponentType
}

/**
 * Registry of React components that can be used as inline blog embeds.
 * Each entry uses next/dynamic for code splitting so components are only
 * loaded when actually rendered.
 */
export const INLINE_COMPONENTS: Record<string, InlineComponentEntry> = {
  'evidence-quality-charts': {
    label: 'Evidence Quality Charts',
    description: 'Charts showing evidence weighting by help level and response time',
    component: dynamic(
      () => import('@/components/blog/ValidationCharts').then((mod) => mod.EvidenceQualityCharts),
      { ssr: false }
    ),
  },
  'automaticity-multipliers': {
    label: 'Automaticity Multiplier Charts',
    description: 'Charts showing automaticity multiplier curves from P(known) to cost scaling',
    component: dynamic(
      () =>
        import('@/components/blog/ValidationCharts').then(
          (mod) => mod.AutomaticityMultiplierCharts
        ),
      { ssr: false }
    ),
  },
  'classification-charts': {
    label: 'Classification Charts',
    description: 'Charts showing BKT skill classification thresholds and confidence intervals',
    component: dynamic(
      () => import('@/components/blog/ValidationCharts').then((mod) => mod.ClassificationCharts),
      { ssr: false }
    ),
  },
  'skill-difficulty-charts': {
    label: 'Skill Difficulty Charts',
    description: 'Charts showing skill-specific difficulty multipliers and learning trajectories',
    component: dynamic(
      () =>
        import('@/components/blog/SkillDifficultyCharts').then((mod) => mod.SkillDifficultyCharts),
      { ssr: false }
    ),
  },
  'three-way-comparison': {
    label: 'Three-Way Comparison Charts',
    description: 'Charts comparing BKT vs fluency multipliers vs baseline targeting modes',
    component: dynamic(
      () =>
        import('@/components/blog/ValidationCharts').then((mod) => mod.ThreeWayComparisonCharts),
      { ssr: false }
    ),
  },
  'validation-results': {
    label: 'Validation Results Charts',
    description: 'Charts showing convergence speed results across journey simulator modes',
    component: dynamic(
      () => import('@/components/blog/ValidationCharts').then((mod) => mod.ValidationResultsCharts),
      { ssr: false }
    ),
  },
  'blame-attribution': {
    label: 'Blame Attribution Charts',
    description: 'Charts showing blame distribution across skills for incorrect answers',
    component: dynamic(
      () => import('@/components/blog/ValidationCharts').then((mod) => mod.BlameAttributionCharts),
      { ssr: false }
    ),
  },
}

/** Get list of available inline components for admin UI dropdowns */
export function getInlineComponentList(): Array<{
  id: string
  label: string
  description: string
}> {
  return Object.entries(INLINE_COMPONENTS).map(([id, entry]) => ({
    id,
    label: entry.label,
    description: entry.description,
  }))
}
