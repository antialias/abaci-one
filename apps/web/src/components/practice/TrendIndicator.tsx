'use client'

import { css } from '../../../styled-system/css'

export interface TrendIndicatorProps {
  /** Current accuracy (0-1) */
  current: number
  /** Previous accuracy (0-1), null if no previous session */
  previous: number | null
  /** Label text (default: "from last session") */
  label?: string
  /** Dark mode */
  isDark: boolean
}

/**
 * TrendIndicator - Shows comparison to previous session
 *
 * Displays:
 * - ↑ 5% (green) when improved
 * - ↓ 3% (red) when declined
 * - → Same (gray) when within 1%
 * - Nothing when previous is null
 */
export function TrendIndicator({
  current,
  previous,
  label = 'from last session',
  isDark,
}: TrendIndicatorProps) {
  if (previous === null) return null

  const delta = current - previous
  const deltaPercent = Math.abs(Math.round(delta * 100))

  // Within 1% is considered "same"
  const isImproved = delta > 0.01
  const isDeclined = delta < -0.01
  const isSame = !isImproved && !isDeclined

  if (isSame) {
    return (
      <div
        data-element="trend-indicator"
        data-trend="same"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.875rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        <span>→</span>
        <span>Same as last session</span>
      </div>
    )
  }

  return (
    <div
      data-element="trend-indicator"
      data-trend={isImproved ? 'improved' : 'declined'}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.875rem',
        color: isImproved ? (isDark ? 'green.400' : 'green.600') : isDark ? 'red.400' : 'red.600',
      })}
    >
      <span>{isImproved ? '↑' : '↓'}</span>
      <span>
        {deltaPercent}% {label}
      </span>
    </div>
  )
}

export default TrendIndicator
