'use client'

import { useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useStudentStakeholders } from '@/hooks/useStudentStakeholders'
import type {
  EnrolledClassroomInfo,
  ParentInfo,
  PendingEnrollmentInfo,
  PresenceInfo,
  ViewerRelationshipSummary,
} from '@/types/student'
import { css, cx } from '../../../styled-system/css'

// =============================================================================
// Types
// =============================================================================

interface RelationshipCardProps {
  /** The player ID to show relationships for */
  playerId: string
  /** Optional class name */
  className?: string
  /** Whether to show in compact mode (less padding, smaller text) */
  compact?: boolean
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * RelationshipCard - Shows complete relationship information for a student
 *
 * Displays:
 * - Viewer's relationship to the student (prominent)
 * - All linked parents
 * - All enrolled classrooms (with teachers)
 * - Any pending enrollment requests
 * - Current classroom presence
 */
export function RelationshipCard({ playerId, className, compact = false }: RelationshipCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data, isLoading } = useStudentStakeholders(playerId)

  if (isLoading) {
    return (
      <div
        data-component="relationship-card"
        data-status="loading"
        className={cx(
          css({
            padding: compact ? '12px' : '16px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          }),
          className
        )}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: isDark ? 'gray.400' : 'gray.500',
            fontSize: compact ? '0.8125rem' : '0.875rem',
          })}
        >
          <span className={css({ animation: 'pulse 1.5s ease-in-out infinite' })}>Loading...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { stakeholders, viewerRelationship } = data

  return (
    <div
      data-component="relationship-card"
      className={cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? '12px' : '16px',
        }),
        className
      )}
    >
      {/* Viewer's Relationship - Primary/Prominent */}
      <ViewerRelationshipSection
        relationship={viewerRelationship}
        presence={stakeholders.currentPresence}
        isDark={isDark}
        compact={compact}
      />

      {/* Other Stakeholders */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? '8px' : '12px',
        })}
      >
        {/* Parents Section */}
        {stakeholders.parents.length > 0 && (
          <StakeholderSection title="Parents" icon="👪" isDark={isDark} compact={compact}>
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '6px' })}>
              {stakeholders.parents.map((parent) => (
                <ParentBadge key={parent.id} parent={parent} isDark={isDark} compact={compact} />
              ))}
            </div>
          </StakeholderSection>
        )}

        {/* Classrooms Section */}
        {stakeholders.enrolledClassrooms.length > 0 && (
          <StakeholderSection title="Classrooms" icon="🏫" isDark={isDark} compact={compact}>
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              })}
            >
              {stakeholders.enrolledClassrooms.map((classroom) => (
                <ClassroomRow
                  key={classroom.id}
                  classroom={classroom}
                  isPresent={stakeholders.currentPresence?.classroomId === classroom.id}
                  isDark={isDark}
                  compact={compact}
                />
              ))}
            </div>
          </StakeholderSection>
        )}

        {/* Pending Enrollments */}
        {stakeholders.pendingEnrollments.length > 0 && (
          <StakeholderSection title="Pending" icon="⌛" isDark={isDark} compact={compact}>
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              })}
            >
              {stakeholders.pendingEnrollments.map((pending) => (
                <PendingRow key={pending.id} pending={pending} isDark={isDark} compact={compact} />
              ))}
            </div>
          </StakeholderSection>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Viewer Relationship Section (Primary/Prominent)
// =============================================================================

interface ViewerRelationshipSectionProps {
  relationship: ViewerRelationshipSummary
  presence: PresenceInfo | null
  isDark: boolean
  compact: boolean
}

function ViewerRelationshipSection({
  relationship,
  presence,
  isDark,
  compact,
}: ViewerRelationshipSectionProps) {
  const config = useMemo(() => {
    switch (relationship.type) {
      case 'parent':
        return {
          icon: '🏠', // house
          title: 'Your Child',
          subtitle: 'You have full access to this student',
          color: {
            light: {
              bg: 'blue.50',
              border: 'blue.200',
              text: 'blue.700',
              accent: 'blue.600',
            },
            dark: {
              bg: 'blue.900/40',
              border: 'blue.700',
              text: 'blue.300',
              accent: 'blue.400',
            },
          },
        }
      case 'teacher':
        return {
          icon: '📚', // books
          title: 'Your Student',
          subtitle: relationship.classroomName
            ? `Enrolled in ${relationship.classroomName}`
            : 'Enrolled in your classroom',
          color: {
            light: {
              bg: 'purple.50',
              border: 'purple.200',
              text: 'purple.700',
              accent: 'purple.600',
            },
            dark: {
              bg: 'purple.900/40',
              border: 'purple.700',
              text: 'purple.300',
              accent: 'purple.400',
            },
          },
        }
      case 'observer':
        return {
          icon: '👀', // eyes
          title: 'Visiting Student',
          subtitle: presence ? `Present in ${presence.classroomName}` : 'In your classroom',
          color: {
            light: {
              bg: 'emerald.50',
              border: 'emerald.200',
              text: 'emerald.700',
              accent: 'emerald.600',
            },
            dark: {
              bg: 'emerald.900/40',
              border: 'emerald.700',
              text: 'emerald.300',
              accent: 'emerald.400',
            },
          },
        }
      default:
        return {
          icon: '👤', // person silhouette
          title: 'Student',
          subtitle: 'No direct relationship',
          color: {
            light: {
              bg: 'gray.50',
              border: 'gray.200',
              text: 'gray.600',
              accent: 'gray.500',
            },
            dark: {
              bg: 'gray.800',
              border: 'gray.700',
              text: 'gray.400',
              accent: 'gray.500',
            },
          },
        }
    }
  }, [relationship, presence])

  const colors = isDark ? config.color.dark : config.color.light

  return (
    <div
      data-element="viewer-relationship"
      className={css({
        padding: compact ? '12px' : '16px',
        borderRadius: '12px',
        border: '2px solid',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '10px' : '14px',
      })}
      style={{
        backgroundColor: `var(--colors-${colors.bg.replace(/[./]/g, '-')})`,
        borderColor: `var(--colors-${colors.border.replace(/[./]/g, '-')})`,
      }}
    >
      {/* Icon */}
      <div
        className={css({
          width: compact ? '40px' : '48px',
          height: compact ? '40px' : '48px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '1.25rem' : '1.5rem',
          flexShrink: 0,
        })}
        style={{
          backgroundColor: `var(--colors-${colors.accent.replace(/[./]/g, '-')})`,
          color: 'white',
        }}
      >
        {config.icon}
      </div>

      {/* Text */}
      <div className={css({ flex: 1, minWidth: 0 })}>
        <div
          className={css({
            fontSize: compact ? '0.9375rem' : '1rem',
            fontWeight: 'semibold',
          })}
          style={{
            color: `var(--colors-${colors.text.replace(/[./]/g, '-')})`,
          }}
        >
          {config.title}
        </div>
        <div
          className={css({
            fontSize: compact ? '0.75rem' : '0.8125rem',
            marginTop: '2px',
          })}
          style={{
            color: `var(--colors-${colors.text.replace(/[./]/g, '-')})`,
            opacity: 0.8,
          }}
        >
          {config.subtitle}
        </div>
      </div>

      {/* Live indicator for presence */}
      {presence && relationship.type !== 'none' && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 'medium',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backgroundColor: isDark ? 'emerald.800/60' : 'emerald.100',
            color: isDark ? 'emerald.300' : 'emerald.700',
          })}
        >
          <span
            className={css({
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'emerald.500',
              animation: 'pulse 2s ease-in-out infinite',
            })}
          />
          Live
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Stakeholder Section
// =============================================================================

interface StakeholderSectionProps {
  title: string
  icon: string
  isDark: boolean
  compact: boolean
  children: React.ReactNode
}

function StakeholderSection({ title, icon, isDark, compact, children }: StakeholderSectionProps) {
  return (
    <div
      data-element={`stakeholder-section-${title.toLowerCase()}`}
      className={css({
        padding: compact ? '10px' : '12px',
        borderRadius: '10px',
        backgroundColor: isDark ? 'gray.800/50' : 'gray.50',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      {/* Section header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: compact ? '8px' : '10px',
        })}
      >
        <span className={css({ fontSize: compact ? '0.875rem' : '1rem' })}>{icon}</span>
        <span
          className={css({
            fontSize: compact ? '0.6875rem' : '0.75rem',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          {title}
        </span>
      </div>

      {/* Content */}
      {children}
    </div>
  )
}

// =============================================================================
// Parent Badge
// =============================================================================

interface ParentBadgeProps {
  parent: ParentInfo
  isDark: boolean
  compact: boolean
}

function ParentBadge({ parent, isDark, compact }: ParentBadgeProps) {
  // Get initials
  const initials = parent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      data-element="parent-badge"
      data-is-me={parent.isMe}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '4px 8px' : '6px 10px',
        borderRadius: '8px',
        border: '1px solid',
      })}
      style={{
        backgroundColor: parent.isMe
          ? isDark
            ? 'var(--colors-blue-900)'
            : 'var(--colors-blue-50)'
          : isDark
            ? 'var(--colors-gray-700)'
            : 'var(--colors-gray-100)',
        borderColor: parent.isMe
          ? isDark
            ? 'var(--colors-blue-700)'
            : 'var(--colors-blue-200)'
          : isDark
            ? 'var(--colors-gray-600)'
            : 'var(--colors-gray-200)',
      }}
    >
      {/* Avatar */}
      <div
        className={css({
          width: compact ? '20px' : '24px',
          height: compact ? '20px' : '24px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '0.625rem' : '0.6875rem',
          fontWeight: 'bold',
          color: 'white',
          flexShrink: 0,
        })}
        style={{
          backgroundColor: parent.isMe
            ? 'var(--colors-blue-500)'
            : isDark
              ? 'var(--colors-gray-500)'
              : 'var(--colors-gray-400)',
        }}
      >
        {initials}
      </div>

      {/* Name */}
      <span
        className={css({
          fontSize: compact ? '0.75rem' : '0.8125rem',
          fontWeight: parent.isMe ? 'medium' : 'normal',
        })}
        style={{
          color: parent.isMe
            ? isDark
              ? 'var(--colors-blue-300)'
              : 'var(--colors-blue-700)'
            : isDark
              ? 'var(--colors-gray-300)'
              : 'var(--colors-gray-700)',
        }}
      >
        {parent.isMe ? 'You' : parent.name}
      </span>
    </div>
  )
}

// =============================================================================
// Classroom Row
// =============================================================================

interface ClassroomRowProps {
  classroom: EnrolledClassroomInfo
  isPresent: boolean
  isDark: boolean
  compact: boolean
}

function ClassroomRow({ classroom, isPresent, isDark, compact }: ClassroomRowProps) {
  return (
    <div
      data-element="classroom-row"
      data-is-mine={classroom.isMyClassroom}
      data-is-present={isPresent}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '6px 8px' : '8px 10px',
        borderRadius: '6px',
        border: '1px solid',
      })}
      style={{
        backgroundColor: classroom.isMyClassroom
          ? isDark
            ? 'var(--colors-purple-900)'
            : 'var(--colors-purple-50)'
          : 'transparent',
        borderColor: classroom.isMyClassroom
          ? isDark
            ? 'var(--colors-purple-700)'
            : 'var(--colors-purple-200)'
          : isDark
            ? 'var(--colors-gray-700)'
            : 'var(--colors-gray-200)',
      }}
    >
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        })}
      >
        <div
          className={css({
            fontSize: compact ? '0.75rem' : '0.8125rem',
            fontWeight: classroom.isMyClassroom ? 'medium' : 'normal',
          })}
          style={{
            color: classroom.isMyClassroom
              ? isDark
                ? 'var(--colors-purple-300)'
                : 'var(--colors-purple-700)'
              : isDark
                ? 'var(--colors-gray-200)'
                : 'var(--colors-gray-700)',
          }}
        >
          {classroom.name}
          {classroom.isMyClassroom && ' (Your classroom)'}
        </div>
        <div
          className={css({
            fontSize: compact ? '0.6875rem' : '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          {classroom.teacherName}
        </div>
      </div>

      {isPresent && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.625rem',
            fontWeight: 'medium',
            backgroundColor: isDark ? 'emerald.800/60' : 'emerald.100',
            color: isDark ? 'emerald.300' : 'emerald.700',
          })}
        >
          <span
            className={css({
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: 'emerald.500',
              animation: 'pulse 2s ease-in-out infinite',
            })}
          />
          Present
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Pending Row
// =============================================================================

interface PendingRowProps {
  pending: PendingEnrollmentInfo
  isDark: boolean
  compact: boolean
}

function PendingRow({ pending, isDark, compact }: PendingRowProps) {
  return (
    <div
      data-element="pending-row"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '6px 8px' : '8px 10px',
        borderRadius: '6px',
        backgroundColor: isDark ? 'amber.900/30' : 'amber.50',
        border: '1px solid',
        borderColor: isDark ? 'amber.800' : 'amber.200',
      })}
    >
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        })}
      >
        <div
          className={css({
            fontSize: compact ? '0.75rem' : '0.8125rem',
            color: isDark ? 'amber.200' : 'amber.800',
          })}
        >
          {pending.classroomName}
        </div>
        <div
          className={css({
            fontSize: compact ? '0.6875rem' : '0.75rem',
            color: isDark ? 'amber.400' : 'amber.600',
          })}
        >
          {pending.teacherName}
        </div>
      </div>

      <div
        className={css({
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.625rem',
          fontWeight: 'medium',
          backgroundColor: isDark ? 'amber.800/60' : 'amber.100',
          color: isDark ? 'amber.300' : 'amber.700',
        })}
      >
        {pending.pendingApproval === 'teacher' ? 'Needs Teacher' : 'Needs Parent'}
      </div>
    </div>
  )
}

// =============================================================================
// Exports
// =============================================================================

export type { RelationshipCardProps }
