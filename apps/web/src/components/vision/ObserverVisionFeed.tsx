'use client'

import type { ObservedVisionFrame } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'

interface ObserverVisionFeedProps {
  /** The latest vision frame from the observed student */
  frame: ObservedVisionFrame
}

/**
 * Displays the vision feed received from an observed student's session.
 *
 * Used in the SessionObserver modal when the student has abacus vision enabled.
 * Shows the processed camera feed with detection status overlay.
 */
export function ObserverVisionFeed({ frame }: ObserverVisionFeedProps) {
  // Calculate age of frame for staleness indicator
  const frameAge = Date.now() - frame.receivedAt
  const isStale = frameAge > 1000 // More than 1 second old

  return (
    <div
      data-component="observer-vision-feed"
      data-stale={isStale}
      className={css({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'lg',
        overflow: 'hidden',
        bg: 'black',
      })}
    >
      {/* Video frame */}
      <img
        src={`data:image/jpeg;base64,${frame.imageData}`}
        alt="Student's abacus vision feed"
        className={css({
          width: '100%',
          height: 'auto',
          display: 'block',
          opacity: isStale ? 0.5 : 1,
          transition: 'opacity 0.3s',
        })}
      />

      {/* Detection overlay */}
      <div
        data-element="detection-overlay"
        className={css({
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          bg: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        })}
      >
        {/* Detected value */}
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span
            className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'white', fontFamily: 'mono' })}
          >
            {frame.detectedValue !== null ? frame.detectedValue : '---'}
          </span>
          {frame.detectedValue !== null && (
            <span className={css({ fontSize: 'xs', color: 'gray.400' })}>
              {Math.round(frame.confidence * 100)}%
            </span>
          )}
        </div>

        {/* Live indicator */}
        <div className={css({ display: 'flex', alignItems: 'center', gap: 1 })}>
          <div
            className={css({
              w: '8px',
              h: '8px',
              borderRadius: 'full',
              bg: isStale ? 'gray.500' : 'green.500',
              animation: isStale ? 'none' : 'pulse 2s infinite',
            })}
          />
          <span
            className={css({
              fontSize: 'xs',
              color: isStale ? 'gray.500' : 'green.400',
            })}
          >
            {isStale ? 'Stale' : 'Live'}
          </span>
        </div>
      </div>

      {/* Vision mode badge */}
      <div
        data-element="vision-badge"
        className={css({
          position: 'absolute',
          top: '4px',
          left: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          bg: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 'md',
          fontSize: 'xs',
          color: 'cyan.400',
        })}
      >
        <span>📷</span>
        <span>Vision</span>
      </div>
    </div>
  )
}
