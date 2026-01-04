'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { EnrollChildModal } from '@/components/classroom/EnrollChildModal'
import { FamilyCodeDisplay } from '@/components/family'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { type StudentActionData, useStudentActions } from '@/hooks/useStudentActions'
import { css } from '../../../styled-system/css'
import { ACTION_DEFINITIONS } from './studentActions'

// Re-export types for backward compatibility
export type { StudentActionData }
export type StudentForActions = StudentActionData

interface StudentActionMenuProps {
  student: StudentActionData
  /** Optional callback when observe session is clicked (for external handling) */
  onObserveSession?: (sessionId: string) => void
  /** Positioning variant: 'card' for absolute positioning on cards, 'inline' for normal flow */
  variant?: 'card' | 'inline'
}

/**
 * Action menu for student cards
 *
 * A thin component that uses useStudentActions hook for all logic.
 * Renders the dropdown menu and sub-modals.
 *
 * Shows context-appropriate actions based on:
 * - User role (teacher vs parent)
 * - Student status (practicing, present, enrolled, etc.)
 * - Relationship (is my child, etc.)
 */
export function StudentActionMenu({
  student,
  onObserveSession,
  variant = 'card',
}: StudentActionMenuProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { actions, handlers, modals, classrooms } = useStudentActions(student, {
    onObserveSession,
  })

  // If no actions are available, don't render the menu
  const hasAnyAction =
    actions.startPractice ||
    actions.watchSession ||
    actions.enterClassroom ||
    actions.leaveClassroom ||
    actions.removeFromClassroom ||
    actions.enrollInClassroom ||
    actions.unenrollStudent ||
    actions.shareAccess ||
    actions.archive ||
    actions.unarchive

  if (!hasAnyAction) return null

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            data-action="open-menu"
            onClick={(e) => e.stopPropagation()}
            className={css({
              // Card variant: absolute positioned overlay on cards
              ...(variant === 'card' && {
                position: 'absolute',
                top: '6px',
                right: '38px',
              }),
              // Inline variant: normal flow for toolbars
              ...(variant === 'inline' && {
                position: 'relative',
              }),
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isDark ? 'gray.700' : 'gray.100',
              color: isDark ? 'gray.400' : 'gray.500',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'gray.600' : 'gray.200',
                color: isDark ? 'gray.200' : 'gray.700',
              },
            })}
            aria-label="Student actions"
          >
            ⋮
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={css({
              minWidth: '180px',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              padding: '4px',
              boxShadow: 'lg',
              zIndex: Z_INDEX.DROPDOWN,
            })}
            sideOffset={5}
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
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

                {/* Always show enroll option */}
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

      {/* Sub-modals */}
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
    </>
  )
}

function menuItemStyles(isDark: boolean, variant: 'default' | 'danger' = 'default') {
  return css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    color:
      variant === 'danger' ? (isDark ? 'red.400' : 'red.600') : isDark ? 'gray.200' : 'gray.700',
    _hover: {
      backgroundColor:
        variant === 'danger'
          ? isDark
            ? 'red.900/50'
            : 'red.50'
          : isDark
            ? 'gray.700'
            : 'gray.100',
    },
    _focus: {
      backgroundColor:
        variant === 'danger'
          ? isDark
            ? 'red.900/50'
            : 'red.50'
          : isDark
            ? 'gray.700'
            : 'gray.100',
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
