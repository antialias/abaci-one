'use client'

import { css } from '../../../styled-system/css'

export interface SpeedMeterProps {
  /** Mean response time in milliseconds */
  meanMs: number
  /** Standard deviation of response times in milliseconds */
  stdDevMs: number
  /** Threshold for pause/slow indicator in milliseconds */
  thresholdMs: number
  /** Whether dark mode is enabled */
  isDark: boolean
  /** Optional current time to show as an indicator on the bar */
  currentTimeMs?: number
  /** Optional compact mode for inline display */
  compact?: boolean
  /** Label for the average marker (default: "Your usual speed") */
  averageLabel?: string
  /** Label for the fast end (default: "Fast") */
  fastLabel?: string
  /** Label for the slow/threshold end (default: "Pause") */
  slowLabel?: string
}

/**
 * Speed visualization bar - shows average speed vs variation
 * Used in session pause modal and timing displays to visualize response time patterns
 */
export function SpeedMeter({
  meanMs,
  stdDevMs,
  thresholdMs,
  isDark,
  currentTimeMs,
  compact = false,
  averageLabel = 'Your usual speed',
  fastLabel = 'Fast',
  slowLabel = 'Pause',
}: SpeedMeterProps) {
  // Scale so the mean is around 50% and threshold is at 100%
  // This ensures the visualization is always meaningful regardless of absolute values
  const scaleMax = thresholdMs
  const meanPercent = Math.min(95, Math.max(5, (meanMs / scaleMax) * 100))

  // Variation should be visible but proportional - minimum 8% width for visibility
  const rawVariationPercent = (stdDevMs / scaleMax) * 100
  const variationPercent = Math.max(8, Math.min(40, rawVariationPercent))

  // Current time position (if provided)
  const currentPercent = currentTimeMs
    ? Math.min(110, Math.max(0, (currentTimeMs / scaleMax) * 100))
    : null

  const barHeight = compact ? '16px' : '24px'
  const markerTop = compact ? '-2px' : '-4px'
  const markerHeight = compact ? '20px' : '32px'

  return (
    <div
      data-element="speed-meter"
      className={css({
        width: '100%',
        padding: compact ? '0.5rem' : '0.75rem',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '8px',
      })}
    >
      {/* Speed bar container */}
      <div
        className={css({
          position: 'relative',
          backgroundColor: isDark ? 'gray.700' : 'gray.200',
          borderRadius: '12px',
          overflow: 'visible',
        })}
        style={{ height: barHeight }}
      >
        {/* Variation range (the "wiggle room") */}
        <div
          className={css({
            position: 'absolute',
            height: '100%',
            backgroundColor: isDark ? 'blue.800' : 'blue.100',
            borderRadius: '12px',
            transition: 'all 0.5s ease',
          })}
          style={{
            left: `${Math.max(0, meanPercent - variationPercent)}%`,
            width: `${variationPercent * 2}%`,
          }}
        />

        {/* Average marker */}
        <div
          data-element="average-marker"
          className={css({
            position: 'absolute',
            width: '8px',
            backgroundColor: isDark ? 'blue.400' : 'blue.500',
            borderRadius: '4px',
            transition: 'all 0.5s ease',
            zIndex: 1,
          })}
          style={{
            top: markerTop,
            height: markerHeight,
            left: `calc(${meanPercent}% - 4px)`,
          }}
        />

        {/* Current time marker (if provided) */}
        {currentPercent !== null && (
          <div
            data-element="current-marker"
            className={css({
              position: 'absolute',
              width: '4px',
              backgroundColor:
                currentPercent > 100
                  ? isDark
                    ? 'red.400'
                    : 'red.500'
                  : currentPercent > meanPercent + variationPercent
                    ? isDark
                      ? 'yellow.400'
                      : 'yellow.500'
                    : isDark
                      ? 'green.400'
                      : 'green.500',
              borderRadius: '2px',
              transition: 'left 0.1s linear, background-color 0.3s ease',
              zIndex: 2,
            })}
            style={{
              top: markerTop,
              height: markerHeight,
              left: `calc(${Math.min(currentPercent, 105)}% - 2px)`,
            }}
          />
        )}

        {/* Threshold marker */}
        <div
          data-element="threshold-marker"
          className={css({
            position: 'absolute',
            top: '0',
            width: '3px',
            height: '100%',
            backgroundColor: isDark ? 'yellow.500' : 'yellow.600',
            borderRadius: '2px',
          })}
          style={{
            left: 'calc(100% - 2px)',
          }}
        />
      </div>

      {/* Labels */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: compact ? '0.25rem' : '0.5rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
        style={{ fontSize: compact ? '0.625rem' : '0.6875rem' }}
      >
        <span>{fastLabel}</span>
        <span
          className={css({
            color: isDark ? 'blue.300' : 'blue.600',
            fontWeight: 'bold',
          })}
        >
          {averageLabel}
        </span>
        <span>{slowLabel}</span>
      </div>
    </div>
  )
}
