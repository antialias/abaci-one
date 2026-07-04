/**
 * @vitest-environment node
 *
 * BKT exclusion & effective-time tests (#158).
 *
 * Verifies the fix that makes "omit from mastery" real: a `teacher-excluded`
 * attempt must be zero-weight — no pKnown movement and no lastPracticedAt bump.
 * Previously compute-bkt skipped only `recency-refresh`, so excluding an
 * attempt was a placebo. Also checks that repaired timing (effective response
 * time) flows into the evidence weight.
 */

import { describe, expect, it } from 'vitest'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'

const SKILL = 'basic.directAddition'
const BASE_TS = new Date('2025-01-01T10:00:00Z').getTime()

function makeResult(overrides: Partial<ProblemResultWithContext> = {}): ProblemResultWithContext {
  const timestamp = overrides.timestamp ?? new Date(BASE_TS)
  return {
    slotId: 'slot-0',
    partNumber: 1,
    slotIndex: 0,
    problem: {} as ProblemResultWithContext['problem'],
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 5000,
    skillsExercised: [SKILL],
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
    sessionId: 'session-0',
    sessionCompletedAt: new Date(BASE_TS),
    partType: 'abacus',
    ...overrides,
    timestamp,
  }
}

function skillFor(history: ProblemResultWithContext[]) {
  return computeBktFromHistory(history).skills.find((s) => s.skillId === SKILL)
}

/** Three correct attempts building up pKnown, at increasing timestamps. */
function threeCorrect(): ProblemResultWithContext[] {
  return [0, 1, 2].map((i) =>
    makeResult({ slotIndex: i, isCorrect: true, timestamp: new Date(BASE_TS + i * 60_000) })
  )
}

describe('compute-bkt teacher-excluded exclusion', () => {
  it('a teacher-excluded wrong attempt is zero-weight (identical pKnown to omitting it)', () => {
    const wrongTs = new Date(BASE_TS + 10 * 60_000)

    const withoutWrong = skillFor(threeCorrect())
    const withExcludedWrong = skillFor([
      ...threeCorrect(),
      makeResult({ slotIndex: 3, isCorrect: false, timestamp: wrongTs, source: 'teacher-excluded' }),
    ])
    const withCountedWrong = skillFor([
      ...threeCorrect(),
      makeResult({ slotIndex: 3, isCorrect: false, timestamp: wrongTs }),
    ])

    expect(withoutWrong).toBeDefined()
    expect(withExcludedWrong).toBeDefined()
    expect(withCountedWrong).toBeDefined()

    // Excluded == as if the wrong attempt never happened.
    expect(withExcludedWrong!.pKnown).toBeCloseTo(withoutWrong!.pKnown, 10)
    expect(withExcludedWrong!.opportunities).toBe(withoutWrong!.opportunities)

    // And the exclusion actually matters: a counted wrong attempt lowers pKnown.
    expect(withCountedWrong!.pKnown).toBeLessThan(withExcludedWrong!.pKnown)
    expect(withCountedWrong!.opportunities).toBe(withoutWrong!.opportunities + 1)
  })

  it('does not advance lastPracticedAt for an excluded attempt', () => {
    const lastCorrectTs = BASE_TS + 2 * 60_000
    const excludedLaterTs = new Date(BASE_TS + 10 * 60_000)

    const skill = skillFor([
      ...threeCorrect(),
      makeResult({ slotIndex: 3, isCorrect: true, timestamp: excludedLaterTs, source: 'teacher-excluded' }),
    ])
    expect(skill?.lastPracticedAt?.getTime()).toBe(lastCorrectTs)
  })

  it('also skips when originalSource marks the attempt as teacher-excluded', () => {
    const wrongTs = new Date(BASE_TS + 10 * 60_000)
    const withoutWrong = skillFor(threeCorrect())
    const withOriginalSourceExcluded = skillFor([
      ...threeCorrect(),
      makeResult({
        slotIndex: 3,
        isCorrect: false,
        timestamp: wrongTs,
        source: 'practice',
        originalSource: 'teacher-excluded',
      }),
    ])
    expect(withOriginalSourceExcluded!.pKnown).toBeCloseTo(withoutWrong!.pKnown, 10)
  })

  it('recency-refresh remains staleness-only (advances lastPracticedAt, not pKnown)', () => {
    const refreshTs = new Date(BASE_TS + 10 * 60_000)
    const base = skillFor(threeCorrect())
    const withRefresh = skillFor([
      ...threeCorrect(),
      makeResult({ slotIndex: 3, isCorrect: true, timestamp: refreshTs, source: 'recency-refresh' }),
    ])
    // pKnown unchanged by the sentinel...
    expect(withRefresh!.pKnown).toBeCloseTo(base!.pKnown, 10)
    // ...but lastPracticedAt advances to the refresh timestamp.
    expect(withRefresh!.lastPracticedAt?.getTime()).toBe(refreshTs.getTime())
  })
})

describe('compute-bkt effective response time', () => {
  it('a repaired (adjusted) time changes the evidence weight vs the raw slow time', () => {
    // A single correct attempt with a very slow raw time (ratio > 2 → weight 0.8).
    const rawSlow = skillFor([makeResult({ isCorrect: true, responseTimeMs: 200_000 })])
    // Same attempt, but an adult set a fast adjusted time (ratio < 0.5 → weight 1.2).
    const adjustedFast = skillFor([
      makeResult({
        isCorrect: true,
        responseTimeMs: 200_000,
        timingReview: {
          adjustedResponseTimeMs: 1000,
          reviewedBy: 'adult',
          reviewedAt: '2026-07-03T00:00:00.000Z',
        },
      }),
    ])
    expect(rawSlow!.pKnown).not.toBeCloseTo(adjustedFast!.pKnown, 6)
  })
})
