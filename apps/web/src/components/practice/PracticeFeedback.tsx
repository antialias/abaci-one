'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css, cx } from '../../../styled-system/css'

interface PracticeFeedbackProps {
  /** Whether the answer was correct */
  isCorrect: boolean
  /** The correct answer (shown when incorrect) */
  correctAnswer: number
  /** Whether to reveal the correct answer when incorrect */
  showCorrectAnswer?: boolean
  /** Optional className for additional styling/positioning */
  className?: string
}

/**
 * Shared feedback component for practice sessions
 *
 * Shows:
 * - "Correct!" in green for correct answers
 * - "The answer was X" in red for incorrect answers
 *
 * Used by both ActiveSession (student view) and SessionObserverModal (teacher view)
 */
export function PracticeFeedback({
  isCorrect,
  correctAnswer,
  showCorrectAnswer = true,
  className,
}: PracticeFeedbackProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const baseStyles = css({
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    backgroundColor: isCorrect
      ? isDark
        ? 'green.900'
        : 'green.100'
      : isDark
        ? 'red.900'
        : 'red.100',
    color: isCorrect ? (isDark ? 'green.200' : 'green.700') : isDark ? 'red.200' : 'red.700',
  })

  return (
    <div
      data-element="practice-feedback"
      data-correct={isCorrect}
      className={cx(baseStyles, className)}
    >
      {isCorrect ? 'Correct!' : showCorrectAnswer ? `The answer was ${correctAnswer}` : 'Not quite.'}
    </div>
  )
}
