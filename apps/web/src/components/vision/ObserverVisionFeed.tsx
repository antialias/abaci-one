'use client'

import type { DvrBufferInfo, ObservedVisionFrame } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'
import { VisionDvrControls } from './VisionDvrControls'

/**
 * Feature flag to control auto-detection display
 * When false, hides the detection overlay since auto-detection is disabled globally
 */
const ENABLE_AUTO_DETECTION = false

export interface ObserverVisionFeedProps {
  /** The latest vision frame from the observed student */
  frame: ObservedVisionFrame
  /** Session ID for DVR requests */
  sessionId: string
  /** DVR buffer info (null if DVR not available) */
  dvrBufferInfo?: DvrBufferInfo | null
  /** Whether currently viewing live feed */
  isLive?: boolean
  /** Callback to scrub to a specific offset */
  onScrub?: (offsetMs: number) => void
  /** Callback to go back to live */
  onGoLive?: () => void
}

/**
 * Displays the vision feed received from an observed student's session.
 *
 * Used in the SessionObserver modal when the student has abacus vision enabled.
 * Shows the processed camera feed with detection status overlay.
 */
export function ObserverVisionFeed({
  frame,
  sessionId,
  dvrBufferInfo,
  isLive = true,
  onScrub,
  onGoLive,
}: ObserverVisionFeedProps) {
  // Calculate age of frame for staleness indicator
  const frameAge = Date.now() - frame.receivedAt
  const isStale = isLive && frameAge > 1000 // Only show stale in live mode

  // Determine if DVR is available
  const isDvrAvailable =
    !!dvrBufferInfo && dvrBufferInfo.availableToMs > dvrBufferInfo.availableFromMs

  return (
    <div
      data-component="observer-vision-feed"
      data-stale={isStale}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'lg',
        overflow: 'hidden',
        bg: 'black',
      })}
    >
      {/* Video container with overlays */}
      <div
        data-element="video-container"
        className={css({
          position: 'relative',
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

        {/* Detection overlay - only shown when auto-detection is enabled */}
        {ENABLE_AUTO_DETECTION && (
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
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  color: 'white',
                  fontFamily: 'mono',
                })}
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
        )}

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

      {/* DVR controls - below video for better usability */}
      {onScrub && onGoLive && (
        <div data-element="dvr-controls-container">
          <VisionDvrControls
            sessionId={sessionId}
            isAvailable={isDvrAvailable}
            availableFromMs={dvrBufferInfo?.availableFromMs}
            availableToMs={dvrBufferInfo?.availableToMs}
            currentProblemStartMs={dvrBufferInfo?.currentProblemStartMs}
            currentProblemNumber={dvrBufferInfo?.currentProblemNumber}
            onScrub={onScrub}
            onGoLive={onGoLive}
            isLive={isLive}
          />
        </div>
      )}
    </div>
  )
}
