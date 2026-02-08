'use client'

import { useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { computeTermCountRange } from '@/lib/curriculum/config/term-count-scaling'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { Tooltip } from '@/components/ui/Tooltip'
import { css } from '../../../../styled-system/css'
import {
  useStartPracticeModal,
  COMFORT_ADJUSTMENTS,
  type ProblemLengthPreference,
} from '../StartPracticeModalContext'

const OPTIONS: { pref: ProblemLengthPreference; label: string }[] = [
  { pref: 'shorter', label: 'Shorter' },
  { pref: 'recommended', label: 'Recommended' },
  { pref: 'longer', label: 'Longer' },
]

function getModeSubtitle(sessionModeType: string): string {
  switch (sessionModeType) {
    case 'remediation':
      return 'Building foundations'
    case 'progression':
      return 'Learning new skills'
    case 'maintenance':
      return 'Reinforcing mastery'
    default:
      return 'Adapts to mastery'
  }
}

function getReadinessLabel(comfort: number): string {
  const pct = comfort * 100
  if (pct < 15) return 'Just starting'
  if (pct < 35) return 'Developing'
  if (pct < 55) return 'Building confidence'
  if (pct < 75) return 'Getting comfortable'
  return 'Highly fluent'
}

function getModeContextSentence(sessionMode: SessionMode): string {
  switch (sessionMode.type) {
    case 'remediation':
      return 'Remediation mode \u2014 shorter problems help focus on fundamentals. As skills strengthen, problems will naturally get longer.'
    case 'progression':
      return `Learning ${sessionMode.nextSkill.displayName}. Readiness is adjusted while building new skills.`
    case 'maintenance':
      return `Reinforcing ${sessionMode.skillCount} skills. Readiness fully reflects mastery.`
  }
}

function MasteryScaleTooltipContent({
  comfortLevel,
  sessionMode,
  ranges,
}: {
  comfortLevel: number
  sessionMode: SessionMode
  ranges: Record<ProblemLengthPreference, { min: number; max: number }>
}) {
  const readinessPct = Math.round(comfortLevel * 100)
  const readinessLabel = getReadinessLabel(comfortLevel)

  // Marker positions on the 0-1 scale, clamped
  const shorterPct = Math.max(0, Math.min(1, comfortLevel + COMFORT_ADJUSTMENTS.shorter)) * 100
  const recommendedPct = comfortLevel * 100
  const longerPct = Math.max(0, Math.min(1, comfortLevel + COMFORT_ADJUSTMENTS.longer)) * 100

  return (
    <div data-element="mastery-scale-tooltip" style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
        Problem Length &amp; Mastery
      </div>
      <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginBottom: '0.75rem' }}>
        {readinessPct}% readiness &mdash; {readinessLabel}
      </div>

      {/* Visual mastery bar */}
      <div style={{ marginBottom: '0.25rem' }}>
        <div
          data-element="mastery-bar"
          style={{
            position: 'relative',
            height: 8,
            borderRadius: 4,
            background: 'linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899)',
          }}
        >
          {/* Shorter marker */}
          <div
            style={{
              position: 'absolute',
              left: `${shorterPct}%`,
              top: -2,
              transform: 'translateX(-50%)',
            }}
          >
            <div
              style={{
                width: 6,
                height: 12,
                borderRadius: 2,
                background: '#60a5fa',
              }}
            />
          </div>

          {/* Recommended marker (current) */}
          <div
            style={{
              position: 'absolute',
              left: `${recommendedPct}%`,
              top: -4,
              transform: 'translateX(-50%)',
            }}
          >
            <div
              style={{
                width: 8,
                height: 16,
                borderRadius: 3,
                background: 'white',
                boxShadow: '0 0 4px rgba(255,255,255,0.5)',
              }}
            />
          </div>

          {/* Longer marker */}
          <div
            style={{
              position: 'absolute',
              left: `${longerPct}%`,
              top: -2,
              transform: 'translateX(-50%)',
            }}
          >
            <div
              style={{
                width: 6,
                height: 12,
                borderRadius: 2,
                background: '#f472b6',
              }}
            />
          </div>
        </div>

        {/* Scale labels */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.6875rem',
            color: '#9ca3af',
            marginTop: '0.25rem',
          }}
        >
          <span>2 terms</span>
          <span>8 terms</span>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.1875rem',
          fontSize: '0.75rem',
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 6, height: 10, borderRadius: 2, background: '#60a5fa', flexShrink: 0 }} />
            Shorter
          </span>
          <span style={{ color: '#9ca3af' }}>
            {ranges.shorter.min}&ndash;{ranges.shorter.max} terms
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 14, borderRadius: 3, background: 'white', boxShadow: '0 0 4px rgba(255,255,255,0.5)', flexShrink: 0 }} />
            Recommended
          </span>
          <span style={{ color: '#9ca3af' }}>
            {ranges.recommended.min}&ndash;{ranges.recommended.max} terms
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 6, height: 10, borderRadius: 2, background: '#f472b6', flexShrink: 0 }} />
            Longer
          </span>
          <span style={{ color: '#9ca3af' }}>
            {ranges.longer.min}&ndash;{ranges.longer.max} terms
          </span>
        </div>
      </div>

      {/* Mode context */}
      <div
        style={{
          fontSize: '0.6875rem',
          color: '#9ca3af',
          lineHeight: 1.4,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '0.5rem',
        }}
      >
        {getModeContextSentence(sessionMode)}
      </div>
    </div>
  )
}

export function ProblemLengthSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const {
    problemLengthPreference,
    setProblemLengthPreference,
    comfortLevel,
    sessionMode,
  } = useStartPracticeModal()

  // Compute term count ranges for each preference option
  const ranges = useMemo(() => {
    const result: Record<ProblemLengthPreference, { min: number; max: number }> = {
      shorter: { min: 0, max: 0 },
      recommended: { min: 0, max: 0 },
      longer: { min: 0, max: 0 },
    }
    for (const pref of ['shorter', 'recommended', 'longer'] as ProblemLengthPreference[]) {
      const adj = COMFORT_ADJUSTMENTS[pref]
      const adjustedComfort = Math.max(0, Math.min(1, comfortLevel + adj))
      result[pref] = computeTermCountRange('abacus', adjustedComfort)
    }
    return result
  }, [comfortLevel])

  const subtitle = getModeSubtitle(sessionMode.type)
  const readinessPct = Math.round(comfortLevel * 100)

  return (
    <div data-setting="problem-length">
      <div
        data-element="problem-length-label"
        className={css({
          fontSize: '0.6875rem',
          fontWeight: '600',
          color: isDark ? 'gray.500' : 'gray.400',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            marginBottom: '0.25rem',
            fontSize: '0.625rem',
          },
        })}
      >
        Problem length
      </div>
      <div
        data-element="problem-length-options"
        className={css({
          display: 'flex',
          gap: '0.25rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            gap: '0.125rem',
          },
        })}
      >
        {OPTIONS.map(({ pref, label }) => {
          const isSelected = problemLengthPreference === pref
          const range = ranges[pref]
          const rangeText = `${range.min}\u2013${range.max}`

          return (
            <button
              key={pref}
              type="button"
              data-option={`length-${pref}`}
              data-selected={isSelected}
              onClick={() => setProblemLengthPreference(pref)}
              className={css({
                flex: 1,
                padding: '0.5rem 0.25rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.125rem',
                lineHeight: '1.2',
                '@media (max-width: 480px), (max-height: 700px)': {
                  padding: '0.3125rem 0.125rem',
                  fontSize: '0.6875rem',
                  borderRadius: '4px',
                },
              })}
              style={{
                backgroundColor: isSelected
                  ? isDark
                    ? '#8b5cf6'
                    : '#7c3aed'
                  : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                color: isSelected ? 'white' : isDark ? '#9ca3af' : '#6b7280',
              }}
            >
              <span>{label}</span>
              <span
                className={css({
                  fontSize: '0.625rem',
                  fontWeight: '400',
                  opacity: isSelected ? 0.85 : 0.7,
                })}
              >
                {rangeText}
              </span>
            </button>
          )
        })}
      </div>
      <Tooltip
        content={
          <MasteryScaleTooltipContent
            comfortLevel={comfortLevel}
            sessionMode={sessionMode}
            ranges={ranges}
          />
        }
        side="bottom"
        delayDuration={150}
      >
        <div
          data-element="problem-length-subtitle"
          className={css({
            fontSize: '0.5625rem',
            color: isDark ? 'gray.600' : 'gray.400',
            marginTop: '0.375rem',
            textAlign: 'center',
            cursor: 'help',
            '@media (max-width: 480px), (max-height: 700px)': {
              marginTop: '0.25rem',
              fontSize: '0.5rem',
            },
          })}
        >
          {readinessPct}% readiness &middot; {subtitle} &#9432;
        </div>
      </Tooltip>
    </div>
  )
}

/** @deprecated Use ProblemLengthSelector instead */
export const MaxTermsSelector = ProblemLengthSelector
