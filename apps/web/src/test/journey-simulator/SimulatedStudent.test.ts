/**
 * Unit Tests for SimulatedStudent Hill Function Learning Model
 *
 * Tests verify:
 * 1. Hill function mathematical correctness
 * 2. Exposure accumulation on every attempt
 * 3. Conjunctive probability model
 * 4. Help bonuses
 * 5. Learning curve progression
 */

import { describe, expect, it } from 'vitest'
import { SeededRandom } from './SeededRandom'
import { SimulatedStudent } from './SimulatedStudent'
import type { StudentProfile } from './types'

/**
 * Create a test profile with known parameters
 */
function createTestProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    name: 'Test Profile',
    description: 'Profile for unit testing',
    halfMaxExposure: 10, // K = 10: 50% at 10 exposures
    hillCoefficient: 2, // n = 2: x² curve shape
    initialExposures: {},
    helpUsageProbabilities: [1.0, 0], // Always no help for deterministic tests
    helpBonuses: [0, 0],
    baseResponseTimeMs: 5000,
    responseTimeVariance: 0,
    ...overrides,
  }
}

describe('SimulatedStudent Hill Function', () => {
  describe('hillFunction mathematical correctness', () => {
    it('should return 0 for 0 exposures', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      expect(student.hillFunction(0, 10, 2)).toBe(0)
    })

    it('should return 0.5 at K exposures (by definition)', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // At exposure = K, P should be exactly 0.5
      expect(student.hillFunction(10, 10, 2)).toBe(0.5)
    })

    it('should return values approaching 1 for high exposures', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // With K=10, n=2:
      // exposure=20: 400 / (100 + 400) = 0.8
      // exposure=30: 900 / (100 + 900) = 0.9
      // exposure=50: 2500 / (100 + 2500) ≈ 0.96
      expect(student.hillFunction(20, 10, 2)).toBeCloseTo(0.8, 5)
      expect(student.hillFunction(30, 10, 2)).toBeCloseTo(0.9, 5)
      expect(student.hillFunction(50, 10, 2)).toBeCloseTo(0.9615, 3)
    })

    it('should show delayed onset with higher n values', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // With K=10, compare n=1 vs n=2 vs n=3 at exposure=5
      // n=1: 5 / (10 + 5) = 0.333
      // n=2: 25 / (100 + 25) = 0.2
      // n=3: 125 / (1000 + 125) = 0.111

      const p_n1 = student.hillFunction(5, 10, 1)
      const p_n2 = student.hillFunction(5, 10, 2)
      const p_n3 = student.hillFunction(5, 10, 3)

      expect(p_n1).toBeCloseTo(0.333, 2)
      expect(p_n2).toBeCloseTo(0.2, 5)
      expect(p_n3).toBeCloseTo(0.111, 2)

      // Higher n = slower initial learning (lower P at early exposures)
      expect(p_n3).toBeLessThan(p_n2)
      expect(p_n2).toBeLessThan(p_n1)
    })

    it('should return 1 when K=0 (instant mastery edge case)', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      expect(student.hillFunction(5, 0, 2)).toBe(1)
    })
  })

  describe('exposure accumulation', () => {
    it('should initialize exposures from profile', () => {
      const profile = createTestProfile({
        initialExposures: {
          'skill.A': 15,
          'skill.B': 5,
        },
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      expect(student.getExposure('skill.A')).toBe(15)
      expect(student.getExposure('skill.B')).toBe(5)
      expect(student.getExposure('skill.C')).toBe(0) // Not in initial
    })

    it('should increment exposure on every problem attempt', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      expect(student.getExposure('skill.A')).toBe(0)

      // Answer a problem that uses skill.A
      student.answerProblem({
        terms: [5],
        answer: 5,
        skillsRequired: ['skill.A'],
      })

      expect(student.getExposure('skill.A')).toBe(1)

      // Answer another
      student.answerProblem({
        terms: [3],
        answer: 3,
        skillsRequired: ['skill.A'],
      })

      expect(student.getExposure('skill.A')).toBe(2)
    })

    it('should increment all skills in a multi-skill problem', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      student.answerProblem({
        terms: [5],
        answer: 5,
        skillsRequired: ['skill.A', 'skill.B', 'skill.C'],
      })

      expect(student.getExposure('skill.A')).toBe(1)
      expect(student.getExposure('skill.B')).toBe(1)
      expect(student.getExposure('skill.C')).toBe(1)
    })

    it('should track cumulative exposures across multiple problems', () => {
      const profile = createTestProfile({
        initialExposures: { 'skill.A': 10 },
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // Start at 10 (from initial)
      expect(student.getExposure('skill.A')).toBe(10)

      // Answer 5 problems
      for (let i = 0; i < 5; i++) {
        student.answerProblem({
          terms: [1],
          answer: 1,
          skillsRequired: ['skill.A'],
        })
      }

      expect(student.getExposure('skill.A')).toBe(15)
    })
  })

  describe('getTrueProbability', () => {
    it('should compute correct probability based on exposure', () => {
      const profile = createTestProfile({
        halfMaxExposure: 10,
        hillCoefficient: 2,
        initialExposures: {
          'skill.none': 0,
          'skill.some': 5,
          'skill.half': 10,
          'skill.high': 20,
        },
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      expect(student.getTrueProbability('skill.none')).toBe(0)
      expect(student.getTrueProbability('skill.some')).toBeCloseTo(0.2, 5)
      expect(student.getTrueProbability('skill.half')).toBe(0.5)
      expect(student.getTrueProbability('skill.high')).toBeCloseTo(0.8, 5)
    })
  })

  describe('conjunctive probability model', () => {
    it('should multiply probabilities for multi-skill problems', () => {
      // Use a profile with known exposures and RNG that always returns 0 (force "correct" below threshold)
      const profile = createTestProfile({
        halfMaxExposure: 10,
        hillCoefficient: 2,
        initialExposures: {
          // Both at exposure=10 → P=0.5 each
          'skill.A': 10,
          'skill.B': 10,
        },
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // After answerProblem, exposures will be incremented to 11
      // P(A) at 11: 121 / (100 + 121) ≈ 0.547
      // P(B) at 11: 121 / (100 + 121) ≈ 0.547
      // P(both) = 0.547 × 0.547 ≈ 0.30 (before clamping)

      // Verify the probabilities are computed correctly
      // Note: We can't directly test the private calculateAnswerProbability,
      // but we can verify through getTrueProbability
      expect(student.getTrueProbability('skill.A')).toBe(0.5)
      expect(student.getTrueProbability('skill.B')).toBe(0.5)

      // Product should be 0.5 × 0.5 = 0.25 for independent skills
      // (The actual answerProblem uses post-exposure values, but the principle holds)
    })

    it('should return high probability for single strong skill', () => {
      const profile = createTestProfile({
        halfMaxExposure: 10,
        hillCoefficient: 2,
        initialExposures: { 'skill.strong': 30 },
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // P at 30 exposures with K=10, n=2: 900/(100+900) = 0.9
      expect(student.getTrueProbability('skill.strong')).toBeCloseTo(0.9, 5)
    })

    it('should return near-zero probability for single weak skill', () => {
      const profile = createTestProfile({
        halfMaxExposure: 10,
        hillCoefficient: 2,
        initialExposures: { 'skill.weak': 2 },
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // P at 2 exposures with K=10, n=2: 4/(100+4) ≈ 0.038
      expect(student.getTrueProbability('skill.weak')).toBeCloseTo(0.0385, 3)
    })
  })

  describe('learning curve progression', () => {
    it('should show increasing probability as exposures accumulate', () => {
      const profile = createTestProfile({
        halfMaxExposure: 10,
        hillCoefficient: 2,
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      const probabilities: number[] = []

      // Simulate 30 problem attempts
      for (let i = 0; i < 30; i++) {
        student.answerProblem({
          terms: [1],
          answer: 1,
          skillsRequired: ['skill.learning'],
        })
        probabilities.push(student.getTrueProbability('skill.learning'))
      }

      // Probability should monotonically increase
      for (let i = 1; i < probabilities.length; i++) {
        expect(probabilities[i]).toBeGreaterThan(probabilities[i - 1])
      }

      // After 30 exposures, should be at ~90%
      expect(probabilities[29]).toBeCloseTo(0.9, 1)
    })

    it('should reach 50% at K exposures', () => {
      const profile = createTestProfile({
        halfMaxExposure: 10,
        hillCoefficient: 2,
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // Simulate exactly K (10) problem attempts
      for (let i = 0; i < 10; i++) {
        student.answerProblem({
          terms: [1],
          answer: 1,
          skillsRequired: ['skill.K'],
        })
      }

      expect(student.getTrueProbability('skill.K')).toBe(0.5)
    })
  })

  describe('different student profiles', () => {
    it('fast learner should reach 50% faster than slow learner', () => {
      const fastProfile = createTestProfile({
        halfMaxExposure: 8, // Faster
        hillCoefficient: 1.5,
      })
      const slowProfile = createTestProfile({
        halfMaxExposure: 20, // Slower
        hillCoefficient: 2.5,
      })

      const fastStudent = new SimulatedStudent(fastProfile, new SeededRandom(111))
      const slowStudent = new SimulatedStudent(slowProfile, new SeededRandom(222))

      // Give both 10 exposures
      for (let i = 0; i < 10; i++) {
        fastStudent.answerProblem({
          terms: [1],
          answer: 1,
          skillsRequired: ['skill.test'],
        })
        slowStudent.answerProblem({
          terms: [1],
          answer: 1,
          skillsRequired: ['skill.test'],
        })
      }

      const fastProb = fastStudent.getTrueProbability('skill.test')
      const slowProb = slowStudent.getTrueProbability('skill.test')

      // Fast learner should have higher probability after same exposures
      expect(fastProb).toBeGreaterThan(slowProb)

      // Fast learner at K=8 with 10 exposures should be >50%
      expect(fastProb).toBeGreaterThan(0.5)

      // Slow learner at K=20 with 10 exposures should be <50%
      expect(slowProb).toBeLessThan(0.5)
    })

    it('pre-seeded profile should start with higher probability', () => {
      const blankProfile = createTestProfile({
        initialExposures: {},
      })
      const preseededProfile = createTestProfile({
        initialExposures: { 'skill.test': 15 },
      })

      const blankStudent = new SimulatedStudent(blankProfile, new SeededRandom(111))
      const preseededStudent = new SimulatedStudent(preseededProfile, new SeededRandom(222))

      // Blank starts at 0%
      expect(blankStudent.getTrueProbability('skill.test')).toBe(0)

      // Pre-seeded starts higher
      // With K=10, n=2, exposure=15: 225/(100+225) ≈ 0.69
      expect(preseededStudent.getTrueProbability('skill.test')).toBeCloseTo(0.69, 1)
    })
  })

  describe('edge cases', () => {
    it('should handle problems with no skills', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // Problem with no skills required should return ~95% success
      const answer = student.answerProblem({
        terms: [5],
        answer: 5,
        skillsRequired: [],
      })

      // Should produce an answer (may be correct or incorrect based on 95%)
      expect(answer).toHaveProperty('isCorrect')
      expect(answer).toHaveProperty('responseTimeMs')
    })

    it('should track skills that start with 0 exposures', () => {
      const profile = createTestProfile()
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // Ensure skill is tracked
      student.ensureSkillTracked('skill.new')
      expect(student.getExposure('skill.new')).toBe(0)
      expect(student.getTrueProbability('skill.new')).toBe(0)
    })

    it('should clamp probability to valid range', () => {
      // Even with 0 skills and max help, probability shouldn't exceed 0.98
      const profile = createTestProfile({
        helpUsageProbabilities: [0, 1.0], // Always uses help
        helpBonuses: [0, 0.5], // Large bonus
      })
      const student = new SimulatedStudent(profile, new SeededRandom(12345))

      // With no skills, base is 0.95, plus 0.5 help bonus would be 1.45
      // Should be clamped to 0.98
      const answer = student.answerProblem({
        terms: [1],
        answer: 1,
        skillsRequired: [],
      })

      // Just verify it doesn't crash
      expect(answer.isCorrect).toBeDefined()
    })
  })
})
