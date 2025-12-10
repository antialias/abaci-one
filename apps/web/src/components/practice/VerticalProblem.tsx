'use client'

import type { ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
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
  /** Index of the term currently being helped with (shows arrow indicator) */
  currentHelpTermIndex?: number
  /** Index of the term to show "need help?" prompt for (ambiguous prefix case) */
  needHelpTermIndex?: number
  /** Rejected digit to show as red X (null = no rejection) */
  rejectedDigit?: string | null
  /** Help overlay to render adjacent to the current help term (positioned above the term row) */
  helpOverlay?: ReactNode
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
  currentHelpTermIndex,
  needHelpTermIndex,
  rejectedDigit = null,
  helpOverlay,
}: VerticalProblemProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Calculate all possible prefix sums (intermediate values when entering answer step-by-step)
  const prefixSums = terms.reduce((acc, term, i) => {
    const prev = i === 0 ? 0 : acc[i - 1]
    acc.push(prev + term)
    return acc
  }, [] as number[])

  // Calculate max digits needed for alignment
  // Include prefix sums so kids can enter intermediate values during step-by-step solving
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    ...prefixSums.map((s) => Math.abs(s).toString().length),
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
        // Allow help overlay to overflow outside the component bounds
        overflow: 'visible',
        backgroundColor: isCompleted
          ? isCorrect
            ? isDark
              ? 'green.900'
              : 'green.50'
            : isDark
              ? 'red.900'
              : 'red.50'
          : isFocused
            ? isDark
              ? 'blue.900'
              : 'blue.50'
            : isDark
              ? 'gray.800'
              : 'gray.50',
        border: '2px solid',
        borderColor: isCompleted
          ? isCorrect
            ? isDark
              ? 'green.600'
              : 'green.400'
            : isDark
              ? 'red.600'
              : 'red.400'
          : isFocused
            ? 'blue.400'
            : isDark
              ? 'gray.600'
              : 'gray.200',
        transition: 'all 0.2s ease',
      })}
    >
      {/* Problem terms */}
      {terms.map((term, index) => {
        const isNegative = term < 0
        const absValue = Math.abs(term)
        const digits = absValue.toString().padStart(maxDigits, ' ').split('')

        // Check if this term row should show the help overlay
        const isCurrentHelp = index === currentHelpTermIndex
        // Check if this term row should show "need help?" prompt (ambiguous case)
        const showNeedHelp = index === needHelpTermIndex && !isCurrentHelp

        return (
          <div
            key={index}
            data-element="term-row"
            data-term-status={isCurrentHelp ? 'current' : showNeedHelp ? 'need-help' : 'pending'}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              position: 'relative',
              transition: 'all 0.2s ease',
            })}
          >
            {/* "Need help?" prompt for ambiguous prefix case */}
            {showNeedHelp && (
              <div
                data-element="need-help-prompt"
                className={css({
                  position: 'absolute',
                  right: '100%',
                  marginRight: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.625rem',
                  backgroundColor: isDark ? 'rgba(250, 204, 21, 0.15)' : 'rgba(202, 138, 4, 0.1)',
                  border: '1px solid',
                  borderColor: isDark ? 'yellow.500' : 'yellow.400',
                  borderRadius: '9999px',
                  color: isDark ? 'yellow.300' : 'yellow.700',
                  fontSize: '0.6875rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  boxShadow: isDark
                    ? '0 0 12px rgba(250, 204, 21, 0.2)'
                    : '0 1px 3px rgba(0, 0, 0, 0.1)',
                  animation: 'pulse 2s ease-in-out infinite',
                })}
              >
                <span>need help?</span>
                <span
                  className={css({
                    fontSize: '0.875rem',
                    lineHeight: 1,
                  })}
                >
                  →
                </span>
              </div>
            )}

            {/* Arrow indicator for current help term (the term being added) */}
            {isCurrentHelp && (
              <div
                data-element="current-arrow"
                className={css({
                  position: 'absolute',
                  left: '-1.5rem',
                  color: isDark ? 'purple.300' : 'purple.600',
                  fontSize: '0.875rem',
                })}
              >
                →
              </div>
            )}

            {/* Operator column (only show minus for negative) */}
            <div
              data-element="operator"
              className={css({
                width: cellWidth,
                height: cellHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isNegative ? (isDark ? 'red.400' : 'red.600') : 'transparent',
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
                  color: isCurrentHelp
                    ? isDark
                      ? 'purple.200'
                      : 'purple.800'
                    : isDark
                      ? 'gray.200'
                      : 'gray.800',
                  fontWeight: isCurrentHelp ? 'bold' : 'inherit',
                })}
              >
                {digit}
              </div>
            ))}

            {/* Help overlay - positioned above this term row, translated up by its height */}
            {isCurrentHelp && helpOverlay && (
              <div
                data-section="term-help"
                data-help-term-index={index}
                className={css({
                  position: 'absolute',
                  // Position at bottom of this row, then translate up by 100% to sit above it
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                })}
              >
                {helpOverlay}
              </div>
            )}
          </div>
        )
      })}

      {/* Separator line */}
      <div
        data-element="separator"
        className={css({
          width: '100%',
          height: '2px',
          backgroundColor: isDark ? 'gray.600' : 'gray.400',
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
          position: 'relative',
        })}
      >
        {/* Equals column */}
        <div
          data-element="equals"
          className={css({
            width: cellWidth,
            height: cellHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          =
        </div>

        {/* Answer digit cells - show maxDigits cells total */}
        {Array(maxDigits)
          .fill(null)
          .map((_, index) => {
            // Determine what to show in this cell
            const displayValue =
              isCompleted && isIncorrect ? correctAnswer?.toString() || '' : userAnswer
            const paddedValue = displayValue.padStart(maxDigits, '')
            const digit = paddedValue[index] || ''
            const isEmpty = digit === ''

            // Check if this is the cell where a rejected digit should show
            // Digits are entered left-to-right, filling from left side of the answer area
            // So the next digit position is right after the current answer length
            const nextDigitIndex = userAnswer.length
            const isRejectedCell = rejectedDigit && isEmpty && index === nextDigitIndex

            return (
              <div
                key={index}
                data-element={
                  isRejectedCell ? 'rejected-cell' : isEmpty ? 'empty-cell' : 'answer-cell'
                }
                className={css({
                  width: cellWidth,
                  height: cellHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  backgroundColor: isRejectedCell
                    ? isDark
                      ? 'red.900'
                      : 'red.100'
                    : isCompleted
                      ? isCorrect
                        ? isDark
                          ? 'green.800'
                          : 'green.100'
                        : isDark
                          ? 'red.800'
                          : 'red.100'
                      : isDark
                        ? 'gray.700'
                        : 'white',
                  borderRadius: '4px',
                  border: isEmpty && !isCompleted && !isRejectedCell ? '1px dashed' : '1px solid',
                  borderColor: isRejectedCell
                    ? isDark
                      ? 'red.500'
                      : 'red.400'
                    : isCompleted
                      ? isCorrect
                        ? isDark
                          ? 'green.600'
                          : 'green.300'
                        : isDark
                          ? 'red.600'
                          : 'red.300'
                      : isEmpty
                        ? isFocused
                          ? 'blue.400'
                          : isDark
                            ? 'gray.600'
                            : 'gray.300'
                        : isDark
                          ? 'gray.600'
                          : 'gray.300',
                  transition: 'all 0.15s ease-out',
                  color: isCompleted
                    ? isCorrect
                      ? isDark
                        ? 'green.200'
                        : 'green.700'
                      : isDark
                        ? 'red.200'
                        : 'red.700'
                    : isDark
                      ? 'gray.200'
                      : 'gray.800',
                  // Shake animation for rejected cell
                  ...(isRejectedCell && {
                    animation: 'shake 0.3s ease-out',
                  }),
                })}
              >
                {isRejectedCell ? (
                  <span
                    className={css({
                      color: isDark ? 'red.400' : 'red.600',
                      fontWeight: 'bold',
                    })}
                  >
                    ✕
                  </span>
                ) : (
                  digit
                )}
              </div>
            )
          })}
      </div>

      {/* Show user's incorrect answer below correct answer */}
      {isCompleted && isIncorrect && (
        <div
          data-element="user-answer"
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'red.400' : 'red.500',
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
