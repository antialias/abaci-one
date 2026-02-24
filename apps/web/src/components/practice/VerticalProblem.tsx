'use client'

import type { ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { GenerationTrace } from '@/db/schema/session-plans'
import { getBaseComplexity } from '@/utils/skillComplexity'
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
  /** Whether to reveal correct answer when completed + incorrect */
  showCorrectAnswerOnIncorrect?: boolean
  /** Size variant */
  size?: 'normal' | 'large'
  /** Index of the term currently being helped with (shows arrow indicator) */
  currentHelpTermIndex?: number
  /** Index of the term to show "need help?" prompt for (ambiguous prefix case) */
  needHelpTermIndex?: number
  /** Rejected digit to show as red X (null = no rejection) */
  rejectedDigit?: string | null
  /** Help overlay to render in place of answer boxes when in help mode */
  helpOverlay?: ReactNode
  /** Whether the help overlay should be visible (controls opacity for crossfade) */
  helpOverlayVisible?: boolean
  /** Duration for help overlay transition in ms (default 1000 for enter, use 300 for dismiss) */
  helpOverlayTransitionMs?: number
  /** Called when help overlay transition completes (useful for clearing answer after fade-in) */
  onHelpOverlayTransitionEnd?: () => void
  /** Whether the answer row is fading out (for dream sequence after help mode) */
  answerFadingOut?: boolean
  /** Generation trace with per-term skills and complexity (for debug overlay) */
  generationTrace?: GenerationTrace
  /** Complexity budget constraint (for debug overlay) */
  complexityBudget?: number
  /** Index of detected prefix sum from vision (shows visual indicator on completed terms) */
  detectedPrefixIndex?: number
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
  showCorrectAnswerOnIncorrect = true,
  size = 'normal',
  currentHelpTermIndex,
  needHelpTermIndex,
  rejectedDigit = null,
  helpOverlay,
  helpOverlayVisible = false,
  helpOverlayTransitionMs = 1000,
  onHelpOverlayTransitionEnd,
  answerFadingOut = false,
  generationTrace,
  complexityBudget,
  detectedPrefixIndex,
}: VerticalProblemProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { isVisualDebugEnabled } = useVisualDebugSafe()

  // Get the trace step for a given term index (for debug overlay)
  const getTraceStep = (index: number) => generationTrace?.steps[index]

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

  // Use numeric comparison so "09" equals 9
  const numericUserAnswer = parseInt(userAnswer, 10)
  const isCorrect =
    isCompleted && correctAnswer !== undefined && numericUserAnswer === correctAnswer
  const isIncorrect =
    isCompleted && correctAnswer !== undefined && numericUserAnswer !== correctAnswer

  const fontSize = size === 'large' ? '2rem' : '1.5rem'
  const cellWidth = size === 'large' ? '1.8rem' : '1.4rem'
  const cellHeight = size === 'large' ? '2.4rem' : '1.8rem'

  return (
    <div
      data-component="vertical-problem"
      data-status={isCompleted ? (isCorrect ? 'correct' : 'incorrect') : 'active'}
      data-correct-answer={correctAnswer}
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
        // Check if this term is already included in the prefix sum (when in help mode)
        const isInPrefixSum = currentHelpTermIndex !== undefined && index < currentHelpTermIndex
        // Check if this term is completed based on vision detection (before help mode)
        const isVisionCompleted =
          detectedPrefixIndex !== undefined &&
          currentHelpTermIndex === undefined && // Only show when NOT in help mode
          index <= detectedPrefixIndex

        return (
          <div
            key={index}
            data-element="term-row"
            data-term-status={
              isCurrentHelp
                ? 'current'
                : showNeedHelp
                  ? 'need-help'
                  : isVisionCompleted
                    ? 'vision-completed'
                    : 'pending'
            }
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              position: 'relative',
              transition: 'all 0.2s ease',
              // Dim terms already in prefix sum when in help mode
              opacity: isInPrefixSum ? 0.4 : 1,
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
                  left: '-2.2rem',
                  color: isDark ? 'purple.300' : 'purple.600',
                  fontSize: '1.75rem',
                })}
              >
                →
              </div>
            )}

            {/* Checkmark indicator for vision-detected completed terms */}
            {isVisionCompleted && (
              <div
                data-element="vision-completed"
                className={css({
                  position: 'absolute',
                  left: '-2rem',
                  color: isDark ? 'green.400' : 'green.600',
                  fontSize: '1.25rem',
                  opacity: 0.8,
                })}
              >
                ✓
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

            {/* Debug overlay: show skills and complexity for this term */}
            {isVisualDebugEnabled &&
              (() => {
                const traceStep = getTraceStep(index)
                if (!traceStep) return null

                const cost = traceStep.complexityCost
                const isOverBudget =
                  complexityBudget !== undefined && cost !== undefined && cost > complexityBudget
                const skills = traceStep.skillsUsed

                // Calculate base cost sum for comparison (without mastery multipliers)
                const baseCostSum = skills.reduce((sum, s) => sum + getBaseComplexity(s), 0)

                return (
                  <div
                    data-element="term-debug-overlay"
                    className={css({
                      position: 'absolute',
                      left: '100%',
                      marginLeft: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      borderRadius: '4px',
                      fontSize: '0.625rem',
                      fontFamily: 'monospace',
                      fontWeight: 'normal',
                      whiteSpace: 'nowrap',
                      zIndex: 100,
                    })}
                  >
                    {/* Total complexity cost badge */}
                    <span
                      className={css({
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        backgroundColor: isOverBudget
                          ? 'rgba(248, 113, 113, 0.3)'
                          : 'rgba(74, 222, 128, 0.3)',
                        color: isOverBudget ? '#f87171' : '#4ade80',
                        border: '1px solid',
                        borderColor: isOverBudget ? '#f87171' : '#4ade80',
                      })}
                    >
                      {cost !== undefined ? cost : baseCostSum}
                    </span>

                    {/* Skills list with individual base costs */}
                    <span className={css({ color: '#9ca3af' })}>
                      {skills.length > 0
                        ? skills
                            .map((s) => {
                              const baseCost = getBaseComplexity(s)
                              const shortName = s.split('.').pop()
                              return `${shortName}(${baseCost})`
                            })
                            .join(', ')
                        : '(none)'}
                    </span>
                  </div>
                )
              })()}
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

      {/* Answer row container - both help overlay and answer cells rendered for crossfade */}
      <div
        data-element="answer-area-container"
        className={css({
          position: 'relative',
          minHeight: '50px', // Ensure container has height for absolute positioning
        })}
      >
        {/* Help overlay layer - fades in when in help mode */}
        {helpOverlay && (
          <div
            data-element="help-area"
            data-help-term-index={currentHelpTermIndex}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem 0',
              // Fade in when help mode active
              transition: `opacity ${helpOverlayTransitionMs}ms ease-out`,
              opacity: helpOverlayVisible ? 1 : 0,
              pointerEvents: helpOverlayVisible ? 'auto' : 'none',
            })}
            onTransitionEnd={(e) => {
              // Only fire for opacity transition on this element, and only when becoming visible
              if (
                e.propertyName === 'opacity' &&
                e.target === e.currentTarget &&
                helpOverlayVisible
              ) {
                onHelpOverlayTransitionEnd?.()
              }
            }}
          >
            {helpOverlay}
          </div>
        )}

        {/* Answer row layer - fades out when help mode active (inverse opacity) */}
        <div
          data-element="answer-row"
          data-fading-out={answerFadingOut ? 'true' : undefined}
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            position: helpOverlay ? 'absolute' : 'relative',
            top: helpOverlay ? 0 : undefined,
            left: helpOverlay ? 0 : undefined,
            right: helpOverlay ? 0 : undefined,
            // Fade out when help mode active (inverse of help overlay) OR when answer is fading out
            transition: answerFadingOut
              ? 'opacity 300ms ease-out'
              : `opacity ${helpOverlayTransitionMs}ms ease-out`,
            opacity: helpOverlayVisible || answerFadingOut ? 0 : 1,
            pointerEvents: helpOverlayVisible ? 'none' : 'auto',
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
                isCompleted && isIncorrect && showCorrectAnswerOnIncorrect
                  ? correctAnswer?.toString() || ''
                  : userAnswer
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
      </div>

      {/* Show user's incorrect answer below correct answer */}
      {isCompleted && isIncorrect && showCorrectAnswerOnIncorrect && (
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
