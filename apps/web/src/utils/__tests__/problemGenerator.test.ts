import {
  analyzeRequiredSkills,
  problemMatchesSkills,
  generateSingleProblem,
  generateProblems,
  validatePracticeStepConfiguration
} from '../problemGenerator'
import { createBasicSkillSet, createEmptySkillSet, PracticeStep } from '../../types/tutorial'

describe('Problem Generator', () => {
  describe('analyzeRequiredSkills', () => {
    it('should identify basic direct addition in sequence', () => {
      const skills = analyzeRequiredSkills([1, 2], 3) // 0 + 1 = 1, then 1 + 2 = 3
      expect(skills).toContain('basic.directAddition')
    })

    it('should identify heaven bead usage in sequence', () => {
      const skills = analyzeRequiredSkills([3, 2], 5) // 0 + 3 = 3, then 3 + 2 = 5 (needs five complement)
      expect(skills).toContain('fiveComplements.2=5-3')
      expect(skills).toContain('basic.heavenBead')
    })

    it('should identify simple combinations', () => {
      const skills = analyzeRequiredSkills([5, 1], 6) // 0 + 5 = 5, then 5 + 1 = 6
      expect(skills).toContain('basic.heavenBead')
      expect(skills).toContain('basic.simpleCombinations')
    })

    it('should identify five complements in sequence', () => {
      const skills = analyzeRequiredSkills([3, 4], 7) // 0 + 3 = 3, then 3 + 4 = 7 (needs 4=5-1)
      expect(skills).toContain('fiveComplements.4=5-1')
    })

    it('should identify ten complements in sequence', () => {
      const skills = analyzeRequiredSkills([7, 5], 12) // 0 + 7 = 7, then 7 + 5 = 12 (needs ten complement)
      expect(skills).toContain('tenComplements.5=10-5')
    })
  })

  describe('problemMatchesSkills', () => {
    const basicSkills = createBasicSkillSet()
    basicSkills.basic.directAddition = true

    const problem = {
      id: 'test',
      terms: [1, 2],
      answer: 3,
      requiredSkills: ['basic.directAddition'],
      difficulty: 'easy' as const
    }

    it('should match when problem uses required skills', () => {
      const matches = problemMatchesSkills(problem, basicSkills)
      expect(matches).toBe(true)
    })

    it('should not match when problem uses forbidden skills', () => {
      const forbiddenSkills = createEmptySkillSet()
      forbiddenSkills.basic.directAddition = true

      const matches = problemMatchesSkills(problem, basicSkills, undefined, forbiddenSkills)
      expect(matches).toBe(false)
    })
  })

  describe('generateSingleProblem', () => {
    it('should generate a sequential problem within constraints', () => {
      const constraints = {
        numberRange: { min: 1, max: 3 },
        maxSum: 8,
        maxTerms: 5,
        problemCount: 1
      }

      const skills = createBasicSkillSet()
      skills.basic.directAddition = true

      const problem = generateSingleProblem(constraints, skills)

      expect(problem).toBeTruthy()
      if (problem) {
        expect(problem.terms.length).toBeGreaterThanOrEqual(3) // Now 3-5 terms
        expect(problem.terms.length).toBeLessThanOrEqual(5)
        expect(problem.answer).toBeLessThanOrEqual(8)
        expect(problem.terms.every(term => term >= 1 && term <= 3)).toBe(true)
      }
    })

    it('should return null when constraints are impossible', () => {
      const constraints = {
        numberRange: { min: 10, max: 10 },
        maxSum: 5, // Impossible: even one term of 10 exceeds maxSum of 5
        maxTerms: 5,
        problemCount: 1
      }

      const skills = createBasicSkillSet()
      skills.basic.directAddition = true

      const problem = generateSingleProblem(constraints, skills, undefined, undefined, 10)
      expect(problem).toBeNull()
    })
  })

  describe('generateProblems', () => {
    const practiceStep: PracticeStep = {
      id: 'test-practice',
      type: 'practice',
      title: 'Test Practice',
      description: 'Test practice step',
      problemCount: 3,
      maxTerms: 5,
      requiredSkills: createBasicSkillSet(),
      numberRange: { min: 1, max: 3 },
      sumConstraints: { maxSum: 8 }
    }

    // Enable basic direct addition
    practiceStep.requiredSkills.basic.directAddition = true

    it('should generate the requested number of problems', () => {
      const problems = generateProblems(practiceStep)
      expect(problems).toHaveLength(3)
      // Each problem should have 3-5 terms
      problems.forEach(problem => {
        expect(problem.terms.length).toBeGreaterThanOrEqual(3)
        expect(problem.terms.length).toBeLessThanOrEqual(5)
      })
    })

    it('should generate unique problems', () => {
      const problems = generateProblems(practiceStep)
      const problemSignatures = problems.map(p => p.terms.join('-'))
      const uniqueSignatures = [...new Set(problemSignatures)]
      expect(uniqueSignatures.length).toBe(problemSignatures.length)
    })

    it('should handle duplicate detection with large problem counts', () => {
      const largePracticeStep: PracticeStep = {
        ...practiceStep,
        problemCount: 10,
        numberRange: { min: 1, max: 2 }, // Very restrictive to force potential duplicates
        maxTerms: 3
      }

      const problems = generateProblems(largePracticeStep)
      const problemSignatures = problems.map(p => p.terms.join('-'))
      const uniqueSignatures = [...new Set(problemSignatures)]

      // Should still generate unique problems even with restrictive constraints
      expect(uniqueSignatures.length).toBe(problemSignatures.length)
      expect(problems.length).toBe(10)
    })

    it('should create fallback problems when primary generation fails', () => {
      const impossibleStep: PracticeStep = {
        id: 'impossible',
        type: 'practice',
        title: 'Impossible',
        description: 'Should fall back to simple problems',
        problemCount: 3,
        maxTerms: 5,
        requiredSkills: createEmptySkillSet(), // No skills enabled
        numberRange: { min: 1, max: 1 }, // Only one possible number
        sumConstraints: { maxSum: 2 } // Very restrictive
      }

      const problems = generateProblems(impossibleStep)
      expect(problems.length).toBe(3)

      // Should fall back to basic addition problems
      problems.forEach(problem => {
        expect(problem.requiredSkills).toContain('basic.directAddition')
        expect(problem.difficulty).toBe('easy')
      })
    })
  })

  describe('validatePracticeStepConfiguration', () => {
    it('should validate a good configuration', () => {
      const practiceStep: PracticeStep = {
        id: 'test',
        type: 'practice',
        title: 'Test',
        description: 'Test',
        problemCount: 5,
        maxTerms: 5,
        requiredSkills: createBasicSkillSet(),
        numberRange: { min: 1, max: 9 },
        sumConstraints: { maxSum: 15 }
      }

      practiceStep.requiredSkills.basic.directAddition = true

      const result = validatePracticeStepConfiguration(practiceStep)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should warn about no required skills', () => {
      const practiceStep: PracticeStep = {
        id: 'test',
        type: 'practice',
        title: 'Test',
        description: 'Test',
        problemCount: 5,
        maxTerms: 3,
        requiredSkills: createEmptySkillSet(),
        numberRange: { min: 1, max: 9 }
      }

      const result = validatePracticeStepConfiguration(practiceStep)
      expect(result.isValid).toBe(false)
      expect(result.warnings.some(w => w.includes('No required skills'))).toBe(true)
    })

    it('should warn about impossible sum constraints', () => {
      const practiceStep: PracticeStep = {
        id: 'test',
        type: 'practice',
        title: 'Test',
        description: 'Test',
        problemCount: 5,
        maxTerms: 5,
        requiredSkills: createBasicSkillSet(),
        numberRange: { min: 1, max: 5 },
        sumConstraints: { maxSum: 30 } // Higher than possible (5 terms * 5 max = 25)
      }

      const result = validatePracticeStepConfiguration(practiceStep)
      expect(result.warnings.some(w => w.includes('Maximum sum constraint'))).toBe(true)
    })
  })
})