'use client'

import * as Checkbox from '@radix-ui/react-checkbox'
import { useCallback, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useUpdatePlayer } from '@/hooks/useUserPlayers'
import type { Player } from '@/types/player'
import { css } from '../../../styled-system/css'
import { NotesModal } from './NotesModal'
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
}

interface StudentCardProps {
  student: StudentWithProgress
  onSelect: (student: StudentWithProgress) => void
  onOpenNotes: (student: StudentWithProgress, bounds: DOMRect) => void
  editMode?: boolean
  isSelected?: boolean
}

/**
 * Individual student card showing avatar, name, and progress
 * Clicking navigates to the student's practice page (or toggles selection in edit mode)
 */
function StudentCard({ student, onSelect, onOpenNotes, editMode, isSelected }: StudentCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const levelLabel = student.currentLevel ? `Lv.${student.currentLevel}` : 'New'
  const cardRef = useRef<HTMLDivElement>(null)
  const isArchived = student.isArchived ?? false

  const handleNotesClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (cardRef.current) {
        const bounds = cardRef.current.getBoundingClientRect()
        onOpenNotes(student, bounds)
      }
    },
    [student, onOpenNotes]
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

      {/* Notes button */}
      <button
        type="button"
        data-action="open-notes"
        onClick={handleNotesClick}
        className={css({
          position: 'absolute',
          top: '6px',
          right: '6px',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: student.notes
            ? isDark
              ? 'amber.900/60'
              : 'amber.100'
            : isDark
              ? 'gray.700'
              : 'gray.100',
          color: student.notes
            ? isDark
              ? 'amber.300'
              : 'amber.600'
            : isDark
              ? 'gray.500'
              : 'gray.400',
          fontSize: '0.875rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          _hover: {
            backgroundColor: student.notes
              ? isDark
                ? 'amber.800'
                : 'amber.200'
              : isDark
                ? 'gray.600'
                : 'gray.200',
            transform: 'scale(1.1)',
          },
        })}
        title={student.notes ? 'View notes' : 'Add notes'}
      >
        📝
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
}: StudentSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Notes modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [selectedStudentForNotes, setSelectedStudentForNotes] =
    useState<StudentWithProgress | null>(null)
  const [sourceBounds, setSourceBounds] = useState<DOMRect | null>(null)

  // Use React Query mutation for updates
  const updatePlayer = useUpdatePlayer()

  const handleOpenNotes = useCallback((student: StudentWithProgress, bounds: DOMRect) => {
    setSelectedStudentForNotes(student)
    setSourceBounds(bounds)
    setNotesModalOpen(true)
  }, [])

  const handleCloseNotes = useCallback(() => {
    setNotesModalOpen(false)
  }, [])

  const handleSaveNotes = useCallback(
    async (notes: string) => {
      if (!selectedStudentForNotes) return

      await updatePlayer.mutateAsync({
        id: selectedStudentForNotes.id,
        updates: { notes: notes || null },
      })

      // Update the selected student for modal display
      setSelectedStudentForNotes((prev) => (prev ? { ...prev, notes: notes || null } : null))
    },
    [selectedStudentForNotes, updatePlayer]
  )

  const handleToggleArchive = useCallback(async () => {
    if (!selectedStudentForNotes) return

    const newArchivedState = !selectedStudentForNotes.isArchived

    await updatePlayer.mutateAsync({
      id: selectedStudentForNotes.id,
      updates: { isArchived: newArchivedState },
    })

    // Update the selected student for modal display
    setSelectedStudentForNotes((prev) => (prev ? { ...prev, isArchived: newArchivedState } : null))
  }, [selectedStudentForNotes, updatePlayer])

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
              onOpenNotes={handleOpenNotes}
              editMode={editMode}
              isSelected={selectedIds.has(student.id)}
            />
          ))}

          {!hideAddButton && onAddStudent && <AddStudentButton onClick={onAddStudent} />}
        </div>
      </div>

      {/* Notes Modal */}
      {selectedStudentForNotes && (
        <NotesModal
          isOpen={notesModalOpen}
          student={{
            id: selectedStudentForNotes.id,
            name: selectedStudentForNotes.name,
            emoji: selectedStudentForNotes.emoji,
            color: selectedStudentForNotes.color,
            notes: selectedStudentForNotes.notes ?? null,
            isArchived: selectedStudentForNotes.isArchived,
          }}
          sourceBounds={sourceBounds}
          onClose={handleCloseNotes}
          onSave={handleSaveNotes}
          onToggleArchive={handleToggleArchive}
          isDark={isDark}
        />
      )}
    </>
  )
}

export default StudentSelector
