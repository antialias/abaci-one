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

const MODE_LABELS: Record<string, string> = {
  abacus: 'Abacus',
  visualization: 'Viz',
  linear: 'Linear',
}

const MODE_ORDER = ['abacus', 'visualization', 'linear'] as const

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

/**
 * Compute per-mode term count ranges for a given comfort adjustment.
 * Returns ranges for each enabled mode using its mode-specific comfort level.
 */
function computePerModeRanges(
  comfortByMode: Record<string, number>,
  overallComfort: number,
  enabledParts: Record<string, boolean>,
  adjustment: number
): Record<string, { min: number; max: number }> {
  const result: Record<string, { min: number; max: number }> = {}
  for (const mode of MODE_ORDER) {
    if (!enabledParts[mode]) continue
    const base = comfortByMode[mode] ?? overallComfort
    const adjusted = Math.max(0, Math.min(1, base + adjustment))
    result[mode] = computeTermCountRange(mode, adjusted)
  }
  return result
}

function formatRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}\u2013${max}`
}

/**
 * Format per-mode ranges into a compact display string.
 * If all enabled modes have the same range, returns a single range (e.g. "2\u20134").
 * Otherwise returns per-mode ranges (e.g. "🧮2\u20135 🧠2\u20133").
 */
function formatRangeText(perModeRanges: Record<string, { min: number; max: number }>): string {
  const entries = MODE_ORDER.filter((m) => perModeRanges[m] !== undefined).map((m) => ({
    mode: m,
    ...perModeRanges[m],
  }))

  if (entries.length === 0) return '2\u20134'

  // Check if all ranges are identical
  const allSame = entries.every((e) => e.min === entries[0].min && e.max === entries[0].max)

  if (allSame || entries.length === 1) {
    return formatRange(entries[0].min, entries[0].max)
  }

  // Show per-mode with emoji labels
  const modeEmojis: Record<string, string> = {
    abacus: '\u{1F9EE}',
    visualization: '\u{1F9E0}',
    linear: '\u{1F4AD}',
  }
  return entries.map((e) => `${modeEmojis[e.mode]}${formatRange(e.min, e.max)}`).join(' ')
}

function formatModeReadiness(
  comfortByMode: Record<string, number>,
  enabledParts: Record<string, boolean>
): string | null {
  const parts: string[] = []
  for (const mode of MODE_ORDER) {
    if (enabledParts[mode] && comfortByMode[mode] !== undefined) {
      parts.push(`${MODE_LABELS[mode]} ${Math.round(comfortByMode[mode] * 100)}%`)
    }
  }
  return parts.length > 1 ? parts.join(' \u00b7 ') : null
}

function MasteryScaleTooltipContent({
  comfortLevel,
  comfortByMode,
  sessionMode,
  enabledParts,
  ranges,
}: {
  comfortLevel: number
  comfortByMode: Record<string, number>
  sessionMode: SessionMode
  enabledParts: Record<string, boolean>
  ranges: Record<ProblemLengthPreference, Record<string, { min: number; max: number }>>
}) {
  const readinessPct = Math.round(comfortLevel * 100)
  const readinessLabel = getReadinessLabel(comfortLevel)
  const modeReadiness = formatModeReadiness(comfortByMode, enabledParts)

  // Marker positions on the 0-1 scale, clamped
  const shorterPct = Math.max(0, Math.min(1, comfortLevel + COMFORT_ADJUSTMENTS.shorter)) * 100
  const recommendedPct = comfortLevel * 100
  const longerPct = Math.max(0, Math.min(1, comfortLevel + COMFORT_ADJUSTMENTS.longer)) * 100

  // Format ranges for legend — show per-mode breakdown
  const enabledModes = MODE_ORDER.filter((m) => enabledParts[m])
  const hasMultipleModes = enabledModes.length > 1
  const hasPerModeData = Object.keys(comfortByMode).length > 0

  return (
    <div data-element="mastery-scale-tooltip" style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
        Problem Length &amp; Mastery
      </div>
      <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginBottom: '0.75rem' }}>
        {modeReadiness ?? `${readinessPct}% readiness`} &mdash; {readinessLabel}
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

      {/* Legend with per-mode ranges */}
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
        {(['shorter', 'recommended', 'longer'] as const).map((pref) => {
          const prefRanges = ranges[pref]
          const markerStyle =
            pref === 'shorter'
              ? { width: 6, height: 10, background: '#60a5fa' }
              : pref === 'recommended'
                ? {
                    width: 8,
                    height: 14,
                    background: 'white',
                    boxShadow: '0 0 4px rgba(255,255,255,0.5)',
                  }
                : { width: 6, height: 10, background: '#f472b6' }
          const label =
            pref === 'shorter' ? 'Shorter' : pref === 'recommended' ? 'Recommended' : 'Longer'

          return (
            <div key={pref}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      borderRadius: pref === 'recommended' ? 3 : 2,
                      flexShrink: 0,
                      ...markerStyle,
                    }}
                  />
                  {label}
                </span>
                <span style={{ color: '#9ca3af' }}>{formatRangeText(prefRanges)}</span>
              </div>
              {/* Show per-mode breakdown if modes have different ranges */}
              {hasMultipleModes &&
                hasPerModeData &&
                (() => {
                  const modeEntries = enabledModes
                    .map((m) => ({ mode: m, range: prefRanges[m] }))
                    .filter((e) => e.range)
                  const allSame = modeEntries.every(
                    (e) =>
                      e.range.min === modeEntries[0].range.min &&
                      e.range.max === modeEntries[0].range.max
                  )
                  if (allSame) return null
                  return (
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: '#6b7280',
                        marginLeft: 18,
                        marginTop: 1,
                      }}
                    >
                      {modeEntries
                        .map(
                          (e) => `${MODE_LABELS[e.mode]} ${formatRange(e.range.min, e.range.max)}`
                        )
                        .join(' \u00b7 ')}
                    </div>
                  )
                })()}
            </div>
          )
        })}
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

const MODE_EMOJIS: Record<string, string> = {
  abacus: '\u{1F9EE}',
  visualization: '\u{1F9E0}',
  linear: '\u{1F4AD}',
}

/**
 * Shows the per-mode term count range for the currently selected preference.
 * Single line when all modes share the same range. Per-mode breakdown otherwise.
 * When modes differ, readiness % is included per-mode to avoid repeating mode labels.
 */
function SelectedRangeDetail({
  perModeRanges,
  comfortByMode,
  overallComfort,
  isDark,
}: {
  perModeRanges: Record<string, { min: number; max: number }>
  comfortByMode: Record<string, number>
  overallComfort: number
  isDark: boolean
}) {
  const entries = MODE_ORDER.filter((m) => perModeRanges[m] !== undefined).map((m) => ({
    mode: m,
    ...perModeRanges[m],
  }))

  if (entries.length === 0) return null

  const allSame = entries.every((e) => e.min === entries[0].min && e.max === entries[0].max)

  return (
    <div
      data-element="selected-range-detail"
      className={css({
        fontSize: '0.625rem',
        color: isDark ? 'gray.500' : 'gray.500',
        marginTop: '0.375rem',
        textAlign: 'center',
        lineHeight: '1.4',
        '@media (max-width: 480px), (max-height: 700px)': {
          marginTop: '0.25rem',
          fontSize: '0.5625rem',
        },
      })}
    >
      {allSame || entries.length === 1 ? (
        <span>{formatRange(entries[0].min, entries[0].max)} terms per problem</span>
      ) : (
        <span>
          {entries.map((e, i) => {
            const pct = Math.round((comfortByMode[e.mode] ?? overallComfort) * 100)
            return (
              <span key={e.mode}>
                {i > 0 && ' \u00b7 '}
                {MODE_EMOJIS[e.mode]} {MODE_LABELS[e.mode]} {formatRange(e.min, e.max)} ({pct}%)
              </span>
            )
          })}
        </span>
      )}
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
    comfortByMode,
    sessionMode,
    enabledParts,
  } = useStartPracticeModal()

  // Compute per-mode term count ranges for each preference option
  const ranges = useMemo(() => {
    const result: Record<ProblemLengthPreference, Record<string, { min: number; max: number }>> = {
      shorter: {},
      recommended: {},
      longer: {},
    }
    for (const pref of ['shorter', 'recommended', 'longer'] as ProblemLengthPreference[]) {
      const adj = COMFORT_ADJUSTMENTS[pref]
      result[pref] = computePerModeRanges(comfortByMode, comfortLevel, enabledParts, adj)
    }
    return result
  }, [comfortLevel, comfortByMode, enabledParts])

  const subtitle = getModeSubtitle(sessionMode.type)
  const readinessPct = Math.round(comfortLevel * 100)
  const modeReadiness = formatModeReadiness(comfortByMode, enabledParts)

  // Check if the selected preference has differing ranges across modes —
  // if so, readiness is shown inline in the range detail row, not the subtitle
  const selectedRanges = ranges[problemLengthPreference]
  const selectedEntries = MODE_ORDER.filter((m) => selectedRanges[m] !== undefined)
  const rangesDiffer =
    selectedEntries.length > 1 &&
    !selectedEntries.every(
      (m) =>
        selectedRanges[m].min === selectedRanges[selectedEntries[0]].min &&
        selectedRanges[m].max === selectedRanges[selectedEntries[0]].max
    )

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
              {label}
            </button>
          )
        })}
      </div>
      {/* Per-mode range detail for selected preference */}
      <SelectedRangeDetail
        perModeRanges={selectedRanges}
        comfortByMode={comfortByMode}
        overallComfort={comfortLevel}
        isDark={isDark}
      />
      <Tooltip
        content={
          <MasteryScaleTooltipContent
            comfortLevel={comfortLevel}
            comfortByMode={comfortByMode}
            sessionMode={sessionMode}
            enabledParts={enabledParts}
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
          {rangesDiffer
            ? `${readinessPct}% readiness`
            : (modeReadiness ?? `${readinessPct}% readiness`)}{' '}
          &middot; {subtitle} &#9432;
        </div>
      </Tooltip>
    </div>
  )
}

/** @deprecated Use ProblemLengthSelector instead */
export const MaxTermsSelector = ProblemLengthSelector
