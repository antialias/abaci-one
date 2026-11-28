'use client'

/**
 * PartTransitionScreen - Full-screen transition between practice session parts
 *
 * Shows a kid-friendly message about the upcoming part, and the abacus
 * notice (pick it up, put it aside) when the caller passes one: the
 * transition carries it only when no game break follows; after a break the
 * shell shows the notice alone (`variant="abacus-notice"`), right before the
 * part's first item (`lib/curriculum/abacus-notice.ts`, plan §8 A19).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPartType } from '@/db/schema/session-plans'
import type { PartTransitionSide } from '@/lib/classroom/socket-events'
import type { AbacusNotice } from '@/lib/curriculum/abacus-notice'
import { arithmeticTransitionView } from '@/lib/curriculum/parts/arithmetic/session-view'
import type { StoredPart } from '@/lib/curriculum/parts/kind'
import { kindIdOf } from '@/lib/curriculum/parts/registry'
import { css } from '../../../styled-system/css'
import { usePartTransitionAudio } from './hooks/usePartTransitionAudio'
import { selectTransitionMessage } from './partTransitionMessages'

// ============================================================================
// Constants
// ============================================================================

/** Default countdown duration in milliseconds */
export const TRANSITION_COUNTDOWN_MS = 7000

/** Update interval for countdown display */
const COUNTDOWN_UPDATE_INTERVAL_MS = 100

// ============================================================================
// Types
// ============================================================================

/**
 * How the screen shows a part: what its kind answers (§1.3). The screen never
 * switches on a kind's own vocabulary; it shows the kind's label and emoji.
 * `presentation` is arithmetic's, and picks arithmetic's messages. Whether
 * the abacus comes or goes is the caller's (`abacusNotice`).
 */
export interface PartTransitionView extends PartTransitionSide {
  presentation?: SessionPartType
}

/** Ask the part's kind how the transition screen shows it. */
export function partTransitionViewOf(
  part: Pick<StoredPart, 'kind' | 'presentation'> & { type?: string }
): PartTransitionView {
  const kind = kindIdOf(part)
  if (kind === 'arithmetic' && part.type)
    return arithmeticTransitionView({ type: part.type, presentation: part.presentation })
  return { kind, label: 'Next part', emoji: '⭐' }
}

export interface PartTransitionScreenProps {
  /** Whether the transition screen is visible */
  isVisible: boolean
  /** The part we're transitioning FROM, as its kind shows it (null if session start) */
  previous: PartTransitionView | null
  /** The part we're transitioning TO, as its kind shows it */
  next: PartTransitionView
  /** Pick up or put away the physical abacus; null = no notice */
  abacusNotice: AbacusNotice | null
  /**
   * `transition` (default): the message, the parts and the notice if any.
   * `abacus-notice`: the notice alone, with the parts, before a part's first
   * item after a break.
   */
  variant?: 'transition' | 'abacus-notice'
  /** Countdown duration in ms */
  countdownMs?: number
  /** Timestamp when countdown started (for sync) */
  countdownStartTime: number
  /** Student info for display */
  student: {
    name: string
    emoji: string
    color: string
  }
  /** Called when transition completes (countdown or skip) */
  onComplete: () => void
  /** Optional seed for message selection (e.g., session ID hash) */
  messageSeed?: number
}

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Component
// ============================================================================

export function PartTransitionScreen({
  isVisible,
  previous,
  next,
  abacusNotice,
  variant = 'transition',
  countdownMs = TRANSITION_COUNTDOWN_MS,
  countdownStartTime,
  student,
  onComplete,
  messageSeed,
}: PartTransitionScreenProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Track elapsed time for countdown
  const [elapsedMs, setElapsedMs] = useState(0)
  const animationFrameRef = useRef<number | null>(null)
  const hasCompletedRef = useRef(false)

  // Select message once when transition starts
  // The headline: arithmetic picks from its message pools by presentation;
  // another kind gets a plain one naming the part. Keyed on the views'
  // content, so a refetched plan does not re-pick it mid-countdown
  const previousPresentation = previous?.presentation ?? null
  const nextPresentation = next.presentation
  const nextLabel = next.label
  const noticeOnly = variant === 'abacus-notice'
  const message = useMemo(
    () =>
      noticeOnly
        ? { headline: '' }
        : nextPresentation
          ? selectTransitionMessage(previousPresentation, nextPresentation, messageSeed)
          : { headline: 'Next Up!', subtitle: nextLabel },
    [noticeOnly, previousPresentation, nextPresentation, nextLabel, messageSeed]
  )

  // Abacus action: the caller's notice (the parts' presentations, and whether a break follows)
  const showAbacusPutAway = abacusNotice === 'put_away'
  const showAbacusPickUp = abacusNotice === 'pick_up'

  // Compute abacus action text for audio narration
  const abacusActionText = showAbacusPutAway
    ? 'Put your abacus away'
    : showAbacusPickUp
      ? 'Grab your abacus'
      : null

  // Speak the transition message when screen becomes visible
  usePartTransitionAudio({ isVisible, message, abacusAction: abacusActionText })

  // Handle skip. Every tap reaches the parent, also after the countdown ran
  // out: the screen stays up until the server leaves part_transition, so a tap
  // is how the kid asks again after a completion that failed (Phase 3c).
  const handleSkip = useCallback(() => {
    hasCompletedRef.current = true
    onComplete()
  }, [onComplete])

  // Countdown timer using requestAnimationFrame for smooth updates
  useEffect(() => {
    if (!isVisible) {
      hasCompletedRef.current = false
      setElapsedMs(0)
      return
    }

    const updateCountdown = () => {
      const now = Date.now()
      const elapsed = now - countdownStartTime
      setElapsedMs(elapsed)

      if (elapsed >= countdownMs) {
        // Countdown complete
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true
          onComplete()
        }
      } else {
        // Continue updating
        animationFrameRef.current = requestAnimationFrame(updateCountdown)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateCountdown)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isVisible, countdownStartTime, countdownMs, onComplete])

  if (!isVisible) return null

  // Calculate countdown values
  const remainingMs = Math.max(0, countdownMs - elapsedMs)
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const percentRemaining = (remainingMs / countdownMs) * 100

  // SVG parameters for countdown circle
  const viewBoxSize = 100
  const center = viewBoxSize / 2
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - percentRemaining / 100)

  // Color based on time remaining
  const countdownColor =
    percentRemaining > 50 ? (isDark ? '#22c55e' : '#16a34a') : isDark ? '#eab308' : '#ca8a04'

  return (
    <div
      data-component={noticeOnly ? 'abacus-notice-screen' : 'part-transition-screen'}
      data-previous-part={previous ? (previous.presentation ?? previous.kind) : 'start'}
      data-next-part={next.presentation ?? next.kind}
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
      })}
    >
      {/* Main content card */}
      <div
        data-element="transition-content"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        })}
      >
        {/* Student avatar */}
        <div
          data-element="student-avatar"
          className={css({
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.25rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          })}
          style={{ backgroundColor: student.color }}
        >
          {student.emoji}
        </div>

        {/* Message (the notice alone carries none) */}
        {!noticeOnly && (
          <div
            data-element="transition-message"
            className={css({
              textAlign: 'center',
            })}
          >
            <h2
              className={css({
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              {message.headline}
            </h2>
            {message.subtitle && (
              <p
                className={css({
                  fontSize: '1.125rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                {message.subtitle}
              </p>
            )}
          </div>
        )}

        {/* Part type indicator */}
        <div
          data-element="part-indicator"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            borderRadius: '12px',
          })}
        >
          {previous && (
            <>
              <span
                className={css({
                  fontSize: '1.5rem',
                  opacity: 0.5,
                })}
              >
                {previous.emoji}
              </span>
              <span
                className={css({
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontSize: '1.25rem',
                })}
              >
                →
              </span>
            </>
          )}
          <span
            className={css({
              fontSize: '1.5rem',
            })}
          >
            {next.emoji}
          </span>
          <span
            className={css({
              fontSize: '1rem',
              fontWeight: '600',
              color: isDark ? 'gray.200' : 'gray.700',
            })}
          >
            {next.label}
          </span>
        </div>

        {/* Abacus action reminder */}
        {(showAbacusPutAway || showAbacusPickUp) && (
          <div
            data-element="abacus-action"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              backgroundColor: showAbacusPutAway
                ? isDark
                  ? 'amber.900/50'
                  : 'amber.100'
                : isDark
                  ? 'green.900/50'
                  : 'green.100',
              borderRadius: '8px',
              fontSize: noticeOnly ? '1.375rem' : '0.9375rem',
              fontWeight: noticeOnly ? '600' : undefined,
              color: showAbacusPutAway
                ? isDark
                  ? 'amber.200'
                  : 'amber.800'
                : isDark
                  ? 'green.200'
                  : 'green.800',
            })}
          >
            <span>{showAbacusPutAway ? '📦' : '🧮'}</span>
            <span>{showAbacusPutAway ? 'Put your abacus aside' : 'Get your abacus ready'}</span>
          </div>
        )}

        {/* Countdown timer */}
        <div
          data-element="countdown"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          })}
        >
          {/* Circular countdown */}
          <div
            className={css({
              width: '80px',
              height: '80px',
              position: 'relative',
            })}
          >
            <svg
              viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
              className={css({
                width: '100%',
                height: '100%',
                transform: 'rotate(-90deg)',
              })}
            >
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                strokeWidth="8"
              />
              {/* Progress arc */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={countdownColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={css({
                  transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease',
                })}
              />
            </svg>
            {/* Seconds in center */}
            <div
              className={css({
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono, monospace)',
                color: countdownColor,
              })}
            >
              {remainingSeconds}
            </div>
          </div>

          {/* Skip button */}
          <button
            data-action={noticeOnly ? 'continue-abacus-notice' : 'skip-transition'}
            onClick={handleSkip}
            className={css({
              padding: '0.625rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              color: isDark ? 'gray.300' : 'gray.600',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'gray.600' : 'gray.300',
              },
              _active: {
                transform: 'scale(0.98)',
              },
            })}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export default PartTransitionScreen
