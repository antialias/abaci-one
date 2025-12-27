'use client'

import * as Checkbox from '@radix-ui/react-checkbox'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/types/player'
import { css } from '../../../styled-system/css'
import { NotesModal } from './NotesModal'
import { StudentActionMenu } from './StudentActionMenu'
import {
  avatarStyles,
  badgeStyles,
  centerStack,
  fontBold,
  gapLg,
  gapMd,
  gapSm,
  paddingLg,
  paddingMd,
  progressBarContainerStyles,
  progressBarFillStyles,
  roundedLg,
  textBase,
  textSm,
  themed,
  transitionNormal,
  wrap,
} from './styles'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the next student in a given direction based on bounding rects.
 * Used for arrow key navigation in the QuickLook modal.
 */
function findNextStudent(
  currentId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  cardRefs: Map<string, HTMLDivElement>
): { studentId: string; bounds: DOMRect } | null {
  const currentRef = cardRefs.get(currentId)
  if (!currentRef) return null

  const currentRect = currentRef.getBoundingClientRect()
  const currentCenterX = currentRect.left + currentRect.width / 2
  const currentCenterY = currentRect.top + currentRect.height / 2

  let bestCandidate: { studentId: string; bounds: DOMRect; distance: number } | null = null

  for (const [studentId, ref] of cardRefs) {
    if (studentId === currentId) continue

    const rect = ref.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Check if this card is in the correct direction
    let isValidDirection = false
    switch (direction) {
      case 'left':
        isValidDirection = centerX < currentCenterX - 10
        break
      case 'right':
        isValidDirection = centerX > currentCenterX + 10
        break
      case 'up':
        isValidDirection = centerY < currentCenterY - 10
        break
      case 'down':
        isValidDirection = centerY > currentCenterY + 10
        break
    }

    if (!isValidDirection) continue

    // Calculate distance with preference for the primary direction
    let distance: number
    if (direction === 'left' || direction === 'right') {
      // Horizontal: prioritize same row (small Y difference)
      const yPenalty = Math.abs(centerY - currentCenterY) * 2
      distance = Math.abs(centerX - currentCenterX) + yPenalty
    } else {
      // Vertical: prioritize same column (small X difference)
      const xPenalty = Math.abs(centerX - currentCenterX) * 2
      distance = Math.abs(centerY - currentCenterY) + xPenalty
    }

    if (!bestCandidate || distance < bestCandidate.distance) {
      bestCandidate = { studentId, bounds: rect, distance }
    }
  }

  return bestCandidate ? { studentId: bestCandidate.studentId, bounds: bestCandidate.bounds } : null
}

// ============================================================================
// Types
// ============================================================================

/**
 * Intervention data for students needing attention
 */
export interface StudentIntervention {
  type: 'struggling' | 'declining' | 'stale' | 'absent' | 'plateau'
  severity: 'high' | 'medium' | 'low'
  message: string
  icon: string
}

/**
 * Student data with curriculum info for display
 */
export interface StudentWithProgress extends Player {
  currentLevel?: number
  currentPhaseId?: string
  masteryPercent?: number
  isArchived?: boolean
  practicingSkills?: string[]
  lastPracticedAt?: Date | null
  skillCategory?: string | null
  intervention?: StudentIntervention | null
}

interface StudentCardProps {
  student: StudentWithProgress
  onSelect: (student: StudentWithProgress) => void
  onOpenQuickLook: (student: StudentWithProgress, bounds: DOMRect) => void
  editMode?: boolean
  isSelected?: boolean
  /** Callback when observe session is clicked */
  onObserveSession?: (sessionId: string) => void
  /** Callback to register card ref for keyboard navigation */
  onRegisterRef?: (studentId: string, ref: HTMLDivElement | null) => void
}

/**
 * Individual student card showing avatar, name, and progress
 * Clicking navigates to the student's practice page (or toggles selection in edit mode)
 */
function StudentCard({
  student,
  onSelect,
  onOpenQuickLook,
  editMode,
  isSelected,
  onObserveSession,
  onRegisterRef,
}: StudentCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const levelLabel = student.currentLevel ? `Lv.${student.currentLevel}` : 'New'
  const cardRef = useRef<HTMLDivElement>(null)
  const isArchived = student.isArchived ?? false

  // Register ref for keyboard navigation
  useEffect(() => {
    if (onRegisterRef && cardRef.current) {
      onRegisterRef(student.id, cardRef.current)
    }
    return () => {
      if (onRegisterRef) {
        onRegisterRef(student.id, null)
      }
    }
  }, [student.id, onRegisterRef])

  // Check for unified student fields (relationship/activity) at runtime
  // These are present when using the unified student list
  const relationship = (
    student as {
      relationship?: {
        isMyChild: boolean
        isEnrolled: boolean
        isPresent: boolean
        enrollmentStatus: string | null
      }
    }
  ).relationship
  const activity = (
    student as {
      activity?: {
        status: string
        sessionProgress?: { current: number; total: number }
        sessionId?: string
      }
    }
  ).activity

  const handleQuickLookClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (cardRef.current) {
        const bounds = cardRef.current.getBoundingClientRect()
        onOpenQuickLook(student, bounds)
      }
    },
    [student, onOpenQuickLook]
  )

  return (
    <div
      ref={cardRef}
      data-component="student-card"
      data-archived={isArchived}
      data-selected={isSelected}
      className={css({
        ...centerStack,
        ...gapSm,
        ...paddingMd,
        ...roundedLg,
        ...transitionNormal,
        border: '2px solid',
        borderColor: isSelected
          ? 'blue.500'
          : isArchived
            ? isDark
              ? 'gray.700'
              : 'gray.300'
            : themed('border', isDark),
        backgroundColor: isArchived
          ? isDark
            ? 'gray.800/50'
            : 'gray.100'
          : themed('surface', isDark),
        minWidth: '100px',
        position: 'relative',
        opacity: isArchived ? 0.6 : 1,
      })}
    >
      {/* Edit mode checkbox */}
      {editMode && (
        <Checkbox.Root
          data-element="checkbox"
          checked={isSelected}
          onCheckedChange={() => onSelect(student)}
          className={css({
            position: 'absolute',
            top: '6px',
            left: '6px',
            width: '22px',
            height: '22px',
            borderRadius: '4px',
            border: '2px solid',
            borderColor: isSelected ? 'blue.500' : isDark ? 'gray.500' : 'gray.400',
            backgroundColor: isSelected ? 'blue.500' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 1,
            _hover: {
              borderColor: 'blue.400',
            },
          })}
        >
          <Checkbox.Indicator
            className={css({
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            })}
          >
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
      )}

      {/* Archived badge */}
      {isArchived && (
        <div
          data-element="archived-badge"
          className={css({
            position: 'absolute',
            top: '6px',
            left: editMode ? '32px' : '6px',
            padding: '2px 6px',
            bg: isDark ? 'gray.700' : 'gray.300',
            color: isDark ? 'gray.400' : 'gray.600',
            fontSize: '10px',
            fontWeight: 'medium',
            borderRadius: '4px',
          })}
        >
          Archived
        </div>
      )}

      {/* Self-contained action menu - uses hooks internally for all actions */}
      <StudentActionMenu
        student={{
          id: student.id,
          name: student.name,
          isArchived: student.isArchived,
          relationship,
          activity,
        }}
        onObserveSession={onObserveSession}
      />

      {/* QuickLook button */}
      <button
        type="button"
        data-action="open-quicklook"
        onClick={handleQuickLookClick}
        className={css({
          position: 'absolute',
          top: '6px',
          right: '6px',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: isDark ? 'gray.700' : 'gray.100',
          color: isDark ? 'gray.400' : 'gray.500',
          fontSize: '0.875rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          _hover: {
            backgroundColor: isDark ? 'gray.600' : 'gray.200',
            color: isDark ? 'gray.200' : 'gray.700',
            transform: 'scale(1.1)',
          },
        })}
        title="Quick look"
      >
        👁
      </button>

      {/* Main clickable area */}
      <button
        type="button"
        data-action="select-student"
        onClick={() => onSelect(student)}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          paddingTop: '1.5rem', // Extra space for the notes/checkbox
          width: '100%',
          _hover: {
            '& > div:first-child': {
              transform: 'scale(1.05)',
            },
          },
        })}
      >
        {/* Avatar */}
        <div
          className={css({
            ...avatarStyles('md'),
            transition: 'transform 0.15s ease',
            filter: isArchived ? 'grayscale(0.5)' : 'none',
          })}
          style={{ backgroundColor: student.color }}
        >
          {student.emoji}
        </div>

        {/* Name */}
        <span
          className={css({
            ...fontBold,
            ...textBase,
            color: isArchived ? (isDark ? 'gray.500' : 'gray.500') : themed('text', isDark),
          })}
        >
          {student.name}
        </span>

        {/* Status badges row - only show if unified student data is available */}
        {(activity?.status === 'practicing' ||
          activity?.status === 'learning' ||
          relationship?.isPresent ||
          relationship?.isEnrolled ||
          relationship?.isMyChild ||
          relationship?.enrollmentStatus) && (
          <div
            data-element="status-badges"
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '4px',
              marginTop: '2px',
            })}
          >
            {/* Practicing badge - highest priority */}
            {activity?.status === 'practicing' && (
              <span
                data-status="practicing"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'medium',
                  bg: isDark ? 'blue.900' : 'blue.100',
                  color: isDark ? 'blue.300' : 'blue.700',
                  animation: 'pulse 2s infinite',
                })}
              >
                <span>📝</span>
                <span>Practicing</span>
              </span>
            )}

            {/* Learning badge */}
            {activity?.status === 'learning' && (
              <span
                data-status="learning"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'medium',
                  bg: isDark ? 'purple.900' : 'purple.100',
                  color: isDark ? 'purple.300' : 'purple.700',
                  animation: 'pulse 2s infinite',
                })}
              >
                <span>📚</span>
                <span>Learning</span>
              </span>
            )}

            {/* Present badge - only show if not practicing/learning */}
            {relationship?.isPresent &&
              activity?.status !== 'practicing' &&
              activity?.status !== 'learning' && (
                <span
                  data-status="present"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 'medium',
                    bg: isDark ? 'green.900' : 'green.100',
                    color: isDark ? 'green.300' : 'green.700',
                  })}
                >
                  <span>🟢</span>
                  <span>Present</span>
                </span>
              )}

            {/* Enrolled badge */}
            {relationship?.isEnrolled && !relationship?.isPresent && (
              <span
                data-status="enrolled"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'medium',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.600',
                })}
              >
                <span>📋</span>
                <span>Enrolled</span>
              </span>
            )}

            {/* Your Child badge - show in enrolled view when it's your child */}
            {relationship?.isMyChild && relationship?.isEnrolled && (
              <span
                data-status="your-child"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'medium',
                  bg: isDark ? 'pink.900' : 'pink.100',
                  color: isDark ? 'pink.300' : 'pink.700',
                })}
              >
                <span>👶</span>
                <span>Your Child</span>
              </span>
            )}

            {/* Pending badge */}
            {relationship?.enrollmentStatus?.startsWith('pending') && (
              <span
                data-status="pending"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'medium',
                  bg: isDark ? 'yellow.900' : 'yellow.100',
                  color: isDark ? 'yellow.300' : 'yellow.700',
                })}
              >
                <span>⏳</span>
                <span>Pending</span>
              </span>
            )}
          </div>
        )}

        {/* Activity progress indicator - show when practicing */}
        {activity?.status === 'practicing' && activity.sessionProgress && (
          <div
            data-element="session-progress"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: isDark ? 'gray.400' : 'gray.500',
              marginTop: '2px',
            })}
          >
            <span>
              Problem {activity.sessionProgress.current + 1} of {activity.sessionProgress.total}
            </span>
          </div>
        )}

        {/* Level badge */}
        <span className={css(badgeStyles(isDark, 'neutral'))}>{levelLabel}</span>

        {/* Mastery progress bar (if available) */}
        {student.masteryPercent !== undefined && (
          <div
            className={css({
              ...progressBarContainerStyles(isDark, 'sm'),
              width: '100%',
            })}
          >
            <div
              className={css(progressBarFillStyles(isDark, 'success'))}
              style={{ width: `${student.masteryPercent}%` }}
            />
          </div>
        )}

        {/* Intervention badge (if needing attention) */}
        {student.intervention && (
          <div
            data-element="intervention-badge"
            data-intervention-type={student.intervention.type}
            data-intervention-severity={student.intervention.severity}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.6875rem',
              fontWeight: 'medium',
              backgroundColor:
                student.intervention.severity === 'high'
                  ? isDark
                    ? 'red.900/60'
                    : 'red.100'
                  : student.intervention.severity === 'medium'
                    ? isDark
                      ? 'orange.900/60'
                      : 'orange.100'
                    : isDark
                      ? 'blue.900/60'
                      : 'blue.100',
              color:
                student.intervention.severity === 'high'
                  ? isDark
                    ? 'red.300'
                    : 'red.700'
                  : student.intervention.severity === 'medium'
                    ? isDark
                      ? 'orange.300'
                      : 'orange.700'
                    : isDark
                      ? 'blue.300'
                      : 'blue.700',
              marginTop: '4px',
            })}
          >
            <span>{student.intervention.icon}</span>
            <span>{student.intervention.message}</span>
          </div>
        )}
      </button>
    </div>
  )
}

interface AddStudentButtonProps {
  onClick: () => void
}

/**
 * Button to add a new student
 */
function AddStudentButton({ onClick }: AddStudentButtonProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={onClick}
      data-action="add-student"
      className={css({
        ...centerStack,
        justifyContent: 'center',
        ...gapSm,
        ...paddingMd,
        ...roundedLg,
        ...transitionNormal,
        border: '2px dashed',
        borderColor: themed('border', isDark),
        backgroundColor: themed('surfaceMuted', isDark),
        cursor: 'pointer',
        minWidth: '100px',
        minHeight: '140px',
        _hover: {
          borderColor: 'green.400',
          backgroundColor: isDark ? 'green.900/30' : 'green.50',
        },
      })}
    >
      <span
        className={css({
          fontSize: '2rem',
          color: isDark ? 'green.400' : 'green.600',
        })}
      >
        +
      </span>
      <span
        className={css({
          ...textSm,
          color: themed('textMuted', isDark),
          textAlign: 'center',
        })}
      >
        Add Student
      </span>
    </button>
  )
}

interface StudentSelectorProps {
  students: StudentWithProgress[]
  onSelectStudent: (student: StudentWithProgress) => void
  onAddStudent?: () => void
  title?: string
  editMode?: boolean
  selectedIds?: Set<string>
  /** Hide the add student button (e.g., when showing filtered subsets) */
  hideAddButton?: boolean
  /** Callback when observe session is clicked */
  onObserveSession?: (sessionId: string) => void
}

/**
 * StudentSelector - Select which student is practicing today
 *
 * Displays all available students (players) with their current
 * curriculum level and progress. Clicking a student navigates
 * to their practice page at /practice/[studentId].
 *
 * In edit mode, clicking toggles selection for bulk operations.
 */
export function StudentSelector({
  students,
  onSelectStudent,
  onAddStudent,
  title = 'Who is practicing today?',
  editMode = false,
  selectedIds = new Set(),
  hideAddButton = false,
  onObserveSession,
}: StudentSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // QuickLook/Notes modal state (unified NotesModal with tabs)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProgress | null>(null)
  const [sourceBounds, setSourceBounds] = useState<DOMRect | null>(null)

  // Ref map for keyboard navigation
  const cardRefsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // Student lookup for quick access by ID
  const studentMap = useRef<Map<string, StudentWithProgress>>(new Map())
  useEffect(() => {
    studentMap.current.clear()
    for (const student of students) {
      studentMap.current.set(student.id, student)
    }
  }, [students])

  // Register card ref callback
  const handleRegisterRef = useCallback((studentId: string, ref: HTMLDivElement | null) => {
    if (ref) {
      cardRefsRef.current.set(studentId, ref)
    } else {
      cardRefsRef.current.delete(studentId)
    }
  }, [])

  const handleOpenQuickLook = useCallback((student: StudentWithProgress, bounds: DOMRect) => {
    setSelectedStudent(student)
    setSourceBounds(bounds)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  // Keyboard navigation when modal is open
  useEffect(() => {
    if (!modalOpen || !selectedStudent) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return

      // Don't interfere with text input (notes editing)
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return
      }

      // Don't interfere with dropdown menu navigation (Radix UI)
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest('[data-radix-menu-content]') ||
          e.target.getAttribute('role') === 'menuitem' ||
          e.target.getAttribute('role') === 'menu')
      ) {
        return
      }

      e.preventDefault()

      const direction = e.key.replace('Arrow', '').toLowerCase() as
        | 'up'
        | 'down'
        | 'left'
        | 'right'

      const next = findNextStudent(selectedStudent.id, direction, cardRefsRef.current)
      if (next) {
        const nextStudent = studentMap.current.get(next.studentId)
        if (nextStudent) {
          setSelectedStudent(nextStudent)
          setSourceBounds(next.bounds)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen, selectedStudent])

  return (
    <>
      <div
        data-component="student-selector"
        className={css({
          ...centerStack,
          ...gapLg,
          ...paddingLg,
        })}
      >
        {/* Title */}
        <h2
          className={css({
            fontSize: '1.5rem',
            ...fontBold,
            color: themed('text', isDark),
          })}
        >
          {title}
        </h2>

        {/* Student grid */}
        <div
          className={css({
            ...wrap,
            justifyContent: 'center',
            ...gapMd,
          })}
        >
          {students.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              onSelect={onSelectStudent}
              onOpenQuickLook={handleOpenQuickLook}
              editMode={editMode}
              isSelected={selectedIds.has(student.id)}
              onObserveSession={onObserveSession}
              onRegisterRef={handleRegisterRef}
            />
          ))}

          {!hideAddButton && onAddStudent && <AddStudentButton onClick={onAddStudent} />}
        </div>
      </div>

      {/* Student QuickLook/Notes Modal (unified with tabs) */}
      {selectedStudent && (
        <NotesModal
          isOpen={modalOpen}
          student={selectedStudent}
          sourceBounds={sourceBounds}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}

export default StudentSelector
