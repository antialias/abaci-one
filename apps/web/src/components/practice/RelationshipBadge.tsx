'use client'

import { useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { StudentRelationship, ViewerRelationType } from '@/types/student'
import { css, cx } from '../../../styled-system/css'
import { Tooltip } from '../ui/Tooltip'

// =============================================================================
// Types
// =============================================================================

interface RelationshipBadgeProps {
  /**
   * The relationship data - can be the simple StudentRelationship or
   * a ViewerRelationType string for when you already know the type
   */
  relationship: StudentRelationship | ViewerRelationType | null
  /**
   * Optional count of other stakeholders (e.g., "2 other parents")
   * Shown in tooltip when provided
   */
  otherStakeholderCount?: {
    parents: number
    teachers: number
  }
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional class name */
  className?: string
  /** Whether to show tooltip on hover (default: true) */
  showTooltip?: boolean
}

// =============================================================================
// Configuration
// =============================================================================

interface RelationshipConfig {
  icon: string
  label: string
  description: string
  color: {
    light: { bg: string; border: string; icon: string }
    dark: { bg: string; border: string; icon: string }
  }
}

const RELATIONSHIP_CONFIGS: Record<ViewerRelationType, RelationshipConfig> = {
  parent: {
    icon: '🏠', // house emoji
    label: 'Your Child',
    description: 'You have full access to this student',
    color: {
      light: { bg: 'blue.100', border: 'blue.300', icon: 'blue.600' },
      dark: { bg: 'blue.900/60', border: 'blue.700', icon: 'blue.400' },
    },
  },
  teacher: {
    icon: '📚', // books emoji
    label: 'Your Student',
    description: 'Enrolled in your classroom',
    color: {
      light: { bg: 'purple.100', border: 'purple.300', icon: 'purple.600' },
      dark: { bg: 'purple.900/60', border: 'purple.700', icon: 'purple.400' },
    },
  },
  observer: {
    icon: '📍', // location pin emoji
    label: 'Visiting',
    description: 'Present in your classroom',
    color: {
      light: { bg: 'emerald.100', border: 'emerald.300', icon: 'emerald.600' },
      dark: { bg: 'emerald.900/60', border: 'emerald.700', icon: 'emerald.400' },
    },
  },
  none: {
    icon: '👤', // person silhouette emoji
    label: 'Student',
    description: 'No direct relationship',
    color: {
      light: { bg: 'gray.100', border: 'gray.300', icon: 'gray.500' },
      dark: { bg: 'gray.800', border: 'gray.700', icon: 'gray.500' },
    },
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert StudentRelationship to ViewerRelationType
 * Priority: parent > teacher > observer > none
 */
function getRelationType(
  relationship: StudentRelationship | ViewerRelationType | null
): ViewerRelationType {
  if (!relationship) return 'none'

  // If already a string type, return it
  if (typeof relationship === 'string') {
    return relationship
  }

  // Convert StudentRelationship to type
  if (relationship.isMyChild) return 'parent'
  if (relationship.isEnrolled) return 'teacher'
  if (relationship.isPresent) return 'observer'
  return 'none'
}

/**
 * Build tooltip content with optional stakeholder counts
 */
function buildTooltipContent(
  config: RelationshipConfig,
  otherStakeholders?: { parents: number; teachers: number }
): string {
  const lines = [config.label]

  if (otherStakeholders) {
    const parts: string[] = []
    if (otherStakeholders.parents > 0) {
      parts.push(
        `${otherStakeholders.parents} other parent${otherStakeholders.parents > 1 ? 's' : ''}`
      )
    }
    if (otherStakeholders.teachers > 0) {
      parts.push(
        `${otherStakeholders.teachers} teacher${otherStakeholders.teachers > 1 ? 's' : ''}`
      )
    }
    if (parts.length > 0) {
      lines.push(parts.join(' • '))
    }
  }

  return lines.join('\n')
}

// =============================================================================
// Component
// =============================================================================

/**
 * RelationshipBadge - Compact icon showing viewer's relationship to a student
 *
 * Used on student tiles to quickly identify relationship at a glance.
 * Shows colored icon with optional tooltip for more details.
 *
 * Colors:
 * - Blue (🏠): Parent - this is your child
 * - Purple (📚): Teacher - enrolled in your classroom
 * - Emerald (📍): Observer - visiting your classroom
 * - Gray (👤): None - no direct relationship
 */
export function RelationshipBadge({
  relationship,
  otherStakeholderCount,
  size = 'md',
  className,
  showTooltip = true,
}: RelationshipBadgeProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const relationType = useMemo(() => getRelationType(relationship), [relationship])
  const config = RELATIONSHIP_CONFIGS[relationType]
  const colors = isDark ? config.color.dark : config.color.light

  // Don't render anything for "none" relationship (or show a subtle indicator)
  if (relationType === 'none') {
    return null
  }

  const badgeSize = size === 'sm' ? '22px' : '26px'
  const fontSize = size === 'sm' ? '0.75rem' : '0.875rem'

  const tooltipContent = useMemo(
    () => buildTooltipContent(config, otherStakeholderCount),
    [config, otherStakeholderCount]
  )

  const badge = (
    <div
      data-component="relationship-badge"
      data-type={relationType}
      className={cx(
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: '1px solid',
          flexShrink: 0,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          cursor: showTooltip ? 'help' : 'default',
          _hover: showTooltip
            ? {
                transform: 'scale(1.1)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }
            : {},
        }),
        className
      )}
      style={{
        width: badgeSize,
        height: badgeSize,
        fontSize,
        backgroundColor: `var(--colors-${colors.bg.replace(/[./]/g, '-')})`,
        borderColor: `var(--colors-${colors.border.replace(/[./]/g, '-')})`,
      }}
    >
      <span
        style={{
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
        }}
      >
        {config.icon}
      </span>
    </div>
  )

  if (showTooltip) {
    return (
      <Tooltip content={tooltipContent} side="right" delayDuration={200}>
        {badge}
      </Tooltip>
    )
  }

  return badge
}

// =============================================================================
// Companion: Relationship Summary Line
// =============================================================================

interface RelationshipSummaryProps {
  /** Relationship type */
  type: ViewerRelationType
  /** Optional: classroom name for teacher/observer */
  classroomName?: string
  /** Optional: counts of other stakeholders */
  otherStakeholders?: {
    parents: number
    teachers: number
  }
  /** Additional class name */
  className?: string
}

/**
 * RelationshipSummary - One-line text summary of relationship
 *
 * Used in card headers and modal subtitles.
 * Example outputs:
 * - "Your Child"
 * - "Your Child • 1 other parent"
 * - "Your Student • Math 101"
 * - "Visiting • 2 teachers"
 */
export function RelationshipSummary({
  type,
  classroomName,
  otherStakeholders,
  className,
}: RelationshipSummaryProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const config = RELATIONSHIP_CONFIGS[type]

  const parts: string[] = [config.label]

  // Add classroom name for teachers/observers
  if (classroomName && (type === 'teacher' || type === 'observer')) {
    parts.push(classroomName)
  }

  // Add other stakeholder counts
  if (otherStakeholders) {
    const stakeholderParts: string[] = []
    if (otherStakeholders.parents > 0) {
      stakeholderParts.push(
        `${otherStakeholders.parents} other parent${otherStakeholders.parents > 1 ? 's' : ''}`
      )
    }
    if (otherStakeholders.teachers > 0) {
      stakeholderParts.push(
        `${otherStakeholders.teachers} teacher${otherStakeholders.teachers > 1 ? 's' : ''}`
      )
    }
    if (stakeholderParts.length > 0) {
      parts.push(stakeholderParts.join(', '))
    }
  }

  if (type === 'none') {
    return null
  }

  return (
    <span
      data-component="relationship-summary"
      className={cx(
        css({
          fontSize: '0.75rem',
          fontWeight: 'medium',
        }),
        className
      )}
      style={{
        color: isDark
          ? `var(--colors-${config.color.dark.icon.replace(/[./]/g, '-')})`
          : `var(--colors-${config.color.light.icon.replace(/[./]/g, '-')})`,
      }}
    >
      {parts.join(' • ')}
    </span>
  )
}

// =============================================================================
// Exports
// =============================================================================

export { RELATIONSHIP_CONFIGS, getRelationType }
export type { RelationshipBadgeProps, RelationshipSummaryProps, RelationshipConfig }
