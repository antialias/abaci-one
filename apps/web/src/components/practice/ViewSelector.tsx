'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

/**
 * Available student list views
 */
export type StudentView = 'all' | 'my-children' | 'enrolled' | 'in-classroom'

interface ViewConfig {
  id: StudentView
  label: string
  icon: string
  /** Only show this view to users who have a classroom */
  teacherOnly?: boolean
}

export const VIEW_CONFIGS: ViewConfig[] = [
  {
    id: 'all',
    label: 'All',
    icon: '👥',
  },
  {
    id: 'my-children',
    label: 'My Children',
    icon: '👶',
  },
  {
    id: 'enrolled',
    label: 'Enrolled',
    icon: '📋',
    teacherOnly: true,
  },
  {
    id: 'in-classroom',
    label: 'In Classroom',
    icon: '🏫',
    teacherOnly: true,
  },
]

interface ViewSelectorProps {
  /** Currently selected view */
  currentView: StudentView
  /** Callback when view changes */
  onViewChange: (view: StudentView) => void
  /** Views to show (filtered by user type) */
  availableViews: StudentView[]
  /** Counts per view (e.g., { all: 5, 'my-children': 3 }) */
  viewCounts?: Partial<Record<StudentView, number>>
}

/**
 * View selector chips for filtering student list.
 *
 * Shows view options as clickable chips. Teachers see all 4 views,
 * parents only see "All" and "My Children".
 */
export function ViewSelector({
  currentView,
  onViewChange,
  availableViews,
  viewCounts = {},
}: ViewSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      data-component="view-selector"
      className={css({
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        alignItems: 'center',
      })}
    >
      {availableViews.map((viewId) => {
        const config = VIEW_CONFIGS.find((v) => v.id === viewId)
        if (!config) return null

        const isActive = currentView === viewId
        const count = viewCounts[viewId]

        return (
          <button
            key={viewId}
            type="button"
            data-view={viewId}
            data-active={isActive}
            onClick={() => onViewChange(viewId)}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '16px',
              border: '1px solid',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'medium',
              transition: 'all 0.15s ease',
              // Active state
              bg: isActive ? (isDark ? 'blue.900' : 'blue.100') : isDark ? 'gray.800' : 'white',
              borderColor: isActive
                ? isDark
                  ? 'blue.600'
                  : 'blue.300'
                : isDark
                  ? 'gray.600'
                  : 'gray.300',
              color: isActive
                ? isDark
                  ? 'blue.300'
                  : 'blue.700'
                : isDark
                  ? 'gray.300'
                  : 'gray.700',
              _hover: {
                borderColor: isActive
                  ? isDark
                    ? 'blue.500'
                    : 'blue.400'
                  : isDark
                    ? 'gray.500'
                    : 'gray.400',
                bg: isActive ? (isDark ? 'blue.800' : 'blue.200') : isDark ? 'gray.700' : 'gray.50',
              },
            })}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
            {count !== undefined && (
              <span
                data-element="view-count"
                className={css({
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  bg: isActive
                    ? isDark
                      ? 'blue.700'
                      : 'blue.200'
                    : isDark
                      ? 'gray.700'
                      : 'gray.200',
                })}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Get available views based on whether user is a teacher
 */
export function getAvailableViews(isTeacher: boolean): StudentView[] {
  return VIEW_CONFIGS.filter((v) => !v.teacherOnly || isTeacher).map((v) => v.id)
}

/**
 * Get default view based on user type
 *
 * - Teacher → "Enrolled"
 * - Parent → "All" (or "My Children" if they have enrolled children)
 */
export function getDefaultView(isTeacher: boolean, hasEnrolledChildren?: boolean): StudentView {
  if (isTeacher) return 'enrolled'
  if (hasEnrolledChildren) return 'my-children'
  return 'all'
}
