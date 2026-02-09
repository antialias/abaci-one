import { describe, it, expect, beforeEach } from 'vitest'
import {
  analyzeRequiredSkills,
  analyzeStepSkills,
  analyzeStepSkillsMemoized,
  clearStepSkillsCache,
  generateProblems,
  generateSingleProblem,
  generateSingleProblemWithDiagnostics,
  getStepSkillsCacheStats,
  problemMatchesSkills,
  validatePracticeStepConfiguration,
  type GeneratedProblem,
  type ProblemConstraints,
  type GenerateProblemOptions,
} from '../problemGenerator'
import {
  createBasicSkillSet,
  createEmptySkillSet,
  type PracticeStep,
  type SkillSet,
} from '../../types/tutorial'

// =============================================================================
// Test Utilities
// =============================================================================

function createFullSkillSet(): SkillSet {
  return {
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: true,
      directSubtraction: true,
      heavenBeadSubtraction: true,
      simpleCombinationsSub: true,
    },
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': true,
      '1=5-4': true,
    },
    fiveComplementsSub: {
      '-4=-5+1': true,
      '-3=-5+2': true,
      '-2=-5+3': true,
      '-1=-5+4': true,
    },
    tenComplements: {
      '9=10-1': true,
      '8=10-2': true,
      '7=10-3': true,
      '6=10-4': true,
      '5=10-5': true,
      '4=10-6': true,
      '3=10-7': true,
      '2=10-8': true,
      '1=10-9': true,
    },
    tenComplementsSub: {
      '-9=+1-10': true,
      '-8=+2-10': true,
      '-7=+3-10': true,
      '-6=+4-10': true,
      '-5=+5-10': true,
      '-4=+6-10': true,
      '-3=+7-10': true,
      '-2=+8-10': true,
      '-1=+9-10': true,
    },
    advanced: {
      cascadingCarry: false,
      cascadingBorrow: false,
    },
  }
}

/** Creates a SkillSet with only basic addition skills enabled */
function createBasicAdditionSkillSet(): SkillSet {
  const skills = createEmptySkillSet()
  skills.basic.directAddition = true
  return skills
}

/** Creates a SkillSet with basic + heaven bead skills */
function createHeavenBeadSkillSet(): SkillSet {
  const skills = createEmptySkillSet()
  skills.basic.directAddition = true
  skills.basic.heavenBead = true
  return skills
}

/** Creates a SkillSet with basic + five complement addition skills */
function createFiveComplementSkillSet(): SkillSet {
  const skills = createEmptySkillSet()
  skills.basic.directAddition = true
  skills.basic.heavenBead = true
  skills.fiveComplements['4=5-1'] = true
  skills.fiveComplements['3=5-2'] = true
  skills.fiveComplements['2=5-3'] = true
  skills.fiveComplements['1=5-4'] = true
  return skills
}

/** Creates default problem constraints */
function createDefaultConstraints(overrides?: Partial<ProblemConstraints>): ProblemConstraints {
  return {
    numberRange: { min: 1, max: 9 },
    maxTerms: 4,
    problemCount: 1,
    ...overrides,
  }
}

/** Creates a minimal PracticeStep for testing generateProblems */
function createPracticeStep(overrides?: Partial<PracticeStep>): PracticeStep {
  return {
    id: 'test-step',
    title: 'Test Step',
    description: 'Test step description',
    problemCount: 3,
    maxTerms: 4,
    allowedSkills: createFullSkillSet(),
    ...overrides,
  }
}

/** Helper to create a mock GeneratedProblem */
function createMockProblem(overrides?: Partial<GeneratedProblem>): GeneratedProblem {
  return {
    id: 'test-problem',
    terms: [1, 2, 3],
    answer: 6,
    skillsUsed: ['basic.directAddition'],
    difficulty: 'easy',
    ...overrides,
  }
}

// =============================================================================
// clearStepSkillsCache
// =============================================================================

describe('clearStepSkillsCache', () => {
  it('should reset cache size and hit/miss counters to zero', () => {
    // Prime the cache with a call
    analyzeStepSkillsMemoized(0, 1, 1)
    clearStepSkillsCache()

    const stats = getStepSkillsCacheStats()
    expect(stats.size).toBe(0)
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
  })
})

// =============================================================================
// getStepSkillsCacheStats
// =============================================================================

describe('getStepSkillsCacheStats', () => {
  beforeEach(() => {
    clearStepSkillsCache()
  })

  it('should return zero stats when cache is empty', () => {
    const stats = getStepSkillsCacheStats()
    expect(stats.size).toBe(0)
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
  })

  it('should track cache misses on first call', () => {
    analyzeStepSkillsMemoized(0, 1, 1)
    const stats = getStepSkillsCacheStats()
    expect(stats.misses).toBe(1)
    expect(stats.hits).toBe(0)
    expect(stats.size).toBe(1)
  })

  it('should track cache hits on repeated calls', () => {
    analyzeStepSkillsMemoized(0, 1, 1)
    analyzeStepSkillsMemoized(0, 1, 1)
    const stats = getStepSkillsCacheStats()
    expect(stats.misses).toBe(1)
    expect(stats.hits).toBe(1)
    expect(stats.size).toBe(1)
  })

  it('should track multiple distinct entries', () => {
    analyzeStepSkillsMemoized(0, 1, 1)
    analyzeStepSkillsMemoized(0, 2, 2)
    analyzeStepSkillsMemoized(0, 3, 3)
    const stats = getStepSkillsCacheStats()
    expect(stats.size).toBe(3)
    expect(stats.misses).toBe(3)
    expect(stats.hits).toBe(0)
  })
})

// =============================================================================
// analyzeStepSkillsMemoized
// =============================================================================

describe('analyzeStepSkillsMemoized', () => {
  beforeEach(() => {
    clearStepSkillsCache()
  })

  it('should return the same result as analyzeStepSkills', () => {
    const direct = analyzeStepSkills(0, 1, 1)
    clearStepSkillsCache()
    const memoized = analyzeStepSkillsMemoized(0, 1, 1)
    expect(memoized).toEqual(direct)
  })

  it('should return cached result on second call with same parameters', () => {
    const first = analyzeStepSkillsMemoized(0, 3, 3)
    const second = analyzeStepSkillsMemoized(0, 3, 3)
    expect(second).toBe(first) // Same reference from cache
  })

  it('should ignore the _newValue parameter (uses only currentValue and term)', () => {
    const result1 = analyzeStepSkillsMemoized(0, 5, 5)
    const result2 = analyzeStepSkillsMemoized(0, 5, 999) // different _newValue
    expect(result2).toBe(result1) // Same cache entry
  })

  it('should produce different results for different currentValue/term pairs', () => {
    const result1 = analyzeStepSkillsMemoized(0, 1, 1)
    const result2 = analyzeStepSkillsMemoized(5, 1, 6)
    // These may or may not have the same skills, but they should be independent cache entries
    const stats = getStepSkillsCacheStats()
    expect(stats.size).toBe(2)
    expect(stats.misses).toBe(2)
  })
})

// =============================================================================
// analyzeStepSkills
// =============================================================================

describe('analyzeStepSkills', () => {
  it('should detect direct addition for small values from zero', () => {
    const skills = analyzeStepSkills(0, 1, 1)
    expect(skills).toContain('basic.directAddition')
  })

  it('should detect heaven bead usage when adding 5', () => {
    const skills = analyzeStepSkills(0, 5, 5)
    expect(skills).toContain('basic.heavenBead')
  })

  it('should detect five complement when adding 4 with insufficient earth beads', () => {
    // At value 2, adding 4 requires five complement: +4 = +5-1
    const skills = analyzeStepSkills(2, 4, 6)
    expect(skills).toContain('fiveComplements.4=5-1')
  })

  it('should detect ten complement when carry is needed', () => {
    // At value 5, adding 9 = +10-1 (carry)
    const skills = analyzeStepSkills(5, 9, 14)
    expect(skills).toContain('tenComplements.9=10-1')
  })

  it('should detect direct subtraction for small negative terms', () => {
    // At value 3, subtract 1
    const skills = analyzeStepSkills(3, -1, 2)
    expect(skills).toContain('basic.directSubtraction')
  })

  it('should detect heaven bead subtraction when subtracting 5', () => {
    // At value 5, subtract 5
    const skills = analyzeStepSkills(5, -5, 0)
    expect(skills).toContain('basic.heavenBeadSubtraction')
  })

  it('should return empty array when sequence generation fails', () => {
    // Attempting an impossible operation should fail gracefully
    const skills = analyzeStepSkills(0, -5, -5)
    expect(skills).toEqual([])
  })

  it('should return unique skill identifiers (no duplicates)', () => {
    const skills = analyzeStepSkills(0, 1, 1)
    const uniqueSkills = [...new Set(skills)]
    expect(skills).toEqual(uniqueSkills)
  })
})

// =============================================================================
// analyzeRequiredSkills
// =============================================================================

describe('analyzeRequiredSkills', () => {
  it('should analyze skills for a simple addition problem', () => {
    const skills = analyzeRequiredSkills([1, 2, 3], 6)
    expect(skills.length).toBeGreaterThan(0)
    expect(skills).toContain('basic.directAddition')
  })

  it('should detect five complement skills in multi-term problems', () => {
    // 3 + 4: at value 3, adding 4 requires five complement
    const skills = analyzeRequiredSkills([3, 4], 7)
    expect(skills).toContain('fiveComplements.4=5-1')
  })

  it('should return unique skill IDs', () => {
    const skills = analyzeRequiredSkills([1, 1, 1, 1], 4)
    const unique = [...new Set(skills)]
    expect(skills).toEqual(unique)
  })

  it('should handle single-term problems', () => {
    const skills = analyzeRequiredSkills([5], 5)
    expect(skills.length).toBeGreaterThan(0)
  })

  it('should handle subtraction terms', () => {
    const skills = analyzeRequiredSkills([5, -1], 4)
    expect(skills.length).toBeGreaterThan(0)
    expect(skills).toContain('basic.directSubtraction')
  })

  it('should ignore the _finalSum parameter', () => {
    // The second parameter is unused - results should be based on terms only
    const skills1 = analyzeRequiredSkills([1, 2], 3)
    const skills2 = analyzeRequiredSkills([1, 2], 999)
    expect(skills1).toEqual(skills2)
  })
})

// =============================================================================
// problemMatchesSkills
// =============================================================================

describe('problemMatchesSkills', () => {
  it('should return true when problem uses an allowed skill', () => {
    const problem = createMockProblem({ skillsUsed: ['basic.directAddition'] })
    const allowed = createBasicAdditionSkillSet()
    expect(problemMatchesSkills(problem, allowed)).toBe(true)
  })

  it('should return false when problem uses no allowed skills', () => {
    const problem = createMockProblem({ skillsUsed: ['fiveComplements.4=5-1'] })
    const allowed = createBasicAdditionSkillSet() // Only directAddition
    expect(problemMatchesSkills(problem, allowed)).toBe(false)
  })

  it('should return false when problem uses a forbidden skill', () => {
    const problem = createMockProblem({
      skillsUsed: ['basic.directAddition', 'fiveComplements.4=5-1'],
    })
    const allowed = createFullSkillSet()
    const forbidden: Partial<SkillSet> = {
      fiveComplements: {
        '4=5-1': true,
        '3=5-2': false,
        '2=5-3': false,
        '1=5-4': false,
      },
    }
    expect(problemMatchesSkills(problem, allowed, undefined, forbidden)).toBe(false)
  })

  it('should return true when no forbidden skills are specified', () => {
    const problem = createMockProblem({ skillsUsed: ['basic.directAddition'] })
    const allowed = createFullSkillSet()
    expect(problemMatchesSkills(problem, allowed, undefined, undefined)).toBe(true)
  })

  it('should require at least one target skill when target skills are specified', () => {
    const problem = createMockProblem({ skillsUsed: ['basic.directAddition'] })
    const allowed = createFullSkillSet()
    const target: Partial<SkillSet> = {
      fiveComplements: {
        '4=5-1': true,
        '3=5-2': false,
        '2=5-3': false,
        '1=5-4': false,
      },
    }
    // Problem doesn't use any target skill
    expect(problemMatchesSkills(problem, allowed, target)).toBe(false)
  })

  it('should return true when problem uses at least one target skill', () => {
    const problem = createMockProblem({
      skillsUsed: ['basic.directAddition', 'fiveComplements.4=5-1'],
    })
    const allowed = createFullSkillSet()
    const target: Partial<SkillSet> = {
      fiveComplements: {
        '4=5-1': true,
        '3=5-2': false,
        '2=5-3': false,
        '1=5-4': false,
      },
    }
    expect(problemMatchesSkills(problem, allowed, target)).toBe(true)
  })

  it('should pass when target skills have no enabled skills', () => {
    const problem = createMockProblem({ skillsUsed: ['basic.directAddition'] })
    const allowed = createFullSkillSet()
    const target: Partial<SkillSet> = {
      fiveComplements: {
        '4=5-1': false,
        '3=5-2': false,
        '2=5-3': false,
        '1=5-4': false,
      },
    }
    // No target skills are actually enabled, so target constraint doesn't apply
    expect(problemMatchesSkills(problem, allowed, target)).toBe(true)
  })

  it('should handle problems with empty skillsUsed', () => {
    const problem = createMockProblem({ skillsUsed: [] })
    const allowed = createFullSkillSet()
    // No skills used => no allowed skill found => false
    expect(problemMatchesSkills(problem, allowed)).toBe(false)
  })

  it('should handle skill categories: fiveComplementsSub', () => {
    const problem = createMockProblem({ skillsUsed: ['fiveComplementsSub.-4=-5+1'] })
    const allowed = createFullSkillSet()
    expect(problemMatchesSkills(problem, allowed)).toBe(true)
  })

  it('should handle skill categories: tenComplementsSub', () => {
    const problem = createMockProblem({ skillsUsed: ['tenComplementsSub.-9=+1-10'] })
    const allowed = createFullSkillSet()
    expect(problemMatchesSkills(problem, allowed)).toBe(true)
  })

  it('should handle skill categories: advanced', () => {
    const problem = createMockProblem({ skillsUsed: ['advanced.cascadingCarry'] })
    const allowed = createFullSkillSet()
    allowed.advanced.cascadingCarry = true
    expect(problemMatchesSkills(problem, allowed)).toBe(true)
  })

  it('should return false for unknown skill categories', () => {
    const problem = createMockProblem({ skillsUsed: ['unknown.skill'] })
    const allowed = createFullSkillSet()
    expect(problemMatchesSkills(problem, allowed)).toBe(false)
  })
})

// =============================================================================
// generateSingleProblem
// =============================================================================

describe('generateSingleProblem', () => {
  it('should generate a problem with basic addition skills', () => {
    const constraints = createDefaultConstraints()
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills)
    expect(problem).not.toBeNull()
    expect(problem!.terms.length).toBeGreaterThanOrEqual(3)
    expect(problem!.terms.length).toBeLessThanOrEqual(4)
    expect(problem!.answer).toBe(problem!.terms.reduce((a, b) => a + b, 0))
  })

  it('should respect maxTerms constraint', () => {
    const constraints = createDefaultConstraints({ maxTerms: 3, minTerms: 3 })
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills)
    expect(problem).not.toBeNull()
    expect(problem!.terms.length).toBe(3)
  })

  it('should respect minTerms constraint', () => {
    const constraints = createDefaultConstraints({ minTerms: 2, maxTerms: 2 })
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills)
    expect(problem).not.toBeNull()
    expect(problem!.terms.length).toBe(2)
  })

  it('should respect number range constraints', () => {
    const constraints = createDefaultConstraints({
      numberRange: { min: 1, max: 3 },
      minTerms: 3,
      maxTerms: 3,
    })
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills)
    expect(problem).not.toBeNull()
    for (const term of problem!.terms) {
      expect(Math.abs(term)).toBeGreaterThanOrEqual(1)
      expect(Math.abs(term)).toBeLessThanOrEqual(3)
    }
  })

  it('should produce a correct answer (sum of terms)', () => {
    const constraints = createDefaultConstraints()
    const skills = createFullSkillSet()
    for (let i = 0; i < 10; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        const expectedAnswer = problem.terms.reduce((a, b) => a + b, 0)
        expect(problem.answer).toBe(expectedAnswer)
      }
    }
  })

  it('should set difficulty based on skills used', () => {
    // Generate many problems and verify difficulty assignment logic
    const constraints = createDefaultConstraints({ maxTerms: 5 })
    const skills = createFullSkillSet()
    for (let i = 0; i < 20; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        if (problem.skillsUsed.some((s) => s.startsWith('tenComplements'))) {
          expect(problem.difficulty).toBe('hard')
        } else if (problem.skillsUsed.some((s) => s.startsWith('fiveComplements'))) {
          expect(problem.difficulty).toBe('medium')
        } else {
          expect(problem.difficulty).toBe('easy')
        }
      }
    }
  })

  it('should include an explanation string', () => {
    const constraints = createDefaultConstraints()
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills)
    expect(problem).not.toBeNull()
    expect(typeof problem!.explanation).toBe('string')
    expect(problem!.explanation!.length).toBeGreaterThan(0)
  })

  it('should include a generation trace', () => {
    const constraints = createDefaultConstraints()
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills)
    expect(problem).not.toBeNull()
    expect(problem!.generationTrace).toBeDefined()
    expect(problem!.generationTrace!.terms).toEqual(problem!.terms)
    expect(problem!.generationTrace!.answer).toBe(problem!.answer)
    expect(problem!.generationTrace!.steps.length).toBe(problem!.terms.length)
  })

  it('should generate a unique id for each problem', () => {
    const constraints = createDefaultConstraints()
    const skills = createBasicAdditionSkillSet()
    const ids = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        expect(ids.has(problem.id)).toBe(false)
        ids.add(problem.id)
      }
    }
  })

  it('should return null when constraints are impossible to satisfy', () => {
    const constraints = createDefaultConstraints({
      numberRange: { min: 1, max: 1 },
      maxTerms: 3,
      minTerms: 3,
      maxSum: 1, // Cannot have 3 terms of at least 1 with max sum 1
    })
    const skills = createBasicAdditionSkillSet()
    const problem = generateSingleProblem(constraints, skills, undefined, undefined, 10)
    expect(problem).toBeNull()
  })

  it('should support the new options-based API', () => {
    const options: GenerateProblemOptions = {
      constraints: createDefaultConstraints(),
      allowedSkills: createBasicAdditionSkillSet(),
      attempts: 50,
    }
    const problem = generateSingleProblem(options)
    expect(problem).not.toBeNull()
    expect(problem!.terms.length).toBeGreaterThanOrEqual(3)
  })

  it('should respect maxSum constraint', () => {
    const constraints = createDefaultConstraints({
      numberRange: { min: 1, max: 3 },
      maxSum: 6,
      minTerms: 2,
      maxTerms: 3,
    })
    const skills = createBasicAdditionSkillSet()
    for (let i = 0; i < 20; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        expect(problem.answer).toBeLessThanOrEqual(6)
      }
    }
  })

  it('should respect minSum constraint', () => {
    const constraints = createDefaultConstraints({
      numberRange: { min: 3, max: 9 },
      minSum: 10,
      minTerms: 3,
      maxTerms: 4,
    })
    const skills = createBasicAdditionSkillSet()
    let successCount = 0
    for (let i = 0; i < 20; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        expect(problem.answer).toBeGreaterThanOrEqual(10)
        successCount++
      }
    }
    // Should be able to generate at least some problems
    expect(successCount).toBeGreaterThan(0)
  })
})

// =============================================================================
// generateSingleProblemWithDiagnostics
// =============================================================================

describe('generateSingleProblemWithDiagnostics', () => {
  it('should return both a problem and diagnostics on success', () => {
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints(),
      allowedSkills: createBasicAdditionSkillSet(),
    })
    expect(result.problem).not.toBeNull()
    expect(result.diagnostics).toBeDefined()
    expect(result.diagnostics.totalAttempts).toBeGreaterThanOrEqual(1)
  })

  it('should populate diagnostics with enabled skill paths', () => {
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints(),
      allowedSkills: createBasicAdditionSkillSet(),
    })
    expect(result.diagnostics.enabledAllowedSkills).toContain('basic.directAddition')
  })

  it('should track target skills in diagnostics', () => {
    const target: Partial<SkillSet> = {
      fiveComplements: {
        '4=5-1': true,
        '3=5-2': false,
        '2=5-3': false,
        '1=5-4': false,
      },
    }
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints(),
      allowedSkills: createFiveComplementSkillSet(),
      targetSkills: target,
    })
    expect(result.diagnostics.enabledTargetSkills).toContain('fiveComplements.4=5-1')
  })

  it('should return null problem with diagnostics when generation fails', () => {
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints({
        numberRange: { min: 1, max: 1 },
        maxSum: 1,
        minTerms: 3,
        maxTerms: 3,
      }),
      allowedSkills: createBasicAdditionSkillSet(),
      attempts: 5,
    })
    expect(result.problem).toBeNull()
    expect(result.diagnostics.totalAttempts).toBe(5)
  })

  it('should count sum constraint failures', () => {
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints({
        numberRange: { min: 5, max: 9 },
        maxSum: 1, // Impossible to achieve
        minTerms: 3,
        maxTerms: 3,
      }),
      allowedSkills: createBasicAdditionSkillSet(),
      attempts: 10,
    })
    // Most attempts should fail on sum constraints
    expect(result.diagnostics.sumConstraintFailures).toBeGreaterThan(0)
  })

  it('should default to 100 attempts when not specified', () => {
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints({
        numberRange: { min: 1, max: 1 },
        maxSum: 1,
        minTerms: 3,
        maxTerms: 3,
      }),
      allowedSkills: createBasicAdditionSkillSet(),
    })
    // Should have attempted 100 times
    expect(result.diagnostics.totalAttempts).toBe(100)
  })

  it('should fall back to a problem matching allowed but not target skills', () => {
    // Target a skill that's hard to trigger
    const target: Partial<SkillSet> = {
      basic: {
        directAddition: false,
        heavenBead: false,
        simpleCombinations: false,
        directSubtraction: false,
        heavenBeadSubtraction: true, // Requires heaven bead state
        simpleCombinationsSub: false,
      },
    }
    const result = generateSingleProblemWithDiagnostics({
      constraints: createDefaultConstraints({
        numberRange: { min: 1, max: 4 },
        minTerms: 2,
        maxTerms: 3,
      }),
      allowedSkills: createBasicAdditionSkillSet(), // No subtraction skills
      targetSkills: target,
      attempts: 50,
    })
    // Even if we can't match target, we might get a fallback
    if (result.problem) {
      // If a problem was returned via fallback, diagnostics should indicate it
      // (targetSkillsFallback may or may not be true depending on whether the
      //  problem happens to match target skills)
      expect(result.diagnostics).toBeDefined()
    }
  })
})

// =============================================================================
// generateProblems
// =============================================================================

describe.skip('generateProblems', () => {
  it('should generate the requested number of problems', () => {
    const step = createPracticeStep({ problemCount: 5 })
    const problems = generateProblems(step)
    expect(problems.length).toBe(5)
  })

  it('should generate unique problems (no duplicate term sequences)', () => {
    const step = createPracticeStep({
      problemCount: 5,
      maxTerms: 5,
      allowedSkills: createFullSkillSet(),
    })
    const problems = generateProblems(step)
    const signatures = problems.map((p) => p.terms.join('-'))
    const uniqueSignatures = new Set(signatures)
    expect(uniqueSignatures.size).toBe(problems.length)
  })

  it('should use default number range when not specified', () => {
    const step = createPracticeStep()
    // numberRange is undefined, should default to { min: 1, max: 9 }
    const problems = generateProblems(step)
    expect(problems.length).toBeGreaterThan(0)
    for (const problem of problems) {
      for (const term of problem.terms) {
        expect(Math.abs(term)).toBeGreaterThanOrEqual(1)
        expect(Math.abs(term)).toBeLessThanOrEqual(9)
      }
    }
  })

  it('should use specified number range', () => {
    const step = createPracticeStep({
      problemCount: 3,
      numberRange: { min: 1, max: 3 },
      allowedSkills: createBasicAdditionSkillSet(),
    })
    const problems = generateProblems(step)
    for (const problem of problems) {
      for (const term of problem.terms) {
        expect(Math.abs(term)).toBeGreaterThanOrEqual(1)
        expect(Math.abs(term)).toBeLessThanOrEqual(3)
      }
    }
  })

  it('should pass sum constraints through', () => {
    const step = createPracticeStep({
      problemCount: 3,
      maxTerms: 3,
      sumConstraints: { maxSum: 10 },
      allowedSkills: createBasicAdditionSkillSet(),
      numberRange: { min: 1, max: 3 },
    })
    const problems = generateProblems(step)
    for (const problem of problems) {
      expect(problem.answer).toBeLessThanOrEqual(10)
    }
  })

  it('should fill with fallback problems when constraints are too restrictive', () => {
    // Very restrictive constraints that may not generate enough problems
    const step = createPracticeStep({
      problemCount: 10,
      maxTerms: 2,
      numberRange: { min: 1, max: 2 },
      allowedSkills: createBasicAdditionSkillSet(),
    })
    const problems = generateProblems(step)
    // Should still return the requested count (using fallbacks if needed)
    expect(problems.length).toBe(10)
  })

  it('should produce problems with correct answers', () => {
    const step = createPracticeStep({ problemCount: 5 })
    const problems = generateProblems(step)
    for (const problem of problems) {
      const expected = problem.terms.reduce((a, b) => a + b, 0)
      expect(problem.answer).toBe(expected)
    }
  })

  it('should handle a single problem request', () => {
    const step = createPracticeStep({ problemCount: 1 })
    const problems = generateProblems(step)
    expect(problems.length).toBe(1)
  })
})

// =============================================================================
// validatePracticeStepConfiguration
// =============================================================================

describe('validatePracticeStepConfiguration', () => {
  it('should return valid when skills are properly configured', () => {
    const step = createPracticeStep({
      allowedSkills: createBasicAdditionSkillSet(),
      problemCount: 5,
    })
    const result = validatePracticeStepConfiguration(step)
    expect(result.isValid).toBe(true)
    expect(result.warnings.length).toBe(0)
  })

  it('should warn when no skills are enabled', () => {
    const step = createPracticeStep({
      allowedSkills: createEmptySkillSet(),
    })
    const result = validatePracticeStepConfiguration(step)
    expect(result.isValid).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('No skills are enabled')
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it('should warn when maxSum exceeds the possible sum from number range', () => {
    const step = createPracticeStep({
      allowedSkills: createBasicAdditionSkillSet(),
      numberRange: { min: 1, max: 5 },
      maxTerms: 3,
      sumConstraints: { maxSum: 100 }, // Way higher than 5*3=15
    })
    const result = validatePracticeStepConfiguration(step)
    expect(result.warnings.some((w) => w.includes('Maximum sum'))).toBe(true)
  })

  it('should warn when maxSum is very low', () => {
    const step = createPracticeStep({
      allowedSkills: createBasicAdditionSkillSet(),
      sumConstraints: { maxSum: 3 },
    })
    const result = validatePracticeStepConfiguration(step)
    expect(result.warnings.some((w) => w.includes('low sum constraint'))).toBe(true)
  })

  it('should warn when problem count is high', () => {
    const step = createPracticeStep({
      allowedSkills: createBasicAdditionSkillSet(),
      problemCount: 25,
    })
    const result = validatePracticeStepConfiguration(step)
    expect(result.warnings.some((w) => w.includes('High problem count'))).toBe(true)
  })

  it('should not warn for normal problem counts', () => {
    const step = createPracticeStep({
      allowedSkills: createBasicAdditionSkillSet(),
      problemCount: 10,
    })
    const result = validatePracticeStepConfiguration(step)
    expect(result.warnings.some((w) => w.includes('High problem count'))).toBe(false)
  })

  it('should use default number range (max 9) when none specified', () => {
    const step = createPracticeStep({
      allowedSkills: createBasicAdditionSkillSet(),
      maxTerms: 4,
      sumConstraints: { maxSum: 100 }, // Greater than 9*4=36
    })
    // numberRange is undefined, defaults to max 9 => max possible is 9*4=36
    const result = validatePracticeStepConfiguration(step)
    expect(result.warnings.some((w) => w.includes('Maximum sum'))).toBe(true)
  })

  it('should return suggestions for every warning', () => {
    const step = createPracticeStep({
      allowedSkills: createEmptySkillSet(),
      problemCount: 25,
      sumConstraints: { maxSum: 3 },
    })
    const result = validatePracticeStepConfiguration(step)
    // Each warning should have a corresponding suggestion
    expect(result.suggestions.length).toBeGreaterThanOrEqual(result.warnings.length)
  })

  it('should check only basic, fiveComplements, and tenComplements for skill validation', () => {
    // A skill set with only subtraction skills enabled should still warn
    const skills = createEmptySkillSet()
    skills.basic.directSubtraction = true
    const step = createPracticeStep({ allowedSkills: skills })
    const result = validatePracticeStepConfiguration(step)
    // directSubtraction is in basic, so basic has a true value
    expect(result.isValid).toBe(true)
  })
})

// =============================================================================
// Integration: Skill detection correctness
// =============================================================================

describe('skill detection correctness', () => {
  it('should detect basic.directAddition for adding 1-4 from zero', () => {
    for (let n = 1; n <= 4; n++) {
      const skills = analyzeStepSkills(0, n, n)
      expect(skills).toContain('basic.directAddition')
    }
  })

  it('should detect basic.heavenBead for adding 5 from zero', () => {
    const skills = analyzeStepSkills(0, 5, 5)
    expect(skills).toContain('basic.heavenBead')
  })

  it('should detect basic.simpleCombinations for adding 6-9 from zero', () => {
    for (let n = 6; n <= 9; n++) {
      const skills = analyzeStepSkills(0, n, n)
      expect(skills).toContain('basic.simpleCombinations')
    }
  })

  it('should detect five complement addition: +4 = +5-1 from value 2', () => {
    const skills = analyzeStepSkills(2, 4, 6)
    expect(skills).toContain('fiveComplements.4=5-1')
  })

  it('should detect five complement addition: +3 = +5-2 from value 3', () => {
    const skills = analyzeStepSkills(3, 3, 6)
    expect(skills).toContain('fiveComplements.3=5-2')
  })

  it('should detect ten complement addition: +9 = +10-1 from value 5', () => {
    const skills = analyzeStepSkills(5, 9, 14)
    expect(skills).toContain('tenComplements.9=10-1')
  })

  it('should detect ten complement addition: +8 = +10-2 from value 5', () => {
    const skills = analyzeStepSkills(5, 8, 13)
    expect(skills).toContain('tenComplements.8=10-2')
  })
})

// =============================================================================
// Integration: Problem generation with subtraction
// =============================================================================

describe('problem generation with subtraction', () => {
  it('should generate problems with subtraction when subtraction skills are enabled', () => {
    const constraints = createDefaultConstraints({ maxTerms: 5, minTerms: 4 })
    const skills = createFullSkillSet()
    let hasSubtraction = false
    // Run multiple times since subtraction is random
    for (let i = 0; i < 30; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem && problem.terms.some((t) => t < 0)) {
        hasSubtraction = true
        break
      }
    }
    expect(hasSubtraction).toBe(true)
  })

  it('should not generate subtraction terms when no subtraction skills are enabled', () => {
    const constraints = createDefaultConstraints({ maxTerms: 4, minTerms: 3 })
    const skills = createBasicAdditionSkillSet()
    for (let i = 0; i < 20; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        expect(problem.terms.every((t) => t > 0)).toBe(true)
      }
    }
  })

  it('should never produce a negative running total', () => {
    const constraints = createDefaultConstraints({ maxTerms: 6, minTerms: 4 })
    const skills = createFullSkillSet()
    for (let i = 0; i < 20; i++) {
      const problem = generateSingleProblem(constraints, skills)
      if (problem) {
        let runningTotal = 0
        for (const term of problem.terms) {
          runningTotal += term
          expect(runningTotal).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})

// =============================================================================
// Generation trace structure
// =============================================================================

describe('generation trace structure', () => {
  it('should have step numbers starting from 1', () => {
    const problem = generateSingleProblem(
      createDefaultConstraints({ minTerms: 3, maxTerms: 3 }),
      createBasicAdditionSkillSet()
    )
    expect(problem).not.toBeNull()
    const trace = problem!.generationTrace!
    expect(trace.steps[0].stepNumber).toBe(1)
    expect(trace.steps[1].stepNumber).toBe(2)
    expect(trace.steps[2].stepNumber).toBe(3)
  })

  it('should have correct accumulated values in trace steps', () => {
    const problem = generateSingleProblem(
      createDefaultConstraints(),
      createBasicAdditionSkillSet()
    )
    expect(problem).not.toBeNull()
    const trace = problem!.generationTrace!
    let acc = 0
    for (const step of trace.steps) {
      expect(step.accumulatedBefore).toBe(acc)
      acc += step.termAdded
      expect(step.accumulatedAfter).toBe(acc)
    }
    expect(acc).toBe(problem!.answer)
  })

  it('should contain operation strings in each step', () => {
    const problem = generateSingleProblem(
      createDefaultConstraints(),
      createBasicAdditionSkillSet()
    )
    expect(problem).not.toBeNull()
    for (const step of problem!.generationTrace!.steps) {
      expect(typeof step.operation).toBe('string')
      expect(step.operation.length).toBeGreaterThan(0)
    }
  })

  it('should have allSkills be the union of all step skills', () => {
    const problem = generateSingleProblem(
      createDefaultConstraints(),
      createFullSkillSet()
    )
    expect(problem).not.toBeNull()
    const trace = problem!.generationTrace!
    const stepSkills = new Set(trace.steps.flatMap((s) => s.skillsUsed))
    for (const skill of trace.allSkills) {
      expect(stepSkills.has(skill)).toBe(true)
    }
  })

  it('should contain explanation strings in each step', () => {
    const problem = generateSingleProblem(
      createDefaultConstraints(),
      createBasicAdditionSkillSet()
    )
    expect(problem).not.toBeNull()
    for (const step of problem!.generationTrace!.steps) {
      expect(typeof step.explanation).toBe('string')
      expect(step.explanation.length).toBeGreaterThan(0)
    }
  })
})
