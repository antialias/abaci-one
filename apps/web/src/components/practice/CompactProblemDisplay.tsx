/**
 * Compact problem display components for session summary and overview
 *
 * These components show problems in a small, reviewable format:
 * - CompactVerticalProblem: Stacked format like a workbook problem
 * - CompactLinearProblem: Horizontal equation format
 */

import { css } from '../../../styled-system/css'

/**
 * Props for compact problem components
 */
export interface CompactProblemProps {
  /** Problem terms (positive for add, negative for subtract) */
  terms: number[]
  /** Correct answer */
  answer: number
  /** Student's submitted answer (if available) */
  studentAnswer?: number
  /** Whether the student got it correct (if available) */
  isCorrect?: boolean
  /** Whether dark mode is active */
  isDark: boolean
}

/**
 * Compact vertical problem display for review
 * Shows terms stacked with answer below, like a mini workbook problem
 */
export function CompactVerticalProblem({
  terms,
  answer,
  studentAnswer,
  isCorrect,
  isDark,
}: CompactProblemProps) {
  // Calculate max digits for alignment
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    answer.toString().length
  )

  return (
    <div
      data-element="compact-vertical-problem"
      className={css({
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        lineHeight: 1.2,
      })}
    >
      {terms.map((term, i) => {
        const isNegative = term < 0
        const absValue = Math.abs(term)
        const digits = absValue.toString()
        const padding = maxDigits - digits.length

        return (
          <div
            key={i}
            className={css({
              display: 'flex',
              alignItems: 'center',
            })}
          >
            {/* Sign: show − for negative terms, + for additions after first (but usually omit +) */}
            <span
              className={css({
                width: '0.75em',
                textAlign: 'center',
                color: isDark ? 'gray.500' : 'gray.400',
              })}
            >
              {i === 0 ? '' : isNegative ? '−' : ''}
            </span>
            {/* Padding for alignment */}
            {padding > 0 && (
              <span className={css({ visibility: 'hidden' })}>{' '.repeat(padding)}</span>
            )}
            <span className={css({ color: isDark ? 'gray.300' : 'gray.700' })}>{digits}</span>
          </div>
        )
      })}
      {/* Answer line */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.300',
          paddingTop: '0.125rem',
          marginTop: '0.125rem',
        })}
      >
        <span className={css({ width: '0.75em' })} />
        <span
          className={css({
            color:
              isCorrect === undefined
                ? isDark
                  ? 'gray.400'
                  : 'gray.600'
                : isCorrect
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : isDark
                    ? 'red.400'
                    : 'red.600',
            fontWeight: 'bold',
          })}
        >
          {answer}
        </span>
        {/* Show wrong answer if incorrect */}
        {isCorrect === false && studentAnswer !== undefined && (
          <span
            className={css({
              marginLeft: '0.25rem',
              color: isDark ? 'red.400' : 'red.500',
              textDecoration: 'line-through',
              fontSize: '0.625rem',
            })}
          >
            {studentAnswer}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Compact linear problem display for review
 * Shows equation in horizontal format: "5 + 3 - 2 = 6"
 */
export function CompactLinearProblem({
  terms,
  answer,
  studentAnswer,
  isCorrect,
  isDark,
}: CompactProblemProps) {
  const equation = terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? ` − ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')

  return (
    <span
      data-element="compact-linear-problem"
      className={css({
        fontFamily: 'monospace',
        fontSize: '0.8125rem',
      })}
    >
      <span className={css({ color: isDark ? 'gray.300' : 'gray.700' })}>{equation} = </span>
      <span
        className={css({
          color:
            isCorrect === undefined
              ? isDark
                ? 'gray.400'
                : 'gray.600'
              : isCorrect
                ? isDark
                  ? 'green.400'
                  : 'green.600'
                : isDark
                  ? 'red.400'
                  : 'red.600',
          fontWeight: 'bold',
        })}
      >
        {answer}
      </span>
      {/* Show wrong answer if incorrect */}
      {isCorrect === false && studentAnswer !== undefined && (
        <span
          className={css({
            marginLeft: '0.375rem',
            color: isDark ? 'red.400' : 'red.500',
            textDecoration: 'line-through',
          })}
        >
          {studentAnswer}
        </span>
      )}
    </span>
  )
}
