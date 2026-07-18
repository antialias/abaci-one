/**
 * Tests for the linear "abacus-off" ramp gate.
 *
 * The gate decides when a linear-ready category stops getting the working abacus
 * (ramp) and moves to pure mental linear. Signal = first-attempt correctness on that
 * category's linear-with-abacus attempts, over a tunable window behind a volume floor.
 */
import { describe, it, expect } from 'vitest'
import type { SkillCategoryKey } from '@/constants/skillCategories'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import {
  deriveLinearGateState,
  resolveLinearGateThresholds,
  linearPartUsesAbacus,
  DEFAULT_LINEAR_GATE_THRESHOLDS,
  type LinearCategoryGate,
} from '../linear-gate'

const T = DEFAULT_LINEAR_GATE_THRESHOLDS // 0.85 accuracy / 15 window / 20 floor
const CAT: SkillCategoryKey = 'tenComplements'
const SKILL = 'tenComplements.9=10-1'

// Minimal linear-attempt fixture — only the fields the gate reads matter.
function lin(
  skill: string,
  isCorrect: boolean,
  opts: {
    partType?: string
    isRetry?: boolean
    epochNumber?: number
    source?: string
    at?: number
  } = {}
): ProblemResultWithContext {
  const {
    partType = 'linear',
    isRetry = false,
    epochNumber = 0,
    source = 'practice',
    at = 0,
  } = opts
  return {
    skillsExercised: [skill],
    isCorrect,
    partType,
    isRetry,
    epochNumber,
    source,
    timestamp: new Date(1_700_000_000_000 + at * 1000).toISOString(),
  } as unknown as ProblemResultWithContext
}

function manyLinear(n: number, correctAt: (i: number) => boolean): ProblemResultWithContext[] {
  return Array.from({ length: n }, (_, i) => lin(SKILL, correctAt(i), { at: i }))
}

function gate(category: string, passed: boolean): LinearCategoryGate {
  return { category: category as SkillCategoryKey, opportunities: 30, recentAccuracy: 1, passed }
}

describe('resolveLinearGateThresholds', () => {
  it('falls back to defaults for null/undefined/empty/invalid config', () => {
    expect(resolveLinearGateThresholds(null)).toEqual(T)
    expect(resolveLinearGateThresholds(undefined)).toEqual(T)
    expect(resolveLinearGateThresholds({})).toEqual(T)
    expect(resolveLinearGateThresholds({ gate: { minAccuracy: 'nope' } })).toEqual(T)
    expect(resolveLinearGateThresholds({ gate: { minAccuracy: Infinity } })).toEqual(T)
  })

  it('merges provided numeric overrides per-field', () => {
    expect(
      resolveLinearGateThresholds({ gate: { minAccuracy: 0.8, minOpportunities: 12 } })
    ).toEqual({
      minAccuracy: 0.8,
      accuracyWindowSize: T.accuracyWindowSize,
      minOpportunities: 12,
    })
  })
})

describe('deriveLinearGateState', () => {
  const cats: SkillCategoryKey[] = [CAT]

  it('no linear history → 0 opportunities, not passed', () => {
    const g = deriveLinearGateState({ problemHistory: [], categories: cats, thresholds: T }).get(
      CAT
    )!
    expect(g.opportunities).toBe(0)
    expect(g.passed).toBe(false)
  })

  it('≥floor opportunities and ≥minAccuracy recent → passed', () => {
    const g = deriveLinearGateState({
      problemHistory: manyLinear(20, () => true),
      categories: cats,
      thresholds: T,
    }).get(CAT)!
    expect(g.opportunities).toBe(20)
    expect(g.recentAccuracy).toBe(1)
    expect(g.passed).toBe(true)
  })

  it('enough opportunities but recent accuracy below minAccuracy → not passed', () => {
    // 20 attempts; the most-recent 15 (i=5..19) are only 10/15 correct (~0.67).
    const g = deriveLinearGateState({
      problemHistory: manyLinear(20, (i) => (i >= 5 ? i % 3 !== 0 : true)),
      categories: cats,
      thresholds: T,
    }).get(CAT)!
    expect(g.opportunities).toBe(20)
    expect(g.recentAccuracy).toBeLessThan(T.minAccuracy)
    expect(g.passed).toBe(false)
  })

  it('below the opportunity floor → not passed even at 100% accuracy', () => {
    const g = deriveLinearGateState({
      problemHistory: manyLinear(15, () => true), // 15 < 20
      categories: cats,
      thresholds: T,
    }).get(CAT)!
    expect(g.opportunities).toBe(15)
    expect(g.recentAccuracy).toBe(1)
    expect(g.passed).toBe(false)
  })

  it('ignores non-linear mode, retries, and sentinel/excluded results', () => {
    const noise = [
      ...Array.from({ length: 30 }, (_, i) => lin(SKILL, true, { partType: 'abacus', at: i })),
      ...Array.from({ length: 30 }, (_, i) =>
        lin(SKILL, true, { isRetry: true, epochNumber: 1, at: i })
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        lin(SKILL, true, { source: 'recency-refresh', at: i })
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        lin(SKILL, true, { source: 'teacher-excluded', at: i })
      ),
    ]
    const g = deriveLinearGateState({ problemHistory: noise, categories: cats, thresholds: T }).get(
      CAT
    )!
    expect(g.opportunities).toBe(0)
    expect(g.passed).toBe(false)
  })

  it('attributes an attempt to a category via its exercised skills', () => {
    const other = Array.from({ length: 20 }, (_, i) => lin('basic.directAddition', true, { at: i }))
    const g = deriveLinearGateState({ problemHistory: other, categories: cats, thresholds: T }).get(
      CAT
    )!
    expect(g.opportunities).toBe(0) // none exercise tenComplements
  })

  it('honors tunable thresholds (a lower floor + accuracy lets it pass sooner)', () => {
    const history = manyLinear(12, () => true)
    const strict = deriveLinearGateState({
      problemHistory: history,
      categories: cats,
      thresholds: T,
    }).get(CAT)!
    const lenient = deriveLinearGateState({
      problemHistory: history,
      categories: cats,
      thresholds: { minAccuracy: 0.8, accuracyWindowSize: 10, minOpportunities: 10 },
    }).get(CAT)!
    expect(strict.passed).toBe(false) // 12 < default floor 20
    expect(lenient.passed).toBe(true) // 12 ≥ 10, window full, 100% ≥ 0.8
  })
})

describe('linearPartUsesAbacus', () => {
  it('empty gate map → abacus off (nothing to ramp)', () => {
    expect(linearPartUsesAbacus(new Map())).toBe(false)
  })

  it('any category not passed → abacus on (ramp)', () => {
    const m = new Map<SkillCategoryKey, LinearCategoryGate>([
      ['basic', gate('basic', true)],
      ['tenComplements', gate('tenComplements', false)],
    ])
    expect(linearPartUsesAbacus(m)).toBe(true)
  })

  it('all categories passed → abacus off (mental)', () => {
    const m = new Map<SkillCategoryKey, LinearCategoryGate>([
      ['basic', gate('basic', true)],
      ['tenComplements', gate('tenComplements', true)],
    ])
    expect(linearPartUsesAbacus(m)).toBe(false)
  })
})
