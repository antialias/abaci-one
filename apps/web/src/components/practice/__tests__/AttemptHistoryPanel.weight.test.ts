import { describe, expect, it } from 'vitest'
import { getMasteryWeightDisplay } from '../AttemptHistoryPanel'

describe('getMasteryWeightDisplay (the weight BKT reads)', () => {
  it('shows a stamped try’s weight, also for a wrong try (Phase 1w)', () => {
    expect(
      getMasteryWeightDisplay(
        { isCorrect: false, kind: 'first', round: 0, masteryWeight: 1 },
        false
      )
    ).toEqual({ value: '1 (100%)', color: 'red' })
    expect(
      getMasteryWeightDisplay(
        { isCorrect: true, kind: 'do_over', round: 1, masteryWeight: 0.5 },
        false
      )
    ).toEqual({ value: '0.5 (50%)', color: 'green' })
  })

  it('re-derives a wrong try recorded at 0 before Phase 1w', () => {
    expect(
      getMasteryWeightDisplay({ isCorrect: false, epochNumber: 0, masteryWeight: 0 }, false)
    ).toEqual({ value: '1 (100%)', color: 'red' })
    expect(
      getMasteryWeightDisplay(
        { isCorrect: false, isRetry: true, epochNumber: 1, masteryWeight: 0 },
        false
      )
    ).toEqual({ value: '0.5 (50%)', color: 'red' })
  })

  it('shows a correct row’s stored weight, 1.0 when unstamped', () => {
    expect(
      getMasteryWeightDisplay({ isCorrect: true, epochNumber: 2, masteryWeight: 0.25 }, false).value
    ).toBe('0.25 (25%)')
    expect(getMasteryWeightDisplay({ isCorrect: true, epochNumber: 2 }, false).value).toBe(
      '1 (100%)'
    )
  })

  it('shows a practice-only do-over as 0', () => {
    expect(
      getMasteryWeightDisplay(
        { isCorrect: true, kind: 'do_over', round: 1, practiceOnly: true, masteryWeight: 0 },
        false
      )
    ).toEqual({ value: '0', color: 'green' })
  })

  it('shows an excluded try as excluded', () => {
    expect(getMasteryWeightDisplay({ isCorrect: false, masteryWeight: 1 }, true).value).toBe(
      '0 (excluded)'
    )
  })
})
