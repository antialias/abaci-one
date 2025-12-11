'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPart, SessionPlan } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'

/**
 * Statistics about response times used for auto-pause threshold
 */
export interface AutoPauseStats {
  /** Mean response time in milliseconds */
  meanMs: number
  /** Standard deviation of response times in milliseconds */
  stdDevMs: number
  /** Calculated threshold (mean + 2*stdDev) in milliseconds */
  thresholdMs: number
  /** Number of samples used to calculate stats */
  sampleCount: number
  /** Whether statistical calculation was used (vs default timeout) */
  usedStatistics: boolean
}

/**
 * Information about why and when the session was paused
 */
export interface PauseInfo {
  /** When the pause occurred */
  pausedAt: Date
  /** Why the session was paused */
  reason: 'manual' | 'auto-timeout'
  /** Auto-pause statistics (only present for auto-timeout) */
  autoPauseStats?: AutoPauseStats
}

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

// Fun phrases for auto-pause
const AUTO_PAUSE_PHRASES = [
  "This one's a thinker!",
  'Taking your time? Smart!',
  'Deep thoughts happening...',
  'Brain at work!',
  'No rush!',
  'Thinking cap on!',
  'Processing...',
  'Working it out!',
  'Press paws! 🙏',
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

/**
 * Speed visualization - shows average speed vs variation
 */
function SpeedMeter({
  meanMs,
  stdDevMs,
  thresholdMs,
  isDark,
}: {
  meanMs: number
  stdDevMs: number
  thresholdMs: number
  isDark: boolean
}) {
  // Normalize values for display (0-100 scale based on threshold)
  const meanPercent = Math.min(100, (meanMs / thresholdMs) * 100)
  const variationPercent = Math.min(50, (stdDevMs / thresholdMs) * 100)

  return (
    <div
      data-element="speed-meter"
      className={css({
        width: '100%',
        padding: '0.75rem',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '8px',
      })}
    >
      {/* Speed bar container */}
      <div
        className={css({
          position: 'relative',
          height: '24px',
          backgroundColor: isDark ? 'gray.700' : 'gray.200',
          borderRadius: '12px',
          overflow: 'visible',
        })}
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
          className={css({
            position: 'absolute',
            top: '-4px',
            width: '8px',
            height: '32px',
            backgroundColor: isDark ? 'blue.400' : 'blue.500',
            borderRadius: '4px',
            transition: 'all 0.5s ease',
            zIndex: 1,
          })}
          style={{
            left: `calc(${meanPercent}% - 4px)`,
          }}
        />

        {/* Threshold marker */}
        <div
          className={css({
            position: 'absolute',
            top: '0',
            width: '3px',
            height: '100%',
            backgroundColor: isDark ? 'yellow.500' : 'yellow.600',
            borderRadius: '2px',
          })}
          style={{
            left: 'calc(100% - 2px)',
          }}
        />
      </div>

      {/* Labels */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.5rem',
          fontSize: '0.6875rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        <span>Fast</span>
        <span
          className={css({
            color: isDark ? 'blue.300' : 'blue.600',
            fontWeight: 'bold',
          })}
        >
          Your usual speed
        </span>
        <span>Pause</span>
      </div>
    </div>
  )
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
  const autoPausePhrase = useMemo(
    () => AUTO_PAUSE_PHRASES[Math.floor(Math.random() * AUTO_PAUSE_PHRASES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pauseInfo?.pausedAt?.getTime()]
  )

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
              <span>{isAutoTimeout ? '🤔' : '☕'}</span>
              <span>{isAutoTimeout ? autoPausePhrase : 'Break Time!'}</span>
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
            className={css({
              position: 'relative',
              width: '100%',
              height: '12px',
              backgroundColor: isDark ? 'gray.600' : 'gray.300',
              borderRadius: '6px',
              overflow: 'hidden',
            })}
          >
            <div
              className={css({
                height: '100%',
                background: isDark
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, #16a34a, #22c55e)',
                borderRadius: '6px',
                transition: 'width 0.3s ease',
              })}
              style={{ width: `${progressPercent}%` }}
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
            onClick={onResume}
            style={{
              padding: '1.25rem',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              borderRadius: '16px',
              border: '3px solid #15803d',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              boxShadow: '0 6px 20px rgba(22, 163, 74, 0.5)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              width: '100%',
            }}
          >
            <span>▶️ Keep Going!</span>
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
