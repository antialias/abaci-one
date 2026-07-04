import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PaceAssessment } from '@/lib/curriculum/timing/pace-estimation'
import { EstimateRecoveryHeader } from '../EstimateRecoveryHeader'

function makeAssessment(overrides: Partial<PaceAssessment> = {}): PaceAssessment {
  return {
    avgSecondsPerProblem: 45,
    secondsPerTerm: 15,
    secondsPerProblemExcludingFlagged: null,
    sampleCount: 12,
    isDefault: false,
    tier1Count: 0,
    tier2Count: 0,
    unresolvedCount: 0,
    affectedSessions: [],
    windowSessionCount: 5,
    ...overrides,
  }
}

describe('EstimateRecoveryHeader', () => {
  it('shows the current estimate as concrete problems-per-20-minutes', () => {
    render(<EstimateRecoveryHeader assessment={makeAssessment()} />)
    // 1200s / 45s ≈ 26.
    expect(screen.getByText(/≈ 26 problems in 20 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/About 45s per problem, from 12 recent timings\./)).toBeInTheDocument()
  })

  it('shows the if-repaired preview only when Tier-2 remains and the number differs', () => {
    render(
      <EstimateRecoveryHeader
        assessment={makeAssessment({
          secondsPerProblemExcludingFlagged: 30,
          tier2Count: 2,
          unresolvedCount: 3,
        })}
      />
    )
    // Repaired: 1200 / 30 = 40.
    expect(screen.getByText(/≈ 40 problems in 20 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/3 timings need your review/)).toBeInTheDocument()
  })

  it('hides the repair preview when there is no Tier-2 to repair', () => {
    render(
      <EstimateRecoveryHeader
        assessment={makeAssessment({ secondsPerProblemExcludingFlagged: 30, tier2Count: 0 })}
      />
    )
    expect(screen.queryByText(/If you resolve the flagged timings/)).not.toBeInTheDocument()
  })

  it('explains the default-pace fallback when there are too few clean samples', () => {
    render(<EstimateRecoveryHeader assessment={makeAssessment({ isDefault: true, sampleCount: 2 })} />)
    expect(screen.getByText(/Using a default pace/)).toBeInTheDocument()
  })
})
