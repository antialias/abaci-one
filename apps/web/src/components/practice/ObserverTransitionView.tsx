'use client'

/**
 * ObserverTransitionView - Simplified transition view for observers
 *
 * Shows "Student transitioning..." with the same synchronized countdown
 * as the student's PartTransitionScreen.
 */

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPartType } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

export interface ObserverTransitionViewProps {
  /** Part type transitioning FROM (null if session start) */
  previousPartType: SessionPartType | null
  /** Part type transitioning TO */
  nextPartType: SessionPartType
  /** Timestamp when countdown started (for sync) */
  countdownStartTime: number
  /** Countdown duration in ms */
  countdownDurationMs: number
  /** Student info for display */
  student: {
    name: string
    emoji: string
    color: string
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPartTypeEmoji(type: SessionPartType): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '✏️'
  }
}

function getPartTypeLabel(type: SessionPartType): string {
  switch (type) {
    case 'abacus':
      return 'Abacus'
    case 'visualization':
      return 'Visualization'
    case 'linear':
      return 'Equations'
  }
}

// ============================================================================
// Component
// ============================================================================

export function ObserverTransitionView({
  previousPartType,
  nextPartType,
  countdownStartTime,
  countdownDurationMs,
  student,
}: ObserverTransitionViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Track elapsed time for countdown
  const [elapsedMs, setElapsedMs] = useState(0)
  const animationFrameRef = useRef<number | null>(null)

  // Countdown timer using requestAnimationFrame for smooth updates
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      const elapsed = now - countdownStartTime
      setElapsedMs(elapsed)

      if (elapsed < countdownDurationMs) {
        animationFrameRef.current = requestAnimationFrame(updateCountdown)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateCountdown)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [countdownStartTime, countdownDurationMs])

  // Calculate countdown values
  const remainingMs = Math.max(0, countdownDurationMs - elapsedMs)
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const percentRemaining = (remainingMs / countdownDurationMs) * 100

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
      data-component="observer-transition-view"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
      })}
    >
      {/* Student avatar */}
      <div
        data-element="student-avatar"
        className={css({
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        })}
        style={{ backgroundColor: student.color }}
      >
        {student.emoji}
      </div>

      {/* Message */}
      <div>
        <h3
          className={css({
            fontSize: '1.25rem',
            fontWeight: '600',
            color: isDark ? 'gray.200' : 'gray.700',
            marginBottom: '0.5rem',
          })}
        >
          {student.name} is transitioning...
        </h3>
        <p
          className={css({
            fontSize: '0.9375rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          Preparing for the next section
        </p>
      </div>

      {/* Part type indicator */}
      <div
        data-element="part-indicator"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: isDark ? 'gray.700' : 'gray.100',
          borderRadius: '8px',
          fontSize: '0.875rem',
        })}
      >
        {previousPartType && (
          <>
            <span className={css({ opacity: 0.5 })}>{getPartTypeEmoji(previousPartType)}</span>
            <span className={css({ color: isDark ? 'gray.500' : 'gray.400' })}>→</span>
          </>
        )}
        <span>{getPartTypeEmoji(nextPartType)}</span>
        <span
          className={css({
            fontWeight: '500',
            color: isDark ? 'gray.300' : 'gray.600',
          })}
        >
          {getPartTypeLabel(nextPartType)}
        </span>
      </div>

      {/* Countdown */}
      <div
        data-element="countdown"
        className={css({
          width: '64px',
          height: '64px',
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
            strokeWidth="6"
          />
          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={countdownColor}
            strokeWidth="6"
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
            fontSize: '1.25rem',
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono, monospace)',
            color: countdownColor,
          })}
        >
          {remainingSeconds}
        </div>
      </div>
    </div>
  )
}

export default ObserverTransitionView
