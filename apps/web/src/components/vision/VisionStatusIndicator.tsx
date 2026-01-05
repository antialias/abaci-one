'use client'

import type { ReactNode } from 'react'
import { css } from '../../../styled-system/css'

export interface VisionStatusIndicatorProps {
  /** Whether calibration is complete */
  isCalibrated: boolean
  /** Whether actively detecting */
  isDetecting: boolean
  /** Detection confidence (0-1) */
  confidence: number
  /** Whether hand motion is detected */
  handDetected: boolean
  /** Current detected value (null if not stable) */
  detectedValue: number | null
  /** Number of consecutive stable frames */
  consecutiveFrames: number
  /** Minimum frames needed for stable detection */
  minFrames?: number
}

/**
 * VisionStatusIndicator - Shows current detection status
 *
 * Displays:
 * - Calibration status
 * - Detection status (detecting, stable, hand blocking)
 * - Confidence level
 * - Current detected value
 */
export function VisionStatusIndicator({
  isCalibrated,
  isDetecting,
  confidence,
  handDetected,
  detectedValue,
  consecutiveFrames,
  minFrames = 10,
}: VisionStatusIndicatorProps): ReactNode {
  // Determine status
  let status: 'uncalibrated' | 'detecting' | 'stable' | 'hand-blocking' = 'uncalibrated'
  let statusColor = 'gray.500'
  let statusText = 'Not calibrated'

  if (!isCalibrated) {
    status = 'uncalibrated'
    statusColor = 'gray.500'
    statusText = 'Not calibrated'
  } else if (handDetected) {
    status = 'hand-blocking'
    statusColor = 'orange.500'
    statusText = 'Hand detected'
  } else if (detectedValue !== null && consecutiveFrames >= minFrames) {
    status = 'stable'
    statusColor = 'green.500'
    statusText = 'Stable'
  } else if (isDetecting) {
    status = 'detecting'
    statusColor = 'yellow.500'
    statusText = 'Detecting...'
  }

  // Confidence bar width
  const confidencePercent = Math.round(confidence * 100)

  return (
    <div
      data-component="vision-status-indicator"
      data-status={status}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        bg: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 'lg',
        minWidth: '120px',
      })}
    >
      {/* Status indicator */}
      <div
        data-element="status-row"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        })}
      >
        {/* Status dot */}
        <div
          data-element="status-dot"
          className={css({
            width: '8px',
            height: '8px',
            borderRadius: 'full',
            animation: status === 'detecting' ? 'pulse 1s infinite' : 'none',
          })}
          style={{
            backgroundColor: `var(--colors-${statusColor.replace('.', '-')})`,
          }}
        />
        <span
          className={css({
            fontSize: 'xs',
            color: 'white',
            fontWeight: 'medium',
          })}
        >
          {statusText}
        </span>
      </div>

      {/* Detected value */}
      {isCalibrated && detectedValue !== null && (
        <div
          data-element="detected-value"
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: status === 'stable' ? 'green.300' : 'yellow.300',
            fontFamily: 'mono',
            textAlign: 'center',
          })}
        >
          {detectedValue}
        </div>
      )}

      {/* Confidence bar */}
      {isCalibrated && isDetecting && (
        <div
          data-element="confidence-bar"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          })}
        >
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.400',
            })}
          >
            Confidence: {confidencePercent}%
          </div>
          <div
            className={css({
              height: '4px',
              bg: 'gray.700',
              borderRadius: 'full',
              overflow: 'hidden',
            })}
          >
            <div
              className={css({
                height: '100%',
                borderRadius: 'full',
                transition: 'width 0.2s',
              })}
              style={{
                width: `${confidencePercent}%`,
                backgroundColor:
                  confidence > 0.8
                    ? 'var(--colors-green-500)'
                    : confidence > 0.5
                      ? 'var(--colors-yellow-500)'
                      : 'var(--colors-red-500)',
              }}
            />
          </div>
        </div>
      )}

      {/* Stability progress */}
      {isCalibrated && isDetecting && !handDetected && consecutiveFrames > 0 && (
        <div
          data-element="stability-progress"
          className={css({
            fontSize: 'xs',
            color: 'gray.400',
          })}
        >
          {consecutiveFrames >= minFrames
            ? 'Locked'
            : `Stabilizing... ${consecutiveFrames}/${minFrames}`}
        </div>
      )}
    </div>
  )
}

export default VisionStatusIndicator
