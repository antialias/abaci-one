'use client'

/**
 * Estimate-recovery header for the timing-review page (#158).
 *
 * Shows the CURRENT pace estimate (Tier-1 poison already removed at read time)
 * as a concrete "≈ N problems in 20 minutes", and — when unusual timings still
 * remain in the estimate (Tier-2) — the if-repaired preview. Both numbers come
 * from the single pace producer's `PaceAssessment`; acting on a card refetches
 * this so the recovery is visible (acceptance criterion 3).
 */

import type { PaceAssessment } from '@/lib/curriculum/timing/pace-estimation'
import { css } from '../../../../styled-system/css'
import { REFERENCE_MINUTES, problemsForDuration } from './formatting'

interface EstimateRecoveryHeaderProps {
  assessment: PaceAssessment
}

export function EstimateRecoveryHeader({ assessment }: EstimateRecoveryHeaderProps) {
  const {
    avgSecondsPerProblem,
    secondsPerProblemExcludingFlagged,
    unresolvedCount,
    tier2Count,
    isDefault,
    sampleCount,
  } = assessment

  const currentProblems = problemsForDuration(avgSecondsPerProblem)
  const repairedProblems =
    secondsPerProblemExcludingFlagged != null
      ? problemsForDuration(secondsPerProblemExcludingFlagged)
      : null
  const showRepairPreview =
    repairedProblems != null && tier2Count > 0 && repairedProblems !== currentProblems

  return (
    <div
      data-component="estimate-recovery-header"
      className={css({
        borderRadius: '16px',
        border: '1px solid',
        borderColor: 'blue.200',
        backgroundColor: 'blue.50',
        padding: '1.25rem 1.5rem',
        _dark: { backgroundColor: 'blue.950', borderColor: 'blue.800' },
      })}
    >
      <div
        data-element="current-estimate"
        className={css({ display: 'flex', flexDirection: 'column', gap: '0.25rem' })}
      >
        <span
          className={css({
            fontSize: '0.8rem',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'blue.700',
            _dark: { color: 'blue.300' },
          })}
        >
          Current pace estimate
        </span>
        <span
          data-element="current-problems"
          className={css({
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: 'gray.900',
            _dark: { color: 'gray.50' },
          })}
        >
          ≈ {currentProblems} problems in {REFERENCE_MINUTES} minutes
        </span>
        <span
          className={css({
            fontSize: '0.85rem',
            color: 'gray.600',
            _dark: { color: 'gray.400' },
          })}
        >
          {isDefault
            ? 'Using a default pace — not enough clean timings yet to measure this student.'
            : `About ${avgSecondsPerProblem}s per problem, from ${sampleCount} recent ${
                sampleCount === 1 ? 'timing' : 'timings'
              }.`}
        </span>
      </div>

      {showRepairPreview && (
        <div
          data-element="repair-preview"
          className={css({
            marginTop: '0.9rem',
            paddingTop: '0.9rem',
            borderTop: '1px dashed',
            borderColor: 'blue.200',
            fontSize: '0.9rem',
            color: 'gray.700',
            _dark: { color: 'gray.300', borderColor: 'blue.800' },
          })}
        >
          If you resolve the flagged timings below, the estimate becomes{' '}
          <strong
            className={css({ color: 'green.700', _dark: { color: 'green.300' } })}
          >
            ≈ {repairedProblems} problems in {REFERENCE_MINUTES} minutes
          </strong>
          .
        </div>
      )}

      {unresolvedCount > 0 && (
        <div
          data-element="unresolved-count"
          className={css({
            marginTop: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderRadius: 'full',
            paddingX: '0.7rem',
            paddingY: '0.3rem',
            fontSize: '0.8rem',
            fontWeight: 'semibold',
            backgroundColor: 'amber.100',
            color: 'amber.800',
            _dark: { backgroundColor: 'amber.900', color: 'amber.200' },
          })}
        >
          {unresolvedCount} {unresolvedCount === 1 ? 'timing needs' : 'timings need'} your review
        </div>
      )}
    </div>
  )
}
