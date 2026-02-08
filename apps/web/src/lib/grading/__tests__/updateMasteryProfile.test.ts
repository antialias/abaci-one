/**
 * @vitest-environment node
 *
 * Tests for updateMasteryProfile.ts
 *
 * Tests both exported functions:
 * - updateMasteryFromGrading: Updates mastery record based on grading results
 * - getMasteryProgress: Returns progression status for all steps
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---- Mocks ----

// Mock the progression path
const mockProgressionPath = [
  {
    id: 'basic-addition-1d',
    stepNumber: 0,
    name: 'Basic Single-Digit Addition',
    masteryThreshold: 0.85,
    minimumAttempts: 10,
  },
  {
    id: 'single-carry-2d',
    stepNumber: 1,
    name: 'Two-Digit Carry',
    masteryThreshold: 0.8,
    minimumAttempts: 15,
  },
  {
    id: 'multi-carry-3d',
    stepNumber: 2,
    name: 'Three-Digit Multi-Carry',
    masteryThreshold: 0.85,
    minimumAttempts: 20,
  },
]

vi.mock('@/app/create/worksheets/progressionPath', () => ({
  SINGLE_CARRY_PATH: [
    {
      id: 'basic-addition-1d',
      stepNumber: 0,
      name: 'Basic Single-Digit Addition',
      masteryThreshold: 0.85,
      minimumAttempts: 10,
    },
    {
      id: 'single-carry-2d',
      stepNumber: 1,
      name: 'Two-Digit Carry',
      masteryThreshold: 0.8,
      minimumAttempts: 15,
    },
    {
      id: 'multi-carry-3d',
      stepNumber: 2,
      name: 'Three-Digit Multi-Carry',
      masteryThreshold: 0.85,
      minimumAttempts: 20,
    },
  ],
}))

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conditions: unknown[]) => ({ conditions }),
}))

// Track DB operations
const mockDbSelectResult: unknown[] = []
const mockDbInsertValues = vi.fn()
const mockDbUpdateSet = vi.fn()

// Build a mock that is both a thenable (Promise-like) returning mockDbSelectResult
// AND has a .limit() method for the updateMasteryFromGrading code path.
function createWhereResult() {
  const result = Promise.resolve(mockDbSelectResult)
  ;(result as any).limit = () => Promise.resolve(mockDbSelectResult)
  return result
}

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => createWhereResult(),
      }),
    }),
    insert: () => ({
      values: (...args: unknown[]) => {
        mockDbInsertValues(...args)
        return Promise.resolve()
      },
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockDbUpdateSet(...args)
        return {
          where: () => Promise.resolve(),
        }
      },
    }),
  },
}))

vi.mock('@/db/schema', () => ({
  worksheetMastery: {
    id: Symbol('worksheetMastery.id'),
    userId: Symbol('worksheetMastery.userId'),
    skillId: Symbol('worksheetMastery.skillId'),
  },
}))

// Import after mocks
import { updateMasteryFromGrading, getMasteryProgress } from '../updateMasteryProfile'
import type { GradingResult } from '@/lib/ai/gradeWorksheet'

describe('updateMasteryFromGrading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbSelectResult.length = 0
    mockDbInsertValues.mockClear()
    mockDbUpdateSet.mockClear()
  })

  function createGradingResult(overrides: Partial<GradingResult> = {}): GradingResult {
    return {
      problems: [],
      totalProblems: 10,
      correctCount: 9,
      accuracy: 0.9,
      errorPatterns: [],
      currentStepEstimate: 'basic-addition-1d',
      suggestedStepId: 'basic-addition-1d',
      reasoning: 'test reasoning',
      feedback: 'test feedback',
      ...overrides,
    }
  }

  it('returns not mastered for unknown step ID', async () => {
    const result = await updateMasteryFromGrading(
      'user-1',
      createGradingResult({ suggestedStepId: 'nonexistent-step' })
    )

    expect(result).toEqual({ mastered: false, stepId: 'nonexistent-step' })
  })

  it('creates new mastery record when none exists', async () => {
    // No existing record
    mockDbSelectResult.length = 0

    const gradingResult = createGradingResult({
      suggestedStepId: 'basic-addition-1d',
      totalProblems: 20,
      correctCount: 18,
      accuracy: 0.9,
    })

    const result = await updateMasteryFromGrading('user-1', gradingResult)

    // 18/20 = 0.9 >= 0.85 threshold AND 20 >= 10 minimum -> mastered
    expect(result.mastered).toBe(true)
    expect(result.stepId).toBe('basic-addition-1d')
    expect(mockDbInsertValues).toHaveBeenCalledTimes(1)
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        skillId: 'basic-addition-1d',
        totalAttempts: 20,
        correctAttempts: 18,
        lastAccuracy: 0.9,
        isMastered: true,
      })
    )
  })

  it('creates new record but not mastered when accuracy below threshold', async () => {
    mockDbSelectResult.length = 0

    const gradingResult = createGradingResult({
      suggestedStepId: 'basic-addition-1d',
      totalProblems: 20,
      correctCount: 14,
      accuracy: 0.7,
    })

    const result = await updateMasteryFromGrading('user-1', gradingResult)

    // 14/20 = 0.7 < 0.85 threshold -> not mastered
    expect(result.mastered).toBe(false)
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        isMastered: false,
        masteredAt: null,
      })
    )
  })

  it('creates new record but not mastered when below minimum attempts', async () => {
    mockDbSelectResult.length = 0

    const gradingResult = createGradingResult({
      suggestedStepId: 'basic-addition-1d',
      totalProblems: 5, // Below minimum of 10
      correctCount: 5,
      accuracy: 1.0,
    })

    const result = await updateMasteryFromGrading('user-1', gradingResult)

    // 5/5 = 1.0 >= 0.85 threshold BUT 5 < 10 minimum -> not mastered
    expect(result.mastered).toBe(false)
  })

  it('updates existing record and checks mastery with cumulative stats', async () => {
    // Existing record with some history
    mockDbSelectResult.push({
      id: 'existing-mastery-id',
      userId: 'user-1',
      skillId: 'basic-addition-1d',
      totalAttempts: 8,
      correctAttempts: 7,
      isMastered: false,
      masteredAt: null,
    })

    const gradingResult = createGradingResult({
      suggestedStepId: 'basic-addition-1d',
      totalProblems: 5,
      correctCount: 4,
      accuracy: 0.8,
    })

    const result = await updateMasteryFromGrading('user-1', gradingResult)

    // Cumulative: (7+4)/(8+5) = 11/13 = 0.846 >= 0.85? No, 0.846 < 0.85 -> not mastered
    // Wait: 11/13 = 0.8461... < 0.85 threshold -> not mastered
    // Also: 13 >= 10 minimum -> meets minimum
    expect(result.mastered).toBe(false)
    expect(result.stepId).toBe('basic-addition-1d')
    expect(mockDbUpdateSet).toHaveBeenCalledTimes(1)
  })

  it('updates existing record to mastered when cumulative stats meet threshold', async () => {
    mockDbSelectResult.push({
      id: 'existing-mastery-id',
      userId: 'user-1',
      skillId: 'basic-addition-1d',
      totalAttempts: 8,
      correctAttempts: 7,
      isMastered: false,
      masteredAt: null,
    })

    const gradingResult = createGradingResult({
      suggestedStepId: 'basic-addition-1d',
      totalProblems: 5,
      correctCount: 5,
      accuracy: 1.0,
    })

    const result = await updateMasteryFromGrading('user-1', gradingResult)

    // Cumulative: (7+5)/(8+5) = 12/13 = 0.923 >= 0.85 AND 13 >= 10 -> mastered!
    expect(result.mastered).toBe(true)
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isMastered: true,
        totalAttempts: 13,
        correctAttempts: 12,
      })
    )
  })

  it('preserves masteredAt timestamp when already mastered', async () => {
    const existingMasteredAt = new Date('2024-01-01')
    mockDbSelectResult.push({
      id: 'existing-mastery-id',
      userId: 'user-1',
      skillId: 'basic-addition-1d',
      totalAttempts: 20,
      correctAttempts: 18,
      isMastered: true,
      masteredAt: existingMasteredAt,
    })

    const gradingResult = createGradingResult({
      suggestedStepId: 'basic-addition-1d',
      totalProblems: 5,
      correctCount: 5,
      accuracy: 1.0,
    })

    await updateMasteryFromGrading('user-1', gradingResult)

    // masteredAt should remain the original date since already mastered
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        masteredAt: existingMasteredAt,
      })
    )
  })

  it('works with different step thresholds', async () => {
    // single-carry-2d has threshold 0.8 and minimum 15
    mockDbSelectResult.length = 0

    const gradingResult = createGradingResult({
      suggestedStepId: 'single-carry-2d',
      totalProblems: 20,
      correctCount: 16,
      accuracy: 0.8,
    })

    const result = await updateMasteryFromGrading('user-1', gradingResult)

    // 16/20 = 0.8 >= 0.8 threshold AND 20 >= 15 minimum -> mastered!
    expect(result.mastered).toBe(true)
  })
})

describe('getMasteryProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbSelectResult.length = 0
  })

  it('returns all progression steps with default values when no records exist', async () => {
    // No mastery records
    mockDbSelectResult.length = 0

    const progress = await getMasteryProgress('user-1')

    expect(progress).toHaveLength(3) // 3 steps in mock path
    expect(progress[0]).toEqual({
      stepId: 'basic-addition-1d',
      stepNumber: 0,
      name: 'Basic Single-Digit Addition',
      isMastered: false,
      totalAttempts: 0,
      correctAttempts: 0,
      lastAccuracy: null,
      masteredAt: null,
      lastPracticedAt: null,
    })
  })

  it('merges mastery records with progression steps', async () => {
    const masteredAt = new Date('2024-01-15')
    const lastPracticed = new Date('2024-01-20')

    mockDbSelectResult.push({
      skillId: 'basic-addition-1d',
      isMastered: true,
      totalAttempts: 25,
      correctAttempts: 22,
      lastAccuracy: 0.92,
      masteredAt,
      lastPracticedAt: lastPracticed,
    })

    const progress = await getMasteryProgress('user-1')

    expect(progress[0]).toEqual({
      stepId: 'basic-addition-1d',
      stepNumber: 0,
      name: 'Basic Single-Digit Addition',
      isMastered: true,
      totalAttempts: 25,
      correctAttempts: 22,
      lastAccuracy: 0.92,
      masteredAt,
      lastPracticedAt: lastPracticed,
    })

    // Other steps should still have defaults
    expect(progress[1].isMastered).toBe(false)
    expect(progress[1].totalAttempts).toBe(0)
  })
})
