import { describe, it, expect } from 'vitest'
import { assessPace, computeChildTimingStats, type TimedAttempt } from '../pace-estimation'
import type { TimingSample } from '../effective-time'

// ============================================================================
// Helpers
// ============================================================================

let seq = 0

function attempt(
  responseTimeMs: number,
  overrides: Partial<TimingSample> = {},
  meta: { sessionId?: string; completedAt?: string | null; termCount?: number } = {}
): TimedAttempt {
  seq++
  return {
    sessionId: meta.sessionId ?? `session-${seq}`,
    completedAt: meta.completedAt ?? '2026-01-01T00:00:00.000Z',
    termCount: meta.termCount ?? 3,
    sample: { responseTimeMs, ...overrides },
  }
}

/** A batch of plain measurements sharing one session id. */
function clean(values: number[], sessionId = 'clean-session'): TimedAttempt[] {
  return values.map((v) => attempt(v, {}, { sessionId }))
}

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000 // 28,800,000

// ============================================================================
// computeChildTimingStats
// ============================================================================

describe('computeChildTimingStats', () => {
  it('computes median, MAD, and the robust spread', () => {
    const stats = computeChildTimingStats([10_000, 20_000, 30_000, 40_000, 50_000])
    expect(stats.median).toBe(30_000)
    // deviations: [20000,10000,0,10000,20000] → median 10000
    expect(stats.mad).toBe(10_000)
    // spread = max(1.4826·10000=14826, 0.25·30000=7500, 5000)
    expect(stats.spread).toBeCloseTo(14_826)
    expect(stats.cleanSampleCount).toBe(5)
  })

  it('applies the 5000ms spread floor for a degenerate (MAD=0) distribution', () => {
    const stats = computeChildTimingStats([1_000, 1_000, 1_000, 1_000])
    expect(stats.mad).toBe(0)
    // median 1000 → 0.25·1000 = 250 → floored to 5000
    expect(stats.spread).toBe(5_000)
  })

  it('returns zeros for an empty distribution', () => {
    expect(computeChildTimingStats([])).toEqual({
      median: 0,
      mad: 0,
      spread: 0,
      cleanSampleCount: 0,
    })
  })
})

// ============================================================================
// Tier-1 exclusion (the un-capping litmus)
// ============================================================================

describe('assessPace — Tier-1 exclusion', () => {
  it('excludes a synthetic 8h legacy attempt and un-caps the estimate', () => {
    // WITHOUT exclusion the raw mean would be ~1457s (poisoned). The legacy rule
    // classifies the 8h value Tier-1 at READ time — no DB repair needed.
    const attempts = [
      ...clean(Array(20).fill(90_000)), // 20 genuine ~90s answers
      attempt(EIGHT_HOURS_MS, {}, { sessionId: 'poisoned' }), // legacy, no #156 flags
    ]

    const result = assessPace(attempts, 5)

    expect(result.tier1Count).toBe(1)
    expect(result.sampleCount).toBe(20) // 8h sample excluded from the estimate
    expect(result.avgSecondsPerProblem).toBe(90) // NOT dragged toward hours
    expect(result.avgSecondsPerProblem).toBeLessThanOrEqual(120)
    expect(result.affectedSessions).toHaveLength(1)
    expect(result.affectedSessions[0].sessionId).toBe('poisoned')
    expect(result.affectedSessions[0].flaggedCount).toBe(1)
    expect(result.affectedSessions[0].worstSeconds).toBeCloseTo(EIGHT_HOURS_MS / 1000)
    expect(result.unresolvedCount).toBe(1) // flagged, no timingReview
  })

  it('excludes an idle-capped (#156) sample regardless of its stored value', () => {
    const attempts = [
      ...clean(Array(10).fill(60_000)),
      attempt(
        300_000,
        { wasIdleCapped: true, responseTimeMsRaw: 5_400_000 },
        { sessionId: 'capped' }
      ),
    ]

    const result = assessPace(attempts, 3)

    expect(result.tier1Count).toBe(1)
    expect(result.sampleCount).toBe(10)
    expect(result.avgSecondsPerProblem).toBe(60)
  })

  it('re-includes an adult-adjusted (restore-raw) value and never re-flags it', () => {
    const attempts = [
      ...clean(Array(10).fill(40_000)),
      attempt(
        300_000,
        {
          wasIdleCapped: true,
          responseTimeMsRaw: 5_400_000,
          timingReview: {
            adjustedResponseTimeMs: 45_000,
            reviewedBy: 'adult-1',
            reviewedAt: '2026-01-01T00:00:00.000Z',
          },
        },
        { sessionId: 'repaired' }
      ),
    ]

    const result = assessPace(attempts, 3)

    expect(result.tier1Count).toBe(0) // adjusted → ok, not quarantined
    expect(result.tier2Count).toBe(0)
    expect(result.sampleCount).toBe(11) // the adjusted value re-enters the estimate
  })
})

// ============================================================================
// Tier-2 (per-child, winsorize-not-drop)
// ============================================================================

describe('assessPace — Tier-2 per-child', () => {
  it('flags a 4-minute answer as Tier-2 for a fast child but not a slow child', () => {
    const fourMin = 240_000

    // Fast child (median 36s): cutoff ≈ 36 + 3.5·9 = 67.5s → 4-min is unusual.
    const fast = assessPace(
      [...clean(Array(12).fill(36_000)), attempt(fourMin, {}, { sessionId: 's' })],
      3
    )
    expect(fast.tier2Count).toBe(1)

    // Slow child (median 150s): cutoff ≈ 281s → the same 4-min is normal.
    const slow = assessPace(
      [...clean(Array(12).fill(150_000)), attempt(fourMin, {}, { sessionId: 's' })],
      3
    )
    expect(slow.tier2Count).toBe(0)
  })

  it('keeps Tier-2 samples in the estimate (winsorized), never dropped', () => {
    const attempts = [...clean(Array(12).fill(36_000)), attempt(240_000, {}, { sessionId: 'slow' })]

    const result = assessPace(attempts, 3)

    expect(result.tier2Count).toBe(1)
    expect(result.sampleCount).toBe(13) // Tier-2 counted, not dropped
    // winsorized to cutoff = 36000 + 3.5·9000 = 67500ms → contributes 67.5s, not 240s.
    // mean = (12·36000 + 67500) / 13 ≈ 38423ms ≈ 38s
    expect(result.avgSecondsPerProblem).toBe(38)
    // "if repaired" preview (ok-only) is strictly lower than the with-Tier-2 estimate.
    expect(result.secondsPerProblemExcludingFlagged).toBe(36)
    expect(result.secondsPerProblemExcludingFlagged!).toBeLessThan(result.avgSecondsPerProblem)
  })

  it('does not flag Tier-2 with fewer than 10 clean samples', () => {
    // 8 fast + one 4-min = 9 clean samples (the outlier itself counts): too few
    // for a per-child judgement, so nothing is flagged.
    const attempts = [...clean(Array(8).fill(36_000)), attempt(240_000, {}, { sessionId: 's' })]
    const result = assessPace(attempts, 3)
    expect(result.tier2Count).toBe(0)
    expect(result.sampleCount).toBe(9) // the 4-min stays in as an ordinary sample
  })

  it('does not count a confirmed flag as unresolved', () => {
    const confirmed = attempt(
      240_000,
      {
        timingReview: {
          timingConfirmed: true,
          reviewedBy: 'adult-1',
          reviewedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      { sessionId: 'confirmed' }
    )
    const result = assessPace([...clean(Array(12).fill(36_000)), confirmed], 3)
    expect(result.tier2Count).toBe(1)
    expect(result.unresolvedCount).toBe(0) // has a timingReview → resolved
  })
})

// ============================================================================
// Ceiling / floor / defaults / integer output
// ============================================================================

describe('assessPace — clamping and fallbacks', () => {
  it('clamps a uniformly-slow window to the 120s ceiling', () => {
    // 300000ms is exactly at the Tier-1 cap (not over), so it stays in the estimate.
    const result = assessPace(clean(Array(10).fill(300_000)), 3)
    expect(result.tier1Count).toBe(0)
    expect(result.avgSecondsPerProblem).toBe(120)
  })

  it('clamps a very-fast window to the 10s floor', () => {
    const result = assessPace(clean(Array(10).fill(2_000)), 3)
    expect(result.avgSecondsPerProblem).toBe(10)
  })

  it('falls back to the default with fewer than 5 usable samples', () => {
    const result = assessPace(clean([30_000, 40_000, 50_000, 60_000]), 2, {
      defaultSecondsPerProblem: 45,
    })
    expect(result.isDefault).toBe(true)
    expect(result.sampleCount).toBe(4)
    expect(result.avgSecondsPerProblem).toBe(45)
  })

  it('does not fall back at exactly 5 usable samples', () => {
    const result = assessPace(clean([30_000, 40_000, 50_000, 60_000, 70_000]), 2)
    expect(result.isDefault).toBe(false)
    expect(result.sampleCount).toBe(5)
    expect(result.avgSecondsPerProblem).toBe(50)
  })

  it('is default (no crash) for an empty window', () => {
    const result = assessPace([], 0, { defaultSecondsPerProblem: 45 })
    expect(result.isDefault).toBe(true)
    expect(result.sampleCount).toBe(0)
    expect(result.avgSecondsPerProblem).toBe(45)
    expect(result.affectedSessions).toEqual([])
  })

  it('returns an integer estimate', () => {
    const result = assessPace(clean([31_000, 32_000, 33_000, 34_000, 35_500]), 2)
    expect(Number.isInteger(result.avgSecondsPerProblem)).toBe(true)
  })
})

// ============================================================================
// Sentinels, term normalization, equivalence
// ============================================================================

describe('assessPace — sentinels and derived fields', () => {
  it('ignores recency-refresh and non-positive sentinels', () => {
    const attempts = [
      ...clean(Array(5).fill(30_000)),
      attempt(30_000, { source: 'recency-refresh' }),
      attempt(0),
      attempt(-5),
    ]
    const result = assessPace(attempts, 2)
    expect(result.sampleCount).toBe(5) // only the real measurements
    expect(result.tier1Count).toBe(0)
    expect(result.avgSecondsPerProblem).toBe(30)
  })

  it('computes seconds per term from term counts', () => {
    // 30000ms / 3 terms = 10s per term
    const attempts = Array(5)
      .fill(30_000)
      .map((v) => attempt(v, {}, { termCount: 3 }))
    const result = assessPace(attempts, 2)
    expect(result.secondsPerTerm).toBeCloseTo(10)
  })

  it('returns null secondsPerTerm when no term-count data exists', () => {
    const attempts = Array(5)
      .fill(30_000)
      .map((v) => attempt(v, {}, { termCount: 0 }))
    const result = assessPace(attempts, 2)
    expect(result.secondsPerTerm).toBeNull()
  })

  it('matches the legacy weighted-mean on clean data (equivalence pin)', () => {
    // legacy: round((30000·5 + 50000·5) / 10 / 1000) = 40
    const result = assessPace([...clean(Array(5).fill(30_000), 'A'), ...clean(Array(5).fill(50_000), 'B')], 2)
    expect(result.tier1Count).toBe(0)
    expect(result.tier2Count).toBe(0)
    expect(result.avgSecondsPerProblem).toBe(40)
  })
})
