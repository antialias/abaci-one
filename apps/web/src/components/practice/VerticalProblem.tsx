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
  /** Index of terms that have been confirmed (0 = first term done, 1 = first two terms done, etc.) */
  confirmedTermCount?: number
  /** Index of the term currently being helped with (highlighted) */
  currentHelpTermIndex?: number
  /** Detected prefix index - shows preview checkmarks/arrow before user clicks "Get Help" */
  detectedPrefixIndex?: number
  /** Whether auto-submit is about to trigger (shows celebration animation) */
  autoSubmitPending?: boolean
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
  confirmedTermCount = 0,
  currentHelpTermIndex,
  detectedPrefixIndex,
  autoSubmitPending = false,
  rejectedDigit = null,
  helpOverlay,
}: VerticalProblemProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

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

        // Term status for highlighting
        const isConfirmed = index < confirmedTermCount
        const isCurrentHelp = index === currentHelpTermIndex
        // Preview states - shown when user's input matches a prefix sum (before clicking "Get Help")
        const isPreviewConfirmed =
          detectedPrefixIndex !== undefined && index <= detectedPrefixIndex && !isConfirmed
        const isPreviewNext =
          detectedPrefixIndex !== undefined &&
          index === detectedPrefixIndex + 1 &&
          !isCurrentHelp &&
          detectedPrefixIndex < terms.length - 1 // Don't show if prefix is the full answer

        return (
          <div
            key={index}
            data-element="term-row"
            data-term-status={
              isConfirmed
                ? 'confirmed'
                : isCurrentHelp
                  ? 'current'
                  : isPreviewConfirmed
                    ? 'preview-confirmed'
                    : isPreviewNext
                      ? 'preview-next'
                      : 'pending'
            }
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              position: 'relative',
              // Confirmed terms are dimmed with checkmark
              opacity: isConfirmed ? 0.5 : isPreviewConfirmed ? 0.7 : 1,
              // Current help term is highlighted
              backgroundColor: isCurrentHelp
                ? isDark
                  ? 'purple.800'
                  : 'purple.100'
                : isPreviewNext
                  ? isDark
                    ? 'yellow.900'
                    : 'yellow.50'
                  : 'transparent',
              borderRadius: isCurrentHelp || isPreviewNext ? '4px' : '0',
              padding: isCurrentHelp || isPreviewNext ? '2px 4px' : '0',
              marginLeft: isCurrentHelp || isPreviewNext ? '-4px' : '0',
              marginRight: isCurrentHelp || isPreviewNext ? '-4px' : '0',
              transition: 'all 0.2s ease',
            })}
          >
            {/* Checkmark for confirmed terms */}
            {isConfirmed && (
              <div
                data-element="confirmed-check"
                className={css({
                  position: 'absolute',
                  left: '-1.5rem',
                  color: isDark ? 'green.400' : 'green.500',
                  fontSize: '0.875rem',
                })}
              >
                ✓
              </div>
            )}

            {/* Preview checkmark for detected prefix terms (shown in muted color with subtle pulse) */}
            {isPreviewConfirmed && (
              <div
                data-element="preview-check"
                className={css({
                  position: 'absolute',
                  left: '-1.5rem',
                  color: isDark ? 'yellow.400' : 'yellow.600',
                  fontSize: '0.875rem',
                  opacity: 0.8,
                })}
              >
                ✓
              </div>
            )}

            {/* Arrow indicator for current help term */}
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

            {/* Preview arrow for next term after detected prefix */}
            {isPreviewNext && (
              <div
                data-element="preview-arrow"
                className={css({
                  position: 'absolute',
                  left: '-1.5rem',
                  color: isDark ? 'yellow.400' : 'yellow.600',
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
        data-auto-submit={autoSubmitPending ? 'pending' : undefined}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          position: 'relative',
          // Auto-submit celebration animation
          ...(autoSubmitPending && {
            animation: 'successPulse 0.3s ease-out',
          }),
        })}
      >
        {/* Auto-submit celebration indicator */}
        {autoSubmitPending && (
          <div
            data-element="auto-submit-indicator"
            className={css({
              position: 'absolute',
              top: '-1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.125rem 0.5rem',
              backgroundColor: isDark ? 'green.700' : 'green.100',
              borderRadius: '999px',
              fontSize: '0.625rem',
              fontWeight: 'bold',
              color: isDark ? 'green.200' : 'green.700',
              whiteSpace: 'nowrap',
              animation: 'bounceIn 0.3s ease-out',
              zIndex: 10,
            })}
          >
            <span>✓</span>
            <span>Perfect!</span>
          </div>
        )}
        {/* Equals sign column - show "..." for prefix sums (mathematically incomplete), "=" for final answer */}
        <div
          data-element="equals"
          data-prefix-mode={detectedPrefixIndex !== undefined ? 'true' : undefined}
          className={css({
            width: cellWidth,
            height: cellHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:
              detectedPrefixIndex !== undefined
                ? isDark
                  ? 'yellow.400'
                  : 'yellow.600'
                : isDark
                  ? 'gray.400'
                  : 'gray.500',
          })}
        >
          {detectedPrefixIndex !== undefined ? '…' : '='}
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
                    : autoSubmitPending
                      ? isDark
                        ? 'green.800'
                        : 'green.100'
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
                  border:
                    isEmpty && !isCompleted && !autoSubmitPending && !isRejectedCell
                      ? '1px dashed'
                      : '1px solid',
                  borderColor: isRejectedCell
                    ? isDark
                      ? 'red.500'
                      : 'red.400'
                    : autoSubmitPending
                      ? isDark
                        ? 'green.500'
                        : 'green.400'
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
