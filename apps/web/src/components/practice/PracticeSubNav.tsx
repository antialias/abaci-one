'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as HoverCard from '@radix-ui/react-hover-card'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavBannerSlot } from './BannerSlots'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { useStudentStakeholders } from '@/hooks/useStudentStakeholders'
import { useActiveSessionPlan } from '@/hooks/useSessionPlan'
import { useStudentActions, type StudentActionData } from '@/hooks/useStudentActions'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { EnrollChildModal } from '@/components/classroom'
import { FamilyCodeDisplay } from '@/components/family'
import { RelationshipCard } from './RelationshipCard'
import { RelationshipSummary } from './RelationshipBadge'
import { SessionMoodIndicator } from './SessionMoodIndicator'
import { SessionProgressIndicator } from './SessionProgressIndicator'
import { ACTION_DEFINITIONS } from './studentActions'

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
    /** Optional: needed for action menu (archive/unarchive) */
    isArchived?: boolean
  }
  /** Current page context (shown as subtle label) */
  pageContext?: 'dashboard' | 'configure' | 'session' | 'summary' | 'resume'
  /** Session HUD data (shown when in active session) */
  sessionHud?: SessionHudData
  /** Optional callback when observe session is clicked */
  onObserveSession?: (sessionId: string) => void
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
  onObserveSession,
}: PracticeSubNavProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isOnDashboard = pageContext === 'dashboard'
  const isInActiveSession = !!sessionHud

  // Stakeholder data for relationship popover
  const { data: stakeholdersData } = useStudentStakeholders(student.id)
  const viewerRelationship = stakeholdersData?.viewerRelationship ?? null
  const stakeholders = stakeholdersData?.stakeholders ?? null
  const hasOtherStakeholders =
    (stakeholders?.parents.filter((p) => !p.isMe).length ?? 0) > 0 ||
    (stakeholders?.enrolledClassrooms.length ?? 0) > 0

  // Check for active session (for "Watch Session" action when not our own session)
  const { data: activeSession } = useActiveSessionPlan(student.id)
  const hasActiveSession = !!activeSession && !isInActiveSession

  // Build StudentActionData for the action menu
  const studentActionData: StudentActionData = useMemo(() => {
    const relationship = viewerRelationship
      ? {
          isMyChild: viewerRelationship.type === 'parent',
          isEnrolled: viewerRelationship.type === 'teacher',
          isPresent: viewerRelationship.type === 'observer',
          enrollmentStatus: null,
        }
      : undefined

    return {
      id: student.id,
      name: student.name,
      isArchived: student.isArchived,
      relationship,
      activity: hasActiveSession
        ? {
            status: 'practicing',
            sessionId: activeSession?.id,
          }
        : undefined,
    }
  }, [
    student.id,
    student.name,
    student.isArchived,
    viewerRelationship,
    hasActiveSession,
    activeSession?.id,
  ])

  // Use student actions hook for menu logic
  const { actions, handlers, modals, classrooms } = useStudentActions(studentActionData, {
    onObserveSession,
  })

  // Check if we have any actions to show
  const hasAnyAction =
    actions.startPractice ||
    actions.watchSession ||
    actions.enterClassroom ||
    actions.leaveClassroom ||
    actions.enrollInClassroom ||
    actions.shareAccess ||
    actions.archive ||
    actions.unarchive

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
        return {
          ...stats,
          hasEnoughData,
          threshold,
          partType: currentPartType,
        }
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
        // Prevent horizontal overflow
        overflow: 'hidden',
        maxWidth: '100vw',
      })}
    >
      {/* Left: Student identity with clear visual zones */}
      <div
        data-element="student-nav-link"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderRadius: '8px',
          padding: '0.375rem',
          marginLeft: '-0.375rem',
          transition: 'all 0.15s ease',
          backgroundColor: isOnDashboard ? (isDark ? 'gray.800' : 'white') : 'transparent',
          _hover: {
            backgroundColor: isDark ? 'gray.800' : 'white',
          },
        })}
      >
        {/* Zone 1: Avatar - links to dashboard */}
        <Link
          href={`/practice/${student.id}/dashboard`}
          className={css({
            display: 'flex',
            textDecoration: 'none',
            flexShrink: 0,
            borderRadius: '50%',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            _hover: {
              transform: 'scale(1.05)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            },
          })}
          aria-label={`${student.name}'s dashboard`}
        >
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
            })}
            style={{ backgroundColor: student.color }}
          >
            {student.emoji}
          </div>
        </Link>

        {/* Zone 2: Name + relationship info - hidden on mobile during session */}
        <div
          className={css({
            display: sessionHud ? { base: 'none', sm: 'flex' } : 'flex',
            flexDirection: 'column',
            gap: '0',
            minWidth: 0,
            flex: 1,
          })}
        >
          {/* Name - links to dashboard */}
          <Link
            href={`/practice/${student.id}/dashboard`}
            className={css({
              textDecoration: 'none',
              fontSize: '0.9375rem',
              fontWeight: '600',
              color: isDark ? 'gray.100' : 'gray.800',
              lineHeight: '1.2',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: 'fit-content',
              _hover: {
                textDecoration: 'underline',
                color: isDark ? 'blue.300' : 'blue.600',
              },
            })}
            aria-current={isOnDashboard ? 'page' : undefined}
          >
            {student.name}
          </Link>

          {/* Relationship summary with hover tooltip */}
          {!sessionHud && (
            <>
              {viewerRelationship && viewerRelationship.type !== 'none' ? (
                <HoverCard.Root openDelay={200} closeDelay={100}>
                  <HoverCard.Trigger asChild>
                    <button
                      type="button"
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'help',
                        background: 'none',
                        border: 'none',
                        padding: '2px 0',
                        textAlign: 'left',
                        width: 'fit-content',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s ease',
                        _hover: {
                          backgroundColor: isDark ? 'gray.700/50' : 'gray.100',
                        },
                      })}
                      aria-label="View relationship details"
                    >
                      <RelationshipSummary
                        type={viewerRelationship.type}
                        classroomName={viewerRelationship.classroomName}
                        otherStakeholders={
                          hasOtherStakeholders
                            ? {
                                parents: stakeholders?.parents.filter((p) => !p.isMe).length ?? 0,
                                teachers: stakeholders?.enrolledClassrooms.length ?? 0,
                              }
                            : undefined
                        }
                        className={css({
                          fontSize: '0.6875rem !important',
                          opacity: 0.8,
                        })}
                      />
                      {/* Info icon to indicate hover for more */}
                      <span
                        className={css({
                          fontSize: '0.625rem',
                          opacity: 0.5,
                          marginLeft: '2px',
                        })}
                        aria-hidden="true"
                      >
                        ⓘ
                      </span>
                    </button>
                  </HoverCard.Trigger>

                  {/* Relationship tooltip content */}
                  <HoverCard.Portal>
                    <HoverCard.Content
                      data-component="relationship-tooltip"
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className={css({
                        width: '320px',
                        maxWidth: 'calc(100vw - 32px)',
                        padding: '12px',
                        borderRadius: '12px',
                        backgroundColor: isDark ? 'gray.800' : 'white',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.700' : 'gray.200',
                        boxShadow: 'lg',
                        zIndex: Z_INDEX.POPOVER,
                        animation: 'fadeIn 0.15s ease',
                      })}
                    >
                      <RelationshipCard playerId={student.id} compact />
                      <HoverCard.Arrow
                        className={css({
                          fill: isDark ? 'gray.800' : 'white',
                        })}
                      />
                    </HoverCard.Content>
                  </HoverCard.Portal>
                </HoverCard.Root>
              ) : (
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
            </>
          )}
        </div>

        {/* Zone 3: Actions menu button - separate, clearly clickable */}
        {!isInActiveSession && hasAnyAction && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                data-element="student-actions-trigger"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  color: isDark ? 'gray.400' : 'gray.500',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  _hover: {
                    backgroundColor: isDark ? 'gray.700' : 'gray.100',
                    borderColor: isDark ? 'gray.600' : 'gray.400',
                    color: isDark ? 'gray.200' : 'gray.700',
                  },
                  _focus: {
                    outline: '2px solid',
                    outlineColor: isDark ? 'blue.500' : 'blue.400',
                    outlineOffset: '2px',
                  },
                })}
                aria-label="Student actions"
              >
                ⋮
              </button>
            </DropdownMenu.Trigger>

            {/* Action menu dropdown */}
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                data-component="student-action-menu"
                className={css({
                  minWidth: '200px',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  padding: '4px',
                  boxShadow: 'lg',
                  zIndex: Z_INDEX.DROPDOWN,
                  animation: 'fadeIn 0.15s ease',
                })}
                sideOffset={8}
                align="end"
              >
                {/* Go to Dashboard - when not on dashboard */}
                {!isOnDashboard && (
                  <DropdownMenu.Item
                    className={menuItemStyles(isDark)}
                    onSelect={() => {
                      window.location.href = `/practice/${student.id}/dashboard`
                    }}
                  >
                    <span>📊</span>
                    <span>Go to Dashboard</span>
                  </DropdownMenu.Item>
                )}

                {/* Practice actions */}
                {actions.startPractice && (
                  <DropdownMenu.Item
                    className={menuItemStyles(isDark)}
                    onSelect={handlers.startPractice}
                  >
                    <span>{ACTION_DEFINITIONS.startPractice.icon}</span>
                    <span>{ACTION_DEFINITIONS.startPractice.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.watchSession && (
                  <DropdownMenu.Item
                    className={menuItemStyles(isDark)}
                    onSelect={handlers.watchSession}
                  >
                    <span>{ACTION_DEFINITIONS.watchSession.icon}</span>
                    <span>{ACTION_DEFINITIONS.watchSession.label}</span>
                  </DropdownMenu.Item>
                )}

                {/* Classroom section */}
                {(classrooms.enrolled.length > 0 || classrooms.current) && (
                  <>
                    <DropdownMenu.Separator className={separatorStyles(isDark)} />

                    {/* If in a classroom, show presence + leave */}
                    {classrooms.current && (
                      <DropdownMenu.Item
                        className={menuItemStyles(isDark)}
                        onSelect={handlers.leaveClassroom}
                        data-action="leave-classroom"
                      >
                        <span
                          className={css({
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'green.500',
                          })}
                        />
                        <span>In {classrooms.current.classroom.name} — Leave</span>
                      </DropdownMenu.Item>
                    )}

                    {/* If not in classroom and has exactly 1 enrollment: direct action */}
                    {!classrooms.current && classrooms.enrolled.length === 1 && (
                      <DropdownMenu.Item
                        className={menuItemStyles(isDark)}
                        onSelect={handlers.enterClassroom}
                        data-action="enter-classroom"
                      >
                        <span>🏫</span>
                        <span>Enter {classrooms.enrolled[0].name}</span>
                      </DropdownMenu.Item>
                    )}

                    {/* If not in classroom and has multiple enrollments: use submenu */}
                    {!classrooms.current && classrooms.enrolled.length > 1 && (
                      <DropdownMenu.Sub>
                        <DropdownMenu.SubTrigger className={subTriggerStyles(isDark)}>
                          <span>🏫</span>
                          <span>Enter Classroom</span>
                          <span className={css({ marginLeft: 'auto' })}>→</span>
                        </DropdownMenu.SubTrigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.SubContent
                            className={css({
                              minWidth: '160px',
                              backgroundColor: isDark ? 'gray.800' : 'white',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isDark ? 'gray.700' : 'gray.200',
                              padding: '4px',
                              boxShadow: 'lg',
                              zIndex: Z_INDEX.DROPDOWN + 1,
                            })}
                            sideOffset={4}
                          >
                            {classrooms.enrolled.map((c) => (
                              <DropdownMenu.Item
                                key={c.id}
                                className={menuItemStyles(isDark)}
                                onSelect={() => handlers.enterSpecificClassroom(c.id)}
                                data-action="enter-specific-classroom"
                              >
                                {c.name}
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.SubContent>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Sub>
                    )}

                    {/* Enroll option */}
                    <DropdownMenu.Item
                      className={menuItemStyles(isDark)}
                      onSelect={handlers.openEnrollModal}
                      data-action="enroll-in-classroom"
                    >
                      <span>➕</span>
                      <span>Enroll in Classroom</span>
                    </DropdownMenu.Item>
                  </>
                )}

                {/* Show enroll option even if no enrollments yet */}
                {classrooms.enrolled.length === 0 &&
                  !classrooms.current &&
                  actions.enrollInClassroom && (
                    <DropdownMenu.Item
                      className={menuItemStyles(isDark)}
                      onSelect={handlers.openEnrollModal}
                      data-action="enroll-in-classroom"
                    >
                      <span>{ACTION_DEFINITIONS.enrollInClassroom.icon}</span>
                      <span>{ACTION_DEFINITIONS.enrollInClassroom.label}</span>
                    </DropdownMenu.Item>
                  )}

                <DropdownMenu.Separator className={separatorStyles(isDark)} />

                {/* Management actions */}
                {actions.archive && (
                  <DropdownMenu.Item
                    className={menuItemStyles(isDark)}
                    onSelect={handlers.toggleArchive}
                  >
                    <span>{ACTION_DEFINITIONS.archive.icon}</span>
                    <span>{ACTION_DEFINITIONS.archive.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.unarchive && (
                  <DropdownMenu.Item
                    className={menuItemStyles(isDark)}
                    onSelect={handlers.toggleArchive}
                  >
                    <span>{ACTION_DEFINITIONS.unarchive.icon}</span>
                    <span>{ACTION_DEFINITIONS.unarchive.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.shareAccess && (
                  <DropdownMenu.Item
                    className={menuItemStyles(isDark)}
                    onSelect={handlers.openShareAccess}
                  >
                    <span>{ACTION_DEFINITIONS.shareAccess.icon}</span>
                    <span>{ACTION_DEFINITIONS.shareAccess.label}</span>
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {/* Session HUD - takes full remaining width when in active session */}
      {sessionHud && (
        <div
          data-section="session-hud"
          className={css({
            flex: 1,
            minWidth: 0, // Allow shrinking below content size
            display: 'flex',
            alignItems: 'center',
            gap: { base: '0.375rem', md: '0.75rem' },
            overflow: 'hidden',
          })}
        >
          {/* Browse mode toggle - prominent standalone button */}
          <button
            type="button"
            data-action="toggle-browse"
            data-active={sessionHud.isBrowseMode || undefined}
            onClick={sessionHud.onToggleBrowse}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.625rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              // Active (browse mode on) styling
              ...(sessionHud.isBrowseMode
                ? {
                    color: isDark ? 'blue.200' : 'blue.700',
                    backgroundColor: isDark ? 'blue.900/60' : 'blue.100',
                    borderColor: isDark ? 'blue.700' : 'blue.300',
                  }
                : {
                    color: isDark ? 'gray.300' : 'gray.600',
                    backgroundColor: isDark ? 'gray.800' : 'gray.50',
                    borderColor: isDark ? 'gray.700' : 'gray.300',
                  }),
              _hover: sessionHud.isBrowseMode
                ? {
                    backgroundColor: isDark ? 'blue.800/60' : 'blue.200',
                  }
                : {
                    backgroundColor: isDark ? 'gray.700' : 'white',
                    borderColor: isDark ? 'gray.600' : 'gray.400',
                  },
            })}
            aria-pressed={sessionHud.isBrowseMode}
            aria-label={sessionHud.isBrowseMode ? 'Exit browse mode' : 'Enter browse mode'}
          >
            <span>🔍</span>
            <span className={css({ display: { base: 'none', sm: 'inline' } })}>
              {sessionHud.isBrowseMode ? 'Exit' : 'Browse'}
            </span>
          </button>

          {/* Session controls dropdown (pause/end) */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                data-element="session-controls"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: isDark ? 'gray.300' : 'gray.600',
                  backgroundColor: isDark ? 'gray.800' : 'gray.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  _hover: {
                    backgroundColor: isDark ? 'gray.700' : 'white',
                    borderColor: isDark ? 'gray.600' : 'gray.400',
                  },
                })}
                aria-label="Session controls"
              >
                {/* Status indicator */}
                <span>{sessionHud.isPaused ? '⏸' : '▶'}</span>
                <span
                  className={css({
                    fontSize: '0.5rem',
                    color: isDark ? 'gray.500' : 'gray.400',
                  })}
                >
                  ▼
                </span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={css({
                  minWidth: '140px',
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

                {/* Observe session - for parents/teachers to open observation page */}
                {(viewerRelationship?.type === 'parent' ||
                  viewerRelationship?.type === 'teacher') && (
                  <>
                    <DropdownMenu.Separator
                      className={css({
                        height: '1px',
                        backgroundColor: isDark ? 'gray.700' : 'gray.200',
                        margin: '0.375rem 0',
                      })}
                    />
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
                        color: isDark ? 'blue.400' : 'blue.600',
                        _hover: {
                          backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                        },
                        _focus: {
                          backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                        },
                      })}
                      onSelect={() => {
                        window.open(`/practice/${student.id}/observe`, '_blank')
                      }}
                    >
                      <span>👁️</span>
                      <span>Observe Session</span>
                    </DropdownMenu.Item>
                  </>
                )}
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

      {/* Nav Banner Slot - shown when not in session
          On dashboard/summary: receives projected banner when content banner scrolls out of view
          On other pages: shows compact banner directly */}
      {!sessionHud && (
        <NavBannerSlot
          className={css({
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          })}
        />
      )}

      {/* Sub-modals for actions */}
      <FamilyCodeDisplay
        playerId={student.id}
        playerName={student.name}
        isOpen={modals.shareAccess.isOpen}
        onClose={modals.shareAccess.close}
      />

      <EnrollChildModal
        isOpen={modals.enroll.isOpen}
        onClose={modals.enroll.close}
        playerId={student.id}
        playerName={student.name}
      />
    </nav>
  )
}

// =============================================================================
// Helper style functions (shared with StudentActionMenu)
// =============================================================================

function menuItemStyles(isDark: boolean) {
  return css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    color: isDark ? 'gray.200' : 'gray.700',
    _hover: {
      backgroundColor: isDark ? 'gray.700' : 'gray.100',
    },
    _focus: {
      backgroundColor: isDark ? 'gray.700' : 'gray.100',
    },
  })
}

function separatorStyles(isDark: boolean) {
  return css({
    height: '1px',
    backgroundColor: isDark ? 'gray.700' : 'gray.200',
    margin: '4px 0',
  })
}

function subTriggerStyles(isDark: boolean) {
  return css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    color: isDark ? 'gray.200' : 'gray.700',
    _hover: {
      backgroundColor: isDark ? 'gray.700' : 'gray.100',
    },
    _focus: {
      backgroundColor: isDark ? 'gray.700' : 'gray.100',
    },
    // SubTrigger specific: highlight when open
    '&[data-state="open"]': {
      backgroundColor: isDark ? 'gray.700' : 'gray.100',
    },
  })
}

export default PracticeSubNav
