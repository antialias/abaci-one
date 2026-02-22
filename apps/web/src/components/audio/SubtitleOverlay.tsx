'use client'

import { useState, useEffect, useCallback } from 'react'
import { css } from '../../../styled-system/css'
import { useAudioManager } from '@/hooks/useAudioManager'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'

const SPEED_LEVELS = [0.5, 0.75, 1, 1.5, 2] as const

const SPEED_LABEL: Record<string, string> = {
  slower: 'Slower',
  faster: 'Faster',
  normal: 'Normal',
}

export function SubtitleOverlay() {
  const {
    subtitleText,
    subtitleDurationMs,
    subtitleDurationMultiplier,
    subtitleBottomOffset,
    subtitleAnchor,
    lastError,
    dismissSubtitle,
    setSubtitleDurationMultiplier,
  } = useAudioManager()
  const { isVisualDebugEnabled } = useVisualDebugSafe()

  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null)
  const [feedbackKey, setFeedbackKey] = useState(0)

  // Clear feedback toast after 800ms
  useEffect(() => {
    if (!feedbackLabel) return
    const timer = setTimeout(() => setFeedbackLabel(null), 800)
    return () => clearTimeout(timer)
  }, [feedbackLabel, feedbackKey])

  const currentIndex = SPEED_LEVELS.indexOf(
    subtitleDurationMultiplier as (typeof SPEED_LEVELS)[number]
  )
  const effectiveIndex = currentIndex === -1 ? 2 : currentIndex // default to 1x

  const handleSlower = useCallback(() => {
    const nextIndex = Math.min(effectiveIndex + 1, SPEED_LEVELS.length - 1)
    if (nextIndex === effectiveIndex) return
    const next = SPEED_LEVELS[nextIndex]
    setSubtitleDurationMultiplier(next)
    setFeedbackLabel(next === 1 ? SPEED_LABEL.normal : SPEED_LABEL.slower)
    setFeedbackKey((k) => k + 1)
  }, [effectiveIndex, setSubtitleDurationMultiplier])

  const handleFaster = useCallback(() => {
    const nextIndex = Math.max(effectiveIndex - 1, 0)
    if (nextIndex === effectiveIndex) return
    const next = SPEED_LEVELS[nextIndex]
    setSubtitleDurationMultiplier(next)
    setFeedbackLabel(next === 1 ? SPEED_LABEL.normal : SPEED_LABEL.faster)
    setFeedbackKey((k) => k + 1)
  }, [effectiveIndex, setSubtitleDurationMultiplier])

  // Show error banner when visual debug is on, even without subtitle text
  if (!subtitleText && !(isVisualDebugEnabled && lastError)) return null

  const atMax = effectiveIndex >= SPEED_LEVELS.length - 1
  const atMin = effectiveIndex <= 0

  return (
    <>
      <style>{`
        @keyframes subtitleShrinkBar {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes subtitleFadeOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        data-component="SubtitleOverlay"
        className={css({
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '90vw',
        })}
        style={
          subtitleAnchor === 'top'
            ? { top: `${subtitleBottomOffset}px` }
            : { bottom: `${subtitleBottomOffset}px` }
        }
      >
        {/* Speed feedback toast */}
        {feedbackLabel && (
          <div
            key={feedbackKey}
            data-element="speed-feedback"
            className={css({
              marginBottom: '8px',
              padding: '4px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              pointerEvents: 'none',
            })}
            style={{ animation: 'subtitleFadeOut 800ms ease-out forwards' }}
          >
            {feedbackLabel}
          </div>
        )}

        {/* TTS error banner (visual debug only) */}
        {isVisualDebugEnabled && lastError && (
          <div
            data-element="tts-error-banner"
            className={css({
              marginBottom: '8px',
              padding: '8px 14px',
              backgroundColor: 'rgba(220, 38, 38, 0.9)',
              color: 'white',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'mono',
              lineHeight: 1.4,
              maxWidth: '80vw',
              wordBreak: 'break-word',
              pointerEvents: 'auto',
            })}
          >
            {lastError}
          </div>
        )}

        {/* Pill */}
        {subtitleText && <div
          role="status"
          aria-live="polite"
          data-element="subtitle-pill"
          className={css({
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '8px',
            overflow: 'hidden',
            pointerEvents: 'auto',
          })}
        >
          {/* Slower button */}
          <button
            data-action="subtitle-slower"
            onClick={handleSlower}
            disabled={atMax}
            aria-label="Slower subtitles"
            className={css({
              flexShrink: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              padding: 0,
              opacity: atMax ? 0.3 : 1,
              pointerEvents: atMax ? 'none' : 'auto',
              _hover: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            })}
          >
            {'🐢'}
          </button>

          {/* Subtitle text — tap to dismiss */}
          <span
            data-action="subtitle-dismiss"
            onClick={dismissSubtitle}
            className={css({
              flex: 1,
              padding: '12px 8px',
              color: 'white',
              fontSize: '18px',
              lineHeight: '1.5',
              textAlign: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            })}
          >
            {subtitleText}
          </span>

          {/* Faster button */}
          <button
            data-action="subtitle-faster"
            onClick={handleFaster}
            disabled={atMin}
            aria-label="Faster subtitles"
            className={css({
              flexShrink: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              padding: 0,
              opacity: atMin ? 0.3 : 1,
              pointerEvents: atMin ? 'none' : 'auto',
              _hover: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            })}
          >
            {'🐇'}
          </button>

          {/* Progress bar */}
          {subtitleDurationMs > 0 && (
            <div
              key={`${subtitleText}-${subtitleDurationMs}`}
              data-element="subtitle-progress"
              className={css({
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
                borderRadius: '0 0 8px 8px',
              })}
              style={{
                animation: `subtitleShrinkBar ${subtitleDurationMs}ms linear forwards`,
              }}
            />
          )}
        </div>}
      </div>
    </>
  )
}
