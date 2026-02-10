/**
 * @vitest-environment node
 *
 * Unit tests for skill-metrics.ts
 *
 * Tests all pure/semi-pure exported functions:
 * - getSkillCategory
 * - calculateOverallMastery
 * - calculateCategoryMastery
 * - calculateNormalizedResponseTime
 * - calculateAccuracy
 * - calculatePracticeStreak
 * - calculateWeeklyProblems
 * - calculateCategorySpeed
 * - computeClassroomLeaderboard
 *
 * Note: computeStudentSkillMetrics and calculateImprovementRate are skipped
 * because they depend on computeBktFromHistory which has deep transitive deps.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock BKT config
vi.mock('./config/bkt-integration', () => ({
  BKT_THRESHOLDS: {
    strong: 0.8,
    weak: 0.5,
    confidence: 0.3,
  },
}))

// Mock compute-bkt (used by calculateImprovementRate and computeStudentSkillMetrics)
vi.mock('./bkt/compute-bkt', () => ({
  computeBktFromHistory: vi.fn().mockReturnValue({ skills: [] }),
}))

import type { SkillBktResult } from '@/lib/curriculum/bkt/types'
import type { SlotResult, SessionPlan } from '@/db/schema/session-plans'
import {
  getSkillCategory,
  calculateOverallMastery,
  calculateCategoryMastery,
  calculateNormalizedResponseTime,
  calculateAccuracy,
  calculatePracticeStreak,
  calculateWeeklyProblems,
  calculateCategorySpeed,
  computeClassroomLeaderboard,
  type SkillCategory,
  type PlayerLeaderboardData,
  type StudentSkillMetrics,
  SKILL_CATEGORY_INFO,
} from '@/lib/curriculum/skill-metrics'

// =============================================================================
// Helpers
// =============================================================================

function makeBktResult(
  skillId: string,
  pKnown: number,
  confidence: number = 0.5,
  opportunities: number = 20
): SkillBktResult {
  return {
    skillId,
    pKnown,
    confidence,
    uncertaintyRange: { low: Math.max(0, pKnown - 0.1), high: Math.min(1, pKnown + 0.1) },
    opportunities,
    successCount: Math.floor(opportunities * pKnown),
    lastPracticedAt: new Date(),
    masteryClassification: pKnown >= 0.8 ? 'strong' : pKnown < 0.5 ? 'weak' : 'developing',
  }
}

interface ProblemResultLike {
  isCorrect: boolean
  responseTimeMs: number
  hadHelp: boolean
  problem: { terms: number[]; answer: number; skillsRequired: string[] }
  skillsExercised: string[]
  timestamp: Date
  partNumber: 1 | 2 | 3
  slotIndex: number
  studentAnswer: number
  usedOnScreenAbacus: boolean
  incorrectAttempts: number
  sessionId: string
  sessionCompletedAt: Date
  partType: string
}

function makeProblemResult(overrides: Partial<ProblemResultLike> = {}): ProblemResultLike {
  return {
    isCorrect: true,
    responseTimeMs: 5000,
    hadHelp: false,
    problem: { terms: [1, 2, 3], answer: 6, skillsRequired: ['add.direct'] },
    skillsExercised: ['basic.directAddition'],
    timestamp: new Date(),
    partNumber: 1,
    slotIndex: 0,
    studentAnswer: 6,
    usedOnScreenAbacus: false,
    incorrectAttempts: 0,
    sessionId: 'session-1',
    sessionCompletedAt: new Date(),
    partType: 'abacus',
    ...overrides,
  }
}

function makeSessionPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'session-1',
    playerId: 'player-1',
    targetDurationMinutes: 10,
    estimatedProblemCount: 10,
    avgTimePerProblemSeconds: 15,
    gameBreakSettings: null,
    parts: [],
    summary: {
      focusDescription: 'test',
      totalProblemCount: 10,
      estimatedMinutes: 10,
      parts: [],
    },
    masteredSkillIds: [],
    status: 'completed',
    currentPartIndex: 0,
    currentSlotIndex: 0,
    sessionHealth: null,
    adjustments: [],
    results: [],
    retryState: null,
    remoteCameraSessionId: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    createdAt: new Date(),
    approvedAt: null,
    startedAt: null,
    completedAt: new Date(),
    ...overrides,
  } as SessionPlan
}

// =============================================================================
// Tests: getSkillCategory
// =============================================================================

describe('getSkillCategory', () => {
  it('returns "basic" for basic skills', () => {
    expect(getSkillCategory('basic.directAddition')).toBe('basic')
  })

  it('returns "fiveComplements" for five complement skills', () => {
    expect(getSkillCategory('fiveComplements.4=5-1')).toBe('fiveComplements')
  })

  it('returns "fiveComplementsSub" for five complement subtraction skills', () => {
    expect(getSkillCategory('fiveComplementsSub.-4=-5+1')).toBe('fiveComplementsSub')
  })

  it('returns "tenComplements" for ten complement skills', () => {
    expect(getSkillCategory('tenComplements.9=10-1')).toBe('tenComplements')
  })

  it('returns "tenComplementsSub" for ten complement subtraction skills', () => {
    expect(getSkillCategory('tenComplementsSub.-9=-10+1')).toBe('tenComplementsSub')
  })

  it('returns "advanced" for advanced skills', () => {
    expect(getSkillCategory('advanced.cascading')).toBe('advanced')
  })

  it('defaults to "basic" for unknown categories', () => {
    expect(getSkillCategory('unknown.skill')).toBe('basic')
    expect(getSkillCategory('randomCategory.foo')).toBe('basic')
  })

  it('handles skills without dots', () => {
    expect(getSkillCategory('noCategory')).toBe('basic')
  })
})

// =============================================================================
// Tests: calculateOverallMastery
// =============================================================================

describe('calculateOverallMastery', () => {
  it('returns 0 for empty results', () => {
    expect(calculateOverallMastery([])).toBe(0)
  })

  it('returns weighted average of pKnown values', () => {
    const results = [
      makeBktResult('s1', 0.8, 0.5, 10),
      makeBktResult('s2', 0.4, 0.5, 10),
    ]
    const mastery = calculateOverallMastery(results)
    // weight = confidence * max(1, opportunities) = 0.5 * 10 = 5 for each
    // weighted sum = 0.8 * 5 + 0.4 * 5 = 4 + 2 = 6
    // total weight = 5 + 5 = 10
    // mastery = 6 / 10 = 0.6
    expect(mastery).toBeCloseTo(0.6)
  })

  it('weights by confidence and opportunities', () => {
    const results = [
      makeBktResult('s1', 0.9, 0.9, 50), // high confidence, many opportunities
      makeBktResult('s2', 0.3, 0.1, 2),   // low confidence, few opportunities
    ]
    const mastery = calculateOverallMastery(results)
    // s1 weight = 0.9 * 50 = 45
    // s2 weight = 0.1 * 2 = 0.2
    // weighted avg = (0.9 * 45 + 0.3 * 0.2) / (45 + 0.2)
    //             = (40.5 + 0.06) / 45.2 ≈ 0.897
    expect(mastery).toBeCloseTo(0.897, 2)
  })

  it('returns single skill pKnown for single skill', () => {
    const results = [makeBktResult('s1', 0.75, 0.5, 10)]
    expect(calculateOverallMastery(results)).toBeCloseTo(0.75)
  })
})

// =============================================================================
// Tests: calculateCategoryMastery
// =============================================================================

describe('calculateCategoryMastery', () => {
  it('returns zeros for all categories when no results', () => {
    const result = calculateCategoryMastery([])
    for (const category of Object.keys(result) as SkillCategory[]) {
      expect(result[category].pKnownAvg).toBe(0)
      expect(result[category].skillCount).toBe(0)
      expect(result[category].masteredCount).toBe(0)
      expect(result[category].practicedCount).toBe(0)
    }
  })

  it('groups skills by category correctly', () => {
    const results = [
      makeBktResult('basic.directAddition', 0.9, 0.5, 20),
      makeBktResult('basic.heavenBead', 0.7, 0.5, 15),
      makeBktResult('fiveComplements.4=5-1', 0.6, 0.5, 10),
    ]

    const mastery = calculateCategoryMastery(results)

    expect(mastery.basic.skillCount).toBe(2)
    expect(mastery.basic.pKnownAvg).toBeCloseTo(0.8) // (0.9 + 0.7) / 2
    expect(mastery.fiveComplements.skillCount).toBe(1)
    expect(mastery.fiveComplements.pKnownAvg).toBeCloseTo(0.6)
    expect(mastery.tenComplements.skillCount).toBe(0)
  })

  it('counts mastered skills correctly (pKnown >= 0.8)', () => {
    const results = [
      makeBktResult('basic.directAddition', 0.9),  // mastered
      makeBktResult('basic.heavenBead', 0.8),       // mastered (edge)
      makeBktResult('basic.directSubtraction', 0.79), // NOT mastered
    ]

    const mastery = calculateCategoryMastery(results)

    expect(mastery.basic.masteredCount).toBe(2)
    expect(mastery.basic.skillCount).toBe(3)
  })

  it('counts practiced skills (opportunities > 0)', () => {
    const results = [
      makeBktResult('basic.directAddition', 0.5, 0.5, 10), // practiced
      makeBktResult('basic.heavenBead', 0.5, 0.5, 0),      // not practiced
    ]

    const mastery = calculateCategoryMastery(results)

    expect(mastery.basic.practicedCount).toBe(1)
  })

  it('puts unknown categories under basic', () => {
    const results = [
      makeBktResult('weirdCategory.foo', 0.7),
    ]

    const mastery = calculateCategoryMastery(results)
    expect(mastery.basic.skillCount).toBe(1)
  })
})

// =============================================================================
// Tests: calculateNormalizedResponseTime
// =============================================================================

describe('calculateNormalizedResponseTime', () => {
  it('returns null avgSecondsPerTerm and stable trend with fewer than 5 valid results', () => {
    const results = [
      makeProblemResult(),
      makeProblemResult(),
      makeProblemResult(),
      makeProblemResult(),
    ]
    const { avgSecondsPerTerm, trend } = calculateNormalizedResponseTime(results as any)
    expect(avgSecondsPerTerm).toBeNull()
    expect(trend).toBe('stable')
  })

  it('excludes results where hadHelp is true', () => {
    const validResults = Array.from({ length: 4 }, () => makeProblemResult())
    const helpResults = Array.from({ length: 5 }, () =>
      makeProblemResult({ hadHelp: true })
    )
    const all = [...validResults, ...helpResults]
    const { avgSecondsPerTerm } = calculateNormalizedResponseTime(all as any)
    expect(avgSecondsPerTerm).toBeNull() // only 4 valid results
  })

  it('excludes results with responseTimeMs > 120000', () => {
    const validResults = Array.from({ length: 4 }, () => makeProblemResult())
    const slowResults = Array.from({ length: 5 }, () =>
      makeProblemResult({ responseTimeMs: 130000 })
    )
    const all = [...validResults, ...slowResults]
    const { avgSecondsPerTerm } = calculateNormalizedResponseTime(all as any)
    expect(avgSecondsPerTerm).toBeNull() // only 4 valid results
  })

  it('excludes results with responseTimeMs <= 0', () => {
    const validResults = Array.from({ length: 4 }, () => makeProblemResult())
    const invalidResults = Array.from({ length: 5 }, () =>
      makeProblemResult({ responseTimeMs: 0 })
    )
    const all = [...validResults, ...invalidResults]
    const { avgSecondsPerTerm } = calculateNormalizedResponseTime(all as any)
    expect(avgSecondsPerTerm).toBeNull()
  })

  it('calculates correct avg seconds per term', () => {
    // Each result: 6000ms / 3 terms = 2 sec/term
    const results = Array.from({ length: 10 }, () =>
      makeProblemResult({
        responseTimeMs: 6000,
        problem: { terms: [1, 2, 3], answer: 6, skillsRequired: ['add.direct'] },
      })
    )
    const { avgSecondsPerTerm } = calculateNormalizedResponseTime(results as any)
    expect(avgSecondsPerTerm).toBeCloseTo(2)
  })

  it('detects improving trend (recent is faster)', () => {
    // Recent results (first half) are faster than older results (second half)
    const results: ProblemResultLike[] = []
    // Recent: 3000ms / 3 terms = 1 sec/term
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ responseTimeMs: 3000 }))
    }
    // Older: 9000ms / 3 terms = 3 sec/term
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ responseTimeMs: 9000 }))
    }
    const { trend } = calculateNormalizedResponseTime(results as any)
    expect(trend).toBe('improving')
  })

  it('detects declining trend (recent is slower)', () => {
    const results: ProblemResultLike[] = []
    // Recent: 9000ms / 3 terms = 3 sec/term
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ responseTimeMs: 9000 }))
    }
    // Older: 3000ms / 3 terms = 1 sec/term
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ responseTimeMs: 3000 }))
    }
    const { trend } = calculateNormalizedResponseTime(results as any)
    expect(trend).toBe('declining')
  })

  it('detects stable trend when change is minimal', () => {
    const results: ProblemResultLike[] = []
    // Recent: 5000ms / 3 terms
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ responseTimeMs: 5000 }))
    }
    // Older: 5100ms / 3 terms (very similar)
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ responseTimeMs: 5100 }))
    }
    const { trend } = calculateNormalizedResponseTime(results as any)
    expect(trend).toBe('stable')
  })
})

// =============================================================================
// Tests: calculateAccuracy
// =============================================================================

describe('calculateAccuracy', () => {
  it('returns zeros for empty results', () => {
    const { overallPercent, recentPercent, trend } = calculateAccuracy([])
    expect(overallPercent).toBe(0)
    expect(recentPercent).toBe(0)
    expect(trend).toBe('stable')
  })

  it('calculates overall accuracy correctly', () => {
    const results = [
      makeProblemResult({ isCorrect: true }),
      makeProblemResult({ isCorrect: true }),
      makeProblemResult({ isCorrect: false }),
    ]
    const { overallPercent } = calculateAccuracy(results as any)
    expect(overallPercent).toBeCloseTo(66.67, 1) // 2/3 * 100
  })

  it('calculates recent accuracy from last 50 results', () => {
    // 60 results total, only last 50 used for recent
    const results: ProblemResultLike[] = []
    // Newest 50: all correct
    for (let i = 0; i < 50; i++) {
      results.push(makeProblemResult({ isCorrect: true }))
    }
    // Oldest 10: all wrong
    for (let i = 0; i < 10; i++) {
      results.push(makeProblemResult({ isCorrect: false }))
    }
    const { recentPercent, overallPercent } = calculateAccuracy(results as any)
    expect(recentPercent).toBeCloseTo(100) // newest 50 are all correct
    expect(overallPercent).toBeCloseTo((50 / 60) * 100, 1)
  })

  it('returns stable trend when fewer than 20 recent results', () => {
    const results = Array.from({ length: 15 }, () => makeProblemResult({ isCorrect: true }))
    const { trend } = calculateAccuracy(results as any)
    expect(trend).toBe('stable')
  })

  it('detects improving trend', () => {
    const results: ProblemResultLike[] = []
    // Newer half: 10 all correct (100%)
    for (let i = 0; i < 10; i++) {
      results.push(makeProblemResult({ isCorrect: true }))
    }
    // Older half: 10, only 5 correct (50%)
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ isCorrect: true }))
    }
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ isCorrect: false }))
    }
    const { trend } = calculateAccuracy(results as any)
    expect(trend).toBe('improving')
  })

  it('detects declining trend', () => {
    const results: ProblemResultLike[] = []
    // Newer half: 10, only 5 correct (50%)
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ isCorrect: true }))
    }
    for (let i = 0; i < 5; i++) {
      results.push(makeProblemResult({ isCorrect: false }))
    }
    // Older half: 10 all correct (100%)
    for (let i = 0; i < 10; i++) {
      results.push(makeProblemResult({ isCorrect: true }))
    }
    const { trend } = calculateAccuracy(results as any)
    expect(trend).toBe('declining')
  })
})

// =============================================================================
// Tests: calculatePracticeStreak
// =============================================================================

describe('calculatePracticeStreak', () => {
  // Pin system clock so streak calculations are deterministic across timezones
  const FIXED_NOW = new Date('2026-06-15T14:00:00')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for empty sessions', () => {
    expect(calculatePracticeStreak([])).toBe(0)
  })

  it('returns 0 for sessions without completed status', () => {
    const sessions = [
      makeSessionPlan({ status: 'draft', completedAt: FIXED_NOW }),
    ]
    expect(calculatePracticeStreak(sessions)).toBe(0)
  })

  it('returns 0 for completed sessions without completedAt', () => {
    const sessions = [
      makeSessionPlan({ status: 'completed', completedAt: null }),
    ]
    expect(calculatePracticeStreak(sessions)).toBe(0)
  })

  it('counts consecutive days from today', () => {
    const today = new Date('2026-06-15T12:00:00')
    const yesterday = new Date('2026-06-14T12:00:00')
    const twoDaysAgo = new Date('2026-06-13T12:00:00')

    const sessions = [
      makeSessionPlan({ id: 's1', status: 'completed', completedAt: today }),
      makeSessionPlan({ id: 's2', status: 'completed', completedAt: yesterday }),
      makeSessionPlan({ id: 's3', status: 'completed', completedAt: twoDaysAgo }),
    ]

    expect(calculatePracticeStreak(sessions)).toBe(3)
  })

  it('breaks streak when a day is missed', () => {
    const today = new Date('2026-06-15T12:00:00')
    const threeDaysAgo = new Date('2026-06-12T12:00:00')

    const sessions = [
      makeSessionPlan({ id: 's1', status: 'completed', completedAt: today }),
      makeSessionPlan({ id: 's2', status: 'completed', completedAt: threeDaysAgo }),
    ]

    expect(calculatePracticeStreak(sessions)).toBe(1)
  })

  it('returns 0 when most recent session is > 1 day ago', () => {
    const threeDaysAgo = new Date('2026-06-12T12:00:00')

    const sessions = [
      makeSessionPlan({ id: 's1', status: 'completed', completedAt: threeDaysAgo }),
    ]

    expect(calculatePracticeStreak(sessions)).toBe(0)
  })

  it('deduplicates multiple sessions on the same day', () => {
    const todayMorning = new Date('2026-06-15T10:00:00')
    const todayAfternoon = new Date('2026-06-15T14:00:00')
    const yesterday = new Date('2026-06-14T12:00:00')

    const sessions = [
      makeSessionPlan({ id: 's1', status: 'completed', completedAt: todayMorning }),
      makeSessionPlan({ id: 's2', status: 'completed', completedAt: todayAfternoon }),
      makeSessionPlan({ id: 's3', status: 'completed', completedAt: yesterday }),
    ]

    expect(calculatePracticeStreak(sessions)).toBe(2)
  })
})

// =============================================================================
// Tests: calculateWeeklyProblems
// =============================================================================

describe('calculateWeeklyProblems', () => {
  it('returns 0 for empty results', () => {
    expect(calculateWeeklyProblems([])).toBe(0)
  })

  it('counts problems within the last 7 days', () => {
    const now = new Date()
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)  // 10 days ago

    const results = [
      makeProblemResult({ timestamp: recent }),
      makeProblemResult({ timestamp: recent }),
      makeProblemResult({ timestamp: old }),
    ]

    expect(calculateWeeklyProblems(results as any)).toBe(2)
  })

  it('counts all results when all are recent', () => {
    const now = new Date()
    const results = Array.from({ length: 5 }, () =>
      makeProblemResult({ timestamp: now })
    )
    expect(calculateWeeklyProblems(results as any)).toBe(5)
  })

  it('returns 0 when all results are old', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const results = Array.from({ length: 5 }, () =>
      makeProblemResult({ timestamp: old })
    )
    expect(calculateWeeklyProblems(results as any)).toBe(0)
  })
})

// =============================================================================
// Tests: calculateCategorySpeed
// =============================================================================

describe('calculateCategorySpeed', () => {
  it('returns null with fewer than 3 valid results', () => {
    const masteredSkills = new Set(['basic.directAddition'])
    const results = [
      makeProblemResult({ skillsExercised: ['basic.directAddition'] }),
      makeProblemResult({ skillsExercised: ['basic.directAddition'] }),
    ]
    expect(calculateCategorySpeed(results as any, 'basic', masteredSkills)).toBeNull()
  })

  it('returns null when no skills match the category', () => {
    const masteredSkills = new Set(['fiveComplements.4=5-1'])
    const results = Array.from({ length: 5 }, () =>
      makeProblemResult({ skillsExercised: ['basic.directAddition'] })
    )
    expect(calculateCategorySpeed(results as any, 'fiveComplements', masteredSkills)).toBeNull()
  })

  it('returns null when skill is not mastered', () => {
    const masteredSkills = new Set<string>() // no mastered skills
    const results = Array.from({ length: 5 }, () =>
      makeProblemResult({ skillsExercised: ['basic.directAddition'] })
    )
    expect(calculateCategorySpeed(results as any, 'basic', masteredSkills)).toBeNull()
  })

  it('excludes results where hadHelp is true', () => {
    const masteredSkills = new Set(['basic.directAddition'])
    const validResults = Array.from({ length: 2 }, () =>
      makeProblemResult({ skillsExercised: ['basic.directAddition'], hadHelp: false })
    )
    const helpResults = Array.from({ length: 5 }, () =>
      makeProblemResult({ skillsExercised: ['basic.directAddition'], hadHelp: true })
    )
    const all = [...validResults, ...helpResults]
    expect(calculateCategorySpeed(all as any, 'basic', masteredSkills)).toBeNull()
  })

  it('excludes results with responseTimeMs > 120000', () => {
    const masteredSkills = new Set(['basic.directAddition'])
    const validResults = Array.from({ length: 2 }, () =>
      makeProblemResult({ skillsExercised: ['basic.directAddition'] })
    )
    const slowResults = Array.from({ length: 5 }, () =>
      makeProblemResult({
        skillsExercised: ['basic.directAddition'],
        responseTimeMs: 130000,
      })
    )
    const all = [...validResults, ...slowResults]
    expect(calculateCategorySpeed(all as any, 'basic', masteredSkills)).toBeNull()
  })

  it('calculates average seconds per term for valid results', () => {
    const masteredSkills = new Set(['basic.directAddition'])
    // Each: 6000ms / 3 terms = 2 sec/term
    const results = Array.from({ length: 5 }, () =>
      makeProblemResult({
        skillsExercised: ['basic.directAddition'],
        responseTimeMs: 6000,
        problem: { terms: [1, 2, 3], answer: 6, skillsRequired: ['add.direct'] },
      })
    )

    const speed = calculateCategorySpeed(results as any, 'basic', masteredSkills)
    expect(speed).toBeCloseTo(2)
  })
})

// =============================================================================
// Tests: computeClassroomLeaderboard
// =============================================================================

describe('computeClassroomLeaderboard', () => {
  function makePlayerData(
    playerId: string,
    opts: {
      weeklyProblems?: number
      totalProblems?: number
      practiceStreak?: number
      improvementRate?: number
      categorySpeed?: Map<SkillCategory, number>
    } = {}
  ): PlayerLeaderboardData {
    return {
      playerId,
      playerName: `Player ${playerId}`,
      playerEmoji: '😀',
      metrics: {
        computedAt: new Date(),
        overallMastery: 0.5,
        categoryMastery: {
          basic: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
          fiveComplements: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
          fiveComplementsSub: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
          tenComplements: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
          tenComplementsSub: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
          advanced: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
        },
        timing: { avgSecondsPerTerm: null, trend: 'stable' as const },
        accuracy: { overallPercent: 80, recentPercent: 85, trend: 'stable' as const },
        progress: {
          improvementRate: opts.improvementRate ?? 0.05,
          practiceStreak: opts.practiceStreak ?? 3,
          totalProblems: opts.totalProblems ?? 100,
          weeklyProblems: opts.weeklyProblems ?? 20,
        },
      },
      categorySpeedByMastered: opts.categorySpeed ?? new Map(),
    }
  }

  it('returns empty leaderboard with no players', () => {
    const leaderboard = computeClassroomLeaderboard([])
    expect(leaderboard.playerCount).toBe(0)
    expect(leaderboard.byWeeklyProblems).toHaveLength(0)
    expect(leaderboard.byTotalProblems).toHaveLength(0)
    expect(leaderboard.byPracticeStreak).toHaveLength(0)
    expect(leaderboard.byImprovementRate).toHaveLength(0)
    expect(leaderboard.speedChampions).toHaveLength(0)
  })

  it('ranks players by weekly problems descending', () => {
    const players = [
      makePlayerData('p1', { weeklyProblems: 10 }),
      makePlayerData('p2', { weeklyProblems: 30 }),
      makePlayerData('p3', { weeklyProblems: 20 }),
    ]

    const leaderboard = computeClassroomLeaderboard(players)

    expect(leaderboard.byWeeklyProblems[0].playerId).toBe('p2')
    expect(leaderboard.byWeeklyProblems[0].rank).toBe(1)
    expect(leaderboard.byWeeklyProblems[1].playerId).toBe('p3')
    expect(leaderboard.byWeeklyProblems[1].rank).toBe(2)
    expect(leaderboard.byWeeklyProblems[2].playerId).toBe('p1')
    expect(leaderboard.byWeeklyProblems[2].rank).toBe(3)
  })

  it('ranks players by practice streak descending', () => {
    const players = [
      makePlayerData('p1', { practiceStreak: 5 }),
      makePlayerData('p2', { practiceStreak: 1 }),
      makePlayerData('p3', { practiceStreak: 10 }),
    ]

    const leaderboard = computeClassroomLeaderboard(players)

    expect(leaderboard.byPracticeStreak[0].playerId).toBe('p3')
    expect(leaderboard.byPracticeStreak[0].value).toBe(10)
  })

  it('ranks players by improvement rate descending', () => {
    const players = [
      makePlayerData('p1', { improvementRate: 0.1 }),
      makePlayerData('p2', { improvementRate: 0.3 }),
      makePlayerData('p3', { improvementRate: -0.05 }),
    ]

    const leaderboard = computeClassroomLeaderboard(players)

    expect(leaderboard.byImprovementRate[0].playerId).toBe('p2')
    expect(leaderboard.byImprovementRate[2].playerId).toBe('p3')
  })

  it('includes speed champions for categories where players have speeds', () => {
    const players = [
      makePlayerData('p1', {
        categorySpeed: new Map([['basic' as SkillCategory, 3.0]]),
      }),
      makePlayerData('p2', {
        categorySpeed: new Map([['basic' as SkillCategory, 2.0]]),
      }),
    ]

    const leaderboard = computeClassroomLeaderboard(players)

    expect(leaderboard.speedChampions.length).toBeGreaterThan(0)
    const basicChamp = leaderboard.speedChampions.find((c) => c.category === 'basic')
    expect(basicChamp).toBeDefined()
    // Faster (lower) is better
    expect(basicChamp!.leaders[0].playerId).toBe('p2')
    expect(basicChamp!.leaders[0].value).toBe(2.0)
  })

  it('limits rankings to top 10', () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makePlayerData(`p${i}`, { weeklyProblems: i * 10 })
    )

    const leaderboard = computeClassroomLeaderboard(players)

    expect(leaderboard.byWeeklyProblems.length).toBe(10)
  })

  it('limits speed champions to top 5', () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      makePlayerData(`p${i}`, {
        categorySpeed: new Map([['basic' as SkillCategory, i + 1]]),
      })
    )

    const leaderboard = computeClassroomLeaderboard(players)

    const basicChamp = leaderboard.speedChampions.find((c) => c.category === 'basic')
    expect(basicChamp).toBeDefined()
    expect(basicChamp!.leaders.length).toBe(5)
  })
})

// =============================================================================
// Tests: SKILL_CATEGORY_INFO
// =============================================================================

describe('SKILL_CATEGORY_INFO', () => {
  it('contains all expected categories', () => {
    const categories: SkillCategory[] = [
      'basic',
      'fiveComplements',
      'fiveComplementsSub',
      'tenComplements',
      'tenComplementsSub',
      'advanced',
    ]
    for (const cat of categories) {
      expect(SKILL_CATEGORY_INFO[cat]).toBeDefined()
      expect(SKILL_CATEGORY_INFO[cat].name).toBeTruthy()
      expect(SKILL_CATEGORY_INFO[cat].shortName).toBeTruthy()
      expect(SKILL_CATEGORY_INFO[cat].emoji).toBeTruthy()
    }
  })
})
