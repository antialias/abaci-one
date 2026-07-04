'use client'

import { css } from '../../../styled-system/css'

export interface LinearProblemProps {
  /** Terms: positive = addition, negative = subtraction */
  terms: number[]
  /** The correct answer (shown when completed / on reveal) */
  correctAnswer?: number
  /**
   * Dark theme. Kept as an explicit prop (unlike VerticalProblem, which reads
   * theme via useTheme): every call site already has `isDark` in scope, and it
   * keeps the live player's output identical to the previous inline component.
   */
  isDark: boolean
  /** Student's current/submitted answer */
  userAnswer?: string
  /** Whether to show the answer box as focused */
  isFocused?: boolean
  /** Whether the problem is completed (locks completed colors + enables reveal) */
  isCompleted?: boolean
  /**
   * On completed + incorrect: reveal `correctAnswer` in the box and show the
   * struck-through student answer below. Default true — parity with
   * VerticalProblem. The live player passes false to preserve its current
   * no-reveal behavior.
   */
  showCorrectAnswerOnIncorrect?: boolean
  /**
   * Player-only: index of a detected prefix sum. When set, the sentence shows
   * "…" instead of "=" (the running-subtotal vision cue).
   */
  detectedPrefixIndex?: number
}

/**
 * Horizontal number-sentence problem display ("45 + 27 = ?").
 *
 * Structural sibling of {@link VerticalProblem}. Linear practice problems are
 * mental math and must ALWAYS render as a horizontal sentence, so this is the
 * single shared renderer used by every surface: the live player, the transition
 * animation, the observer, the plan preview, and the review/annotated view.
 * Never fork this — always factor.
 */
export function LinearProblem({
  terms,
  correctAnswer,
  isDark,
  userAnswer = '',
  isFocused = false,
  isCompleted = false,
  showCorrectAnswerOnIncorrect = true,
  detectedPrefixIndex,
}: LinearProblemProps) {
  // Build the equation string
  const equation = terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? ` - ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')

  // Use "..." for prefix sums (mathematically incomplete), "=" for final answer
  const isPrefixSum = detectedPrefixIndex !== undefined
  const operator = isPrefixSum ? '…' : '='

  // Use numeric comparison so "09" equals 9
  const numericUserAnswer = parseInt(userAnswer, 10)
  const isCorrect =
    isCompleted && correctAnswer !== undefined && numericUserAnswer === correctAnswer
  const isIncorrect =
    isCompleted && correctAnswer !== undefined && numericUserAnswer !== correctAnswer

  // On completed + incorrect, optionally reveal the correct answer in the box
  const revealCorrect = isIncorrect && showCorrectAnswerOnIncorrect
  const boxValue = revealCorrect ? String(correctAnswer) : userAnswer

  return (
    <div
      data-component="linear-problem"
      data-status={isCompleted ? (isCorrect ? 'correct' : 'incorrect') : 'active'}
      data-correct-answer={correctAnswer}
      data-prefix-mode={isPrefixSum ? 'true' : undefined}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
      })}
    >
      <div
        data-element="linear-sentence"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'monospace',
          fontSize: '2rem',
          fontWeight: 'bold',
        })}
      >
        <span className={css({ color: isDark ? 'gray.200' : 'gray.800' })}>
          {equation}{' '}
          <span
            className={css({
              color: isPrefixSum
                ? isDark
                  ? 'yellow.400'
                  : 'yellow.600'
                : isDark
                  ? 'gray.200'
                  : 'gray.800',
            })}
          >
            {operator}
          </span>
        </span>
        <span
          data-element="answer-box"
          className={css({
            minWidth: '80px',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            textAlign: 'center',
            backgroundColor: isCompleted
              ? isCorrect
                ? isDark
                  ? 'green.900'
                  : 'green.100'
                : isDark
                  ? 'red.900'
                  : 'red.100'
              : isDark
                ? 'gray.800'
                : 'gray.100',
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
            border: '2px solid',
            borderColor: isFocused ? 'blue.400' : isDark ? 'gray.600' : 'gray.300',
          })}
        >
          {boxValue || (isFocused ? '?' : '')}
        </span>
      </div>
      {revealCorrect && (
        <div
          data-element="user-answer"
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'red.400' : 'red.500',
            textDecoration: 'line-through',
          })}
        >
          Your answer: {userAnswer}
        </div>
      )}
    </div>
  )
}

export default LinearProblem
