import { describe, it, expect } from 'vitest'
import { analyzeStepSkills, generateSingleProblem } from '../problemGenerator'
import { createSkillCostCalculator, type StudentSkillHistory } from '../skillComplexity'
import type { SkillSet } from '../../types/tutorial'

/**
 * Creates a SkillSet with all skills enabled for testing
 */
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
      cascadingCarry: true,
      cascadingBorrow: true,
    },
  }
}

/**
 * Tests for the complexity budget filtering feature in the problem generator.
 *
 * The budget system works as follows:
 * - Each term in a problem has a "cost" based on the skills it requires
 * - Cost = sum of (baseCost × masteryMultiplier) for each skill
 * - If maxComplexityBudgetPerTerm is set, terms exceeding the budget are rejected
 */

describe('Problem Generator Budget Integration', () => {
  describe('analyzeStepSkills produces correct skills for budget calculation', () => {
    it('should identify basic.directAddition for simple additions', () => {
      // 0 + 3 = 3 (direct addition)
      const skills = analyzeStepSkills(0, 3, 3)
      expect(skills).toContain('basic.directAddition')
    })

    it('should identify heaven bead usage for adding 5', () => {
      // 0 + 5 = 5 (heaven bead)
      const skills = analyzeStepSkills(0, 5, 5)
      expect(skills).toContain('basic.heavenBead')
    })

    it('should identify ten complement for carry-producing additions', () => {
      // 5 + 9 = 14 (ten complement: +9 = +10 - 1)
      const skills = analyzeStepSkills(5, 9, 14)
      expect(skills).toContain('tenComplements.9=10-1')
    })
  })

  describe('term costs vary by student mastery', () => {
    it('should have low cost for effortless skills', () => {
      const history: StudentSkillHistory = {
        skills: {
          'fiveComplements.4=5-1': {
            skillId: 'fiveComplements.4=5-1',
            masteryState: 'effortless',
          },
        },
      }
      const calculator = createSkillCostCalculator(history)

      // 3 + 4 = 7 (five complement: +5 -1)
      const skills = analyzeStepSkills(3, 4, 7)
      const cost = calculator.calculateTermCost(skills)

      // fiveComplements.4=5-1 has base cost 1, effortless multiplier 1
      // Note: may also include basic.heavenBead (base 0) and basic.simpleCombinations (base 0)
      expect(cost).toBe(1) // base 1 × effortless 1 = 1
    })

    it('should have high cost for not_practicing skills', () => {
      const history: StudentSkillHistory = {
        skills: {
          'fiveComplements.4=5-1': {
            skillId: 'fiveComplements.4=5-1',
            masteryState: 'not_practicing',
          },
        },
      }
      const calculator = createSkillCostCalculator(history)

      // Same operation: 3 + 4 = 7 (five complement)
      const skills = analyzeStepSkills(3, 4, 7)
      const cost = calculator.calculateTermCost(skills)

      // fiveComplements.4=5-1 has base cost 1, not_practicing multiplier 4
      // Note: basic.heavenBead and basic.simpleCombinations have base 0
      expect(cost).toBe(4) // base 1 × not_practicing 4 = 4
    })

    it('should have higher cost for ten complement than basic skills', () => {
      const history: StudentSkillHistory = {
        skills: {
          'tenComplements.9=10-1': {
            skillId: 'tenComplements.9=10-1',
            masteryState: 'effortless',
          },
        },
      }
      const calculator = createSkillCostCalculator(history)

      // 5 + 9 = 14 (ten complement)
      const skills = analyzeStepSkills(5, 9, 14)
      const cost = calculator.calculateTermCost(skills)

      // Ten complement: base 2 × effortless 1 = 2
      expect(cost).toBeGreaterThanOrEqual(2)
    })
  })

  describe('budget filtering scenarios', () => {
    const fullSkillSet = createFullSkillSet()

    it('beginner: same skill costs more than expert', () => {
      // Beginner: all skills at learning (unknown = learning)
      const beginnerHistory: StudentSkillHistory = { skills: {} }
      const beginnerCalc = createSkillCostCalculator(beginnerHistory)

      // Expert: ten complement effortless
      const expertHistory: StudentSkillHistory = {
        skills: {
          'tenComplements.9=10-1': {
            skillId: 'tenComplements.9=10-1',
            masteryState: 'effortless',
          },
        },
      }
      const expertCalc = createSkillCostCalculator(expertHistory)

      // 5 + 9 = 14 (needs ten complement)
      const skills = analyzeStepSkills(5, 9, 14)

      const beginnerCost = beginnerCalc.calculateTermCost(skills)
      const expertCost = expertCalc.calculateTermCost(skills)

      expect(beginnerCost).toBeGreaterThan(expertCost)
      expect(beginnerCost).toBe(8) // base 2 × learning 4 = 8
      expect(expertCost).toBe(2) // base 2 × effortless 1 = 2
    })

    it('expert can fit complex terms in tight budget', () => {
      const expertHistory: StudentSkillHistory = {
        skills: {
          'tenComplements.9=10-1': {
            skillId: 'tenComplements.9=10-1',
            masteryState: 'effortless',
          },
          'basic.heavenBead': {
            skillId: 'basic.heavenBead',
            masteryState: 'effortless',
          },
        },
      }
      const calculator = createSkillCostCalculator(expertHistory)

      const skills = analyzeStepSkills(5, 9, 14)
      const cost = calculator.calculateTermCost(skills)

      // With budget 3, expert can fit this
      expect(cost <= 3).toBe(true)
    })

    it('beginner cannot fit same term in tight budget', () => {
      const beginnerHistory: StudentSkillHistory = { skills: {} }
      const calculator = createSkillCostCalculator(beginnerHistory)

      const skills = analyzeStepSkills(5, 9, 14)
      const cost = calculator.calculateTermCost(skills)

      // With budget 3, beginner cannot fit this
      expect(cost > 3).toBe(true)
    })
  })

  describe('generateSingleProblem with budget', () => {
    const fullSkillSet = createFullSkillSet()

    it('should respect budget constraint when generating problems', () => {
      // Create a calculator where ten complements are expensive (not_practicing)
      const beginnerHistory: StudentSkillHistory = {
        skills: {
          'basic.directAddition': {
            skillId: 'basic.directAddition',
            masteryState: 'effortless',
          },
          'basic.heavenBead': {
            skillId: 'basic.heavenBead',
            masteryState: 'effortless',
          },
          'basic.simpleCombinations': {
            skillId: 'basic.simpleCombinations',
            masteryState: 'effortless',
          },
        },
      }
      const calculator = createSkillCostCalculator(beginnerHistory)

      // Generate a problem with tight budget (2)
      // This should only allow simple operations
      const problem = generateSingleProblem({
        constraints: {
          numberRange: { min: 1, max: 9 },
          maxTerms: 5,
          problemCount: 1,
          maxComplexityBudgetPerTerm: 2,
        },
        allowedSkills: fullSkillSet,
        costCalculator: calculator,
        attempts: 200,
      })

      // With a tight budget, the problem should avoid expensive skills
      // or return null if impossible
      if (problem) {
        // Verify no ten complements (which would cost 8 for a beginner)
        const hasTenComplement = problem.skillsUsed.some((s) => s.includes('tenComplements'))
        expect(hasTenComplement).toBe(false)
      }
    })

    it('should allow more complex operations with higher budget', () => {
      // Expert history - all skills effortless
      const expertHistory: StudentSkillHistory = {
        skills: {
          'basic.directAddition': {
            skillId: 'basic.directAddition',
            masteryState: 'effortless',
          },
          'basic.heavenBead': {
            skillId: 'basic.heavenBead',
            masteryState: 'effortless',
          },
          'basic.simpleCombinations': {
            skillId: 'basic.simpleCombinations',
            masteryState: 'effortless',
          },
          'tenComplements.9=10-1': {
            skillId: 'tenComplements.9=10-1',
            masteryState: 'effortless',
          },
          'tenComplements.8=10-2': {
            skillId: 'tenComplements.8=10-2',
            masteryState: 'effortless',
          },
        },
      }
      const calculator = createSkillCostCalculator(expertHistory)

      // Generate multiple problems with higher budget
      let hasComplexSkill = false
      for (let i = 0; i < 20; i++) {
        const problem = generateSingleProblem({
          constraints: {
            numberRange: { min: 1, max: 9 },
            maxTerms: 5,
            problemCount: 1,
            maxComplexityBudgetPerTerm: 6, // Higher budget
          },
          allowedSkills: fullSkillSet,
          costCalculator: calculator,
          attempts: 50,
        })

        if (problem) {
          const hasTenComplement = problem.skillsUsed.some((s) => s.includes('tenComplements'))
          if (hasTenComplement) {
            hasComplexSkill = true
            break
          }
        }
      }

      // With a higher budget and expert status, ten complements should sometimes appear
      // (This test may be flaky due to randomness, but with 20 attempts it should succeed)
      expect(hasComplexSkill).toBe(true)
    })

    it('should work without budget constraint (backward compatibility)', () => {
      // Without costCalculator, should work as before
      const problem = generateSingleProblem(
        {
          numberRange: { min: 1, max: 9 },
          maxTerms: 5,
          problemCount: 1,
        },
        fullSkillSet
      )

      expect(problem).not.toBeNull()
    })

    it('should work with new options API', () => {
      const problem = generateSingleProblem({
        constraints: {
          numberRange: { min: 1, max: 9 },
          maxTerms: 5,
          problemCount: 1,
        },
        allowedSkills: fullSkillSet,
        attempts: 100,
      })

      expect(problem).not.toBeNull()
    })
  })
})
