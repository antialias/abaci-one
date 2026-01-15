'use client'

import { useState } from 'react'
import { css } from '../../../../../styled-system/css'

interface DistributionHeatmapProps {
  /** Count of images per digit (0-9) */
  digitCounts: Record<number, number>
  /** Minimum count to be considered "sufficient" */
  minThreshold?: number
  /** Compact mode for mobile */
  compact?: boolean
}

/**
 * Compact heatmap showing distribution of training images across digits 0-9.
 * - Blue intensity = relative count (darker = more)
 * - Red = insufficient samples
 * - Hover/tap to see exact count
 */
export function DistributionHeatmap({
  digitCounts,
  minThreshold = 3,
  compact = false,
}: DistributionHeatmapProps) {
  const [hoveredDigit, setHoveredDigit] = useState<number | null>(null)

  const maxCount = Math.max(...Object.values(digitCounts), 1)
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  // Calculate intensity (0-1) for color
  const getIntensity = (count: number) => {
    if (maxCount === 0) return 0
    return Math.min(count / maxCount, 1)
  }

  // Get background color based on count
  const getCellColor = (count: number, isHovered: boolean) => {
    const isInsufficient = count < minThreshold

    if (isInsufficient) {
      return isHovered ? 'red.400' : 'red.500/70'
    }

    const intensity = getIntensity(count)
    // Map intensity to blue shades
    if (intensity > 0.8) return isHovered ? 'blue.400' : 'blue.500'
    if (intensity > 0.6) return isHovered ? 'blue.500' : 'blue.600'
    if (intensity > 0.4) return isHovered ? 'blue.600' : 'blue.700'
    if (intensity > 0.2) return isHovered ? 'blue.700' : 'blue.800'
    return isHovered ? 'blue.800' : 'blue.900'
  }

  return (
    <div data-component="distribution-heatmap">
      {/* Heatmap grid */}
      <div
        className={css({
          display: 'flex',
          gap: compact ? '2px' : '3px',
        })}
      >
        {digits.map((digit) => {
          const count = digitCounts[digit] || 0
          const isInsufficient = count < minThreshold
          const isHovered = hoveredDigit === digit

          return (
            <div
              key={digit}
              data-digit={digit}
              onMouseEnter={() => setHoveredDigit(digit)}
              onMouseLeave={() => setHoveredDigit(null)}
              onClick={() => setHoveredDigit(hoveredDigit === digit ? null : digit)}
              className={css({
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'transform 0.1s ease',
                _hover: { transform: 'scale(1.1)' },
              })}
            >
              {/* Color cell */}
              <div
                className={css({
                  width: compact ? '20px' : '24px',
                  height: compact ? '16px' : '20px',
                  borderRadius: 'sm',
                  bg: getCellColor(count, isHovered),
                  border: '1px solid',
                  borderColor: isInsufficient
                    ? 'red.400/50'
                    : isHovered
                      ? 'blue.400/50'
                      : 'transparent',
                  transition: 'all 0.15s ease',
                })}
              />
              {/* Digit label */}
              <span
                className={css({
                  fontSize: compact ? '2xs' : 'xs',
                  color: isInsufficient ? 'red.400' : 'gray.500',
                  fontWeight: isInsufficient ? 'bold' : 'normal',
                  mt: '2px',
                  fontFamily: 'mono',
                })}
              >
                {digit}
              </span>

              {/* Tooltip on hover */}
              {isHovered && (
                <div
                  className={css({
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    mb: 1,
                    px: 2,
                    py: 1,
                    bg: 'gray.800',
                    color: 'gray.100',
                    fontSize: 'xs',
                    borderRadius: 'md',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: 'lg',
                    border: '1px solid',
                    borderColor: 'gray.700',
                  })}
                >
                  <span className={css({ fontWeight: 'bold' })}>{count}</span>
                  <span className={css({ color: 'gray.400' })}> images</span>
                  {isInsufficient && (
                    <span className={css({ color: 'red.400', ml: 1 })}>
                      (need {minThreshold - count} more)
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DistributionHeatmap
