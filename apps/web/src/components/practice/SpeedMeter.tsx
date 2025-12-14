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
}

/**
 * Format milliseconds to a kid-friendly short time string
 * Under 60s: "Xs" (e.g., "8s", "30s")
 * 60s+: "Xm" (e.g., "2m")
 */
function formatTimeShort(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  return `${minutes}m`
}

/**
 * Speed visualization bar - shows average speed vs variation with actual time values
 * Used in session pause modal and timing displays to visualize response time patterns
 */
export function SpeedMeter({
  meanMs,
  stdDevMs,
  thresholdMs,
  isDark,
  currentTimeMs,
  compact = false,
}: SpeedMeterProps) {
  // Scale so threshold is at ~83% instead of 100%, giving visual room beyond it
  const scaleMax = thresholdMs * 1.2
  const meanPercent = Math.min(95, Math.max(5, (meanMs / scaleMax) * 100))
  const thresholdPercent = (thresholdMs / scaleMax) * 100 // ~83%

  // Variation should be visible but proportional - minimum 8% width for visibility
  const rawVariationPercent = (stdDevMs / scaleMax) * 100
  const variationPercent = Math.max(8, Math.min(40, rawVariationPercent))

  // Current time position (if provided)
  const currentPercent = currentTimeMs
    ? Math.min(110, Math.max(0, (currentTimeMs / scaleMax) * 100))
    : null

  // Check if mean and threshold labels would overlap (within 15% of each other)
  const labelsWouldOverlap = thresholdPercent - meanPercent < 15

  const barHeight = compact ? '16px' : '24px'
  const markerTop = compact ? '-2px' : '-4px'
  const markerHeight = compact ? '20px' : '32px'
  const labelFontSize = compact ? '0.625rem' : '0.75rem'
  const smallLabelFontSize = compact ? '0.5rem' : '0.625rem'

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
                currentPercent > thresholdPercent
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
            left: `calc(${thresholdPercent}% - 2px)`,
          }}
        />
      </div>

      {/* Time labels positioned under their markers */}
      <div
        className={css({
          position: 'relative',
          height: compact ? '1.75rem' : '2.25rem',
          marginTop: compact ? '0.25rem' : '0.375rem',
        })}
      >
        {/* 0s label at left */}
        <span
          className={css({
            position: 'absolute',
            left: 0,
            color: isDark ? 'gray.500' : 'gray.400',
          })}
          style={{ fontSize: labelFontSize }}
        >
          0s
        </span>

        {/* Average time label - positioned at mean marker */}
        {!labelsWouldOverlap && (
          <span
            className={css({
              position: 'absolute',
              textAlign: 'center',
              color: isDark ? 'blue.300' : 'blue.600',
              fontWeight: 'bold',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.2,
            })}
            style={{
              left: `${meanPercent}%`,
              transform: 'translateX(-50%)',
              fontSize: labelFontSize,
            }}
          >
            ~{formatTimeShort(meanMs)}
            <span
              className={css({ fontWeight: 'normal', color: isDark ? 'gray.400' : 'gray.500' })}
              style={{ fontSize: smallLabelFontSize }}
            >
              avg
            </span>
          </span>
        )}

        {/* Threshold time label - positioned at threshold marker */}
        <span
          className={css({
            position: 'absolute',
            textAlign: 'center',
            color: isDark ? 'yellow.300' : 'yellow.700',
            fontWeight: 'bold',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1.2,
          })}
          style={{
            left: `${thresholdPercent}%`,
            transform: 'translateX(-50%)',
            fontSize: labelFontSize,
          }}
        >
          {labelsWouldOverlap ? `~${formatTimeShort(meanMs)} / ` : ''}
          {formatTimeShort(thresholdMs)}
          <span
            className={css({ fontWeight: 'normal', color: isDark ? 'gray.400' : 'gray.500' })}
            style={{ fontSize: smallLabelFontSize }}
          >
            {labelsWouldOverlap ? 'avg / pause' : 'pause'}
          </span>
        </span>
      </div>
    </div>
  )
}
