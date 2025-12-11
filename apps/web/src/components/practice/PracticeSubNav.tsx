'use client'

import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

/**
 * Session HUD data for active practice sessions
 */
export interface SessionHudData {
  /** Is the session currently paused? */
  isPaused: boolean
  /** Current part info */
  currentPart: {
    type: 'abacus' | 'visualization' | 'linear'
    partNumber: number
    totalSlots: number
  }
  /** Current slot index within the part */
  currentSlotIndex: number
  /** Total problems completed so far */
  completedProblems: number
  /** Total problems in session */
  totalProblems: number
  /** Session health info */
  sessionHealth?: {
    overall: 'good' | 'warning' | 'struggling'
    accuracy: number
  }
  /** Callbacks for transport controls */
  onPause: () => void
  onResume: () => void
  onEndEarly: () => void
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

function getPartTypeEmoji(type: 'abacus' | 'visualization' | 'linear'): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '💭'
  }
}

function getPartTypeLabel(type: 'abacus' | 'visualization' | 'linear'): string {
  switch (type) {
    case 'abacus':
      return 'Use Abacus'
    case 'visualization':
      return 'Visualization'
    case 'linear':
      return 'Mental Math'
  }
}

function getHealthEmoji(overall: 'good' | 'warning' | 'struggling'): string {
  switch (overall) {
    case 'good':
      return '🟢'
    case 'warning':
      return '🟡'
    case 'struggling':
      return '🔴'
  }
}

function getHealthColor(overall: 'good' | 'warning' | 'struggling'): string {
  switch (overall) {
    case 'good':
      return 'green.500'
    case 'warning':
      return 'yellow.500'
    case 'struggling':
      return 'red.500'
  }
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
        gap: '1rem',
        padding: '0.75rem 1.5rem',
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
        {/* Name + context */}
        <div
          className={css({
            display: 'flex',
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
            gap: '0.75rem',
          })}
        >
          {/* Transport controls */}
          <div
            data-element="transport-controls"
            className={css({
              display: 'flex',
              gap: '0.25rem',
              flexShrink: 0,
            })}
          >
            {/* Pause/Play button */}
            <button
              type="button"
              data-action={sessionHud.isPaused ? 'resume' : 'pause'}
              onClick={sessionHud.isPaused ? sessionHud.onResume : sessionHud.onPause}
              className={css({
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.125rem',
                color: 'white',
                backgroundColor: sessionHud.isPaused ? 'green.500' : 'gray.600',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: sessionHud.isPaused ? 'green.400' : 'gray.500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: sessionHud.isPaused ? 'green.400' : 'gray.500',
                  transform: 'scale(1.05)',
                },
                _active: {
                  transform: 'scale(0.95)',
                },
              })}
              aria-label={sessionHud.isPaused ? 'Resume session' : 'Pause session'}
            >
              {sessionHud.isPaused ? '▶' : '⏸'}
            </button>

            {/* Stop button */}
            <button
              type="button"
              data-action="end-early"
              onClick={sessionHud.onEndEarly}
              className={css({
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.125rem',
                color: 'red.300',
                backgroundColor: 'gray.600',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: 'gray.500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: 'red.900',
                  borderColor: 'red.700',
                  color: 'red.200',
                  transform: 'scale(1.05)',
                },
                _active: {
                  transform: 'scale(0.95)',
                },
              })}
              aria-label="End session"
            >
              ⏹
            </button>
          </div>

          {/* BIG Progress bar - takes up remaining width */}
          <div
            data-element="progress-bar"
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            })}
          >
            {/* Labels row */}
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              })}
            >
              {/* Mode label on left */}
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                })}
              >
                <span className={css({ fontSize: '1.125rem', lineHeight: 1 })}>
                  {getPartTypeEmoji(sessionHud.currentPart.type)}
                </span>
                <span
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: isDark ? 'gray.100' : 'gray.700',
                  })}
                >
                  {getPartTypeLabel(sessionHud.currentPart.type)}
                </span>
              </div>

              {/* "X left" on right */}
              <span
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: isDark ? 'gray.300' : 'gray.600',
                })}
              >
                {sessionHud.totalProblems - sessionHud.completedProblems} left
              </span>
            </div>

            {/* Big chunky progress bar */}
            <div
              className={css({
                width: '100%',
                height: '16px',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  backgroundColor: 'green.500',
                  borderRadius: '8px',
                  transition: 'width 0.3s ease',
                  boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
                })}
                style={{
                  width: `${Math.round((sessionHud.completedProblems / sessionHud.totalProblems) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Health indicator */}
          {sessionHud.sessionHealth && (
            <div
              data-element="session-health"
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.375rem 0.5rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                borderRadius: '8px',
                flexShrink: 0,
              })}
            >
              <span className={css({ fontSize: '1rem' })}>
                {getHealthEmoji(sessionHud.sessionHealth.overall)}
              </span>
              <span
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                })}
                style={{
                  color: `var(--colors-${getHealthColor(sessionHud.sessionHealth.overall).replace('.', '-')})`,
                }}
              >
                {Math.round(sessionHud.sessionHealth.accuracy * 100)}%
              </span>
            </div>
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
