'use client'

/**
 * RetryTransitionScreen - Brief transition between epochs when retrying wrong problems
 *
 * Shows a kid-friendly message encouraging them to try the problems again,
 * with info about how many problems need retrying and which attempt this is.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

// ============================================================================
// Constants
// ============================================================================

/** Countdown duration for retry transition */
export const RETRY_TRANSITION_COUNTDOWN_MS = 3000

// ============================================================================
// Types
// ============================================================================

export interface RetryTransitionScreenProps {
  /** Whether the transition screen is visible */
  isVisible: boolean
  /** Which retry epoch we're starting (1 = first retry, 2 = second retry) */
  epochNumber: number
  /** Number of problems that need retrying */
  problemCount: number
  /** Student info for display */
  student: {
    name: string
    emoji: string
  }
  /** Called when transition completes (countdown or skip) */
  onComplete: () => void
}

// ============================================================================
// Component
// ============================================================================

export function RetryTransitionScreen({
  isVisible,
  epochNumber,
  problemCount,
  student,
  onComplete,
}: RetryTransitionScreenProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [countdown, setCountdown] = useState(3)

  // Reset countdown when screen becomes visible
  useEffect(() => {
    if (isVisible) {
      setCountdown(3)
    }
  }, [isVisible])

  // Countdown timer
  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, onComplete])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  if (!isVisible) return null

  // Get encouraging message based on epoch
  const getMessage = () => {
    if (epochNumber === 1) {
      return "Let's practice those again!"
    }
    return 'One more try!'
  }

  const getSubMessage = () => {
    const plural = problemCount === 1 ? 'problem' : 'problems'
    if (epochNumber === 1) {
      return `You have ${problemCount} ${plural} to practice again.`
    }
    return `${problemCount} ${plural} left. You can do it!`
  }

  return (
    <div
      data-component="retry-transition-screen"
      data-epoch={epochNumber}
      className={css({
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'gray.900' : 'orange.50',
        zIndex: 50,
        padding: '2rem',
      })}
    >
      {/* Main content */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '400px',
          textAlign: 'center',
        })}
      >
        {/* Student avatar */}
        <div
          className={css({
            fontSize: '4rem',
            marginBottom: '1.5rem',
          })}
        >
          {student.emoji}
        </div>

        {/* Main message */}
        <h2
          className={css({
            fontSize: '2rem',
            fontWeight: 'bold',
            color: isDark ? 'orange.200' : 'orange.700',
            marginBottom: '1rem',
          })}
        >
          {getMessage()}
        </h2>

        {/* Sub message */}
        <p
          className={css({
            fontSize: '1.25rem',
            color: isDark ? 'gray.300' : 'gray.600',
            marginBottom: '2rem',
          })}
        >
          {getSubMessage()}
        </p>

        {/* Attempt indicator */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: isDark ? 'orange.900' : 'orange.100',
            borderRadius: '999px',
            marginBottom: '2rem',
          })}
        >
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'orange.200' : 'orange.700',
            })}
          >
            Attempt {epochNumber + 1} of 3
          </span>
        </div>

        {/* Countdown / Skip */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          })}
        >
          <div
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Starting in {countdown}...
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className={css({
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: isDark ? 'orange.600' : 'orange.500',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'orange.500' : 'orange.600',
                transform: 'scale(1.05)',
              },
            })}
          >
            Let's Go!
          </button>
        </div>
      </div>
    </div>
  )
}
