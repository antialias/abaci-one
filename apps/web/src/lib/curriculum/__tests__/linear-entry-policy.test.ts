/**
 * Linear entry policy — the configurable composition that decides which
 * skills feed number sentences (see linear-entry-policy.ts).
 */
import { describe, expect, it } from 'vitest'
import {
  assessLinearEntry,
  DEFAULT_LINEAR_ENTRY_POLICY,
  type LinearEntryPolicy,
  resolveLinearEntryPolicy,
} from '@/lib/curriculum/linear-entry-policy'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'

const SKILL = 'basic.directAddition'
let slot = 0

function result(
  isCorrect: boolean,
  opts: {
    ms?: number
    hadHelp?: boolean
    source?: ProblemResultWithContext['source']
    isRetry?: boolean
    terms?: number[]
    skill?: string
  } = {}
): ProblemResultWithContext {
  slot++
  // Newest first in the array = newest timestamp; each call is one minute older.
  const timestamp = new Date(Date.UTC(2026, 8, 1, 12, 0, 0) - slot * 60_000)
  return {
    sessionId: `s${Math.ceil(slot / 5)}`,
    partNumber: 1,
    slotIndex: slot,
    slotId: `slot-${slot}`,
    problem: { terms: opts.terms ?? [1, 2, 3], answer: 6, skillsRequired: [opts.skill ?? SKILL] },
    studentAnswer: isCorrect ? 6 : 7,
    isCorrect,
    responseTimeMs: opts.ms ?? 6_000,
    skillsExercised: [opts.skill ?? SKILL],
    usedOnScreenAbacus: false,
    timestamp,
    hadHelp: opts.hadHelp ?? false,
    incorrectAttempts: 0,
    sessionCompletedAt: timestamp,
    partType: 'visualization',
    source: opts.source,
    isRetry: opts.isRetry,
  }
}

function readiness(over: { mastery?: boolean; volume?: boolean } = {}): SkillReadinessResult {
  return {
    skillId: SKILL,
    isSolid: false,
    dimensions: {
      mastery: { met: over.mastery ?? true, pKnown: 0.97, confidence: 0.8 },
      volume: { met: over.volume ?? true, opportunities: 40, sessionCount: 6 },
      speed: { met: false, medianSecondsPerTerm: 9 },
      consistency: {
        met: false,
        recentAccuracy: 0.8,
        lastFiveAllCorrect: false,
        recentHelpCount: 1,
      },
    },
  }
}

/** n results, the first `wrong` of them (newest) incorrect. */
function history(n: number, wrong: number, ms = 6_000): ProblemResultWithContext[] {
  return Array.from({ length: n }, (_, i) => result(i >= wrong, { ms }))
}

describe('resolveLinearEntryPolicy', () => {
  it('no config → defaults (accuracy 0.85 over 15, no streak, speed off)', () => {
    expect(resolveLinearEntryPolicy(undefined)).toEqual(DEFAULT_LINEAR_ENTRY_POLICY)
    expect(resolveLinearEntryPolicy(null)).toEqual(DEFAULT_LINEAR_ENTRY_POLICY)
    expect(DEFAULT_LINEAR_ENTRY_POLICY).toMatchObject({
      minAccuracy: 0.85,
      accuracyWindowSize: 15,
      requireCleanStreak: false,
      speedRule: 'off',
      frontierRequiresAccuracy: false,
    })
  })

  it('ignores the ramp gate block and reads only `entry`', () => {
    expect(resolveLinearEntryPolicy({ gate: { minAccuracy: 0.5 } })).toEqual(
      DEFAULT_LINEAR_ENTRY_POLICY
    )
  })

  it('applies valid overrides and rejects junk per key', () => {
    const p = resolveLinearEntryPolicy({
      entry: {
        minAccuracy: 0.8,
        accuracyWindowSize: 10.4,
        requireCleanStreak: true,
        speedRule: 'fastest-quartile',
        maxSecondsPerTerm: '5', // wrong type → default
        speedWindowSize: 0, // clamped to 1
        frontierRequiresAccuracy: 'yes', // wrong type → default
      },
    })
    expect(p).toEqual<LinearEntryPolicy>({
      minAccuracy: 0.8,
      accuracyWindowSize: 10,
      requireCleanStreak: true,
      speedRule: 'fastest-quartile',
      maxSecondsPerTerm: DEFAULT_LINEAR_ENTRY_POLICY.maxSecondsPerTerm,
      speedWindowSize: 1,
      frontierRequiresAccuracy: false,
    })
    expect(resolveLinearEntryPolicy({ entry: { speedRule: 'bogus' } }).speedRule).toBe('off')
  })
})

describe('assessLinearEntry (defaults)', () => {
  it('mastered + practiced + 13/15 recent correct → ready and advances the frontier', () => {
    const a = assessLinearEntry(SKILL, history(15, 2), readiness())
    expect(a.ready).toBe(true)
    expect(a.advancesFrontier).toBe(true)
    expect(a.accuracy).toMatchObject({
      met: true,
      windowFilled: 15,
      windowSize: 15,
      minAccuracy: 0.85,
    })
    expect(a.accuracy.recentAccuracy).toBeCloseTo(13 / 15)
    expect(a.speed).toEqual({ rule: 'off', met: true, secondsPerTerm: null, maxSecondsPerTerm: 5 })
    expect(a.opportunities).toBe(40)
  })

  it('12/15 correct → not ready, but still advances the frontier', () => {
    const a = assessLinearEntry(SKILL, history(15, 3), readiness())
    expect(a.ready).toBe(false)
    expect(a.advancesFrontier).toBe(true)
    expect(a.accuracy.met).toBe(false)
    expect(a.accuracy.recentAccuracy).toBeCloseTo(0.8)
  })

  it('mastery or volume missing → neither ready nor advancing', () => {
    expect(assessLinearEntry(SKILL, history(15, 0), readiness({ mastery: false }))).toMatchObject({
      ready: false,
      advancesFrontier: false,
    })
    expect(assessLinearEntry(SKILL, history(15, 0), readiness({ volume: false }))).toMatchObject({
      ready: false,
      advancesFrontier: false,
    })
  })

  it('window not yet filled → accuracy unmet even at 100%', () => {
    const a = assessLinearEntry(SKILL, history(10, 0), readiness())
    expect(a.accuracy).toMatchObject({ met: false, windowFilled: 10, recentAccuracy: 1 })
    expect(a.ready).toBe(false)
  })

  it('only counts first-try, non-sentinel, non-excluded attempts on this skill', () => {
    const h = [
      ...history(15, 0),
      result(false, { isRetry: true }),
      result(false, { source: 'recency-refresh' }),
      result(false, { source: 'teacher-excluded' as ProblemResultWithContext['source'] }),
      result(false, { skill: 'basic.heavenBead' }),
    ]
    const a = assessLinearEntry(SKILL, h, readiness())
    expect(a.accuracy.windowFilled).toBe(15)
    expect(a.accuracy.recentAccuracy).toBe(1)
  })
})

describe('assessLinearEntry (policy knobs)', () => {
  it('requireCleanStreak: a helped answer in the last five blocks membership', () => {
    const policy = { ...DEFAULT_LINEAR_ENTRY_POLICY, requireCleanStreak: true }
    const helped = [result(true, { hadHelp: true }), ...history(14, 0)]
    const a = assessLinearEntry(SKILL, helped, readiness(), policy)
    expect(a.accuracy.cleanStreak).toBe(false)
    expect(a.accuracy.met).toBe(false)
    expect(a.ready).toBe(false)
    const clean = assessLinearEntry(SKILL, history(15, 0), readiness(), policy)
    expect(clean.accuracy.cleanStreak).toBe(true)
    expect(clean.ready).toBe(true)
  })

  it('frontierRequiresAccuracy: an inaccurate skill pins the frontier', () => {
    const policy = { ...DEFAULT_LINEAR_ENTRY_POLICY, frontierRequiresAccuracy: true }
    const a = assessLinearEntry(SKILL, history(15, 3), readiness(), policy)
    expect(a.advancesFrontier).toBe(false)
  })

  it('speed: median vs fastest-quartile over the last 10 timed attempts', () => {
    // 5 fast (2 s/term) + 5 slow (10 s/term), 3-term problems
    const h = [
      ...Array.from({ length: 5 }, () => result(true, { ms: 6_000 })),
      ...Array.from({ length: 5 }, () => result(true, { ms: 30_000 })),
      ...history(10, 0, 30_000), // older, outside the speed window
    ]
    const median = assessLinearEntry(SKILL, h, readiness(), {
      ...DEFAULT_LINEAR_ENTRY_POLICY,
      speedRule: 'median',
      maxSecondsPerTerm: 5,
    })
    expect(median.speed.secondsPerTerm).toBeCloseTo(6)
    expect(median.speed.met).toBe(false)
    expect(median.ready).toBe(false)
    expect(median.advancesFrontier).toBe(true) // speed never gates the frontier

    const q1 = assessLinearEntry(SKILL, h, readiness(), {
      ...DEFAULT_LINEAR_ENTRY_POLICY,
      speedRule: 'fastest-quartile',
      maxSecondsPerTerm: 5,
    })
    expect(q1.speed.secondsPerTerm).toBeCloseTo(2)
    expect(q1.speed.met).toBe(true)
    expect(q1.ready).toBe(true)
  })

  it('speed with no timed attempts → unmet (never silently passes)', () => {
    const a = assessLinearEntry(SKILL, history(15, 0, 0), readiness(), {
      ...DEFAULT_LINEAR_ENTRY_POLICY,
      speedRule: 'median',
    })
    expect(a.speed.secondsPerTerm).toBeNull()
    expect(a.speed.met).toBe(false)
  })
})
