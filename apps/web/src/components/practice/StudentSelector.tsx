'use client'

import { useCallback, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
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
}

interface StudentCardProps {
  student: StudentWithProgress
  onSelect: (student: StudentWithProgress) => void
  onOpenNotes: (student: StudentWithProgress, bounds: DOMRect) => void
}

/**
 * Individual student card showing avatar, name, and progress
 * Clicking navigates to the student's practice page
 */
function StudentCard({ student, onSelect, onOpenNotes }: StudentCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const levelLabel = student.currentLevel ? `Lv.${student.currentLevel}` : 'New'
  const cardRef = useRef<HTMLDivElement>(null)

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
      className={css({
        ...centerStack,
        ...gapSm,
        ...paddingMd,
        ...roundedLg,
        ...transitionNormal,
        border: '2px solid',
        borderColor: themed('border', isDark),
        backgroundColor: themed('surface', isDark),
        minWidth: '100px',
        position: 'relative',
      })}
    >
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
          paddingTop: '1.5rem', // Extra space for the notes button
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
            color: themed('text', isDark),
          })}
        >
          {student.name}
        </span>

        {/* Level badge */}
        <span className={css(badgeStyles(isDark, 'neutral'))}>{levelLabel}</span>

        {/* Mastery progress bar (if available) */}
        {student.masteryPercent !== undefined && (
          <div className={css({ ...progressBarContainerStyles(isDark, 'sm'), width: '100%' })}>
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

/**
 * Link to manage students page
 */
function ManageStudentsLink() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <a
      href="/students"
      data-action="manage-students"
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
        textDecoration: 'none',
        _hover: {
          borderColor: 'blue.400',
          backgroundColor: themed('info', isDark),
        },
      })}
    >
      <span
        className={css({
          fontSize: '1.5rem',
          color: themed('textSubtle', isDark),
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
        Manage Students
      </span>
    </a>
  )
}

interface StudentSelectorProps {
  students: StudentWithProgress[]
  onSelectStudent: (student: StudentWithProgress) => void
  title?: string
}

/**
 * StudentSelector - Select which student is practicing today
 *
 * Displays all available students (players) with their current
 * curriculum level and progress. Clicking a student navigates
 * to their practice page at /practice/[studentId].
 */
export function StudentSelector({
  students,
  onSelectStudent,
  title = 'Who is practicing today?',
}: StudentSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Notes modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [selectedStudentForNotes, setSelectedStudentForNotes] =
    useState<StudentWithProgress | null>(null)
  const [sourceBounds, setSourceBounds] = useState<DOMRect | null>(null)

  // Track students with local state for optimistic updates
  const [localStudents, setLocalStudents] = useState(students)

  // Update local students when props change
  if (students !== localStudents && !notesModalOpen) {
    setLocalStudents(students)
  }

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

      const response = await fetch(`/api/players/${selectedStudentForNotes.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      })

      if (!response.ok) {
        throw new Error('Failed to save notes')
      }

      // Optimistically update local state
      setLocalStudents((prev) =>
        prev.map((s) => (s.id === selectedStudentForNotes.id ? { ...s, notes: notes || null } : s))
      )

      // Update the selected student for modal
      setSelectedStudentForNotes((prev) => (prev ? { ...prev, notes: notes || null } : null))
    },
    [selectedStudentForNotes]
  )

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
          {localStudents.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              onSelect={onSelectStudent}
              onOpenNotes={handleOpenNotes}
            />
          ))}

          <ManageStudentsLink />
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
          }}
          sourceBounds={sourceBounds}
          onClose={handleCloseNotes}
          onSave={handleSaveNotes}
          isDark={isDark}
        />
      )}
    </>
  )
}

export default StudentSelector
