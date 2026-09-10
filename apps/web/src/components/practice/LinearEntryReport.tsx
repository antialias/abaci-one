'use client'

import type { LinearEntryAssessment } from '@/lib/curriculum/linear-entry-policy'
import { css } from '../../../styled-system/css'

export interface LinearEntryDimension {
  key: 'mastery' | 'volume' | 'accuracy' | 'speed'
  label: string
  met: boolean
  /** Short human phrase, e.g. "73% over last 15, need 85%". */
  detail: string
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

/**
 * Turn the entry policy's verdict into parent-readable dimensions. Speed only
 * appears when the policy actually checks it — a dimension that can't fail is
 * noise.
 */
export function describeLinearEntry(entry: LinearEntryAssessment): LinearEntryDimension[] {
  const dims: LinearEntryDimension[] = [
    {
      key: 'mastery',
      label: 'Mastery',
      met: entry.mastery.met,
      detail: entry.mastery.met ? 'mastered' : `${pct(entry.mastery.pKnown)} mastered`,
    },
    {
      key: 'volume',
      label: 'Practice',
      met: entry.volume.met,
      detail: entry.volume.met
        ? `${entry.volume.opportunities} tries`
        : `${entry.volume.opportunities} of ${entry.volume.minOpportunities} tries`,
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      met: entry.accuracy.met,
      detail:
        entry.accuracy.windowFilled < entry.accuracy.windowSize
          ? `${entry.accuracy.windowFilled} of ${entry.accuracy.windowSize} recent tries`
          : `${pct(entry.accuracy.recentAccuracy)} over last ${entry.accuracy.windowSize}, need ${pct(entry.accuracy.minAccuracy)}`,
    },
  ]
  if (entry.speed.rule !== 'off') {
    dims.push({
      key: 'speed',
      label: 'Speed',
      met: entry.speed.met,
      detail:
        entry.speed.secondsPerTerm == null
          ? 'not enough timed tries'
          : `${entry.speed.secondsPerTerm.toFixed(1)}s per step, need under ${entry.speed.maxSecondsPerTerm}s`,
    })
  }
  return dims
}

/** The one thing to say next to a skill name: "ready" or the first unmet dimension. */
export function summarizeLinearEntry(entry: LinearEntryAssessment): string {
  if (entry.ready) return 'ready'
  const blocker = describeLinearEntry(entry).find((d) => !d.met)
  return blocker ? `${blocker.label.toLowerCase()}: ${blocker.detail}` : 'ready'
}

export function LinearEntryReport({
  entry,
  variant = 'full',
}: {
  entry: LinearEntryAssessment
  variant?: 'full' | 'compact'
}) {
  if (variant === 'compact') {
    return (
      <span
        data-element="linear-entry-summary"
        data-ready={entry.ready}
        className={css({
          fontSize: '0.75rem',
          color: entry.ready ? 'green.600' : 'gray.500',
          _dark: { color: entry.ready ? 'green.300' : 'gray.400' },
        })}
      >
        {entry.ready ? '✓ ' : ''}
        {summarizeLinearEntry(entry)}
      </span>
    )
  }
  return (
    <ul
      data-element="linear-entry-report"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.125rem',
        fontSize: '0.75rem',
        color: 'gray.600',
        _dark: { color: 'gray.300' },
      })}
    >
      {describeLinearEntry(entry).map((d) => (
        <li key={d.key} data-dimension={d.key} data-met={d.met}>
          <span aria-hidden>{d.met ? '✓' : '○'} </span>
          <strong>{d.label}</strong> · {d.detail}
        </li>
      ))}
    </ul>
  )
}
