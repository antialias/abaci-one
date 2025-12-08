'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/types/player'
import { css } from '../../../styled-system/css'
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
  primaryButtonStyles,
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
  isSelected?: boolean
  onSelect: (student: StudentWithProgress) => void
}

/**
 * Individual student card showing avatar, name, and progress
 */
function StudentCard({ student, isSelected, onSelect }: StudentCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const levelLabel = student.currentLevel ? `Lv.${student.currentLevel}` : 'New'

  return (
    <button
      type="button"
      data-component="student-card"
      data-selected={isSelected}
      onClick={() => onSelect(student)}
      className={css({
        ...centerStack,
        ...gapSm,
        ...paddingMd,
        ...roundedLg,
        ...transitionNormal,
        border: isSelected ? '3px solid' : '2px solid',
        borderColor: isSelected ? 'blue.500' : themed('border', isDark),
        backgroundColor: isSelected ? themed('info', isDark) : themed('surface', isDark),
        cursor: 'pointer',
        minWidth: '100px',
        _hover: {
          borderColor: 'blue.400',
          transform: 'translateY(-2px)',
          boxShadow: 'md',
        },
      })}
    >
      {/* Avatar */}
      <div className={css(avatarStyles('md'))} style={{ backgroundColor: student.color }}>
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
      data-action="add-student"
      onClick={onClick}
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
          borderColor: 'blue.400',
          backgroundColor: themed('info', isDark),
        },
      })}
    >
      <span
        className={css({
          fontSize: '2rem',
          color: themed('textSubtle', isDark),
        })}
      >
        +
      </span>
      <span
        className={css({
          ...textSm,
          color: themed('textMuted', isDark),
        })}
      >
        Add New
      </span>
    </button>
  )
}

interface StudentSelectorProps {
  students: StudentWithProgress[]
  selectedStudent?: StudentWithProgress
  onSelectStudent: (student: StudentWithProgress) => void
  onAddStudent: () => void
  title?: string
}

/**
 * StudentSelector - Select which student is practicing today
 *
 * Displays all available students (players) with their current
 * curriculum level and progress. Parent/teacher selects a student
 * and hands the computer to the child.
 */
export function StudentSelector({
  students,
  selectedStudent,
  onSelectStudent,
  onAddStudent,
  title = 'Who is practicing today?',
}: StudentSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
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
            isSelected={selectedStudent?.id === student.id}
            onSelect={onSelectStudent}
          />
        ))}

        <AddStudentButton onClick={onAddStudent} />
      </div>

      {/* Selected student action */}
      {selectedStudent && (
        <div
          className={css({
            marginTop: '1rem',
            textAlign: 'center',
          })}
        >
          <p
            className={css({
              ...textBase,
              color: themed('textMuted', isDark),
              marginBottom: '1rem',
            })}
          >
            Selected:{' '}
            <strong className={css({ color: themed('text', isDark) })}>
              {selectedStudent.name}
            </strong>{' '}
            {selectedStudent.emoji}
          </p>
          <button type="button" data-action="start-practice" className={css(primaryButtonStyles())}>
            Start Practice →
          </button>
        </div>
      )}
    </div>
  )
}

export default StudentSelector
