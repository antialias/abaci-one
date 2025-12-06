'use client'

import { css } from '../../../styled-system/css'

interface VerticalProblemProps {
  /** Array of terms (positive for addition, negative for subtraction) */
  terms: number[]
  /** User's current answer input */
  userAnswer: string
  /** Whether to show the answer box as focused */
  isFocused?: boolean
  /** Whether the problem is completed */
  isCompleted?: boolean
  /** The correct answer (shown when completed) */
  correctAnswer?: number
  /** Size variant */
  size?: 'normal' | 'large'
}

/**
 * Vertical columnar problem display.
 *
 * Renders problems in the traditional workbook format:
 * - Numbers stacked vertically
 * - Plus sign omitted (except for first term if negative)
 * - Minus sign shown before negative terms
 * - Answer box at the bottom
 */
export function VerticalProblem({
  terms,
  userAnswer,
  isFocused = false,
  isCompleted = false,
  correctAnswer,
  size = 'normal',
}: VerticalProblemProps) {
  // Calculate max digits needed for alignment
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    userAnswer.length || 1,
    correctAnswer?.toString().length || 1
  )

  const isCorrect = isCompleted && userAnswer === correctAnswer?.toString()
  const isIncorrect = isCompleted && userAnswer !== correctAnswer?.toString()

  const fontSize = size === 'large' ? '2rem' : '1.5rem'
  const cellWidth = size === 'large' ? '1.8rem' : '1.4rem'
  const cellHeight = size === 'large' ? '2.4rem' : '1.8rem'

  return (
    <div
      data-component="vertical-problem"
      data-status={isCompleted ? (isCorrect ? 'correct' : 'incorrect') : 'active'}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize,
        fontWeight: 'bold',
        gap: '2px',
        padding: '0.5rem',
        borderRadius: '8px',
        backgroundColor: isCompleted
          ? isCorrect
            ? 'green.50'
            : 'red.50'
          : isFocused
            ? 'blue.50'
            : 'gray.50',
        border: '2px solid',
        borderColor: isCompleted
          ? isCorrect
            ? 'green.400'
            : 'red.400'
          : isFocused
            ? 'blue.400'
            : 'gray.200',
        transition: 'all 0.2s ease',
      })}
    >
      {/* Problem terms */}
      {terms.map((term, index) => {
        const isNegative = term < 0
        const absValue = Math.abs(term)
        const digits = absValue.toString().padStart(maxDigits, ' ').split('')

        return (
          <div
            key={index}
            data-element="term-row"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            })}
          >
            {/* Operator column (only show minus for negative) */}
            <div
              data-element="operator"
              className={css({
                width: cellWidth,
                height: cellHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isNegative ? 'red.600' : 'transparent',
              })}
            >
              {isNegative ? '−' : ''}
            </div>

            {/* Digit cells */}
            {digits.map((digit, digitIndex) => (
              <div
                key={digitIndex}
                data-element="digit-cell"
                className={css({
                  width: cellWidth,
                  height: cellHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'gray.800',
                })}
              >
                {digit}
              </div>
            ))}
          </div>
        )
      })}

      {/* Separator line */}
      <div
        data-element="separator"
        className={css({
          width: '100%',
          height: '2px',
          backgroundColor: 'gray.400',
          marginTop: '4px',
          marginBottom: '4px',
        })}
      />

      {/* Answer row */}
      <div
        data-element="answer-row"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
        })}
      >
        {/* Equals sign column */}
        <div
          data-element="equals"
          className={css({
            width: cellWidth,
            height: cellHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'gray.500',
          })}
        >
          =
        </div>

        {/* Answer digit cells */}
        {(isCompleted && isIncorrect ? correctAnswer?.toString() || '' : userAnswer)
          .padStart(maxDigits, ' ')
          .split('')
          .map((digit, index) => (
            <div
              key={index}
              data-element="answer-cell"
              className={css({
                width: cellWidth,
                height: cellHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isCompleted ? (isCorrect ? 'green.100' : 'red.100') : 'white',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: isCompleted ? (isCorrect ? 'green.300' : 'red.300') : 'gray.300',
                color: isCompleted ? (isCorrect ? 'green.700' : 'red.700') : 'gray.800',
              })}
            >
              {digit}
            </div>
          ))}

        {/* Empty cells to fill remaining space */}
        {!isCompleted &&
          Array(Math.max(0, maxDigits - userAnswer.length))
            .fill(null)
            .map((_, index) => (
              <div
                key={`empty-${index}`}
                data-element="empty-cell"
                className={css({
                  width: cellWidth,
                  height: cellHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px dashed',
                  borderColor: isFocused ? 'blue.300' : 'gray.300',
                })}
              />
            ))}
      </div>

      {/* Show user's incorrect answer below correct answer */}
      {isCompleted && isIncorrect && (
        <div
          data-element="user-answer"
          className={css({
            fontSize: '0.875rem',
            color: 'red.500',
            marginTop: '4px',
            textDecoration: 'line-through',
          })}
        >
          Your answer: {userAnswer}
        </div>
      )}
    </div>
  )
}

export default VerticalProblem
