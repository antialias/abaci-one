/**
 * @vitest-environment node
 *
 * Unit tests for problem-generator.ts
 *
 * Tests the generateProblemFromConstraints function and the
 * ProblemGenerationError class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the config barrel to avoid transitive DB/import issues
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
  CHALLENGE_RATIO_BY_PART_TYPE: {},
  BKT_INTEGRATION_CONFIG: {},
  DEFAULT_PROBLEM_GENERATION_MODE: 'adaptive-bkt',
  WEAK_SKILL_THRESHOLDS: {},
}))

// Mock the problem generator utility
const mockGenerateSingleProblemWithDiagnostics = vi.fn()
vi.mock('@/utils/problemGenerator', () => ({
  generateSingleProblemWithDiagnostics: (...args: unknown[]) =>
    mockGenerateSingleProblemWithDiagnostics(...args),
}))

// Mock createBasicSkillSet
vi.mock('@/types/tutorial', () => ({
  createBasicSkillSet: () => ({
    basic: { directAddition: true },
    fiveComplements: {},
    tenComplements: {},
    fiveComplementsSub: {},
    tenComplementsSub: {},
    advanced: {},
  }),
}))

import {
  generateProblemFromConstraints,
  ProblemGenerationError,
} from '@/lib/curriculum/problem-generator'
import type { ProblemConstraints } from '@/db/schema/session-plans'

// =============================================================================
// Tests: ProblemGenerationError
// =============================================================================

describe('ProblemGenerationError', () => {
  it('has correct name', () => {
    const constraints: ProblemConstraints = {
      digitRange: { min: 1, max: 1 },
      termCount: { min: 3, max: 5 },
    }
    const error = new ProblemGenerationError('test message', constraints)
    expect(error.name).toBe('ProblemGenerationError')
    expect(error.message).toBe('test message')
    expect(error.constraints).toBe(constraints)
    expect(error.diagnostics).toBeUndefined()
  })

  it('stores diagnostics when provided', () => {
    const constraints: ProblemConstraints = {}
    const diagnostics = {
      totalAttempts: 100,
      sequenceFailures: 50,
      sumConstraintFailures: 30,
      skillMatchFailures: 20,
      enabledAllowedSkills: ['add.direct'],
      enabledTargetSkills: ['add.five'],
      lastGeneratedSkills: ['add.direct'],
    }
    const error = new ProblemGenerationError('fail', constraints, diagnostics)
    expect(error.diagnostics).toBe(diagnostics)
  })

  it('is instanceof Error', () => {
    const error = new ProblemGenerationError('fail', {})
    expect(error instanceof Error).toBe(true)
    expect(error instanceof ProblemGenerationError).toBe(true)
  })
})

// =============================================================================
// Tests: generateProblemFromConstraints
// =============================================================================

describe('generateProblemFromConstraints', () => {
  beforeEach(() => {
    mockGenerateSingleProblemWithDiagnostics.mockReset()
  })

  it('returns generated problem on success', () => {
    const generatedProblem = {
      terms: [3, 4, -2],
      answer: 5,
      skillsUsed: ['add.direct', 'sub.direct'],
      generationTrace: {
        terms: [3, 4, -2],
        answer: 5,
        steps: [],
        allSkills: ['add.direct', 'sub.direct'],
      },
    }

    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: generatedProblem,
      diagnostics: {
        totalAttempts: 1,
        sequenceFailures: 0,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    const constraints: ProblemConstraints = {
      digitRange: { min: 1, max: 1 },
      termCount: { min: 3, max: 5 },
    }

    const result = generateProblemFromConstraints(constraints)

    expect(result).toEqual({
      terms: [3, 4, -2],
      answer: 5,
      skillsRequired: ['add.direct', 'sub.direct'],
      generationTrace: generatedProblem.generationTrace,
    })
  })

  it('throws ProblemGenerationError when generator returns null', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: null,
      diagnostics: {
        totalAttempts: 100,
        sequenceFailures: 100,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    const constraints: ProblemConstraints = {
      digitRange: { min: 1, max: 1 },
      termCount: { min: 3, max: 5 },
    }

    expect(() => generateProblemFromConstraints(constraints)).toThrow(ProblemGenerationError)
  })

  it('includes diagnostics info in error message for sequence failures', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: null,
      diagnostics: {
        totalAttempts: 100,
        sequenceFailures: 100,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    try {
      generateProblemFromConstraints({
        digitRange: { min: 1, max: 1 },
        termCount: { min: 3, max: 5 },
      })
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as ProblemGenerationError
      expect(err.message).toContain('All attempts failed during sequence generation')
      expect(err.message).toContain('No allowed skills are enabled')
    }
  })

  it('includes diagnostics info for skill match failures', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: null,
      diagnostics: {
        totalAttempts: 100,
        sequenceFailures: 30,
        sumConstraintFailures: 0,
        skillMatchFailures: 70,
        enabledAllowedSkills: ['add.direct'],
        enabledTargetSkills: ['add.five'],
        lastGeneratedSkills: ['add.direct'],
      },
    })

    try {
      generateProblemFromConstraints({
        digitRange: { min: 1, max: 1 },
        termCount: { min: 3, max: 5 },
      })
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as ProblemGenerationError
      expect(err.message).toContain("didn't match skill requirements")
    }
  })

  it('includes diagnostics info for sum constraint failures', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: null,
      diagnostics: {
        totalAttempts: 100,
        sequenceFailures: 30,
        sumConstraintFailures: 70,
        skillMatchFailures: 0,
        enabledAllowedSkills: ['add.direct'],
        enabledTargetSkills: [],
      },
    })

    try {
      generateProblemFromConstraints({
        digitRange: { min: 1, max: 1 },
        termCount: { min: 3, max: 5 },
      })
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as ProblemGenerationError
      expect(err.message).toContain('failed sum constraints')
    }
  })

  it('passes correct constraints to generator', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: { terms: [1, 2], answer: 3, skillsUsed: [], generationTrace: null },
      diagnostics: {
        totalAttempts: 1,
        sequenceFailures: 0,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    const constraints: ProblemConstraints = {
      digitRange: { min: 1, max: 2 },
      termCount: { min: 4, max: 6 },
      minComplexityBudgetPerTerm: 1,
      maxComplexityBudgetPerTerm: 3,
    }

    generateProblemFromConstraints(constraints)

    expect(mockGenerateSingleProblemWithDiagnostics).toHaveBeenCalledOnce()
    const callArgs = mockGenerateSingleProblemWithDiagnostics.mock.calls[0][0]
    expect(callArgs.constraints.numberRange).toEqual({ min: 1, max: 99 }) // 10^2 - 1 = 99
    expect(callArgs.constraints.minTerms).toBe(4)
    expect(callArgs.constraints.maxTerms).toBe(6)
    expect(callArgs.constraints.minComplexityBudgetPerTerm).toBe(1)
    expect(callArgs.constraints.maxComplexityBudgetPerTerm).toBe(3)
    expect(callArgs.constraints.problemCount).toBe(1)
  })

  it('uses defaults when digitRange and termCount are missing', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: { terms: [1, 2], answer: 3, skillsUsed: [], generationTrace: null },
      diagnostics: {
        totalAttempts: 1,
        sequenceFailures: 0,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    generateProblemFromConstraints({})

    const callArgs = mockGenerateSingleProblemWithDiagnostics.mock.calls[0][0]
    expect(callArgs.constraints.numberRange).toEqual({ min: 1, max: 9 }) // 10^1 - 1 = 9
    expect(callArgs.constraints.minTerms).toBe(3)
    expect(callArgs.constraints.maxTerms).toBe(5)
  })

  it('passes targetSkills and forbiddenSkills to generator', () => {
    const targetSkills = { fiveComplements: { '4=5-1': true } }
    const forbiddenSkills = { tenComplements: { '9=10-1': true } }

    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: { terms: [1, 2], answer: 3, skillsUsed: [], generationTrace: null },
      diagnostics: {
        totalAttempts: 1,
        sequenceFailures: 0,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    generateProblemFromConstraints({
      targetSkills: targetSkills as any,
      forbiddenSkills: forbiddenSkills as any,
    })

    const callArgs = mockGenerateSingleProblemWithDiagnostics.mock.calls[0][0]
    expect(callArgs.targetSkills).toBe(targetSkills)
    expect(callArgs.forbiddenSkills).toBe(forbiddenSkills)
  })

  it('passes costCalculator to generator', () => {
    const costCalculator = { getSkillCost: () => 1 } as any

    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: { terms: [1, 2], answer: 3, skillsUsed: [], generationTrace: null },
      diagnostics: {
        totalAttempts: 1,
        sequenceFailures: 0,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    generateProblemFromConstraints({}, costCalculator)

    const callArgs = mockGenerateSingleProblemWithDiagnostics.mock.calls[0][0]
    expect(callArgs.costCalculator).toBe(costCalculator)
  })

  it('merges allowedSkills with base skill set', () => {
    mockGenerateSingleProblemWithDiagnostics.mockReturnValue({
      problem: { terms: [1, 2], answer: 3, skillsUsed: [], generationTrace: null },
      diagnostics: {
        totalAttempts: 1,
        sequenceFailures: 0,
        sumConstraintFailures: 0,
        skillMatchFailures: 0,
        enabledAllowedSkills: [],
        enabledTargetSkills: [],
      },
    })

    generateProblemFromConstraints({
      allowedSkills: { basic: { directAddition: false } } as any,
    })

    const callArgs = mockGenerateSingleProblemWithDiagnostics.mock.calls[0][0]
    // The allowed skills should be the base set merged with constraint overrides
    expect(callArgs.allowedSkills.basic.directAddition).toBe(false) // overridden
  })
})
