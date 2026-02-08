/**
 * @vitest-environment node
 *
 * Unit tests for session trend calculations.
 *
 * Tests the pure function `calculateSessionTrends` and its internal helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'

// We need to mock the config barrel because it imports DB schema internals
vi.mock('@/lib/curriculum/config', () => ({
  DEFAULT_SECONDS_PER_PROBLEM: 15,
  MIN_SECONDS_PER_PROBLEM: 5,
  REVIEW_INTERVAL_DAYS: { review: 3, mastered: 7 },
  SESSION_TIMEOUT_HOURS: 24,
  PART_TIME_WEIGHTS: { abacus: 0.4, visualization: 0.35, linear: 0.25 },
  PURPOSE_WEIGHTS: { focus: 0.4, reinforce: 0.3, review: 0.2, challenge: 0.1 },
  TERM_COUNT_RANGES: { abacus: { min: 3, max: 6 }, visualization: null, linear: null },
  PURPOSE_COMPLEXITY_BOUNDS: {},
  getTermCountRange: () => ({ min: 3, max: 5 }),
  CHALLENGE_RATIO_BY_PART_TYPE: { abacus: 0.1, visualization: 0.1, linear: 0.1 },
  BKT_INTEGRATION_CONFIG: {},
  DEFAULT_PROBLEM_GENERATION_MODE: 'adaptive-bkt',
  WEAK_SKILL_THRESHOLDS: {},
}))

import { calculateSessionTrends } from '@/lib/curriculum/trends'

// =============================================================================
// Helpers
// =============================================================================

function makeSlotResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [1, 2], answer: 3, skillsRequired: [] },
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 5000,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
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
    completedAt: null,
    ...overrides,
  } as SessionPlan
}

// =============================================================================
// Tests
// =============================================================================

describe('calculateSessionTrends', () => {
  it('returns null when current session is null', () => {
    const result = calculateSessionTrends(null, null, [])
    expect(result).toBeNull()
  })

  it('returns trends with no previous session', () => {
    const current = makeSessionPlan({
      results: [
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: false }),
      ],
    })

    const result = calculateSessionTrends(current, null, [current])

    expect(result).not.toBeNull()
    expect(result!.accuracyDelta).toBeNull()
    expect(result!.previousAccuracy).toBeNull()
    expect(result!.totalSessions).toBe(1)
    expect(result!.totalProblems).toBe(2)
    expect(result!.avgAccuracy).toBe(0.5)
  })

  it('calculates accuracy delta when previous session exists', () => {
    const previous = makeSessionPlan({
      id: 'prev',
      results: [
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: false }),
        makeSlotResult({ isCorrect: false }),
      ],
    })
    const current = makeSessionPlan({
      id: 'curr',
      results: [
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: false }),
      ],
    })

    const result = calculateSessionTrends(current, previous, [current, previous])

    expect(result).not.toBeNull()
    expect(result!.previousAccuracy).toBe(0.5)
    // current accuracy is 3/4 = 0.75, delta = 0.75 - 0.5 = 0.25
    expect(result!.accuracyDelta).toBeCloseTo(0.25)
  })

  it('calculates week stats for sessions within 7 days', () => {
    const now = Date.now()
    const recentSession = makeSessionPlan({
      id: 'recent',
      completedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) as unknown as any,
      results: [
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: true }),
      ],
    })
    const oldSession = makeSessionPlan({
      id: 'old',
      completedAt: new Date(now - 10 * 24 * 60 * 60 * 1000) as unknown as any,
      results: [
        makeSlotResult({ isCorrect: false }),
        makeSlotResult({ isCorrect: false }),
      ],
    })
    const current = makeSessionPlan({
      id: 'current',
      results: [makeSlotResult({ isCorrect: true })],
    })

    const allSessions = [current, recentSession, oldSession]
    const result = calculateSessionTrends(current, recentSession, allSessions)

    expect(result).not.toBeNull()
    // only recentSession is within 7 days (oldSession is 10 days ago)
    // current has no completedAt so it should not count as within 7 days
    expect(result!.weekSessions).toBe(1)
    expect(result!.weekProblems).toBe(2)
    expect(result!.weekAccuracy).toBe(1.0) // both correct in recentSession
    expect(result!.totalSessions).toBe(3)
    expect(result!.totalProblems).toBe(5)
  })

  it('handles empty results in sessions', () => {
    const current = makeSessionPlan({
      results: [],
    })

    const result = calculateSessionTrends(current, null, [current])

    expect(result).not.toBeNull()
    expect(result!.avgAccuracy).toBe(0)
    expect(result!.totalProblems).toBe(0)
  })

  it('handles null results field in sessions', () => {
    const current = makeSessionPlan({
      results: null as unknown as SlotResult[],
    })

    const result = calculateSessionTrends(current, null, [current])

    expect(result).not.toBeNull()
    expect(result!.totalProblems).toBe(0)
    expect(result!.avgAccuracy).toBe(0)
  })

  it('calculates all-time stats correctly', () => {
    const s1 = makeSessionPlan({
      id: 's1',
      results: [
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: false }),
      ],
    })
    const s2 = makeSessionPlan({
      id: 's2',
      results: [
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: true }),
        makeSlotResult({ isCorrect: true }),
      ],
    })
    const current = makeSessionPlan({
      id: 'current',
      results: [makeSlotResult({ isCorrect: true })],
    })

    const all = [current, s1, s2]
    const result = calculateSessionTrends(current, s2, all)

    expect(result).not.toBeNull()
    expect(result!.totalSessions).toBe(3)
    expect(result!.totalProblems).toBe(6)
    // 5 correct / 6 total
    expect(result!.avgAccuracy).toBeCloseTo(5 / 6)
  })
})

describe('streak calculation', () => {
  let realDateNow: () => number

  beforeEach(() => {
    realDateNow = Date.now
  })

  afterEach(() => {
    Date.now = realDateNow
    vi.restoreAllMocks()
  })

  it('returns streak 0 when no sessions', () => {
    const current = makeSessionPlan({ results: [makeSlotResult()] })
    const result = calculateSessionTrends(current, null, [])

    expect(result).not.toBeNull()
    expect(result!.currentStreak).toBe(0)
  })

  it('returns streak 0 when no completed sessions', () => {
    const s = makeSessionPlan({ completedAt: null })
    const current = makeSessionPlan({ results: [makeSlotResult()] })

    const result = calculateSessionTrends(current, null, [s])

    expect(result).not.toBeNull()
    expect(result!.currentStreak).toBe(0)
  })

  it('counts consecutive days as streak', () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)

    const today = now.getTime()
    const yesterday = today - 1 * 24 * 60 * 60 * 1000
    const twoDaysAgo = today - 2 * 24 * 60 * 60 * 1000

    const sessions = [
      makeSessionPlan({ id: 's1', completedAt: today as unknown as any }),
      makeSessionPlan({ id: 's2', completedAt: yesterday as unknown as any }),
      makeSessionPlan({ id: 's3', completedAt: twoDaysAgo as unknown as any }),
    ]

    const current = makeSessionPlan({
      results: [makeSlotResult()],
    })

    const result = calculateSessionTrends(current, null, sessions)
    expect(result).not.toBeNull()
    expect(result!.currentStreak).toBe(3)
  })

  it('breaks streak when a day is missed', () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)

    const today = now.getTime()
    // Skip yesterday
    const twoDaysAgo = today - 2 * 24 * 60 * 60 * 1000

    const sessions = [
      makeSessionPlan({ id: 's1', completedAt: today as unknown as any }),
      makeSessionPlan({ id: 's2', completedAt: twoDaysAgo as unknown as any }),
    ]

    const current = makeSessionPlan({
      results: [makeSlotResult()],
    })

    const result = calculateSessionTrends(current, null, sessions)
    expect(result).not.toBeNull()
    // Today has session, but yesterday has no session, so streak is just 1
    expect(result!.currentStreak).toBe(1)
  })

  it('returns streak 0 when most recent session is > 1 day ago', () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)

    const threeDaysAgo = now.getTime() - 3 * 24 * 60 * 60 * 1000

    const sessions = [
      makeSessionPlan({ id: 's1', completedAt: threeDaysAgo as unknown as any }),
    ]

    const current = makeSessionPlan({
      results: [makeSlotResult()],
    })

    const result = calculateSessionTrends(current, null, sessions)
    expect(result).not.toBeNull()
    expect(result!.currentStreak).toBe(0)
  })
})
