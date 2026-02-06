'use client'

import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useMemo, useState } from 'react'
import {
  calculateEstimatedTimeRemainingMs,
  formatEstimatedTimeRemaining,
  type TimingStats,
} from '@/hooks/useSessionTimeEstimate'
import { css } from '../../../styled-system/css'
import { useIsTouchDevice } from './hooks/useDeviceDetection'
import { SpeedMeter } from './SpeedMeter'

export interface SessionMoodIndicatorProps {
  /** Current elapsed time on this problem in ms */
  currentElapsedMs: number
  /** Mean response time for this part type */
  meanMs: number
  /** Standard deviation of response times */
  stdDevMs: number
  /** Threshold for "too slow" */
  thresholdMs: number
  /** Whether we have enough data for stats */
  hasEnoughData: boolean
  /** Number of problems remaining */
  problemsRemaining: number
  /** Total problems in session */
  totalProblems: number
  /** Recent results for accuracy display (last N) */
  recentResults: boolean[]
  /** Overall accuracy (0-1) */
  accuracy: number
  /** Session health status */
  healthStatus: 'good' | 'warning' | 'struggling'
  /** Is session paused */
  isPaused: boolean
  /** Dark mode */
  isDark: boolean
}

/**
 * Calculate current streak from results
 */
function calculateStreak(results: boolean[]): number {
  let streak = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i]) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * Get streak message based on length
 */
function getStreakMessage(streak: number): { text: string; fires: string } {
  if (streak >= 10) return { text: 'LEGENDARY!', fires: '🔥🔥🔥🔥' }
  if (streak >= 7) return { text: 'Unstoppable!', fires: '🔥🔥🔥' }
  if (streak >= 5) return { text: "You're on fire!", fires: '🔥🔥' }
  if (streak >= 3) return { text: 'Nice streak!', fires: '🔥' }
  return { text: '', fires: '' }
}

/**
 * Determine the mood based on current state
 */
function getMood(props: SessionMoodIndicatorProps): {
  emoji: string
  label: string
  description: string
} {
  const {
    currentElapsedMs,
    meanMs,
    stdDevMs,
    hasEnoughData,
    healthStatus,
    isPaused,
    recentResults,
  } = props

  // Check for streak
  const streak = calculateStreak(recentResults)
  const lastFiveCorrect = recentResults.slice(-5)
  const recentAccuracy =
    lastFiveCorrect.length > 0 ? lastFiveCorrect.filter(Boolean).length / lastFiveCorrect.length : 1

  // Paused state
  if (isPaused) {
    return {
      emoji: '⏸️',
      label: 'Paused',
      description: "Taking a break - that's fine!",
    }
  }

  // Calculate how slow they are on current problem
  const slowThreshold = hasEnoughData ? meanMs + stdDevMs : 15000
  const verySlowThreshold = hasEnoughData ? meanMs + 2 * stdDevMs : 30000
  const isSlowOnCurrent = currentElapsedMs > slowThreshold
  const isVerySlowOnCurrent = currentElapsedMs > verySlowThreshold

  // Very stuck
  if (isVerySlowOnCurrent) {
    return {
      emoji: '🤔',
      label: 'Thinking hard',
      description: "This one's tricky! Take your time.",
    }
  }

  // On fire - fast and accurate with streak
  if (streak >= 3 && healthStatus === 'good' && !isSlowOnCurrent) {
    return {
      emoji: '🔥',
      label: 'On fire!',
      description: "You're crushing it!",
    }
  }

  // Good overall
  if (healthStatus === 'good' && !isSlowOnCurrent) {
    return {
      emoji: '😊',
      label: 'Cruising',
      description: "You're doing great!",
    }
  }

  // Bit slow but accurate
  if (isSlowOnCurrent && recentAccuracy >= 0.7) {
    return {
      emoji: '🐢',
      label: 'Slow and steady',
      description: 'Taking your time - accuracy is good!',
    }
  }

  // Warning - some mistakes or slow
  if (healthStatus === 'warning') {
    return {
      emoji: '😌',
      label: 'Hanging in there',
      description: 'Keep going, you got this!',
    }
  }

  // Struggling
  if (healthStatus === 'struggling') {
    return {
      emoji: '💪',
      label: 'Tough stretch',
      description: "It's hard right now, but you're learning!",
    }
  }

  // Default
  return {
    emoji: '😊',
    label: 'Doing well',
    description: 'Keep it up!',
  }
}

/**
 * Format milliseconds as kid-friendly time
 */
function formatTimeKid(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes >= 1) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

// formatEstimatedTimeRemaining is imported from useSessionTimeEstimate

// Animation names (defined in GlobalStyles below)
const ANIM = {
  pulse: 'streak-pulse',
  glow: 'streak-glow',
  shake: 'streak-shake',
  rainbow: 'streak-rainbow',
}

/**
 * Global styles for streak animations
 * Injected once into the document
 */
function GlobalStreakStyles() {
  return (
    <style>{`
      @keyframes ${ANIM.pulse} {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      @keyframes ${ANIM.glow} {
        0%, 100% { box-shadow: 0 0 5px rgba(251, 146, 60, 0.5); }
        50% { box-shadow: 0 0 20px rgba(251, 146, 60, 0.8), 0 0 30px rgba(251, 146, 60, 0.4); }
      }
      @keyframes ${ANIM.shake} {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        25% { transform: translateX(-2px) rotate(-2deg); }
        75% { transform: translateX(2px) rotate(2deg); }
      }
      @keyframes ${ANIM.rainbow} {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
    `}</style>
  )
}

/**
 * Streak Display Component with animations
 */
function StreakDisplay({ streak, isDark }: { streak: number; isDark: boolean }) {
  if (streak < 2) return null

  const { text, fires } = getStreakMessage(streak)

  // Animation intensity based on streak
  const animationDuration = Math.max(0.3, 1 - streak * 0.08) // Faster as streak grows
  const isLegendary = streak >= 10
  const isUnstoppable = streak >= 7
  const isOnFire = streak >= 5

  return (
    <div
      data-element="streak-display"
      data-streak={streak}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        marginTop: '0.5rem',
        borderRadius: '8px',
        backgroundColor: isDark ? 'orange.900' : 'orange.50',
        border: '2px solid',
        borderColor: isDark ? 'orange.700' : 'orange.200',
      })}
      style={{
        animation: isLegendary
          ? `${ANIM.glow} ${animationDuration}s ease-in-out infinite, ${ANIM.shake} ${animationDuration * 0.5}s ease-in-out infinite`
          : isOnFire
            ? `${ANIM.glow} ${animationDuration}s ease-in-out infinite`
            : undefined,
      }}
    >
      {/* Fire emojis with animation */}
      <span
        className={css({
          fontSize: isLegendary ? '1.5rem' : isUnstoppable ? '1.25rem' : '1rem',
        })}
        style={{
          animation:
            streak >= 3 ? `${ANIM.pulse} ${animationDuration}s ease-in-out infinite` : undefined,
        }}
      >
        <span
          style={{
            animation: isLegendary ? `${ANIM.rainbow} 2s linear infinite` : undefined,
            display: 'inline-block',
          }}
        >
          {fires}
        </span>
      </span>

      {/* Streak count and message */}
      <div className={css({ textAlign: 'center' })}>
        <div
          className={css({
            fontSize: isLegendary ? '1.25rem' : '1rem',
            fontWeight: 'bold',
            color: isDark ? 'orange.300' : 'orange.600',
          })}
          style={{
            animation: isUnstoppable
              ? `${ANIM.pulse} ${animationDuration}s ease-in-out infinite`
              : undefined,
          }}
        >
          {streak} in a row!
        </div>
        {text && (
          <div
            className={css({
              fontSize: '0.75rem',
              fontWeight: '600',
              color: isDark ? 'orange.400' : 'orange.500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            })}
          >
            {text}
          </div>
        )}
      </div>

      {/* Fire emojis on the right too for symmetry on big streaks */}
      {isOnFire && (
        <span
          className={css({
            fontSize: isLegendary ? '1.5rem' : isUnstoppable ? '1.25rem' : '1rem',
          })}
          style={{
            animation: `${ANIM.pulse} ${animationDuration}s ease-in-out infinite`,
            animationDelay: `${animationDuration / 2}s`,
          }}
        >
          <span
            style={{
              animation: isLegendary ? `${ANIM.rainbow} 2s linear infinite` : undefined,
              animationDelay: '1s',
              display: 'inline-block',
            }}
          >
            {fires}
          </span>
        </span>
      )}
    </div>
  )
}

/**
 * The tooltip/popover content
 */
function MoodContent({
  props,
  mood,
  streak,
  lastFive,
  correctCount,
  estimatedTimeMs,
}: {
  props: SessionMoodIndicatorProps
  mood: { emoji: string; label: string; description: string }
  streak: number
  lastFive: boolean[]
  correctCount: number
  estimatedTimeMs: number
}) {
  const { currentElapsedMs, meanMs, stdDevMs, thresholdMs, hasEnoughData, isDark } = props

  return (
    <div
      className={css({
        padding: '1rem',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        boxShadow: 'lg',
        minWidth: '280px',
        maxWidth: '320px',
      })}
    >
      {/* Header with mood */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <span className={css({ fontSize: '2.5rem' })}>{mood.emoji}</span>
        <div>
          <div
            className={css({
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {mood.label}
          </div>
          <div
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {mood.description}
          </div>
        </div>
      </div>

      {/* Time Remaining */}
      <div
        data-section="time-remaining"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          borderRadius: '8px',
        })}
      >
        <div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.500',
              marginBottom: '0.125rem',
            })}
          >
            Time left
          </div>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {formatEstimatedTimeRemaining(estimatedTimeMs)}
          </div>
        </div>
        <div
          className={css({
            fontSize: '2rem',
            opacity: 0.5,
          })}
        >
          ⏰
        </div>
      </div>

      {/* Current Problem Speed */}
      <div
        data-section="current-speed"
        className={css({
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          borderRadius: '8px',
        })}
      >
        <div
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.500' : 'gray.500',
            marginBottom: '0.5rem',
          })}
        >
          This problem
        </div>

        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          })}
        >
          <span
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {formatTimeKid(currentElapsedMs)}
          </span>
          {hasEnoughData && (
            <span
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              (you usually take ~{formatTimeKid(meanMs)})
            </span>
          )}
        </div>

        {/* Speed Meter */}
        {hasEnoughData && (
          <SpeedMeter
            meanMs={meanMs}
            stdDevMs={stdDevMs}
            thresholdMs={thresholdMs}
            currentTimeMs={currentElapsedMs}
            isDark={isDark}
            compact={false}
          />
        )}
      </div>

      {/* Accuracy - Last 5 with Streak */}
      <div
        data-section="accuracy"
        className={css({
          padding: '0.75rem',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          borderRadius: '8px',
        })}
      >
        <div
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.500' : 'gray.500',
            marginBottom: '0.5rem',
          })}
        >
          Last 5 answers
        </div>

        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          })}
        >
          {/* Dots for last 5 */}
          <div
            className={css({
              display: 'flex',
              gap: '0.375rem',
            })}
          >
            {lastFive.length === 0 ? (
              <span
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontStyle: 'italic',
                })}
              >
                No answers yet
              </span>
            ) : (
              lastFive.map((correct, i) => {
                // Is this dot part of the current streak?
                const isInStreak =
                  correct && i >= lastFive.length - Math.min(streak, lastFive.length)
                const streakPosition = isInStreak ? lastFive.length - i : 0

                return (
                  <span
                    key={i}
                    className={css({
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      backgroundColor: correct
                        ? isDark
                          ? 'green.900'
                          : 'green.100'
                        : isDark
                          ? 'red.900'
                          : 'red.100',
                      color: correct
                        ? isDark
                          ? 'green.300'
                          : 'green.700'
                        : isDark
                          ? 'red.300'
                          : 'red.700',
                      border: '2px solid',
                      borderColor: correct
                        ? isDark
                          ? 'green.700'
                          : 'green.300'
                        : isDark
                          ? 'red.700'
                          : 'red.300',
                      transition: 'all 0.2s ease',
                    })}
                    style={
                      isInStreak && streak >= 3
                        ? {
                            animation: `${ANIM.pulse} ${Math.max(0.4, 0.8 - streakPosition * 0.1)}s ease-in-out infinite`,
                            animationDelay: `${streakPosition * 0.1}s`,
                            boxShadow:
                              streak >= 5
                                ? '0 0 8px rgba(34, 197, 94, 0.6)'
                                : '0 0 4px rgba(34, 197, 94, 0.4)',
                          }
                        : undefined
                    }
                  >
                    {correct ? '✓' : '✗'}
                  </span>
                )
              })
            )}
          </div>

          {/* Count */}
          {lastFive.length > 0 && (
            <span
              className={css({
                fontSize: '0.875rem',
                fontWeight: '600',
                color:
                  correctCount >= 4
                    ? isDark
                      ? 'green.400'
                      : 'green.600'
                    : correctCount >= 2
                      ? isDark
                        ? 'yellow.400'
                        : 'yellow.600'
                      : isDark
                        ? 'red.400'
                        : 'red.600',
              })}
            >
              {correctCount} right!
            </span>
          )}
        </div>

        {/* Streak Display */}
        <StreakDisplay streak={streak} isDark={isDark} />
      </div>
    </div>
  )
}

/**
 * Session Mood Indicator
 *
 * A big emoji that synthesizes speed + accuracy into an at-a-glance mood.
 * Tooltip (desktop) or Popover (touch) reveals the detailed data in a kid-friendly layout.
 */
export function SessionMoodIndicator(props: SessionMoodIndicatorProps) {
  const { problemsRemaining, recentResults, isDark, meanMs, stdDevMs, thresholdMs, hasEnoughData } =
    props

  const isTouchDevice = useIsTouchDevice()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const mood = getMood(props)

  // Use shared time estimation function
  const timingStats: TimingStats = {
    mean: meanMs,
    stdDev: stdDevMs,
    count: hasEnoughData ? 5 : 0, // We don't have exact count, but hasEnoughData tells us if >= 5
    hasEnoughData,
    threshold: thresholdMs,
  }
  const estimatedTimeMs = calculateEstimatedTimeRemainingMs(timingStats, problemsRemaining)

  // Calculate streak
  const streak = useMemo(() => calculateStreak(recentResults), [recentResults])

  // Last 5 results for dot display
  const lastFive = recentResults.slice(-5)
  const correctCount = lastFive.filter(Boolean).length

  // Trigger button styles
  const triggerClassName = css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: isDark ? 'gray.800' : 'gray.100',
    borderRadius: '12px',
    border: '2px solid',
    borderColor: isDark ? 'gray.700' : 'gray.200',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    _hover: {
      backgroundColor: isDark ? 'gray.700' : 'gray.200',
      borderColor: isDark ? 'gray.600' : 'gray.300',
      transform: 'scale(1.02)',
    },
  })

  // Animation for streak on the main button
  const buttonAnimation =
    streak >= 10
      ? `${ANIM.glow} 0.5s ease-in-out infinite`
      : streak >= 5
        ? `${ANIM.glow} 0.8s ease-in-out infinite`
        : undefined

  const TriggerButton = (
    <button
      type="button"
      data-element="session-mood-indicator"
      data-streak={streak}
      className={triggerClassName}
      style={{
        animation: buttonAnimation,
        borderColor: streak >= 5 ? (isDark ? 'orange.600' : 'orange.300') : undefined,
      }}
    >
      {/* Big emoji */}
      <span
        className={css({
          fontSize: '2rem',
          lineHeight: 1,
        })}
        style={{
          animation:
            streak >= 3
              ? `${ANIM.pulse} ${Math.max(0.5, 1 - streak * 0.05)}s ease-in-out infinite`
              : undefined,
        }}
      >
        {mood.emoji}
      </span>

      {/* Problems left + time estimate + streak indicator */}
      <span
        className={css({
          fontSize: '0.75rem',
          fontWeight: '600',
          color: isDark ? 'gray.300' : 'gray.600',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        })}
      >
        {problemsRemaining} left · ~{Math.max(1, Math.round(estimatedTimeMs / 60000))}m
        {streak >= 3 && (
          <span
            style={{
              animation: `${ANIM.pulse} ${Math.max(0.4, 0.8 - streak * 0.05)}s ease-in-out infinite`,
            }}
          >
            🔥
          </span>
        )}
      </span>
    </button>
  )

  const contentProps = {
    props,
    mood,
    streak,
    lastFive,
    correctCount,
    estimatedTimeMs,
  }

  // Use Popover for touch devices, Tooltip for desktop
  if (isTouchDevice) {
    return (
      <>
        <GlobalStreakStyles />
        <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Popover.Trigger asChild>{TriggerButton}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              sideOffset={8}
              className={css({ zIndex: 1000, outline: 'none' })}
            >
              <MoodContent {...contentProps} />
              <Popover.Arrow
                className={css({
                  fill: isDark ? 'gray.800' : 'white',
                })}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </>
    )
  }

  return (
    <>
      <GlobalStreakStyles />
      <Tooltip.Provider delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{TriggerButton}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="bottom" sideOffset={8} className={css({ zIndex: 1000 })}>
              <MoodContent {...contentProps} />
              <Tooltip.Arrow
                className={css({
                  fill: isDark ? 'gray.800' : 'white',
                })}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </>
  )
}
