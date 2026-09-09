'use client'

import { type CSSProperties, Fragment } from 'react'
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
 * Fit-to-width sizing.
 *
 * The sentence never wraps on its own: its font size is `2rem` at most and shrinks
 * so that `terms + operator + answer box` fit the nearest `container-type: inline-size`
 * ancestor (ActiveSession's `problem-with-help`). Without such an ancestor, `cqw`
 * falls back to the viewport width. Below the 1rem floor the row wraps as a last
 * resort: the answer box drops under the sentence and the sentence itself can only
 * break in front of an operator (each "+ 41" chunk is `nowrap`).
 */
const MONO_ADVANCE_EM = 0.62 // widest common monospace advance (Menlo/Courier ≈ 0.60)
const ANSWER_BOX_MIN_DIGITS = 4
const ANSWER_BOX_CHROME_EM = 1.5 // 0.5em padding on each side + 0.5em column gap
// The answer box's 2px borders are the only non-em width; they are subtracted as 4px
// inside the fontSize clamp() below.

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
  // One chunk per term ("58", "+ 41", "- 24"); chunks are joined by breakable spaces
  // and each chunk is nowrap, so a fallback wrap can only happen before an operator.
  const chunks = terms.map((term, i) => {
    if (i === 0) return String(term)
    return term < 0 ? `- ${Math.abs(term)}` : `+ ${term}`
  })

  // Use "..." for prefix sums (mathematically incomplete), "=" for final answer
  const isPrefixSum = detectedPrefixIndex !== undefined
  const operator = isPrefixSum ? '…' : '='

  // Width budget in em: every monospace column of the sentence plus the answer box.
  const sentenceChars = chunks.join(' ').length + 1 + operator.length
  const answerDigits = Math.max(ANSWER_BOX_MIN_DIGITS, String(correctAnswer ?? '').length)
  const fitColumns = (sentenceChars + answerDigits) * MONO_ADVANCE_EM + ANSWER_BOX_CHROME_EM
  const sentenceStyle = { '--linear-fit-columns': fitColumns } as CSSProperties

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
        style={sentenceStyle}
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: '0.5em',
          rowGap: '0.25em',
          fontFamily: 'monospace',
          fontSize: 'clamp(1rem, calc((100cqw - 4px) / var(--linear-fit-columns)), 2rem)',
          fontWeight: 'bold',
        })}
      >
        <span className={css({ color: isDark ? 'gray.200' : 'gray.800', textAlign: 'center' })}>
          {chunks.map((chunk, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span className={css({ whiteSpace: 'nowrap' })}>{chunk}</span>
            </Fragment>
          ))}{' '}
          <span
            className={css({
              whiteSpace: 'nowrap',
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
            minWidth: '2.5em',
            padding: '0.25em 0.5em',
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
