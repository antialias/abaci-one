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
}

/**
 * Individual student card showing avatar, name, and progress
 * Clicking navigates to the student's practice page
 */
function StudentCard({ student, onSelect }: StudentCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const levelLabel = student.currentLevel ? `Lv.${student.currentLevel}` : 'New'

  return (
    <button
      type="button"
      data-component="student-card"
      onClick={() => onSelect(student)}
      className={css({
        ...centerStack,
        ...gapSm,
        ...paddingMd,
        ...roundedLg,
        ...transitionNormal,
        border: '2px solid',
        borderColor: themed('border', isDark),
        backgroundColor: themed('surface', isDark),
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
          <StudentCard key={student.id} student={student} onSelect={onSelectStudent} />
        ))}

        <ManageStudentsLink />
      </div>
    </div>
  )
}

export default StudentSelector
