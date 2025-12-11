'use client'

import { useEffect, useState } from 'react'
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
 * Sample dots visualization - shows the problems used to learn the rhythm
 */
function SampleDots({ count, needed, isDark }: { count: number; needed: number; isDark: boolean }) {
  const total = Math.max(count, needed)
  const dots = []

  for (let i = 0; i < total; i++) {
    const isFilled = i < count
    dots.push(
      <div
        key={i}
        className={css({
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: isFilled
            ? isDark
              ? 'green.400'
              : 'green.500'
            : isDark
              ? 'gray.600'
              : 'gray.300',
          transition: 'all 0.3s ease',
        })}
        title={isFilled ? `Problem ${i + 1}` : 'Not yet solved'}
      />
    )
  }

  return (
    <div
      data-element="sample-dots"
      className={css({
        display: 'flex',
        gap: '6px',
        justifyContent: 'center',
        flexWrap: 'wrap',
      })}
    >
      {dots}
    </div>
  )
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
        {/* Hero section with avatar */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          })}
        >
          {/* Thinking character */}
          <div
            className={css({
              position: 'relative',
            })}
          >
            <div
              data-element="student-avatar"
              className={css({
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              })}
              style={{ backgroundColor: student.color }}
            >
              {student.emoji}
            </div>
            {/* Thought bubble */}
            <div
              className={css({
                position: 'absolute',
                top: '-8px',
                right: '-12px',
                fontSize: '1.5rem',
              })}
            >
              {isAutoTimeout ? '🤔' : '☕'}
            </div>
          </div>

          {/* Greeting - contextual based on reason */}
          <div className={css({ textAlign: 'center' })}>
            <h2
              className={css({
                fontSize: '1.375rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.800',
                marginBottom: '0.25rem',
              })}
            >
              {isAutoTimeout ? 'Taking a Thinking Break!' : 'Break Time!'}
            </h2>
            <p
              className={css({
                fontSize: '0.9375rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {isAutoTimeout
                ? `This one's a thinker, ${student.name}!`
                : `Nice pause, ${student.name}!`}
            </p>
          </div>
        </div>

        {/* Break timer - make it feel positive */}
        {pauseInfo && (
          <div
            data-element="break-timer"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: isDark ? 'gray.700' : 'gray.100',
              borderRadius: '20px',
            })}
          >
            <span className={css({ fontSize: '1rem' })}>⏱️</span>
            <span
              className={css({
                fontSize: '0.9375rem',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              Resting for{' '}
              <strong
                className={css({
                  color: isDark ? 'blue.300' : 'blue.600',
                  fontFamily: 'monospace',
                })}
              >
                {formatDurationFriendly(pauseDuration)}
              </strong>
            </span>
          </div>
        )}

        {/* Auto-pause explanation - educational and friendly */}
        {isAutoTimeout && stats && (
          <div
            data-element="rhythm-explanation"
            className={css({
              width: '100%',
              padding: '1rem',
              backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'blue.700' : 'blue.200',
            })}
          >
            {stats.usedStatistics ? (
              <>
                {/* We know their rhythm */}
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  })}
                >
                  <span className={css({ fontSize: '1.25rem' })}>🎵</span>
                  <span
                    className={css({
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: isDark ? 'blue.200' : 'blue.700',
                    })}
                  >
                    We Know Your Rhythm!
                  </span>
                </div>

                <p
                  className={css({
                    fontSize: '0.8125rem',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '0.75rem',
                    lineHeight: '1.5',
                  })}
                >
                  We watched you solve{' '}
                  <strong className={css({ color: isDark ? 'green.300' : 'green.600' })}>
                    {stats.sampleCount} problems
                  </strong>{' '}
                  and learned your speed! Usually you take{' '}
                  <strong className={css({ color: isDark ? 'blue.300' : 'blue.600' })}>
                    {formatSecondsFriendly(stats.meanMs)}
                  </strong>
                  .
                </p>

                {/* Speed visualization */}
                <SpeedMeter
                  meanMs={stats.meanMs}
                  stdDevMs={stats.stdDevMs}
                  thresholdMs={stats.thresholdMs}
                  isDark={isDark}
                />

                <p
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    marginTop: '0.75rem',
                    fontStyle: 'italic',
                  })}
                >
                  The blue bar shows your usual range. This problem took longer, so we paused to
                  check in!
                </p>
              </>
            ) : (
              <>
                {/* Still learning their rhythm */}
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  })}
                >
                  <span className={css({ fontSize: '1.25rem' })}>📊</span>
                  <span
                    className={css({
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: isDark ? 'blue.200' : 'blue.700',
                    })}
                  >
                    Learning Your Rhythm...
                  </span>
                </div>

                <p
                  className={css({
                    fontSize: '0.8125rem',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '0.75rem',
                    lineHeight: '1.5',
                  })}
                >
                  We need to watch you solve a few problems to learn how fast you usually go!
                </p>

                {/* Sample dots showing progress */}
                <div className={css({ marginBottom: '0.75rem' })}>
                  <p
                    className={css({
                      fontSize: '0.75rem',
                      color: isDark ? 'gray.400' : 'gray.500',
                      marginBottom: '0.5rem',
                      textAlign: 'center',
                    })}
                  >
                    Problems solved: {stats.sampleCount} of 5 needed
                  </p>
                  <SampleDots count={stats.sampleCount} needed={5} isDark={isDark} />
                </div>

                <p
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'yellow.300' : 'yellow.700',
                    textAlign: 'center',
                    fontWeight: '500',
                  })}
                >
                  {5 - stats.sampleCount} more problem{5 - stats.sampleCount !== 1 ? 's' : ''} until
                  we know your rhythm!
                </p>
              </>
            )}
          </div>
        )}

        {/* Manual pause - simple and encouraging */}
        {pauseInfo?.reason === 'manual' && (
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: isDark ? 'green.900/50' : 'green.50',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'green.700' : 'green.200',
            })}
          >
            <span className={css({ fontSize: '1.25rem' })}>✨</span>
            <p
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'green.200' : 'green.700',
              })}
            >
              Smart thinking to take a break when you need one!
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
            gap: '0.5rem',
            width: '100%',
          })}
        >
          <button
            type="button"
            data-action="resume"
            onClick={onResume}
            className={css({
              padding: '1rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'white',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              _hover: {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(34, 197, 94, 0.4)',
              },
              _active: {
                transform: 'translateY(0)',
              },
            })}
          >
            <span>▶️</span>
            <span>Keep Going!</span>
          </button>

          <button
            type="button"
            data-action="end-session"
            onClick={onEndSession}
            className={css({
              padding: '0.625rem',
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.500',
              backgroundColor: 'transparent',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: {
                color: isDark ? 'red.300' : 'red.600',
                backgroundColor: isDark ? 'red.900/30' : 'red.50',
              },
            })}
          >
            End Session Early
          </button>
        </div>
      </div>
    </div>
  )
}
