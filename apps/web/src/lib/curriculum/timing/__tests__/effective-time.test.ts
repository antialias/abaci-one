import { describe, it, expect } from 'vitest'
import {
  getEffectiveResponseTimeMs,
  isIdleCapped,
  classifyAttemptTiming,
  countQuarantined,
  countUnresolvedFlagged,
  isFlagResolved,
  type TimingSample,
} from '../effective-time'
import { MAX_RESPONSE_TIME_CAP_MS } from '../constants'

/** A review stamp with the required audit fields, plus optional resolution fields. */
function review(
  fields: Partial<
    Pick<
      NonNullable<TimingSample['timingReview']>,
      'omitFromTiming' | 'adjustedResponseTimeMs' | 'timingConfirmed'
    >
  >
): NonNullable<TimingSample['timingReview']> {
  return { reviewedBy: 'adult-1', reviewedAt: '2026-01-01T00:00:00.000Z', ...fields }
}

/** An unresolved Tier-1 (idle-capped) sample. */
function tier1Sample(overrides: Partial<TimingSample> = {}): TimingSample {
  return {
    responseTimeMs: 300_000,
    wasIdleCapped: true,
    responseTimeMsRaw: 9_000_000,
    ...overrides,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Build a minimal timing sample; overrides win over the plain-30s default. */
function sample(overrides: Partial<TimingSample> = {}): TimingSample {
  return { responseTimeMs: 30_000, ...overrides }
}

// ============================================================================
// getEffectiveResponseTimeMs
// ============================================================================

describe('getEffectiveResponseTimeMs', () => {
  it('returns null when the sample is omitted from timing', () => {
    const result = sample({
      responseTimeMs: 45_000,
      timingReview: {
        omitFromTiming: true,
        reviewedBy: 'adult-1',
        reviewedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(getEffectiveResponseTimeMs(result)).toBeNull()
  })

  it('returns the adult-adjusted value when present (and outranks omit precedence order)', () => {
    const result = sample({
      responseTimeMs: 999_999,
      timingReview: {
        adjustedResponseTimeMs: 42_000,
        reviewedBy: 'adult-1',
        reviewedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(getEffectiveResponseTimeMs(result)).toBe(42_000)
  })

  it('returns null for recency-refresh sentinel records', () => {
    const result = sample({ responseTimeMs: 30_000, source: 'recency-refresh' })
    expect(getEffectiveResponseTimeMs(result)).toBeNull()
  })

  it('returns null when responseTimeMs is <= 0', () => {
    expect(getEffectiveResponseTimeMs(sample({ responseTimeMs: 0 }))).toBeNull()
    expect(getEffectiveResponseTimeMs(sample({ responseTimeMs: -5 }))).toBeNull()
  })

  it('returns the raw responseTimeMs for a plain measurement', () => {
    expect(getEffectiveResponseTimeMs(sample({ responseTimeMs: 30_000 }))).toBe(30_000)
  })
})

// ============================================================================
// isIdleCapped
// ============================================================================

describe('isIdleCapped', () => {
  it('is true only when wasIdleCapped === true', () => {
    expect(isIdleCapped(sample({ wasIdleCapped: true }))).toBe(true)
    expect(isIdleCapped(sample({ wasIdleCapped: false }))).toBe(false)
    expect(isIdleCapped(sample())).toBe(false)
  })
})

// ============================================================================
// classifyAttemptTiming (Tier-1 only for Phase 0)
// ============================================================================

describe('classifyAttemptTiming', () => {
  it('classifies a normal ~30s value as ok', () => {
    expect(classifyAttemptTiming(sample({ responseTimeMs: 30_000 }))).toEqual({ tier: 'ok' })
  })

  it('classifies wasIdleCapped as tier1 / idle-capped (any stored value)', () => {
    const result = sample({
      responseTimeMs: 300_000,
      wasIdleCapped: true,
      responseTimeMsRaw: 5_400_000,
    })
    expect(classifyAttemptTiming(result)).toEqual({ tier: 'tier1', reason: 'idle-capped' })
  })

  it('classifies a legacy implausible value (> cap, no guard flags) as tier1 / legacy-implausible', () => {
    const result = sample({ responseTimeMs: MAX_RESPONSE_TIME_CAP_MS + 1 })
    expect(classifyAttemptTiming(result)).toEqual({
      tier: 'tier1',
      reason: 'legacy-implausible',
    })
  })

  it('does not flag a value exactly at the cap as legacy-implausible', () => {
    const result = sample({ responseTimeMs: MAX_RESPONSE_TIME_CAP_MS })
    expect(classifyAttemptTiming(result)).toEqual({ tier: 'ok' })
  })

  it('does not apply the legacy rule when #156 guard flags are present', () => {
    // Stored value is above the cap but a guard flag is set and it is NOT
    // idle-capped: the guard already handled it, so the legacy heuristic must
    // not re-flag it. (Without the guard-flag check this would be tier1.)
    const result = sample({
      responseTimeMs: MAX_RESPONSE_TIME_CAP_MS + 5_000,
      capSource: 'server',
      capThresholdMs: MAX_RESPONSE_TIME_CAP_MS,
    })
    expect(classifyAttemptTiming(result)).toEqual({ tier: 'ok' })
  })

  it('classifies an adult-adjusted value as ok even when idle-capped', () => {
    const result = sample({
      responseTimeMs: 300_000,
      wasIdleCapped: true,
      responseTimeMsRaw: 5_400_000,
      timingReview: {
        adjustedResponseTimeMs: 35_000,
        reviewedBy: 'adult-1',
        reviewedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(classifyAttemptTiming(result)).toEqual({ tier: 'ok' })
  })

  it('classifies a normal value as ok even when child stats are supplied', () => {
    const result = sample({ responseTimeMs: 30_000 })
    const childStats = { median: 30_000, mad: 5_000, spread: 7_413, cleanSampleCount: 20 }
    expect(classifyAttemptTiming(result, childStats)).toEqual({ tier: 'ok' })
  })

  it('classifies an unusually-slow value as tier2 / unusual-for-child', () => {
    // median 30s, spread ~7.4s → cutoff ≈ 30 + 3.5·7.4 ≈ 56s; a 90s answer is
    // both past the cutoff and past the 60s absolute floor.
    const result = sample({ responseTimeMs: 90_000 })
    const childStats = { median: 30_000, mad: 5_000, spread: 7_413, cleanSampleCount: 20 }
    expect(classifyAttemptTiming(result, childStats)).toEqual({
      tier: 'tier2',
      reason: 'unusual-for-child',
    })
  })

  it('does not flag Tier-2 with fewer than the minimum clean samples', () => {
    const result = sample({ responseTimeMs: 90_000 })
    const childStats = { median: 30_000, mad: 5_000, spread: 7_413, cleanSampleCount: 9 }
    expect(classifyAttemptTiming(result, childStats)).toEqual({ tier: 'ok' })
  })
})

// ============================================================================
// countQuarantined
// ============================================================================

describe('countQuarantined', () => {
  it('counts only Tier-1 samples', () => {
    const results: TimingSample[] = [
      sample({ responseTimeMs: 30_000 }), // ok
      sample({ responseTimeMs: 300_000, wasIdleCapped: true, responseTimeMsRaw: 9_000_000 }), // tier1
      sample({ responseTimeMs: MAX_RESPONSE_TIME_CAP_MS + 5_000 }), // tier1 legacy
      sample({ responseTimeMs: 0 }), // ok (no sample, not tier1)
    ]
    expect(countQuarantined(results)).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(countQuarantined([])).toBe(0)
  })
})

// ============================================================================
// isFlagResolved
// ============================================================================

describe('isFlagResolved', () => {
  it('is false when there is no timingReview at all', () => {
    expect(isFlagResolved(tier1Sample())).toBe(false)
  })

  it('is true when the timing sample was omitted', () => {
    expect(isFlagResolved(tier1Sample({ timingReview: review({ omitFromTiming: true }) }))).toBe(
      true
    )
  })

  it('is true when an adjusted time was entered', () => {
    expect(
      isFlagResolved(tier1Sample({ timingReview: review({ adjustedResponseTimeMs: 35_000 }) }))
    ).toBe(true)
  })

  it('is true when the value was confirmed as genuine', () => {
    expect(isFlagResolved(tier1Sample({ timingReview: review({ timingConfirmed: true }) }))).toBe(
      true
    )
  })

  it('is false for a bare review stamp with no timing resolution (e.g. mastery-only)', () => {
    // reviewedBy/reviewedAt present but no omit/adjust/confirm → still unresolved.
    expect(isFlagResolved(tier1Sample({ timingReview: review({}) }))).toBe(false)
    // timingConfirmed explicitly false (e.g. after an unconfirm) is unresolved.
    expect(
      isFlagResolved(tier1Sample({ timingReview: review({ timingConfirmed: false }) }))
    ).toBe(false)
  })
})

// ============================================================================
// countUnresolvedFlagged
// ============================================================================

describe('countUnresolvedFlagged', () => {
  it('counts an unresolved Tier-1 attempt', () => {
    expect(countUnresolvedFlagged([tier1Sample()])).toBe(1)
  })

  it('does not count a flag resolved via omit', () => {
    expect(
      countUnresolvedFlagged([tier1Sample({ timingReview: review({ omitFromTiming: true }) })])
    ).toBe(0)
  })

  it('does not count a flag resolved via confirm (value stays in the estimate)', () => {
    expect(
      countUnresolvedFlagged([tier1Sample({ timingReview: review({ timingConfirmed: true }) })])
    ).toBe(0)
  })

  it('does not count a flag resolved via an adjusted time (re-classified as ok)', () => {
    expect(
      countUnresolvedFlagged([tier1Sample({ timingReview: review({ adjustedResponseTimeMs: 35_000 }) })])
    ).toBe(0)
  })

  it('never counts an ok sample', () => {
    expect(countUnresolvedFlagged([sample({ responseTimeMs: 30_000 })])).toBe(0)
  })

  it('counts only the unresolved flags in a mixed list', () => {
    const results: TimingSample[] = [
      sample({ responseTimeMs: 30_000 }), // ok
      tier1Sample(), // unresolved tier1 → counted
      tier1Sample({ timingReview: review({ omitFromTiming: true }) }), // resolved → not counted
      tier1Sample({ timingReview: review({ timingConfirmed: true }) }), // resolved → not counted
      sample({ responseTimeMs: MAX_RESPONSE_TIME_CAP_MS + 5_000 }), // unresolved legacy tier1 → counted
    ]
    expect(countUnresolvedFlagged(results)).toBe(2)
  })

  it('counts an unresolved Tier-2 attempt when child stats are supplied', () => {
    const childStats = { median: 30_000, mad: 5_000, spread: 7_413, cleanSampleCount: 20 }
    const tier2 = sample({ responseTimeMs: 90_000 })
    expect(countUnresolvedFlagged([tier2], childStats)).toBe(1)
    // Confirming it keeps the value but drops it from the unresolved count.
    const confirmed = sample({
      responseTimeMs: 90_000,
      timingReview: review({ timingConfirmed: true }),
    })
    expect(countUnresolvedFlagged([confirmed], childStats)).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(countUnresolvedFlagged([])).toBe(0)
  })
})
