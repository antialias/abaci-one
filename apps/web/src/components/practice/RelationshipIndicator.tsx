'use client'

import { useMemo } from 'react'
import type { StudentRelationship, EnrollmentStatus } from '@/types/student'
import { useTheme } from '@/contexts/ThemeContext'
import { css, cx } from '../../../styled-system/css'
import { Tooltip } from '../ui/Tooltip'

/**
 * Individual relationship badge data
 */
interface RelationshipBadge {
  key: string
  icon: string
  label: string
  color: {
    light: { bg: string; text: string; border: string }
    dark: { bg: string; text: string; border: string }
  }
  /** Whether to show a pulse animation (for real-time indicators like "present") */
  pulse?: boolean
}

/**
 * Configuration for all relationship types
 */
const RELATIONSHIP_BADGES: Record<string, RelationshipBadge> = {
  myChild: {
    key: 'myChild',
    icon: '🏠', // house emoji
    label: 'My Child',
    color: {
      light: { bg: 'blue.50', text: 'blue.700', border: 'blue.200' },
      dark: { bg: 'blue.900/40', text: 'blue.300', border: 'blue.700' },
    },
  },
  enrolled: {
    key: 'enrolled',
    icon: '\u2713', // checkmark
    label: 'Enrolled',
    color: {
      light: { bg: 'green.50', text: 'green.700', border: 'green.200' },
      dark: { bg: 'green.900/40', text: 'green.300', border: 'green.700' },
    },
  },
  present: {
    key: 'present',
    icon: '📍', // location pin emoji
    label: 'In Class',
    color: {
      light: { bg: 'emerald.50', text: 'emerald.700', border: 'emerald.200' },
      dark: {
        bg: 'emerald.900/40',
        text: 'emerald.300',
        border: 'emerald.700',
      },
    },
    pulse: true,
  },
  pendingTeacher: {
    key: 'pendingTeacher',
    icon: '⌛', // hourglass emoji
    label: 'Pending (Teacher)',
    color: {
      light: { bg: 'amber.50', text: 'amber.700', border: 'amber.200' },
      dark: { bg: 'amber.900/40', text: 'amber.300', border: 'amber.700' },
    },
  },
  pendingParent: {
    key: 'pendingParent',
    icon: '⌛', // hourglass emoji
    label: 'Pending (Parent)',
    color: {
      light: { bg: 'amber.50', text: 'amber.700', border: 'amber.200' },
      dark: { bg: 'amber.900/40', text: 'amber.300', border: 'amber.700' },
    },
  },
}

/**
 * Get the pending badge based on enrollment status
 */
function getPendingBadge(status: EnrollmentStatus): RelationshipBadge | null {
  if (status === 'pending-teacher') return RELATIONSHIP_BADGES.pendingTeacher
  if (status === 'pending-parent') return RELATIONSHIP_BADGES.pendingParent
  return null
}

/**
 * Convert StudentRelationship to array of badges to display
 */
function getActiveBadges(relationship: StudentRelationship): RelationshipBadge[] {
  const badges: RelationshipBadge[] = []

  // Order by importance: My Child > Enrolled > Present > Pending
  if (relationship.isMyChild) {
    badges.push(RELATIONSHIP_BADGES.myChild)
  }
  if (relationship.isEnrolled) {
    badges.push(RELATIONSHIP_BADGES.enrolled)
  }
  if (relationship.isPresent) {
    badges.push(RELATIONSHIP_BADGES.present)
  }
  const pendingBadge = getPendingBadge(relationship.enrollmentStatus)
  if (pendingBadge) {
    badges.push(pendingBadge)
  }

  return badges
}

export interface RelationshipIndicatorProps {
  /** The relationship data to display */
  relationship: StudentRelationship
  /** Display variant: 'compact' for tiles, 'full' for dashboard/modal */
  variant: 'compact' | 'full'
  /** Show tooltip on hover (only applies to compact variant) */
  showTooltip?: boolean
  /** Additional class name */
  className?: string
}

/**
 * Displays relationship indicators (My Child, Enrolled, Present, Pending)
 *
 * Two variants:
 * - `compact`: Small stacked icons with optional tooltips (for student tiles)
 * - `full`: Horizontal row of labeled badges (for dashboard/modal)
 */
export function RelationshipIndicator({
  relationship,
  variant,
  showTooltip = false,
  className,
}: RelationshipIndicatorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const badges = useMemo(() => getActiveBadges(relationship), [relationship])

  // Don't render if no relationships
  if (badges.length === 0) {
    return null
  }

  if (variant === 'compact') {
    return (
      <div
        data-element="relationship-indicator-compact"
        className={cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }),
          className
        )}
      >
        {badges.map((badge) => (
          <CompactBadge key={badge.key} badge={badge} isDark={isDark} showTooltip={showTooltip} />
        ))}
      </div>
    )
  }

  // Full variant: horizontal row with labels
  return (
    <div
      data-element="relationship-indicator-full"
      className={cx(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }),
        className
      )}
    >
      {badges.map((badge) => (
        <FullBadge key={badge.key} badge={badge} isDark={isDark} />
      ))}
    </div>
  )
}

/**
 * Compact badge: icon only with optional tooltip
 */
function CompactBadge({
  badge,
  isDark,
  showTooltip,
}: {
  badge: RelationshipBadge
  isDark: boolean
  showTooltip: boolean
}) {
  const colors = isDark ? badge.color.dark : badge.color.light

  const badgeElement = (
    <div
      data-badge={badge.key}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        border: '1px solid',
        transition: 'transform 0.15s ease',
        cursor: showTooltip ? 'help' : 'default',
        _hover: showTooltip ? { transform: 'scale(1.1)' } : {},
      })}
      style={{
        backgroundColor: `var(--colors-${colors.bg.replace(/[./]/g, '-')})`,
        borderColor: `var(--colors-${colors.border.replace(/[./]/g, '-')})`,
        color: `var(--colors-${colors.text.replace(/[./]/g, '-')})`,
      }}
    >
      {badge.icon}
      {badge.pulse && (
        <span
          className={css({
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'emerald.500',
            animation: 'pulse 2s ease-in-out infinite',
          })}
        />
      )}
    </div>
  )

  if (showTooltip) {
    return (
      <Tooltip content={badge.label} side="right" delayDuration={100}>
        {badgeElement}
      </Tooltip>
    )
  }

  return badgeElement
}

/**
 * Full badge: icon + label
 */
function FullBadge({ badge, isDark }: { badge: RelationshipBadge; isDark: boolean }) {
  const colors = isDark ? badge.color.dark : badge.color.light

  return (
    <div
      data-badge={badge.key}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 'medium',
        border: '1px solid',
        position: 'relative',
      })}
      style={{
        backgroundColor: `var(--colors-${colors.bg.replace(/[./]/g, '-')})`,
        borderColor: `var(--colors-${colors.border.replace(/[./]/g, '-')})`,
        color: `var(--colors-${colors.text.replace(/[./]/g, '-')})`,
      }}
    >
      <span className={css({ fontSize: '0.8125rem' })}>{badge.icon}</span>
      <span>{badge.label}</span>
      {badge.pulse && (
        <span
          className={css({
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'emerald.500',
            animation: 'pulse 2s ease-in-out infinite',
          })}
        />
      )}
    </div>
  )
}

// Re-export types for convenience
export type { RelationshipBadge }
export { RELATIONSHIP_BADGES, getActiveBadges }
