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

/**
 * Format milliseconds as a human-readable duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

/**
 * Format milliseconds as seconds with one decimal place
 */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
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
 * A unified modal shown when:
 * 1. User pauses an active session (via the HUD controls)
 * 2. User navigates back to a paused session
 *
 * Shows progress info and options to resume or end the session.
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

  // Format pause time
  const pauseTimeStr = pauseInfo?.pausedAt
    ? pauseInfo.pausedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

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
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      })}
      onClick={(e) => {
        // Don't close on backdrop click - must use buttons
        e.stopPropagation()
      }}
    >
      <div
        data-element="modal-content"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Paused indicator */}
        <div
          className={css({
            fontSize: '3rem',
          })}
        >
          ⏸️
        </div>

        {/* Avatar and greeting */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexDirection: 'column',
          })}
        >
          <div
            data-element="student-avatar"
            className={css({
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            })}
            style={{ backgroundColor: student.color }}
          >
            {student.emoji}
          </div>
          <h2
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              textAlign: 'center',
            })}
          >
            Session Paused
          </h2>
          <p
            className={css({
              fontSize: '0.9375rem',
              color: isDark ? 'gray.400' : 'gray.600',
              textAlign: 'center',
            })}
          >
            Take a break, {student.name}! Tap Resume when ready.
          </p>
        </div>

        {/* Pause details */}
        {pauseInfo && (
          <div
            data-element="pause-details"
            className={css({
              width: '100%',
              padding: '1rem',
              backgroundColor: isDark ? 'gray.700' : 'gray.100',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            {/* Pause timing */}
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              })}
            >
              <span
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                Paused at {pauseTimeStr}
              </span>
              <span
                className={css({
                  fontSize: '0.9375rem',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: isDark ? 'blue.300' : 'blue.600',
                })}
              >
                {formatDuration(pauseDuration)}
              </span>
            </div>

            {/* Auto-pause reason */}
            {pauseInfo.reason === 'auto-timeout' && (
              <div
                data-element="auto-pause-reason"
                className={css({
                  padding: '0.75rem',
                  backgroundColor: isDark ? 'yellow.900' : 'yellow.50',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'yellow.700' : 'yellow.200',
                })}
              >
                <p
                  className={css({
                    fontSize: '0.8125rem',
                    fontWeight: 'bold',
                    color: isDark ? 'yellow.300' : 'yellow.700',
                    marginBottom: '0.5rem',
                  })}
                >
                  Auto-paused: Taking longer than usual
                </p>
                {pauseInfo.autoPauseStats && (
                  <div
                    className={css({
                      fontSize: '0.75rem',
                      color: isDark ? 'gray.300' : 'gray.600',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    })}
                  >
                    {pauseInfo.autoPauseStats.usedStatistics ? (
                      <>
                        <p>
                          Based on {pauseInfo.autoPauseStats.sampleCount} problems: avg{' '}
                          {formatSeconds(pauseInfo.autoPauseStats.meanMs)} ±{' '}
                          {formatSeconds(pauseInfo.autoPauseStats.stdDevMs)}
                        </p>
                        <p>
                          Timeout threshold: {formatSeconds(pauseInfo.autoPauseStats.thresholdMs)}{' '}
                          (avg + 2×std dev)
                        </p>
                      </>
                    ) : (
                      <p>
                        Using default {formatSeconds(pauseInfo.autoPauseStats.thresholdMs)} timeout
                        (need {5 - pauseInfo.autoPauseStats.sampleCount} more problems for
                        personalized timing)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Manual pause */}
            {pauseInfo.reason === 'manual' && (
              <p
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                  fontStyle: 'italic',
                })}
              >
                Session paused manually
              </p>
            )}
          </div>
        )}

        {/* Progress summary */}
        <div className={css({ width: '100%', textAlign: 'center' })}>
          <p
            className={css({
              fontSize: '1rem',
              color: isDark ? 'gray.300' : 'gray.600',
              marginBottom: '0.75rem',
            })}
          >
            Problem <strong>{completedProblems + 1}</strong> of <strong>{totalProblems}</strong>
          </p>

          {/* Progress bar */}
          <div
            data-element="progress-bar"
            className={css({
              width: '100%',
              height: '10px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              borderRadius: '5px',
              overflow: 'hidden',
              marginBottom: '0.75rem',
            })}
          >
            <div
              className={css({
                height: '100%',
                backgroundColor: isDark ? 'green.400' : 'green.500',
                borderRadius: '5px',
                transition: 'width 0.3s ease',
              })}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Current part indicator */}
          {currentPart && (
            <p
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              {getPartTypeEmoji(currentPart.type)} Part {session.currentPartIndex + 1}:{' '}
              {getPartTypeLabel(currentPart.type)}
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
            marginTop: '0.5rem',
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
              backgroundColor: 'green.500',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: 'green.400',
                transform: 'translateY(-1px)',
              },
              _active: {
                transform: 'translateY(0)',
              },
            })}
          >
            <span>▶</span>
            <span>Resume</span>
          </button>

          <button
            type="button"
            data-action="end-session"
            onClick={onEndSession}
            className={css({
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: isDark ? 'gray.300' : 'gray.600',
              backgroundColor: 'transparent',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                borderColor: isDark ? 'red.700' : 'red.300',
                color: isDark ? 'red.300' : 'red.600',
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
