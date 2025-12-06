'use client'

import type { Player } from '@/types/player'
import { css } from '../../../styled-system/css'

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
  const levelLabel = student.currentLevel ? `Lv.${student.currentLevel}` : 'New'

  return (
    <button
      type="button"
      data-component="student-card"
      data-selected={isSelected}
      onClick={() => onSelect(student)}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '12px',
        border: isSelected ? '3px solid' : '2px solid',
        borderColor: isSelected ? 'blue.500' : 'gray.200',
        backgroundColor: isSelected ? 'blue.50' : 'white',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '100px',
        _hover: {
          borderColor: 'blue.400',
          transform: 'translateY(-2px)',
          boxShadow: 'md',
        },
      })}
    >
      {/* Avatar */}
      <div
        className={css({
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
        })}
        style={{ backgroundColor: student.color }}
      >
        {student.emoji}
      </div>

      {/* Name */}
      <span
        className={css({
          fontWeight: 'bold',
          fontSize: '1rem',
          color: 'gray.800',
        })}
      >
        {student.name}
      </span>

      {/* Level badge */}
      <span
        className={css({
          fontSize: '0.75rem',
          padding: '0.125rem 0.5rem',
          borderRadius: '9999px',
          backgroundColor: 'gray.100',
          color: 'gray.600',
        })}
      >
        {levelLabel}
      </span>

      {/* Mastery progress bar (if available) */}
      {student.masteryPercent !== undefined && (
        <div
          className={css({
            width: '100%',
            height: '4px',
            backgroundColor: 'gray.200',
            borderRadius: '2px',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              height: '100%',
              backgroundColor: 'green.500',
              transition: 'width 0.3s ease',
            })}
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
  return (
    <button
      type="button"
      data-action="add-student"
      onClick={onClick}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '12px',
        border: '2px dashed',
        borderColor: 'gray.300',
        backgroundColor: 'gray.50',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '100px',
        minHeight: '140px',
        _hover: {
          borderColor: 'blue.400',
          backgroundColor: 'blue.50',
        },
      })}
    >
      <span
        className={css({
          fontSize: '2rem',
          color: 'gray.400',
        })}
      >
        ➕
      </span>
      <span
        className={css({
          fontSize: '0.875rem',
          color: 'gray.500',
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
  return (
    <div
      data-component="student-selector"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '2rem',
      })}
    >
      {/* Title */}
      <h2
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: 'gray.800',
        })}
      >
        {title}
      </h2>

      {/* Student grid */}
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '1rem',
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
              fontSize: '1rem',
              color: 'gray.600',
              marginBottom: '1rem',
            })}
          >
            Selected: <strong>{selectedStudent.name}</strong> {selectedStudent.emoji}
          </p>
          <button
            type="button"
            data-action="start-practice"
            className={css({
              padding: '0.75rem 2rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: 'blue.500',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              _hover: {
                backgroundColor: 'blue.600',
              },
            })}
          >
            Start Practice →
          </button>
        </div>
      )}
    </div>
  )
}

export default StudentSelector
