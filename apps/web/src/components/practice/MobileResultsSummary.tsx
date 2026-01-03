'use client'

import { useMemo } from 'react'
import type { ObservedResult } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'

interface MobileResultsSummaryProps {
  /** Accumulated results from the session */
  results: ObservedResult[]
  /** Total problems in the session */
  totalProblems: number
  /** Whether dark mode */
  isDark: boolean
  /** Callback to expand to full report view */
  onExpand: () => void
}

/**
 * Compact results summary for mobile screens
 *
 * Shows progress, accuracy, and incorrect count in a horizontal chip layout.
 * Tapping expands to full report view.
 */
export function MobileResultsSummary({
  results,
  totalProblems,
  isDark,
  onExpand,
}: MobileResultsSummaryProps) {
  // Compute stats
  const stats = useMemo(() => {
    const correct = results.filter((r) => r.isCorrect).length
    const incorrect = results.filter((r) => !r.isCorrect).length
    const completed = results.length
    const accuracy = completed > 0 ? correct / completed : 0
    return { correct, incorrect, completed, accuracy }
  }, [results])

  // No results yet - show minimal placeholder
  if (results.length === 0) {
    return (
      <div
        data-component="mobile-results-summary"
        data-state="empty"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          borderRadius: '20px',
          backgroundColor: isDark ? 'gray.800' : 'gray.100',
          fontSize: '0.8125rem',
          color: isDark ? 'gray.500' : 'gray.400',
        })}
      >
        Waiting for results...
      </div>
    )
  }

  return (
    <button
      type="button"
      data-component="mobile-results-summary"
      onClick={onExpand}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        borderRadius: '20px',
        backgroundColor: isDark ? 'gray.800' : 'gray.100',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        _hover: {
          backgroundColor: isDark ? 'gray.700' : 'gray.200',
        },
      })}
    >
      {/* Progress */}
      <span
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.200' : 'gray.700',
        })}
      >
        {stats.completed}/{totalProblems}
      </span>

      {/* Divider */}
      <span
        className={css({
          width: '1px',
          height: '16px',
          backgroundColor: isDark ? 'gray.600' : 'gray.300',
        })}
      />

      {/* Accuracy */}
      <span
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color:
            stats.accuracy >= 0.8
              ? isDark
                ? 'green.400'
                : 'green.600'
              : stats.accuracy >= 0.6
                ? isDark
                  ? 'yellow.400'
                  : 'yellow.600'
                : isDark
                  ? 'red.400'
                  : 'red.600',
        })}
      >
        {Math.round(stats.accuracy * 100)}%
      </span>

      {/* Incorrect count badge (only if there are incorrect) */}
      {stats.incorrect > 0 && (
        <span
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: isDark ? 'red.900/50' : 'red.100',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: isDark ? 'red.300' : 'red.700',
          })}
        >
          <span>✗</span>
          <span>{stats.incorrect}</span>
        </span>
      )}

      {/* View report arrow */}
      <span
        className={css({
          marginLeft: 'auto',
          fontSize: '0.75rem',
          color: isDark ? 'blue.400' : 'blue.600',
          fontWeight: 'medium',
        })}
      >
        Report →
      </span>
    </button>
  )
}

export default MobileResultsSummary
