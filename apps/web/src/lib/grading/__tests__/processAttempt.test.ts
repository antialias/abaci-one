/**
 * @vitest-environment node
 *
 * Tests for processAttempt.ts
 *
 * The main export `processWorksheetAttempt` is an orchestration function that
 * coordinates DB reads/writes, AI grading, and mastery updates. We mock all
 * external dependencies (db, AI grading, mastery update) to test the
 * orchestration logic and the private `inferErrorType` helper indirectly.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---- Mocks ----

// Mock the AI grading module
const mockGradeWorksheetWithVision = vi.fn()
vi.mock('@/lib/ai/gradeWorksheet', () => ({
  gradeWorksheetWithVision: (...args: unknown[]) => mockGradeWorksheetWithVision(...args),
}))

// Mock the mastery update module
const mockUpdateMasteryFromGrading = vi.fn()
vi.mock('../updateMasteryProfile', () => ({
  updateMasteryFromGrading: (...args: unknown[]) => mockUpdateMasteryFromGrading(...args),
}))

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}))

// Build a mock DB chain that records calls for assertion
function createMockDb() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  let selectReturnValue: unknown[] = []

  const chain = (): any =>
    new Proxy(() => Promise.resolve(selectReturnValue), {
      get: (_target, prop) => {
        if (prop === 'then') return undefined
        return (...args: unknown[]) => {
          calls.push({ method: prop as string, args })
          if (prop === 'where') return Promise.resolve(selectReturnValue)
          return chain()
        }
      },
      apply: () => {
        return Promise.resolve(selectReturnValue)
      },
    })

  return {
    db: new Proxy(
      {},
      {
        get: (_target, prop) => {
          calls.push({ method: prop as string, args: [] })
          return chain()
        },
      }
    ),
    calls,
    setSelectReturn: (val: unknown[]) => {
      selectReturnValue = val
    },
  }
}

// We need a more targeted DB mock for the processWorksheetAttempt tests
// because it makes specific DB calls in sequence
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
})

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
})

const mockDbSelect = vi.fn()

vi.mock('@/db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}))

vi.mock('@/db/schema', () => ({
  worksheetAttempts: { id: 'worksheetAttempts.id' },
  problemAttempts: { id: 'problemAttempts.id' },
  worksheetMastery: { id: 'worksheetMastery.id' },
}))

// Import the function under test AFTER mocks are set up
import { processWorksheetAttempt } from '../processAttempt'

describe('processWorksheetAttempt', () => {
  const fakeAttemptId = 'test-attempt-123'
  const fakeUserId = 'user-456'

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: select returns a valid attempt record
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: fakeAttemptId,
            userId: fakeUserId,
            uploadedImageUrl: 'uploads/test-image.png',
          },
        ]),
      }),
    })

    // Default: update returns chainable
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })

    // Default: insert works
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })

    // Default grading result
    mockGradeWorksheetWithVision.mockResolvedValue({
      problems: [
        {
          index: 0,
          operandA: 23,
          operandB: 45,
          correctAnswer: 68,
          studentAnswer: 68,
          isCorrect: true,
          digitCount: 2,
          requiresRegrouping: false,
        },
        {
          index: 1,
          operandA: 37,
          operandB: 28,
          correctAnswer: 65,
          studentAnswer: 55,
          isCorrect: false,
          digitCount: 2,
          requiresRegrouping: true,
        },
      ],
      totalProblems: 2,
      correctCount: 1,
      accuracy: 0.5,
      errorPatterns: ['carry error in tens place'],
      currentStepEstimate: 'step-2',
      suggestedStepId: 'step-2',
      reasoning: 'Student struggles with carrying',
      feedback: 'Practice carrying in the tens place',
    })

    // Default mastery update result
    mockUpdateMasteryFromGrading.mockResolvedValue({
      mastered: false,
      stepId: 'step-2',
    })
  })

  it('calls grading pipeline and returns success with mastery info', async () => {
    const result = await processWorksheetAttempt(fakeAttemptId)

    expect(result).toEqual({
      success: true,
      attemptId: fakeAttemptId,
      mastered: false,
    })
  })

  it('updates attempt status to processing first', async () => {
    await processWorksheetAttempt(fakeAttemptId)

    // First call to update should set status to 'processing'
    expect(mockDbUpdate).toHaveBeenCalled()
    const firstUpdateCall = mockDbUpdate.mock.results[0]
    const setCall = firstUpdateCall.value.set
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ gradingStatus: 'processing' }))
  })

  it('calls AI grading with the correct image path', async () => {
    await processWorksheetAttempt(fakeAttemptId)

    expect(mockGradeWorksheetWithVision).toHaveBeenCalledTimes(1)
    const imagePath = mockGradeWorksheetWithVision.mock.calls[0][0]
    expect(imagePath).toContain('data')
    expect(imagePath).toContain('uploads/test-image.png')
  })

  it('inserts problem attempt records for each graded problem', async () => {
    await processWorksheetAttempt(fakeAttemptId)

    // Should have inserted 2 problem records
    expect(mockDbInsert).toHaveBeenCalledTimes(2)
  })

  it('calls updateMasteryFromGrading with correct userId', async () => {
    await processWorksheetAttempt(fakeAttemptId)

    expect(mockUpdateMasteryFromGrading).toHaveBeenCalledTimes(1)
    expect(mockUpdateMasteryFromGrading).toHaveBeenCalledWith(
      fakeUserId,
      expect.objectContaining({ suggestedStepId: 'step-2' })
    )
  })

  it('throws and marks attempt as failed when attempt not found', async () => {
    // Return empty array (no attempt found)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    await expect(processWorksheetAttempt(fakeAttemptId)).rejects.toThrow(
      `Attempt ${fakeAttemptId} not found`
    )

    // Should have set status to 'failed'
    // The last update call should set gradingStatus: 'failed'
    const lastUpdateCall = mockDbUpdate.mock.results[mockDbUpdate.mock.results.length - 1]
    const setCall = lastUpdateCall.value.set
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ gradingStatus: 'failed' }))
  })

  it('handles AI grading failure gracefully', async () => {
    mockGradeWorksheetWithVision.mockRejectedValue(new Error('AI service unavailable'))

    await expect(processWorksheetAttempt(fakeAttemptId)).rejects.toThrow('AI service unavailable')

    // Should mark as failed
    const lastUpdateCall = mockDbUpdate.mock.results[mockDbUpdate.mock.results.length - 1]
    const setCall = lastUpdateCall.value.set
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        gradingStatus: 'failed',
        errorMessage: 'AI service unavailable',
      })
    )
  })

  it('returns mastered=true when mastery is achieved', async () => {
    mockUpdateMasteryFromGrading.mockResolvedValue({
      mastered: true,
      stepId: 'step-2',
    })

    const result = await processWorksheetAttempt(fakeAttemptId)
    expect(result.mastered).toBe(true)
  })

  describe('inferErrorType (tested indirectly)', () => {
    // inferErrorType is a private function called when a problem is incorrect.
    // We test it indirectly by checking the errorType in the insert call.

    it('infers carry error type from error patterns', async () => {
      mockGradeWorksheetWithVision.mockResolvedValue({
        problems: [
          {
            index: 0,
            operandA: 37,
            operandB: 28,
            correctAnswer: 65,
            studentAnswer: 55,
            isCorrect: false,
            digitCount: 2,
            requiresRegrouping: true,
          },
        ],
        totalProblems: 1,
        correctCount: 0,
        accuracy: 0,
        errorPatterns: ['carry error in tens place'],
        currentStepEstimate: 'step-2',
        suggestedStepId: 'step-2',
        reasoning: 'test',
        feedback: 'test',
      })

      await processWorksheetAttempt(fakeAttemptId)

      // Check the inserted problem attempt has errorType 'carry'
      const insertValues = mockDbInsert.mock.results[0].value.values
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ errorType: 'carry' }))
    })

    it('infers borrow error type from error patterns', async () => {
      mockGradeWorksheetWithVision.mockResolvedValue({
        problems: [
          {
            index: 0,
            operandA: 42,
            operandB: 18,
            correctAnswer: 24,
            studentAnswer: 36,
            isCorrect: false,
            digitCount: 2,
            requiresRegrouping: true,
          },
        ],
        totalProblems: 1,
        correctCount: 0,
        accuracy: 0,
        errorPatterns: ['borrow error'],
        currentStepEstimate: 'step-2',
        suggestedStepId: 'step-2',
        reasoning: 'test',
        feedback: 'test',
      })

      await processWorksheetAttempt(fakeAttemptId)

      const insertValues = mockDbInsert.mock.results[0].value.values
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ errorType: 'borrow' }))
    })

    it('infers alignment error type from error patterns', async () => {
      mockGradeWorksheetWithVision.mockResolvedValue({
        problems: [
          {
            index: 0,
            operandA: 42,
            operandB: 18,
            correctAnswer: 60,
            studentAnswer: 510,
            isCorrect: false,
            digitCount: 2,
            requiresRegrouping: false,
          },
        ],
        totalProblems: 1,
        correctCount: 0,
        accuracy: 0,
        errorPatterns: ['column alignment issue'],
        currentStepEstimate: 'step-1',
        suggestedStepId: 'step-1',
        reasoning: 'test',
        feedback: 'test',
      })

      await processWorksheetAttempt(fakeAttemptId)

      const insertValues = mockDbInsert.mock.results[0].value.values
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ errorType: 'alignment' }))
    })

    it('infers ocr-uncertain error type from error patterns', async () => {
      mockGradeWorksheetWithVision.mockResolvedValue({
        problems: [
          {
            index: 0,
            operandA: 42,
            operandB: 18,
            correctAnswer: 60,
            studentAnswer: 0,
            isCorrect: false,
            digitCount: 2,
            requiresRegrouping: false,
          },
        ],
        totalProblems: 1,
        correctCount: 0,
        accuracy: 0,
        errorPatterns: ['OCR could not read answer'],
        currentStepEstimate: 'step-1',
        suggestedStepId: 'step-1',
        reasoning: 'test',
        feedback: 'test',
      })

      await processWorksheetAttempt(fakeAttemptId)

      const insertValues = mockDbInsert.mock.results[0].value.values
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'ocr-uncertain' })
      )
    })

    it('defaults to computation error for unrecognized patterns', async () => {
      mockGradeWorksheetWithVision.mockResolvedValue({
        problems: [
          {
            index: 0,
            operandA: 42,
            operandB: 18,
            correctAnswer: 60,
            studentAnswer: 50,
            isCorrect: false,
            digitCount: 2,
            requiresRegrouping: false,
          },
        ],
        totalProblems: 1,
        correctCount: 0,
        accuracy: 0,
        errorPatterns: ['unknown error type'],
        currentStepEstimate: 'step-1',
        suggestedStepId: 'step-1',
        reasoning: 'test',
        feedback: 'test',
      })

      await processWorksheetAttempt(fakeAttemptId)

      const insertValues = mockDbInsert.mock.results[0].value.values
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'computation' })
      )
    })

    it('sets errorType to null for correct problems', async () => {
      mockGradeWorksheetWithVision.mockResolvedValue({
        problems: [
          {
            index: 0,
            operandA: 42,
            operandB: 18,
            correctAnswer: 60,
            studentAnswer: 60,
            isCorrect: true,
            digitCount: 2,
            requiresRegrouping: false,
          },
        ],
        totalProblems: 1,
        correctCount: 1,
        accuracy: 1,
        errorPatterns: [],
        currentStepEstimate: 'step-1',
        suggestedStepId: 'step-1',
        reasoning: 'test',
        feedback: 'test',
      })

      await processWorksheetAttempt(fakeAttemptId)

      const insertValues = mockDbInsert.mock.results[0].value.values
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ errorType: null }))
    })
  })
})
