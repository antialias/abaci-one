'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { SessionMoodIndicator } from './SessionMoodIndicator'
import { SessionProgressIndicator } from './SessionProgressIndicator'

/**
 * Timing data for the current problem attempt
 */
export interface TimingData {
  /** When the current attempt started */
  startTime: number
  /** Accumulated pause time in ms */
  accumulatedPauseMs: number
  /** Session results so far (for calculating averages) */
  results: SlotResult[]
  /** Session parts (to map result partNumber to part type) */
  parts: SessionPart[]
}

/**
 * Session HUD data for active practice sessions
 */
export interface SessionHudData {
  /** Is the session currently paused? */
  isPaused: boolean
  /** All session parts */
  parts: SessionPart[]
  /** Current part index */
  currentPartIndex: number
  /** Current part info */
  currentPart: {
    type: 'abacus' | 'visualization' | 'linear'
    partNumber: number
    totalSlots: number
  }
  /** Current slot index within the part */
  currentSlotIndex: number
  /** All results so far */
  results: SlotResult[]
  /** Total problems completed so far */
  completedProblems: number
  /** Total problems in session */
  totalProblems: number
  /** Session health info */
  sessionHealth?: {
    overall: 'good' | 'warning' | 'struggling'
    accuracy: number
  }
  /** Timing data for current problem (optional) */
  timing?: TimingData
  /** Whether browse mode is active */
  isBrowseMode: boolean
  /** Callbacks for transport controls */
  onPause: () => void
  onResume: () => void
  onEndEarly: () => void
  onToggleBrowse: () => void
  /** Navigate to specific problem in browse mode */
  onBrowseNavigate?: (linearIndex: number) => void
}

interface PracticeSubNavProps {
  /** Student info for the nav */
  student: {
    id: string
    name: string
    emoji: string
    color: string
  }
  /** Current page context (shown as subtle label) */
  pageContext?: 'dashboard' | 'configure' | 'session' | 'summary' | 'resume' | 'placement-test'
  /** Session HUD data (shown when in active session) */
  sessionHud?: SessionHudData
  /** Callback when "Start Practice" button is clicked (shown on dashboard) */
  onStartPractice?: () => void
}

// Minimum samples needed for statistical display
const MIN_SAMPLES_FOR_STATS = 3

/**
 * Calculate mean and standard deviation of response times
 */
function calculateStats(times: number[]): {
  mean: number
  stdDev: number
  count: number
} {
  if (times.length === 0) {
    return { mean: 0, stdDev: 0, count: 0 }
  }

  const count = times.length
  const mean = times.reduce((sum, t) => sum + t, 0) / count

  if (count < 2) {
    return { mean, stdDev: 0, count }
  }

  const squaredDiffs = times.map((t) => (t - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (count - 1)
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev, count }
}

/**
 * Practice Sub-Navigation Bar
 *
 * A sticky sub-navigation bar that appears below the main nav on all
 * student-scoped practice pages. Features:
 * - Student avatar + name with persistent link to dashboard
 * - Session HUD controls when in an active session
 * - Consistent visual identity across all practice pages
 */
export function PracticeSubNav({
  student,
  pageContext,
  sessionHud,
  onStartPractice,
}: PracticeSubNavProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isOnDashboard = pageContext === 'dashboard'

  // Live-updating current problem timer
  const [currentElapsedMs, setCurrentElapsedMs] = useState(0)

  // Update current timer every 100ms when timing data is available
  useEffect(() => {
    if (!sessionHud?.timing || sessionHud.isPaused) {
      return
    }

    const { startTime, accumulatedPauseMs } = sessionHud.timing
    const updateTimer = () => {
      const elapsed = Date.now() - startTime - accumulatedPauseMs
      setCurrentElapsedMs(Math.max(0, elapsed))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [sessionHud?.timing?.startTime, sessionHud?.timing?.accumulatedPauseMs, sessionHud?.isPaused])

  // Calculate timing stats from results - filtered by current part type
  const timingStats = sessionHud?.timing
    ? (() => {
        const currentPartType = sessionHud.currentPart.type
        const { results, parts } = sessionHud.timing

        // Map each result to its part type and filter for current type only
        const timesForCurrentType = results
          .filter((r) => {
            const partIndex = parts.findIndex((p) => p.partNumber === r.partNumber)
            return partIndex >= 0 && parts[partIndex].type === currentPartType
          })
          .map((r) => r.responseTimeMs)

        const stats = calculateStats(timesForCurrentType)
        const hasEnoughData = stats.count >= MIN_SAMPLES_FOR_STATS
        const threshold = hasEnoughData
          ? Math.max(30_000, Math.min(stats.mean + 2 * stats.stdDev, 5 * 60 * 1000))
          : 60_000
        return { ...stats, hasEnoughData, threshold, partType: currentPartType }
      })()
    : null

  // Extract recent correctness results for mood indicator (last N)
  const recentResults = useMemo(() => {
    if (!sessionHud?.results) return []
    return sessionHud.results.slice(-10).map((r) => r.isCorrect)
  }, [sessionHud?.results])

  return (
    <nav
      data-component="practice-sub-nav"
      data-context={pageContext}
      className={css({
        position: 'sticky',
        top: '80px', // Stick below the main nav when scrolling
        marginTop: '80px', // Initial offset to push below fixed nav
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: { base: '0.5rem', md: '1rem' },
        padding: { base: '0.5rem 0.75rem', md: '0.75rem 1.5rem' },
        backgroundColor: isDark ? 'gray.900' : 'gray.100',
        borderBottom: '1px solid',
        borderColor: isDark ? 'gray.800' : 'gray.200',
        boxShadow: 'sm',
      })}
    >
      {/* Left: Student avatar + name (link to dashboard) */}
      <Link
        href={`/practice/${student.id}/dashboard`}
        data-element="student-nav-link"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          textDecoration: 'none',
          borderRadius: '8px',
          padding: '0.375rem 0.75rem 0.375rem 0.375rem',
          marginLeft: '-0.375rem',
          transition: 'all 0.15s ease',
          backgroundColor: isOnDashboard ? (isDark ? 'gray.800' : 'white') : 'transparent',
          _hover: {
            backgroundColor: isDark ? 'gray.800' : 'white',
          },
        })}
        aria-current={isOnDashboard ? 'page' : undefined}
      >
        {/* Avatar */}
        <div
          data-element="student-avatar"
          className={css({
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            flexShrink: 0,
          })}
          style={{ backgroundColor: student.color }}
        >
          {student.emoji}
        </div>
        {/* Name + context - hidden on mobile during session */}
        <div
          className={css({
            display: sessionHud ? { base: 'none', sm: 'flex' } : 'flex',
            flexDirection: 'column',
            gap: '0',
            minWidth: 0,
          })}
        >
          <span
            className={css({
              fontSize: '0.9375rem',
              fontWeight: '600',
              color: isDark ? 'gray.100' : 'gray.800',
              lineHeight: '1.2',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            })}
          >
            {student.name}
          </span>
          {!sessionHud && (
            <span
              className={css({
                fontSize: '0.6875rem',
                color: isDark ? 'gray.500' : 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              })}
            >
              {isOnDashboard ? 'Dashboard' : 'Back to dashboard'}
            </span>
          )}
        </div>
      </Link>

      {/* Session HUD - takes full remaining width when in active session */}
      {sessionHud && (
        <div
          data-section="session-hud"
          className={css({
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: { base: '0.375rem', md: '0.75rem' },
          })}
        >
          {/* Transport controls dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                data-element="transport-controls"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.625rem',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: isDark ? 'gray.200' : 'gray.700',
                  backgroundColor: isDark ? 'gray.700' : 'white',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  _hover: {
                    backgroundColor: isDark ? 'gray.600' : 'gray.50',
                    borderColor: isDark ? 'gray.500' : 'gray.400',
                  },
                  _active: {
                    backgroundColor: isDark ? 'gray.650' : 'gray.100',
                  },
                })}
                aria-label="Session controls"
              >
                {/* Status indicator dot */}
                <span
                  className={css({
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: sessionHud.isBrowseMode
                      ? 'blue.500'
                      : sessionHud.isPaused
                        ? 'yellow.500'
                        : 'green.500',
                  })}
                />
                <span>
                  {sessionHud.isBrowseMode
                    ? 'Browse'
                    : sessionHud.isPaused
                      ? 'Paused'
                      : 'Active'}
                </span>
                <span
                  className={css({
                    fontSize: '0.5rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    marginLeft: '0.125rem',
                  })}
                >
                  ▼
                </span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={css({
                  minWidth: '160px',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '8px',
                  padding: '0.375rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  zIndex: 1000,
                })}
                sideOffset={5}
              >
                {/* Play/Pause item */}
                <DropdownMenu.Item
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    color: isDark ? 'gray.100' : 'gray.900',
                    _hover: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.100',
                    },
                    _focus: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.100',
                    },
                  })}
                  onSelect={sessionHud.isPaused ? sessionHud.onResume : sessionHud.onPause}
                >
                  <span>{sessionHud.isPaused ? '▶' : '⏸'}</span>
                  <span>{sessionHud.isPaused ? 'Resume' : 'Pause'}</span>
                </DropdownMenu.Item>

                {/* Browse mode item */}
                <DropdownMenu.Item
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    color: sessionHud.isBrowseMode
                      ? isDark
                        ? 'blue.300'
                        : 'blue.600'
                      : isDark
                        ? 'gray.100'
                        : 'gray.900',
                    backgroundColor: sessionHud.isBrowseMode
                      ? isDark
                        ? 'blue.900/50'
                        : 'blue.50'
                      : 'transparent',
                    _hover: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.100',
                    },
                    _focus: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.100',
                    },
                  })}
                  onSelect={sessionHud.onToggleBrowse}
                >
                  <span>🔢</span>
                  <span>{sessionHud.isBrowseMode ? 'Exit Browse' : 'Browse'}</span>
                </DropdownMenu.Item>

                <DropdownMenu.Separator
                  className={css({
                    height: '1px',
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    margin: '0.375rem 0',
                  })}
                />

                {/* End session item */}
                <DropdownMenu.Item
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    color: isDark ? 'red.400' : 'red.600',
                    _hover: {
                      backgroundColor: isDark ? 'red.900/50' : 'red.50',
                    },
                    _focus: {
                      backgroundColor: isDark ? 'red.900/50' : 'red.50',
                    },
                  })}
                  onSelect={sessionHud.onEndEarly}
                >
                  <span>⏹</span>
                  <span>End Session</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Session Progress Indicator - discrete problem slots */}
          <div
            data-element="progress-indicator"
            className={css({
              flex: 1,
              minWidth: 0, // Allow shrinking
            })}
          >
            <SessionProgressIndicator
              parts={sessionHud.parts}
              results={sessionHud.results}
              currentPartIndex={sessionHud.currentPartIndex}
              currentSlotIndex={sessionHud.currentSlotIndex}
              isBrowseMode={sessionHud.isBrowseMode}
              onNavigate={sessionHud.onBrowseNavigate}
              averageResponseTimeMs={timingStats?.hasEnoughData ? timingStats.mean : undefined}
              isDark={isDark}
              compact={true}
            />
          </div>

          {/* Session Mood Indicator - unified timing + health display */}
          {timingStats && (
            <SessionMoodIndicator
              currentElapsedMs={currentElapsedMs}
              meanMs={timingStats.mean}
              stdDevMs={timingStats.stdDev}
              thresholdMs={timingStats.threshold}
              hasEnoughData={timingStats.hasEnoughData}
              problemsRemaining={sessionHud.totalProblems - sessionHud.completedProblems}
              totalProblems={sessionHud.totalProblems}
              recentResults={recentResults}
              accuracy={sessionHud.sessionHealth?.accuracy ?? 1}
              healthStatus={sessionHud.sessionHealth?.overall ?? 'good'}
              isPaused={sessionHud.isPaused}
              isDark={isDark}
            />
          )}
        </div>
      )}

      {/* Center: Start Practice button (when on dashboard with no active session) */}
      {isOnDashboard && !sessionHud && onStartPractice && (
        <button
          type="button"
          data-action="start-practice"
          onClick={onStartPractice}
          className={css({
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.875rem 1.75rem',
            fontSize: '1.0625rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: 'green.500',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: 'green.400',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
            transition: 'all 0.2s ease',
            _hover: {
              backgroundColor: 'green.400',
              borderColor: 'green.300',
              transform: 'translateX(-50%) translateY(-2px) scale(1.02)',
              boxShadow: '0 6px 20px rgba(34, 197, 94, 0.5)',
            },
            _active: {
              transform: 'translateX(-50%) translateY(0) scale(0.98)',
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.4)',
            },
          })}
        >
          <span className={css({ fontSize: '1.25rem' })}>▶</span>
          <span>Start Practice</span>
        </button>
      )}
    </nav>
  )
}

export default PracticeSubNav
