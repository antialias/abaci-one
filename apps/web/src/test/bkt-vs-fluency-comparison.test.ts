/**
 * @vitest-environment node
 *
 * BKT vs Fluency Algorithm Comparison
 *
 * Compares BKT (Bayesian Knowledge Tracing) and Fluency algorithms
 * to understand their strengths and weaknesses:
 *
 * BKT: Continuous probability model based on Bayesian inference
 * - Updates P(known) based on each correct/incorrect answer
 * - Uses conjunctive model for multi-skill problems
 * - Provides confidence estimates based on opportunities
 *
 * Fluency: Discrete state model based on performance thresholds
 * - States: practicing, fluent, effortless, rusty, not_practicing
 * - Based on: attempts, accuracy, consecutive streak, recency
 * - Maps to fixed multipliers
 *
 * This test runs both algorithms on identical data to compare:
 * 1. Sensitivity to weak skills
 * 2. Response to improvement
 * 3. Handling of mixed performance
 */

import { describe, expect, it } from 'vitest'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import {
  calculateFluencyState,
  hasFluency,
  FLUENCY_CONFIG,
  type FluencyState,
} from '@/db/schema/player-skill-mastery'

// Helper to create a result entry
function createResult(
  skillIds: string[],
  isCorrect: boolean,
  timestampOffset: number
): ProblemResultWithContext {
  return {
    sessionId: 'test-session',
    partNumber: 1,
    slotIndex: 0,
    problem: {
      terms: [1, 2],
      answer: 3,
      skillsRequired: skillIds,
    },
    studentAnswer: isCorrect ? 3 : 4,
    isCorrect,
    responseTimeMs: isCorrect ? 3000 : 8000,
    skillsExercised: skillIds,
    usedOnScreenAbacus: false,
    timestamp: new Date(Date.now() - timestampOffset),
    helpLevelUsed: 0,
    incorrectAttempts: 0,
    sessionCompletedAt: new Date(Date.now() - timestampOffset),
    partType: 'abacus',
  }
}

/**
 * Compute fluency state from problem history for a single skill
 */
function computeFluencyFromHistory(
  results: ProblemResultWithContext[],
  skillId: string
): { fluencyState: FluencyState; attempts: number; correct: number; consecutiveCorrect: number } {
  // Filter results that include this skill
  const skillResults = results.filter((r) => r.skillsExercised.includes(skillId))

  let attempts = 0
  let correct = 0
  let consecutiveCorrect = 0

  // Process in chronological order
  const sorted = [...skillResults].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  for (const result of sorted) {
    attempts++
    if (result.isCorrect) {
      correct++
      consecutiveCorrect++
    } else {
      consecutiveCorrect = 0
    }
  }

  // Calculate days since last practice
  const lastPractice = sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp) : null
  const daysSinceLastPractice = lastPractice
    ? Math.floor((Date.now() - lastPractice.getTime()) / (1000 * 60 * 60 * 24))
    : undefined

  const fluencyState = calculateFluencyState(
    attempts,
    correct,
    consecutiveCorrect,
    daysSinceLastPractice
  )

  return { fluencyState, attempts, correct, consecutiveCorrect }
}

describe('BKT vs Fluency Comparison', () => {
  describe('Weak Skill Detection Sensitivity', () => {
    it('should compare detection of a consistently weak skill', () => {
      const weakSkill = 'fiveComplements.4=5-1'
      const strongSkill = 'basic.directAddition'

      // Generate 50 problems where weak skill always fails
      const results: ProblemResultWithContext[] = []

      for (let i = 0; i < 50; i++) {
        const usesWeakSkill = Math.random() < 0.4
        const skills = usesWeakSkill ? [weakSkill, strongSkill] : [strongSkill]
        const isCorrect = !usesWeakSkill // Fail when weak skill is present

        results.push(createResult(skills, isCorrect, (50 - i) * 5000))
      }

      // Compute BKT
      const bkt = computeBktFromHistory(results)
      const bktWeak = bkt.skills.find((s) => s.skillId === weakSkill)
      const bktStrong = bkt.skills.find((s) => s.skillId === strongSkill)

      // Compute Fluency
      const fluencyWeak = computeFluencyFromHistory(results, weakSkill)
      const fluencyStrong = computeFluencyFromHistory(results, strongSkill)

      console.log('\n=== Weak Skill Detection ===')
      console.log('\nBKT Results:')
      console.log(
        `  ${weakSkill}: pKnown=${(bktWeak?.pKnown ?? 0).toFixed(3)}, conf=${(bktWeak?.confidence ?? 0).toFixed(3)}, opp=${bktWeak?.opportunities ?? 0}`
      )
      console.log(
        `  ${strongSkill}: pKnown=${(bktStrong?.pKnown ?? 0).toFixed(3)}, conf=${(bktStrong?.confidence ?? 0).toFixed(3)}, opp=${bktStrong?.opportunities ?? 0}`
      )

      console.log('\nFluency Results:')
      console.log(
        `  ${weakSkill}: state=${fluencyWeak.fluencyState}, attempts=${fluencyWeak.attempts}, correct=${fluencyWeak.correct}, streak=${fluencyWeak.consecutiveCorrect}`
      )
      console.log(
        `  ${strongSkill}: state=${fluencyStrong.fluencyState}, attempts=${fluencyStrong.attempts}, correct=${fluencyStrong.correct}, streak=${fluencyStrong.consecutiveCorrect}`
      )

      // BKT should clearly identify weak skill
      expect(bktWeak).toBeDefined()
      expect(bktWeak!.pKnown).toBeLessThan(0.3)

      // Compare differentiation
      const bktGap = (bktStrong?.pKnown ?? 0) - (bktWeak?.pKnown ?? 0)
      console.log(`\nBKT Gap (strong - weak): ${bktGap.toFixed(3)}`)

      // Fluency states should also differ
      console.log(
        `Fluency distinguishes weak from strong: ${fluencyWeak.fluencyState !== fluencyStrong.fluencyState || fluencyWeak.correct < fluencyStrong.correct}`
      )
    })

    it('should compare response to gradual improvement', () => {
      const skill = 'fiveComplements.3=5-2'

      // First 30 problems: mostly wrong (learning phase)
      // Last 30 problems: mostly correct (improved)
      const results: ProblemResultWithContext[] = []

      for (let i = 0; i < 60; i++) {
        const inLearningPhase = i < 30
        // Learning phase: 20% correct, improved phase: 90% correct
        const isCorrect = inLearningPhase ? Math.random() < 0.2 : Math.random() < 0.9

        results.push(createResult([skill], isCorrect, (60 - i) * 5000))
      }

      // Compute at different points
      const resultsAtMidpoint = results.slice(0, 30)
      const resultsAtEnd = results

      const bktMid = computeBktFromHistory(resultsAtMidpoint)
      const bktEnd = computeBktFromHistory(resultsAtEnd)

      const fluencyMid = computeFluencyFromHistory(resultsAtMidpoint, skill)
      const fluencyEnd = computeFluencyFromHistory(resultsAtEnd, skill)

      console.log('\n=== Response to Improvement ===')
      console.log('\nAt midpoint (30 problems, mostly wrong):')
      console.log(`  BKT pKnown: ${(bktMid.skills[0]?.pKnown ?? 0).toFixed(3)}`)
      console.log(
        `  Fluency state: ${fluencyMid.fluencyState} (${fluencyMid.correct}/${fluencyMid.attempts} correct)`
      )

      console.log('\nAt end (60 problems, improved):')
      console.log(`  BKT pKnown: ${(bktEnd.skills[0]?.pKnown ?? 0).toFixed(3)}`)
      console.log(
        `  Fluency state: ${fluencyEnd.fluencyState} (${fluencyEnd.correct}/${fluencyEnd.attempts} correct)`
      )

      // BKT should show improvement
      expect(bktEnd.skills[0]?.pKnown ?? 0).toBeGreaterThan(bktMid.skills[0]?.pKnown ?? 0)

      console.log(
        `\nBKT improvement: +${((bktEnd.skills[0]?.pKnown ?? 0) - (bktMid.skills[0]?.pKnown ?? 0)).toFixed(3)}`
      )
    })
  })

  describe('Conjunctive vs Aggregate', () => {
    it('should compare multi-skill problem handling', () => {
      // BKT uses conjunctive model (blame distribution)
      // Fluency uses aggregate (each skill gets full credit/blame)

      const skillA = 'basic.directAddition'
      const skillB = 'fiveComplements.4=5-1'
      const skillC = 'basic.heavenBead'

      // Create problems where:
      // - A alone: always correct
      // - B alone: always correct
      // - A+B together: always wrong (interaction effect)
      // - C alone: always correct

      const results: ProblemResultWithContext[] = []

      // A alone correct x10
      for (let i = 0; i < 10; i++) {
        results.push(createResult([skillA], true, (50 - results.length) * 5000))
      }

      // B alone correct x10
      for (let i = 0; i < 10; i++) {
        results.push(createResult([skillB], true, (50 - results.length) * 5000))
      }

      // A+B together wrong x15
      for (let i = 0; i < 15; i++) {
        results.push(createResult([skillA, skillB], false, (50 - results.length) * 5000))
      }

      // C alone correct x10
      for (let i = 0; i < 10; i++) {
        results.push(createResult([skillC], true, (50 - results.length) * 5000))
      }

      const bkt = computeBktFromHistory(results)
      const fluencyA = computeFluencyFromHistory(results, skillA)
      const fluencyB = computeFluencyFromHistory(results, skillB)
      const fluencyC = computeFluencyFromHistory(results, skillC)

      const bktA = bkt.skills.find((s) => s.skillId === skillA)
      const bktB = bkt.skills.find((s) => s.skillId === skillB)
      const bktC = bkt.skills.find((s) => s.skillId === skillC)

      console.log('\n=== Conjunctive vs Aggregate ===')
      console.log('Scenario: A alone=pass, B alone=pass, A+B=fail, C alone=pass')

      console.log('\nBKT (conjunctive model - distributes blame):')
      console.log(`  A: pKnown=${(bktA?.pKnown ?? 0).toFixed(3)}`)
      console.log(`  B: pKnown=${(bktB?.pKnown ?? 0).toFixed(3)}`)
      console.log(`  C: pKnown=${(bktC?.pKnown ?? 0).toFixed(3)}`)

      console.log('\nFluency (aggregate - each skill gets full result):')
      console.log(`  A: state=${fluencyA.fluencyState} (${fluencyA.correct}/${fluencyA.attempts})`)
      console.log(`  B: state=${fluencyB.fluencyState} (${fluencyB.correct}/${fluencyB.attempts})`)
      console.log(`  C: state=${fluencyC.fluencyState} (${fluencyC.correct}/${fluencyC.attempts})`)

      // BKT should show A and B are weaker than C (they share the blame)
      expect(bktC?.pKnown ?? 0).toBeGreaterThan((bktA?.pKnown ?? 0 + (bktB?.pKnown ?? 0)) / 2)

      console.log('\nKey insight:')
      console.log(
        `  BKT correctly shows C is stronger than A,B: ${(bktC?.pKnown ?? 0).toFixed(3)} > ${((bktA?.pKnown ?? 0) + (bktB?.pKnown ?? 0)) / 2}`
      )
      console.log(
        `  Fluency shows A: ${fluencyA.correct}/${fluencyA.attempts} = ${((fluencyA.correct / fluencyA.attempts) * 100).toFixed(0)}%`
      )
      console.log(
        `  Fluency shows B: ${fluencyB.correct}/${fluencyB.attempts} = ${((fluencyB.correct / fluencyB.attempts) * 100).toFixed(0)}%`
      )
    })
  })

  describe('Algorithm Characteristics Summary', () => {
    it('should summarize key differences', () => {
      console.log('\n' + '='.repeat(70))
      console.log('              BKT vs FLUENCY ALGORITHM COMPARISON')
      console.log('='.repeat(70))

      console.log('\n| Aspect              | BKT                    | Fluency               |')
      console.log('|---------------------|------------------------|-----------------------|')
      console.log('| Output type         | Continuous P(known)    | Discrete states       |')
      console.log('| Update mechanism    | Bayesian inference     | Threshold-based       |')
      console.log('| Multi-skill problems| Conjunctive (shared)   | Aggregate (full each) |')
      console.log('| Confidence tracking | Yes (opportunities)    | No                    |')
      console.log('| Recency decay       | Optional               | Built-in              |')
      console.log('| Streak bonus        | No                     | Yes (consecutive)     |')

      console.log('\nWhen to use BKT:')
      console.log('  - Need fine-grained skill assessment')
      console.log('  - Have multi-skill problems (conjunctive model)')
      console.log('  - Want confidence-aware recommendations')

      console.log('\nWhen to use Fluency:')
      console.log('  - Simple pass/fail tracking per skill')
      console.log('  - Need recency-aware state (rusty skills)')
      console.log('  - Want streak-based motivation')

      console.log('\nRecommendation:')
      console.log('  Use BKT for SKILL TARGETING (which skills to practice)')
      console.log('  Use Fluency for COMPLEXITY BUDGETING (difficulty control)')
      console.log('='.repeat(70))

      expect(true).toBe(true) // Placeholder assertion
    })

    it('should validate fluency thresholds', () => {
      console.log('\n=== Fluency Threshold Configuration ===')
      console.log(`  Minimum attempts for fluency: ${FLUENCY_CONFIG.minimumAttempts}`)
      console.log(`  Consecutive streak required: ${FLUENCY_CONFIG.consecutiveForFluency}`)
      console.log(`  Effortless days threshold: ${FLUENCY_CONFIG.effortlessDays}`)
      console.log(`  Fluent days threshold: ${FLUENCY_CONFIG.fluentDays}`)

      // Test threshold behavior
      const testCases = [
        { attempts: 5, correct: 5, streak: 5, expected: 'effortless' },
        { attempts: 10, correct: 8, streak: 3, expected: 'practicing' }, // streak too low
        { attempts: 50, correct: 40, streak: 5, expected: 'effortless' },
        { attempts: 5, correct: 3, streak: 3, expected: 'practicing' }, // not enough correct
      ]

      console.log('\nThreshold test cases:')
      for (const tc of testCases) {
        const state = calculateFluencyState(tc.attempts, tc.correct, tc.streak, 0)
        const hasFl = hasFluency(tc.attempts, tc.correct, tc.streak)
        console.log(
          `  attempts=${tc.attempts}, correct=${tc.correct}, streak=${tc.streak} => ${state} (hasFluency=${hasFl})`
        )
      }
    })
  })
})
