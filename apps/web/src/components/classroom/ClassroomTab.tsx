'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import type { Classroom } from '@/db/schema'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useActiveSessionsInClassroom,
  useClassroomPresence,
  useLeaveClassroom,
  type ActiveSessionInfo,
  type PresenceStudent,
} from '@/hooks/useClassroom'
import { css } from '../../../styled-system/css'
import { ClassroomCodeShare } from './ClassroomCodeShare'

interface ClassroomTabProps {
  classroom: Classroom
}

/**
 * ClassroomTab - Shows live classroom view
 *
 * Displays students currently "present" in the classroom.
 * Teachers can see who's actively practicing and remove students when needed.
 */
export function ClassroomTab({ classroom }: ClassroomTabProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Fetch present students
  // Note: WebSocket subscription is in ClassroomDashboard (parent) so it stays
  // connected even when user switches tabs
  const { data: presentStudents = [], isLoading } = useClassroomPresence(classroom.id)
  const leaveClassroom = useLeaveClassroom()

  // Fetch active sessions to show "Practicing" indicator
  const { data: activeSessions = [] } = useActiveSessionsInClassroom(classroom.id)

  // Map active sessions by playerId for quick lookup
  const activeSessionsByPlayer = new Map<string, ActiveSessionInfo>(
    activeSessions.map((session) => [session.playerId, session])
  )

  const handleRemoveStudent = useCallback(
    (playerId: string) => {
      leaveClassroom.mutate({
        classroomId: classroom.id,
        playerId,
      })
    },
    [classroom.id, leaveClassroom]
  )

  return (
    <div
      data-component="classroom-tab"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      })}
    >
      {/* Present students section */}
      {isLoading ? (
        <div
          className={css({
            textAlign: 'center',
            padding: '24px',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          Loading classroom...
        </div>
      ) : presentStudents.length > 0 ? (
        <section data-section="present-students">
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.800',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            })}
          >
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'green.500',
                animation: 'pulse 2s infinite',
              })}
            />
            <span>Students Present</span>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '24px',
                padding: '0 8px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'green.700' : 'green.500',
                color: 'white',
                fontSize: '0.8125rem',
                fontWeight: 'bold',
              })}
            >
              {presentStudents.length}
            </span>
          </h3>

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
            {presentStudents.map((student) => (
              <PresentStudentCard
                key={student.id}
                student={student}
                activeSession={activeSessionsByPlayer.get(student.id)}
                onRemove={() => handleRemoveStudent(student.id)}
                isRemoving={
                  leaveClassroom.isPending && leaveClassroom.variables?.playerId === student.id
                }
                isDark={isDark}
              />
            ))}
          </div>
        </section>
      ) : (
        /* Empty state */
        <div
          className={css({
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '16px',
            border: '2px dashed',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              fontSize: '3rem',
              marginBottom: '16px',
            })}
          >
            🏫
          </div>
          <h3
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.800',
              marginBottom: '8px',
            })}
          >
            No Students Present
          </h3>
          <p
            className={css({
              fontSize: '0.9375rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '24px',
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
            })}
          >
            When students join your classroom for practice, they'll appear here. Share your
            classroom code to get started.
          </p>

          <ClassroomCodeShare code={classroom.code} />
        </div>
      )}

      {/* Instructions */}
      <div
        className={css({
          padding: '20px',
          backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'blue.800' : 'blue.200',
        })}
      >
        <h4
          className={css({
            fontSize: '0.9375rem',
            fontWeight: 'bold',
            color: isDark ? 'blue.300' : 'blue.700',
            marginBottom: '8px',
          })}
        >
          How students join
        </h4>
        <ol
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'blue.200' : 'blue.800',
            paddingLeft: '20px',
            listStyleType: 'decimal',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          })}
        >
          <li>Share your classroom code with parents</li>
          <li>Parents enroll their child using the code</li>
          <li>When practicing, students can "enter" the classroom</li>
          <li>You'll see them appear here in real-time</li>
        </ol>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface PresentStudentCardProps {
  student: PresenceStudent
  activeSession?: ActiveSessionInfo
  onRemove: () => void
  isRemoving: boolean
  isDark: boolean
}

function PresentStudentCard({
  student,
  activeSession,
  onRemove,
  isRemoving,
  isDark,
}: PresentStudentCardProps) {
  const enteredAt = new Date(student.enteredAt)
  const timeAgo = getTimeAgo(enteredAt)
  const isPracticing = !!activeSession

  return (
    <div
      data-element="present-student-card"
      data-practicing={isPracticing}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '12px',
        border: isPracticing ? '2px solid' : '1px solid',
        borderColor: isPracticing
          ? 'blue.500'
          : isDark
            ? 'green.800'
            : 'green.200',
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
      })}
    >
      <Link
        href={`/practice/${student.id}/dashboard`}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          textDecoration: 'none',
          flex: 1,
          _hover: { opacity: 0.8 },
        })}
      >
        <div className={css({ position: 'relative' })}>
          <span
            className={css({
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.375rem',
            })}
            style={{ backgroundColor: student.color }}
          >
            {student.emoji}
          </span>
          {/* Online/Practicing indicator */}
          <span
            className={css({
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: isPracticing ? 'blue.500' : 'green.500',
              border: '2px solid',
              borderColor: isDark ? 'gray.800' : 'white',
            })}
            style={
              isPracticing
                ? {
                    animation: 'practicing-pulse 1.5s ease-in-out infinite',
                  }
                : undefined
            }
          />
          {/* Keyframes for practicing pulse animation */}
          {isPracticing && (
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @keyframes practicing-pulse {
                    0%, 100% {
                      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
                    }
                    50% {
                      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
                    }
                  }
                `,
              }}
            />
          )}
        </div>
        <div>
          <p
            className={css({
              fontWeight: 'medium',
              color: isDark ? 'white' : 'gray.800',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            {student.name}
            {isPracticing && (
              <span
                data-element="practicing-badge"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'blue.900' : 'blue.100',
                  color: isDark ? 'blue.300' : 'blue.700',
                  fontSize: '0.6875rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                })}
              >
                <span className={css({ fontSize: '0.75rem' })}>📝</span>
                Practicing
              </span>
            )}
          </p>
          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            {isPracticing ? (
              <>
                Problem {activeSession.completedProblems + 1} of {activeSession.totalProblems}
              </>
            ) : (
              <>Joined {timeAgo}</>
            )}
          </p>
        </div>
      </Link>

      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          data-action="remove-from-classroom"
          className={css({
            padding: '8px 14px',
            backgroundColor: 'transparent',
            color: isDark ? 'gray.400' : 'gray.500',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.300',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.700' : 'gray.100',
              borderColor: isDark ? 'gray.600' : 'gray.400',
              color: isDark ? 'gray.300' : 'gray.700',
            },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {isRemoving ? 'Removing...' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

/**
 * Format a date as a relative time string (e.g., "2 minutes ago")
 */
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes === 1) return '1 minute ago'
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`

  return 'over a day ago'
}
