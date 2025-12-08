'use client'

/**
 * HelpCountdown - Pie chart style countdown timer for help escalation
 *
 * Shows a circular countdown that depletes as time passes, with seconds
 * remaining displayed in the center. Positioned in place of the "=" sign
 * in the VerticalProblem component.
 */

import { css } from '../../../styled-system/css'

export interface HelpCountdownProps {
  /** Time elapsed since problem started (ms) */
  elapsedTimeMs: number
  /** Target time for next help level (ms) */
  targetTimeMs: number
  /** Size of the countdown circle (matches cell size) */
  size?: string
  /** Whether dark mode is active */
  isDark?: boolean
}

/**
 * Get color based on percentage remaining
 * Green (>66%) → Yellow (33-66%) → Orange (15-33%) → Red (<15%)
 */
function getColor(percentRemaining: number, isDark: boolean): string {
  if (percentRemaining > 66) {
    return isDark ? '#22c55e' : '#16a34a' // green
  } else if (percentRemaining > 33) {
    return isDark ? '#eab308' : '#ca8a04' // yellow
  } else if (percentRemaining > 15) {
    return isDark ? '#f97316' : '#ea580c' // orange
  } else {
    return isDark ? '#ef4444' : '#dc2626' // red
  }
}

/**
 * HelpCountdown - Pie chart countdown timer
 *
 * Renders a circular progress indicator that depletes clockwise,
 * with the seconds remaining shown in the center.
 */
export function HelpCountdown({
  elapsedTimeMs,
  targetTimeMs,
  size = '2.4rem',
  isDark = false,
}: HelpCountdownProps) {
  const remainingMs = Math.max(0, targetTimeMs - elapsedTimeMs)
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const percentRemaining = (remainingMs / targetTimeMs) * 100

  // SVG parameters
  const viewBoxSize = 100
  const center = viewBoxSize / 2
  const radius = 40
  const circumference = 2 * Math.PI * radius

  // Calculate stroke dash for remaining time (pie depletes as time passes)
  const strokeDashoffset = circumference * (1 - percentRemaining / 100)

  const color = getColor(percentRemaining, isDark)

  // Background color for the circle
  const bgColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  return (
    <div
      data-element="help-countdown"
      data-seconds-remaining={remainingSeconds}
      className={css({
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className={css({
          width: '100%',
          height: '100%',
          transform: 'rotate(-90deg)', // Start from top
        })}
      >
        {/* Background circle */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke={bgColor} strokeWidth="12" />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={css({
            transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease',
          })}
        />
      </svg>
      {/* Seconds remaining in center */}
      <div
        className={css({
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          fontFamily: 'var(--font-mono, monospace)',
          color: color,
          lineHeight: 1,
        })}
      >
        {remainingSeconds}
      </div>
    </div>
  )
}

export default HelpCountdown
