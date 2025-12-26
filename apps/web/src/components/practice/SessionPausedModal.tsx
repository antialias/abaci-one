'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPart, SessionPlan } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import type { AutoPauseStats, PauseInfo } from './autoPauseCalculator'
import { SpeedMeter } from './SpeedMeter'

// Re-export types for backwards compatibility
export type { AutoPauseStats, PauseInfo }

function getPartTypeLabel(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Use Abacus'
    case 'visualization':
      return 'Mental Math (Visualization)'
    case 'linear':
      return 'Mental Math (Linear)'
  }
}

function getPartTypeEmoji(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '💭'
  }
}

// Fun phrases for auto-pause (system noticed they're taking a while)
const AUTO_PAUSE_PHRASES = [
  'We pressed paws! 🙏',
  "This one's a thinker!",
  'Deep thoughts detected!',
  'Brain at work!',
  'Thinking cap on!',
  'Taking your time? Smart!',
]

// Fun phrases for manual pause (kid chose to take a break)
const MANUAL_PAUSE_PHRASES = [
  'You pressed paws! 🙏',
  'Break time!',
  'Taking five!',
  'Quick breather!',
  'Good call!',
  'Smart break!',
]

// Phrases for teacher-initiated pause
const TEACHER_PAUSE_PHRASES = [
  'Teacher called timeout!',
  'Hold on a moment!',
  'Quick pause!',
  'Wait for your teacher!',
]

// Intl formatters for duration display
const secondsFormatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'second',
  unitDisplay: 'long',
})
const minutesFormatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'minute',
  unitDisplay: 'long',
})
const hoursFormatter = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'hour',
  unitDisplay: 'long',
})

/**
 * Format milliseconds as a human-readable duration using Intl.NumberFormat
 */
function formatDurationFriendly(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    if (minutes === 0) {
      return hoursFormatter.format(hours)
    }
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    if (seconds === 0) {
      return minutesFormatter.format(minutes)
    }
    return `${minutes}m ${seconds}s`
  }
  return secondsFormatter.format(seconds)
}

/**
 * Format milliseconds as approximate seconds using Intl.NumberFormat
 */
function formatSecondsFriendly(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 1) return 'less than a second'
  return `about ${secondsFormatter.format(Math.round(seconds))}`
}

export interface SessionPausedModalProps {
  /** Whether the modal is visible */
  isOpen: boolean
  /** Student info */
  student: {
    name: string
    emoji: string
    color: string
  }
  /** Current session plan (for progress info) */
  session: SessionPlan
  /** Information about the pause (optional for backwards compatibility) */
  pauseInfo?: PauseInfo
  /** Called when user clicks Resume */
  onResume: () => void
  /** Called when user clicks End Session */
  onEndSession: () => void
}

/**
 * Session Paused Modal
 *
 * A kid-friendly modal shown when a session is paused.
 * Features educational explanations of statistics concepts
 * like averages and variation in an approachable way.
 */
export function SessionPausedModal({
  isOpen,
  student,
  session,
  pauseInfo,
  onResume,
  onEndSession,
}: SessionPausedModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Live-updating pause duration
  const [pauseDuration, setPauseDuration] = useState(0)
  // Toggle for showing stats details
  const [showStats, setShowStats] = useState(false)

  // Pick a random phrase once per pause (stable while modal is open)
  const pausePhrase = useMemo(() => {
    let phrases: string[]
    switch (pauseInfo?.reason) {
      case 'auto-timeout':
        phrases = AUTO_PAUSE_PHRASES
        break
      case 'teacher':
        phrases = TEACHER_PAUSE_PHRASES
        break
      default:
        phrases = MANUAL_PAUSE_PHRASES
    }
    return phrases[Math.floor(Math.random() * phrases.length)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseInfo?.pausedAt?.getTime(), pauseInfo?.reason])

  useEffect(() => {
    if (!isOpen || !pauseInfo?.pausedAt) {
      setPauseDuration(0)
      return
    }

    // Update immediately
    setPauseDuration(Date.now() - pauseInfo.pausedAt.getTime())

    // Update every second
    const interval = setInterval(() => {
      setPauseDuration(Date.now() - pauseInfo.pausedAt.getTime())
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, pauseInfo?.pausedAt])

  if (!isOpen) return null

  // Calculate progress
  const completedProblems = session.results.length
  const totalProblems = session.parts.reduce((sum, part) => sum + part.slots.length, 0)
  const progressPercent =
    totalProblems > 0 ? Math.round((completedProblems / totalProblems) * 100) : 0

  const currentPart = session.parts[session.currentPartIndex]

  // Determine greeting based on pause reason
  const isAutoTimeout = pauseInfo?.reason === 'auto-timeout'
  const isTeacherPause = pauseInfo?.reason === 'teacher'
  const stats = pauseInfo?.autoPauseStats

  return (
    <div
      data-component="session-paused-modal"
      data-status="paused"
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      })}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        data-element="modal-content"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          padding: '1.5rem',
          maxWidth: '380px',
          width: '100%',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero section with avatar and title */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
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
              flexShrink: 0,
            })}
            style={{ backgroundColor: student.color }}
          >
            {student.emoji}
          </div>

          {/* Title with emoji and timer */}
          <div>
            <h2
              className={css({
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              })}
            >
              <span>{isTeacherPause ? '👩‍🏫' : isAutoTimeout ? '🤔' : '☕'}</span>
              <span>{pausePhrase}</span>
            </h2>
            {pauseInfo && (
              <p
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                  marginTop: '0.125rem',
                })}
              >
                ⏱️{' '}
                <span
                  className={css({
                    fontFamily: 'monospace',
                  })}
                >
                  {formatDurationFriendly(pauseDuration)}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Auto-pause explanation - only shown when we have enough data */}
        {isAutoTimeout && stats?.usedStatistics && (
          <div
            data-element="rhythm-explanation"
            className={css({
              width: '100%',
            })}
          >
            {/* Main explanation text */}
            <p
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.300' : 'gray.600',
                lineHeight: '1.5',
                textAlign: 'center',
                marginBottom: '0.5rem',
              })}
            >
              Usually you take {formatSecondsFriendly(stats.meanMs)}. This one took longer, so we
              paused to check in.
              {!showStats && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => setShowStats(true)}
                    className={css({
                      color: isDark ? 'gray.500' : 'gray.400',
                      fontSize: '0.75rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                      _hover: {
                        color: isDark ? 'gray.400' : 'gray.500',
                      },
                    })}
                  >
                    really?
                  </button>
                </>
              )}
            </p>

            {/* Collapsible stats visualization */}
            {showStats && (
              <div
                className={css({
                  position: 'relative',
                  padding: '0.75rem',
                  backgroundColor: isDark ? 'gray.700/50' : 'gray.100',
                  borderRadius: '8px',
                  marginTop: '0.5rem',
                })}
              >
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setShowStats(false)}
                  className={css({
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: isDark ? 'gray.500' : 'gray.400',
                    fontSize: '0.875rem',
                    lineHeight: 1,
                    borderRadius: '4px',
                    _hover: {
                      color: isDark ? 'gray.400' : 'gray.500',
                      backgroundColor: isDark ? 'gray.600' : 'gray.200',
                    },
                  })}
                  aria-label="Close stats"
                >
                  ×
                </button>
                <SpeedMeter
                  meanMs={stats.meanMs}
                  stdDevMs={stats.stdDevMs}
                  thresholdMs={stats.thresholdMs}
                  isDark={isDark}
                />
                <p
                  className={css({
                    fontSize: '0.6875rem',
                    color: isDark ? 'gray.500' : 'gray.400',
                    marginTop: '0.5rem',
                    textAlign: 'center',
                  })}
                >
                  The blue bar shows your usual range.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Teacher pause message - shown when teacher pauses the session */}
        {isTeacherPause && (
          <div
            data-element="teacher-pause-message"
            className={css({
              width: '100%',
              padding: '1rem',
              backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
              borderRadius: '12px',
              border: '2px solid',
              borderColor: isDark ? 'blue.700' : 'blue.200',
            })}
          >
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'blue.200' : 'blue.700',
                textAlign: 'center',
                fontWeight: 'medium',
              })}
            >
              {pauseInfo?.teacherMessage ||
                'Your teacher paused the session. Please wait for them to resume.'}
            </p>
          </div>
        )}

        {/* Progress summary - celebratory */}
        <div
          className={css({
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            borderRadius: '12px',
          })}
        >
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            })}
          >
            <span
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              Progress
            </span>
            <span
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: isDark ? 'green.300' : 'green.600',
              })}
            >
              {completedProblems} of {totalProblems} done!
            </span>
          </div>

          {/* Progress bar with sparkle */}
          <div
            data-element="progress-bar"
            style={{
              position: 'relative',
              width: '100%',
              height: '12px',
              backgroundColor: isDark ? '#4b5563' : '#d1d5db',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: isDark
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, #16a34a, #22c55e)',
                borderRadius: '6px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Current part indicator */}
          {currentPart && (
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.500',
                marginTop: '0.5rem',
                textAlign: 'center',
              })}
            >
              {getPartTypeEmoji(currentPart.type)} {getPartTypeLabel(currentPart.type)}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: '100%',
          })}
        >
          <button
            type="button"
            data-action="resume"
            onClick={isTeacherPause ? undefined : onResume}
            disabled={isTeacherPause}
            style={{
              padding: '1.25rem',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#ffffff',
              background: isTeacherPause
                ? 'linear-gradient(135deg, #6b7280, #4b5563)'
                : 'linear-gradient(135deg, #22c55e, #16a34a)',
              borderRadius: '16px',
              border: isTeacherPause ? '3px solid #374151' : '3px solid #15803d',
              cursor: isTeacherPause ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              boxShadow: isTeacherPause
                ? '0 6px 20px rgba(75, 85, 99, 0.3)'
                : '0 6px 20px rgba(22, 163, 74, 0.5)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              width: '100%',
              opacity: isTeacherPause ? 0.7 : 1,
            }}
          >
            <span>{isTeacherPause ? '⏳ Waiting for teacher...' : '▶️ Keep Going!'}</span>
          </button>

          <button
            type="button"
            data-action="end-session"
            onClick={onEndSession}
            className={css({
              padding: '0.5rem',
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.400',
              backgroundColor: 'transparent',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              _hover: {
                color: isDark ? 'gray.400' : 'gray.500',
              },
            })}
          >
            <span className={css({ fontSize: '0.875rem' })}>🛑</span>
            <span>end session</span>
          </button>
        </div>
      </div>
    </div>
  )
}
