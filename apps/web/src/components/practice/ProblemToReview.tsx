/**
 * Problem To Review Component
 *
 * A compact problem summary row that can expand to show full details.
 * Used in the "Problems Worth Attention" section of the session summary.
 */

'use client'

import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { calculateAutoPauseInfo } from './autoPauseCalculator'
import { DetailedProblemCard } from './DetailedProblemCard'
import {
  type AttentionReason,
  formatProblemAsEquation,
  isVerticalPart,
  type ProblemNeedingAttention,
} from './sessionSummaryUtils'

export interface ProblemToReviewProps {
  /** The problem that needs attention */
  problem: ProblemNeedingAttention
  /** All results up to this problem (for auto-pause calculation) */
  allResultsBeforeThis: import('@/db/schema/session-plans').SlotResult[]
  /** Dark mode */
  isDark: boolean
}

/**
 * Format a compact problem display for vertical layout
 */
function CompactVerticalDisplay({
  terms,
  answer,
  studentAnswer,
  isCorrect,
  isDark,
}: {
  terms: number[]
  answer: number
  studentAnswer: number
  isCorrect: boolean
  isDark: boolean
}) {
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    Math.abs(answer).toString().length
  )

  return (
    <div
      data-element="compact-vertical"
      className={css({
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        lineHeight: 1.2,
      })}
    >
      {terms.map((term, i) => (
        <div key={i} className={css({ display: 'flex', alignItems: 'center' })}>
          <span
            className={css({
              width: '1rem',
              textAlign: 'center',
              color:
                i === 0
                  ? 'transparent'
                  : term < 0
                    ? isDark
                      ? 'red.400'
                      : 'red.600'
                    : isDark
                      ? 'green.400'
                      : 'green.600',
            })}
          >
            {i === 0 ? '' : term < 0 ? '−' : '+'}
          </span>
          <span
            className={css({
              minWidth: `${maxDigits}ch`,
              textAlign: 'right',
              color: isDark ? 'gray.200' : 'gray.800',
            })}
          >
            {Math.abs(term)}
          </span>
        </div>
      ))}
      <div
        className={css({
          width: '100%',
          height: '1px',
          backgroundColor: isDark ? 'gray.500' : 'gray.400',
          marginY: '0.125rem',
        })}
      />
      <div className={css({ display: 'flex', alignItems: 'center', gap: '0.25rem' })}>
        <span
          className={css({
            color: isCorrect
              ? isDark
                ? 'green.300'
                : 'green.700'
              : isDark
                ? 'red.300'
                : 'red.700',
            minWidth: `${maxDigits}ch`,
            textAlign: 'right',
          })}
        >
          {answer}
        </span>
        {!isCorrect && (
          <span
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'red.400' : 'red.500',
              textDecoration: 'line-through',
            })}
          >
            ({studentAnswer})
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Get reason badge content
 */
function ReasonBadge({ reason, isDark }: { reason: AttentionReason; isDark: boolean }) {
  const config = {
    incorrect: { label: 'Incorrect', color: 'red', emoji: '✗' },
    slow: { label: 'Slow', color: 'yellow', emoji: '⏱️' },
    'help-used': { label: 'Help used', color: 'orange', emoji: '💡' },
  }[reason]

  return (
    <span
      data-reason={reason}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.6875rem',
        fontWeight: '500',
        backgroundColor: isDark ? `${config.color}.900` : `${config.color}.100`,
        color: isDark ? `${config.color}.300` : `${config.color}.700`,
      })}
    >
      {config.emoji} {config.label}
    </span>
  )
}

/**
 * Format skills as a comma-separated list
 */
function formatSkillsList(skillIds: string[]): string {
  return skillIds
    .map((id) => {
      const parts = id.split('.')
      if (parts.length === 2) {
        const category = parts[0]
        const specific = parts[1]
        if (category === 'fiveComplements' || category === 'fiveComplementsSub') {
          return `5's: ${specific}`
        }
        if (category === 'tenComplements' || category === 'tenComplementsSub') {
          return `10's: ${specific}`
        }
        if (category === 'basic') {
          return specific.replace(/([A-Z])/g, ' $1').toLowerCase()
        }
        return specific
      }
      return id
    })
    .join(', ')
}

export function ProblemToReview({ problem, allResultsBeforeThis, isDark }: ProblemToReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const { result, slot, part, problemNumber, reasons } = problem
  const { problem: generatedProblem } = slot
  const isIncorrect = !result.isCorrect

  // Calculate auto-pause stats for the detailed view
  const autoPauseInfo = calculateAutoPauseInfo(allResultsBeforeThis)

  if (!generatedProblem) return null

  return (
    <div
      data-component="problem-to-review"
      data-problem-number={problemNumber}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: isIncorrect
          ? isDark
            ? 'red.700'
            : 'red.200'
          : isDark
            ? 'yellow.700'
            : 'yellow.200',
        backgroundColor: isIncorrect
          ? isDark
            ? 'red.900/30'
            : 'red.50'
          : isDark
            ? 'yellow.900/30'
            : 'yellow.50',
        overflow: 'hidden',
      })}
    >
      {/* Compact summary row */}
      <div
        data-element="problem-summary"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
        })}
      >
        {/* Problem number */}
        <span
          className={css({
            fontWeight: 'bold',
            fontSize: '0.875rem',
            color: isDark ? 'gray.300' : 'gray.700',
            minWidth: '2.5rem',
          })}
        >
          #{problemNumber}
        </span>

        {/* Problem display */}
        <div
          className={css({
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          })}
        >
          {isVerticalPart(part.type) ? (
            <CompactVerticalDisplay
              terms={generatedProblem.terms}
              answer={generatedProblem.answer}
              studentAnswer={result.studentAnswer}
              isCorrect={result.isCorrect}
              isDark={isDark}
            />
          ) : (
            <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
              <span
                className={css({
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.200' : 'gray.800',
                })}
              >
                {formatProblemAsEquation(generatedProblem.terms, generatedProblem.answer)}
              </span>
              {!result.isCorrect && (
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'red.400' : 'red.500',
                  })}
                >
                  (answered: {result.studentAnswer})
                </span>
              )}
            </div>
          )}

          {/* Skills used (compact) */}
          <span
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '200px',
            })}
          >
            {formatSkillsList(result.skillsExercised)}
          </span>
        </div>

        {/* Reason badges */}
        <div
          className={css({
            display: 'flex',
            gap: '0.375rem',
            flexWrap: 'wrap',
          })}
        >
          {reasons.map((reason) => (
            <ReasonBadge key={reason} reason={reason} isDark={isDark} />
          ))}
        </div>

        {/* Expand/collapse button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={css({
            padding: '0.375rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: isDark ? 'blue.300' : 'blue.600',
            backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
            border: '1px solid',
            borderColor: isDark ? 'blue.700' : 'blue.200',
            borderRadius: '6px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            _hover: {
              backgroundColor: isDark ? 'blue.800' : 'blue.100',
            },
          })}
        >
          {isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
        </button>
      </div>

      {/* Expanded detail view */}
      {isExpanded && (
        <div
          data-element="problem-details"
          className={css({
            padding: '0.5rem',
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            backgroundColor: isDark ? 'gray.800/50' : 'white',
          })}
        >
          <DetailedProblemCard
            slot={slot}
            part={part}
            result={result}
            autoPauseStats={autoPauseInfo.stats}
            isDark={isDark}
            problemNumber={problemNumber}
          />
        </div>
      )}
    </div>
  )
}

export default ProblemToReview
