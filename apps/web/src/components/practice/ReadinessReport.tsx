'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'
import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'
import { css } from '../../../styled-system/css'

// =============================================================================
// Types
// =============================================================================

interface ReadinessReportProps {
  /** Readiness results keyed by skill ID */
  readiness: Record<string, SkillReadinessResult>
  /** Which variant to render */
  variant?: 'full' | 'compact'
}

interface DimensionLineProps {
  icon: string
  label: string
  met: boolean
  isDark: boolean
}

// =============================================================================
// Helpers
// =============================================================================

function formatSecondsPerTerm(value: number | null): string {
  if (value === null) return 'No data yet'
  return `${value.toFixed(1)}s per step`
}

function formatAccuracy(value: number): string {
  return `${Math.round(value * 100)}%`
}

function encouragement(met: boolean, dimension: string): string {
  if (met) return ''
  switch (dimension) {
    case 'speed':
      return 'getting faster!'
    case 'consistency':
      return 'keep practicing!'
    case 'volume':
      return 'almost there!'
    case 'mastery':
      return 'building understanding!'
    default:
      return ''
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function DimensionLine({ icon, label, met, isDark }: DimensionLineProps) {
  return (
    <div
      data-element="dimension-line"
      data-met={met}
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        fontSize: '0.8125rem',
        lineHeight: '1.4',
      })}
      style={{
        color: met
          ? isDark
            ? '#86efac'
            : '#166534'
          : isDark
            ? '#d4d4d8'
            : '#525252',
      }}
    >
      <span className={css({ flexShrink: 0, lineHeight: 1, marginTop: '0.125rem' })}>
        {icon}
      </span>
      <span>{label}</span>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ReadinessReport — renders an evidence report showing per-dimension readiness.
 *
 * Full variant: one line per dimension with status icon, description, values.
 * Compact variant: summary badge only (e.g., "3/4 solid").
 */
export function ReadinessReport({ readiness, variant = 'full' }: ReadinessReportProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const results = Object.values(readiness)
  if (results.length === 0) return null

  // Aggregate across all skills — show the "hardest" dimension
  // For the report, pick the skill that is least ready (most unmet dimensions)
  const aggregated = aggregateDimensions(results)

  if (variant === 'compact') {
    const solidCount = aggregated.filter((d) => d.met).length
    const total = aggregated.length

    return (
      <span
        data-element="readiness-badge"
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.75rem',
          fontWeight: '600',
          padding: '0.125rem 0.5rem',
          borderRadius: '999px',
        })}
        style={{
          backgroundColor: solidCount === total
            ? isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'
            : isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.1)',
          color: solidCount === total
            ? isDark ? '#86efac' : '#166534'
            : isDark ? '#fcd34d' : '#92400e',
        }}
      >
        {solidCount === total ? 'Solid' : `${solidCount}/${total} solid`}
      </span>
    )
  }

  // Full variant — show each dimension line
  return (
    <div
      data-component="readiness-report"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
      })}
    >
      {aggregated.map((dim) => (
        <DimensionLine
          key={dim.key}
          icon={dim.met ? '\u2705' : dim.inProgress ? '\u23F3' : '\u274C'}
          label={dim.label}
          met={dim.met}
          isDark={isDark}
        />
      ))}
    </div>
  )
}

// =============================================================================
// Aggregation
// =============================================================================

interface AggregatedDimension {
  key: string
  met: boolean
  inProgress: boolean
  label: string
}

/**
 * Aggregate readiness across all skills into per-dimension summaries.
 * For each dimension, we report the "worst" skill's values.
 */
function aggregateDimensions(results: SkillReadinessResult[]): AggregatedDimension[] {
  // Find worst values across all skills for each dimension
  let worstVolume = results[0]
  let worstSpeed = results[0]
  let worstConsistency = results[0]
  let worstMastery = results[0]

  for (const r of results) {
    if (r.dimensions.volume.opportunities < worstVolume.dimensions.volume.opportunities) {
      worstVolume = r
    }
    if (
      r.dimensions.speed.medianSecondsPerTerm === null ||
      (worstSpeed.dimensions.speed.medianSecondsPerTerm !== null &&
        r.dimensions.speed.medianSecondsPerTerm > worstSpeed.dimensions.speed.medianSecondsPerTerm)
    ) {
      worstSpeed = r
    }
    if (r.dimensions.consistency.recentAccuracy < worstConsistency.dimensions.consistency.recentAccuracy) {
      worstConsistency = r
    }
    if (r.dimensions.mastery.pKnown < worstMastery.dimensions.mastery.pKnown) {
      worstMastery = r
    }
  }

  const vol = worstVolume.dimensions.volume
  const spd = worstSpeed.dimensions.speed
  const con = worstConsistency.dimensions.consistency
  const mas = worstMastery.dimensions.mastery

  const dims: AggregatedDimension[] = [
    {
      key: 'volume',
      met: vol.met,
      inProgress: vol.opportunities > 0,
      label: vol.met
        ? `${vol.opportunities} problems practiced (need ${READINESS_THRESHOLDS.minOpportunities})`
        : `${vol.opportunities}/${READINESS_THRESHOLDS.minOpportunities} problems practiced — ${encouragement(false, 'volume')}`,
    },
    {
      key: 'speed',
      met: spd.met,
      inProgress: spd.medianSecondsPerTerm !== null,
      label: spd.met
        ? `Answering in ${formatSecondsPerTerm(spd.medianSecondsPerTerm)} (need under ${READINESS_THRESHOLDS.maxMedianSecondsPerTerm}s)`
        : spd.medianSecondsPerTerm !== null
          ? `Answering in ${formatSecondsPerTerm(spd.medianSecondsPerTerm)} (need under ${READINESS_THRESHOLDS.maxMedianSecondsPerTerm}s) — ${encouragement(false, 'speed')}`
          : `No speed data yet — ${encouragement(false, 'speed')}`,
    },
    {
      key: 'consistency',
      met: con.met,
      inProgress: true,
      label: con.met
        ? `${formatAccuracy(con.recentAccuracy)} accuracy over last ${READINESS_THRESHOLDS.accuracyWindowSize} problems`
        : `${formatAccuracy(con.recentAccuracy)} accuracy over last ${READINESS_THRESHOLDS.accuracyWindowSize} problems — ${encouragement(false, 'consistency')}`,
    },
    {
      key: 'mastery',
      met: mas.met,
      inProgress: mas.pKnown > 0,
      label: mas.met
        ? `Mastery at ${Math.round(mas.pKnown * 100)}% (need ${Math.round(READINESS_THRESHOLDS.pKnownThreshold * 100)}%)`
        : `Mastery at ${Math.round(mas.pKnown * 100)}% (need ${Math.round(READINESS_THRESHOLDS.pKnownThreshold * 100)}%) — ${encouragement(false, 'mastery')}`,
    },
  ]

  return dims
}

export default ReadinessReport
