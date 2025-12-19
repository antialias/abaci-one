'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

/**
 * Skill focus options for offline sessions
 */
const SKILL_FOCUS_OPTIONS = [
  {
    id: 'basic',
    name: 'Basic Operations',
    description: 'Direct addition/subtraction (1-9)',
  },
  {
    id: 'fiveComplements',
    name: 'Five Complements',
    description: 'Using +5/-5 techniques',
  },
  {
    id: 'tenComplements',
    name: 'Ten Complements',
    description: 'Carrying and borrowing',
  },
  {
    id: 'mixed',
    name: 'Mixed Practice',
    description: 'All skill levels combined',
  },
] as const

export interface OfflineSessionData {
  date: string
  problemCount: number
  accuracy: number
  focusSkill: string
  notes?: string
}

export interface OfflineSessionFormProps {
  /** Whether modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Student name (for display) */
  studentName: string
  /** Student ID for saving */
  playerId: string
  /** Callback when session is recorded */
  onSubmit: (data: OfflineSessionData) => Promise<void>
}

/**
 * OfflineSessionForm - Modal for recording practice done outside the app
 *
 * Allows teachers to:
 * - Record date of practice
 * - Enter number of problems completed
 * - Enter approximate accuracy
 * - Select the primary skill focus
 * - Add optional notes
 */
export function OfflineSessionForm({
  open,
  onClose,
  studentName,
  playerId,
  onSubmit,
}: OfflineSessionFormProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  // Form state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [problemCount, setProblemCount] = useState(20)
  const [accuracy, setAccuracy] = useState(85)
  const [focusSkill, setFocusSkill] = useState('basic')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!date) {
      newErrors.date = 'Date is required'
    } else {
      const selectedDate = new Date(date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (selectedDate > today) {
        newErrors.date = 'Date cannot be in the future'
      }
    }

    if (problemCount < 1) {
      newErrors.problemCount = 'Must complete at least 1 problem'
    } else if (problemCount > 500) {
      newErrors.problemCount = 'Maximum 500 problems per session'
    }

    if (accuracy < 0) {
      newErrors.accuracy = 'Accuracy cannot be negative'
    } else if (accuracy > 100) {
      newErrors.accuracy = 'Accuracy cannot exceed 100%'
    }

    if (!focusSkill) {
      newErrors.focusSkill = 'Please select a skill focus'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        date,
        problemCount,
        accuracy: accuracy / 100, // Convert to decimal
        focusSkill,
        notes: notes.trim() || undefined,
      })
      onClose()
      // Reset form for next use
      setProblemCount(20)
      setAccuracy(85)
      setNotes('')
    } catch (error) {
      console.error('Failed to record session:', error)
      alert('Failed to record session. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const estimatedCorrect = Math.round(problemCount * (accuracy / 100))

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'rgba(0, 0, 0, 0.5)',
            zIndex: 50,
          })}
        />
        <Dialog.Content
          data-component="offline-session-form"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bg: isDark ? 'gray.800' : 'white',
            borderRadius: 'xl',
            boxShadow: 'xl',
            p: '6',
            maxWidth: '450px',
            width: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 51,
          })}
        >
          {/* Header */}
          <div className={css({ mb: '5' })}>
            <Dialog.Title
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              Record Offline Practice
            </Dialog.Title>
            <Dialog.Description
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.400' : 'gray.600',
                mt: '1',
              })}
            >
              Log {studentName}'s practice session from outside the app (book work, tutoring, etc.)
            </Dialog.Description>
          </div>

          {/* Form */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '4',
            })}
          >
            {/* Date */}
            <div>
              <label
                htmlFor="session-date"
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '1',
                })}
              >
                Practice Date
              </label>
              <input
                id="session-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setErrors((prev) => ({ ...prev, date: '' }))
                }}
                max={new Date().toISOString().split('T')[0]}
                className={css({
                  width: '100%',
                  px: '3',
                  py: '2',
                  border: '1px solid',
                  borderColor: errors.date ? 'red.500' : isDark ? 'gray.600' : 'gray.300',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  bg: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.900',
                  _focus: {
                    outline: 'none',
                    borderColor: 'blue.500',
                    ring: '2px',
                    ringColor: 'blue.500/20',
                  },
                })}
              />
              {errors.date && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'red.400' : 'red.600',
                    mt: '1',
                  })}
                >
                  {errors.date}
                </p>
              )}
            </div>

            {/* Problem Count */}
            <div>
              <label
                htmlFor="problem-count"
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '1',
                })}
              >
                Number of Problems
              </label>
              <input
                id="problem-count"
                type="number"
                min={1}
                max={500}
                value={problemCount}
                onChange={(e) => {
                  setProblemCount(Number.parseInt(e.target.value) || 0)
                  setErrors((prev) => ({ ...prev, problemCount: '' }))
                }}
                className={css({
                  width: '100%',
                  px: '3',
                  py: '2',
                  border: '1px solid',
                  borderColor: errors.problemCount ? 'red.500' : isDark ? 'gray.600' : 'gray.300',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  bg: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.900',
                  _focus: {
                    outline: 'none',
                    borderColor: 'blue.500',
                    ring: '2px',
                    ringColor: 'blue.500/20',
                  },
                })}
              />
              {errors.problemCount && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'red.400' : 'red.600',
                    mt: '1',
                  })}
                >
                  {errors.problemCount}
                </p>
              )}
            </div>

            {/* Accuracy Slider */}
            <div>
              <label
                htmlFor="accuracy"
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '1',
                })}
              >
                <span>Accuracy</span>
                <span
                  className={css({
                    fontWeight: 'bold',
                    color: isDark
                      ? accuracy >= 85
                        ? 'green.400'
                        : accuracy >= 70
                          ? 'yellow.400'
                          : 'red.400'
                      : accuracy >= 85
                        ? 'green.600'
                        : accuracy >= 70
                          ? 'yellow.600'
                          : 'red.600',
                  })}
                >
                  {accuracy}%
                </span>
              </label>
              <input
                id="accuracy"
                type="range"
                min={0}
                max={100}
                step={5}
                value={accuracy}
                onChange={(e) => {
                  setAccuracy(Number.parseInt(e.target.value))
                  setErrors((prev) => ({ ...prev, accuracy: '' }))
                }}
                className={css({
                  width: '100%',
                  cursor: 'pointer',
                })}
              />
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'xs',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                <span>0%</span>
                <span>
                  ~{estimatedCorrect} of {problemCount} correct
                </span>
                <span>100%</span>
              </div>
              {errors.accuracy && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'red.400' : 'red.600',
                    mt: '1',
                  })}
                >
                  {errors.accuracy}
                </p>
              )}
            </div>

            {/* Skill Focus */}
            <div>
              <label
                htmlFor="focus-skill"
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '1',
                })}
              >
                Primary Skill Focus
              </label>
              <select
                id="focus-skill"
                value={focusSkill}
                onChange={(e) => {
                  setFocusSkill(e.target.value)
                  setErrors((prev) => ({ ...prev, focusSkill: '' }))
                }}
                className={css({
                  width: '100%',
                  px: '3',
                  py: '2',
                  border: '1px solid',
                  borderColor: errors.focusSkill ? 'red.500' : isDark ? 'gray.600' : 'gray.300',
                  borderRadius: 'md',
                  bg: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.900',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  _focus: {
                    outline: 'none',
                    borderColor: 'blue.500',
                    ring: '2px',
                    ringColor: 'blue.500/20',
                  },
                })}
              >
                {SKILL_FOCUS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} - {option.description}
                  </option>
                ))}
              </select>
              {errors.focusSkill && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'red.400' : 'red.600',
                    mt: '1',
                  })}
                >
                  {errors.focusSkill}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '1',
                })}
              >
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations about the session..."
                rows={3}
                className={css({
                  width: '100%',
                  px: '3',
                  py: '2',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  resize: 'vertical',
                  bg: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.900',
                  _focus: {
                    outline: 'none',
                    borderColor: 'blue.500',
                    ring: '2px',
                    ringColor: 'blue.500/20',
                  },
                  _placeholder: {
                    color: isDark ? 'gray.500' : 'gray.400',
                  },
                })}
              />
            </div>

            {/* Summary Box */}
            <div
              className={css({
                p: '3',
                bg: isDark ? 'blue.900' : 'blue.50',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: isDark ? 'blue.700' : 'blue.100',
              })}
            >
              <p
                className={css({
                  fontSize: 'sm',
                  color: isDark ? 'blue.200' : 'blue.800',
                })}
              >
                This will record <strong>{problemCount} problems</strong> at{' '}
                <strong>{accuracy}% accuracy</strong> (~{estimatedCorrect} correct) for{' '}
                <strong>{studentName}</strong> on{' '}
                <strong>{new Date(date).toLocaleDateString()}</strong>.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div
            className={css({
              display: 'flex',
              gap: '3',
              justifyContent: 'flex-end',
              mt: '6',
            })}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              data-action="cancel"
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: isDark ? 'gray.300' : 'gray.700',
                bg: 'transparent',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: isDark ? 'gray.700' : 'gray.50' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-action="record-session"
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'white',
                bg: 'green.600',
                border: 'none',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: 'green.700' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isSubmitting ? 'Recording...' : 'Record Session'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default OfflineSessionForm
