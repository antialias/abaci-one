/**
 * @vitest-environment node
 *
 * A/B Test: Heuristic vs Bayesian Blame Attribution
 *
 * Compares two methods of attributing blame when a multi-skill problem is answered incorrectly:
 *
 * 1. HEURISTIC: blame(skill) ∝ (1 - P(known))
 *    - Fast O(n) computation
 *    - Linear approximation
 *
 * 2. BAYESIAN: P(~known_i | fail) via marginalization
 *    - Proper posterior computation O(n × 2^n)
 *    - Exact for the conjunctive model
 *
 * Key test scenario: Student has nearly-mastered skills + brand-new skills.
 * This is exactly what happens when a student advances to a new skill type.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import {
  bayesianUpdateOnIncorrect,
  updateOnIncorrect,
  type BlameMethod,
  type SkillBktRecord,
} from '@/lib/curriculum/bkt'
import { getDefaultParams } from '@/lib/curriculum/bkt/skill-priors'
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from './EphemeralDatabase'
import { JourneyRunner } from './JourneyRunner'
import {
  ALL_SKILLS,
  averageLearnerProfile,
  fastLearnerProfile,
  slowLearnerProfile,
  starkContrastProfile,
} from './profiles'
import { formatJourneyResults } from './reporters'
import { SeededRandom } from './SeededRandom'
import { SimulatedStudent } from './SimulatedStudent'

// Mock the @/db module to use our ephemeral database
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

describe('Blame Attribution: Unit Tests', () => {
  it('should produce different blame distributions for stark contrast skills', () => {
    // Simulate a student who knows basic skills well but just started complements
    const skills: SkillBktRecord[] = [
      {
        skillId: 'basic.directAddition',
        pKnown: 0.95, // Nearly mastered
        params: getDefaultParams('basic.directAddition'),
      },
      {
        skillId: 'fiveComplements.4=5-1',
        pKnown: 0.1, // Just started
        params: getDefaultParams('fiveComplements.4=5-1'),
      },
    ]

    const heuristicResult = updateOnIncorrect(skills)
    const bayesianResult = bayesianUpdateOnIncorrect(skills)

    console.log('\n=== BLAME ATTRIBUTION COMPARISON (2 skills) ===')
    console.log('\nInput:')
    console.log(`  basic.directAddition: P(known) = 0.95 (nearly mastered)`)
    console.log(`  fiveComplements.4=5-1: P(known) = 0.10 (just started)`)

    console.log('\nHeuristic (blame ∝ unknownness):')
    for (const r of heuristicResult) {
      console.log(
        `  ${r.skillId}: blame=${(r.blameWeight * 100).toFixed(1)}%, new P(known)=${(r.updatedPKnown * 100).toFixed(1)}%`
      )
    }

    console.log('\nBayesian (proper posterior):')
    for (const r of bayesianResult) {
      console.log(
        `  ${r.skillId}: blame=${(r.blameWeight * 100).toFixed(1)}%, new P(known)=${(r.updatedPKnown * 100).toFixed(1)}%`
      )
    }

    // Both should attribute more blame to the unknown skill
    const heuristicBlameToUnknown = heuristicResult.find(
      (r) => r.skillId === 'fiveComplements.4=5-1'
    )!.blameWeight
    const bayesianBlameToUnknown = bayesianResult.find(
      (r) => r.skillId === 'fiveComplements.4=5-1'
    )!.blameWeight

    expect(heuristicBlameToUnknown).toBeGreaterThan(0.5)
    expect(bayesianBlameToUnknown).toBeGreaterThan(0.5)

    // Bayesian should attribute even MORE blame to the unknown skill (more extreme)
    console.log(
      `\nBayesian attributes ${((bayesianBlameToUnknown / heuristicBlameToUnknown - 1) * 100).toFixed(1)}% more blame to unknown skill`
    )

    // Record the difference for snapshot
    expect({
      heuristic: {
        basic: {
          blame: heuristicResult[0].blameWeight,
          newPKnown: heuristicResult[0].updatedPKnown,
        },
        complement: {
          blame: heuristicResult[1].blameWeight,
          newPKnown: heuristicResult[1].updatedPKnown,
        },
      },
      bayesian: {
        basic: { blame: bayesianResult[0].blameWeight, newPKnown: bayesianResult[0].updatedPKnown },
        complement: {
          blame: bayesianResult[1].blameWeight,
          newPKnown: bayesianResult[1].updatedPKnown,
        },
      },
    }).toMatchSnapshot('stark-contrast-2-skills')
  })

  it('should handle 3-skill problems with mixed mastery levels', () => {
    // More realistic scenario with 3 skills
    const skills: SkillBktRecord[] = [
      {
        skillId: 'basic.directAddition',
        pKnown: 0.9,
        params: getDefaultParams('basic.directAddition'),
      },
      {
        skillId: 'fiveComplements.4=5-1',
        pKnown: 0.5, // Medium
        params: getDefaultParams('fiveComplements.4=5-1'),
      },
      {
        skillId: 'tenComplements.9=10-1',
        pKnown: 0.15, // Weak
        params: getDefaultParams('tenComplements.9=10-1'),
      },
    ]

    const heuristicResult = updateOnIncorrect(skills)
    const bayesianResult = bayesianUpdateOnIncorrect(skills)

    console.log('\n=== BLAME ATTRIBUTION COMPARISON (3 skills) ===')
    console.log('\nInput:')
    console.log(`  basic.directAddition: P(known) = 0.90`)
    console.log(`  fiveComplements.4=5-1: P(known) = 0.50`)
    console.log(`  tenComplements.9=10-1: P(known) = 0.15`)

    console.log('\nHeuristic:')
    for (const r of heuristicResult) {
      console.log(
        `  ${r.skillId.padEnd(25)}: blame=${(r.blameWeight * 100).toFixed(1).padStart(5)}%, new P(known)=${(r.updatedPKnown * 100).toFixed(1)}%`
      )
    }

    console.log('\nBayesian:')
    for (const r of bayesianResult) {
      console.log(
        `  ${r.skillId.padEnd(25)}: blame=${(r.blameWeight * 100).toFixed(1).padStart(5)}%, new P(known)=${(r.updatedPKnown * 100).toFixed(1)}%`
      )
    }

    expect({
      heuristic: heuristicResult.map((r) => ({
        skillId: r.skillId,
        blame: r.blameWeight,
        newPKnown: r.updatedPKnown,
      })),
      bayesian: bayesianResult.map((r) => ({
        skillId: r.skillId,
        blame: r.blameWeight,
        newPKnown: r.updatedPKnown,
      })),
    }).toMatchSnapshot('mixed-mastery-3-skills')
  })

  it('should converge when all skills have equal mastery', () => {
    // When all skills have equal P(known), both methods should give equal blame
    const skills: SkillBktRecord[] = [
      { skillId: 'skill.a', pKnown: 0.5, params: getDefaultParams('basic.directAddition') },
      { skillId: 'skill.b', pKnown: 0.5, params: getDefaultParams('basic.directAddition') },
    ]

    const heuristicResult = updateOnIncorrect(skills)
    const bayesianResult = bayesianUpdateOnIncorrect(skills)

    // Blame should be equal (50/50)
    expect(heuristicResult[0].blameWeight).toBeCloseTo(0.5, 2)
    expect(heuristicResult[1].blameWeight).toBeCloseTo(0.5, 2)
    expect(bayesianResult[0].blameWeight).toBeCloseTo(bayesianResult[1].blameWeight, 2)

    console.log('\n=== EQUAL MASTERY CASE ===')
    console.log('Both skills at P(known)=0.50')
    console.log(
      `Heuristic blame: ${(heuristicResult[0].blameWeight * 100).toFixed(1)}% / ${(heuristicResult[1].blameWeight * 100).toFixed(1)}%`
    )
    console.log(
      `Bayesian blame:  ${(bayesianResult[0].blameWeight * 100).toFixed(1)}% / ${(bayesianResult[1].blameWeight * 100).toFixed(1)}%`
    )
  })

  it('should show extreme divergence at mastery cliff', () => {
    // This is the critical case: student just mastered one skill, brand new to another
    const skills: SkillBktRecord[] = [
      {
        skillId: 'basic.directAddition',
        pKnown: 0.99, // Just mastered
        params: getDefaultParams('basic.directAddition'),
      },
      {
        skillId: 'tenComplements.1=10-9',
        pKnown: 0.01, // Never practiced
        params: getDefaultParams('tenComplements.1=10-9'),
      },
    ]

    const heuristicResult = updateOnIncorrect(skills)
    const bayesianResult = bayesianUpdateOnIncorrect(skills)

    console.log('\n=== MASTERY CLIFF CASE ===')
    console.log('P(known): 0.99 vs 0.01 (extreme contrast)')

    const heuristicBlameToNew = heuristicResult.find(
      (r) => r.skillId === 'tenComplements.1=10-9'
    )!.blameWeight
    const bayesianBlameToNew = bayesianResult.find(
      (r) => r.skillId === 'tenComplements.1=10-9'
    )!.blameWeight

    console.log(`Heuristic blame to new skill: ${(heuristicBlameToNew * 100).toFixed(1)}%`)
    console.log(`Bayesian blame to new skill:  ${(bayesianBlameToNew * 100).toFixed(1)}%`)
    console.log(
      `Difference: ${((bayesianBlameToNew - heuristicBlameToNew) * 100).toFixed(1)} percentage points`
    )

    // Bayesian should be very close to 100% blame on the new skill
    expect(bayesianBlameToNew).toBeGreaterThan(0.95)
    // Heuristic will be high but not as extreme
    expect(heuristicBlameToNew).toBeGreaterThan(0.9)

    expect({
      heuristic: {
        masteredBlame: heuristicResult[0].blameWeight,
        newBlame: heuristicResult[1].blameWeight,
      },
      bayesian: {
        masteredBlame: bayesianResult[0].blameWeight,
        newBlame: bayesianResult[1].blameWeight,
      },
    }).toMatchSnapshot('mastery-cliff-extreme')
  })
})

describe('Blame Attribution: Journey Simulation A/B', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  it('should compare heuristic vs bayesian over full learning journey', async () => {
    const testSkills = [
      'basic.directAddition',
      'basic.heavenBead',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'tenComplements.9=10-1',
      'tenComplements.8=10-2',
    ]

    const baseConfig = {
      profile: starkContrastProfile,
      sessionCount: 6,
      sessionDurationMinutes: 10,
      seed: 99999,
      practicingSkills: testSkills,
    }

    // ============ RUN WITH HEURISTIC BLAME ============
    const dbHeuristic = createEphemeralDatabase()
    setCurrentEphemeralDb(dbHeuristic.db)
    const { playerId: heuristicPlayerId } = await createTestStudent(
      dbHeuristic.db,
      'heuristic-student'
    )

    const rngHeuristic = new SeededRandom(baseConfig.seed)
    const studentHeuristic = new SimulatedStudent(baseConfig.profile, rngHeuristic)
    const runnerHeuristic = new JourneyRunner(
      dbHeuristic.db,
      studentHeuristic,
      { ...baseConfig, mode: 'adaptive', blameMethod: 'heuristic' as BlameMethod },
      rngHeuristic,
      heuristicPlayerId
    )
    const resultHeuristic = await runnerHeuristic.run()
    setCurrentEphemeralDb(null)
    dbHeuristic.cleanup()

    // ============ RUN WITH BAYESIAN BLAME ============
    const dbBayesian = createEphemeralDatabase()
    setCurrentEphemeralDb(dbBayesian.db)
    const { playerId: bayesianPlayerId } = await createTestStudent(
      dbBayesian.db,
      'bayesian-student'
    )

    const rngBayesian = new SeededRandom(baseConfig.seed)
    const studentBayesian = new SimulatedStudent(baseConfig.profile, rngBayesian)
    const runnerBayesian = new JourneyRunner(
      dbBayesian.db,
      studentBayesian,
      { ...baseConfig, mode: 'adaptive', blameMethod: 'bayesian' as BlameMethod },
      rngBayesian,
      bayesianPlayerId
    )
    const resultBayesian = await runnerBayesian.run()
    setCurrentEphemeralDb(null)
    dbBayesian.cleanup()

    // ============ ANALYZE RESULTS ============
    console.log(`\n${'='.repeat(70)}`)
    console.log('   A/B COMPARISON: HEURISTIC vs BAYESIAN BLAME ATTRIBUTION')
    console.log('='.repeat(70))

    console.log('\n--- HEURISTIC BLAME ---')
    console.log(formatJourneyResults(resultHeuristic))

    console.log('\n--- BAYESIAN BLAME ---')
    console.log(formatJourneyResults(resultBayesian))

    const heuristicAccuracies = resultHeuristic.snapshots.map((s) => s.accuracy)
    const bayesianAccuracies = resultBayesian.snapshots.map((s) => s.accuracy)

    console.log('\n--- SESSION-BY-SESSION COMPARISON ---')
    console.log('| Session | Heuristic Acc | Bayesian Acc | Diff |')
    console.log('|---------|---------------|--------------|------|')
    for (let i = 0; i < heuristicAccuracies.length; i++) {
      const diff = bayesianAccuracies[i] - heuristicAccuracies[i]
      const diffStr = diff > 0 ? `+${(diff * 100).toFixed(1)}%` : `${(diff * 100).toFixed(1)}%`
      console.log(
        `|    ${i + 1}    |     ${(heuristicAccuracies[i] * 100).toFixed(1)}%     |    ${(bayesianAccuracies[i] * 100).toFixed(1)}%    | ${diffStr.padStart(5)} |`
      )
    }

    console.log('\n--- WEAK SKILL SURFACING ---')
    console.log(`Heuristic: ${resultHeuristic.finalMetrics.weakSkillSurfacing.toFixed(2)}x`)
    console.log(`Bayesian:  ${resultBayesian.finalMetrics.weakSkillSurfacing.toFixed(2)}x`)

    // Check BKT correlation
    console.log('\n--- BKT-TRUE CORRELATION ---')
    console.log(`Heuristic: ${resultHeuristic.finalMetrics.bktCorrelation.toFixed(3)}`)
    console.log(`Bayesian:  ${resultBayesian.finalMetrics.bktCorrelation.toFixed(3)}`)

    // Capture as snapshot
    expect({
      heuristic: {
        accuracies: heuristicAccuracies.map((a) => Math.round(a * 1000) / 1000),
        finalAccuracy: heuristicAccuracies[heuristicAccuracies.length - 1],
        weakSkillSurfacing: resultHeuristic.finalMetrics.weakSkillSurfacing,
        bktCorrelation: resultHeuristic.finalMetrics.bktCorrelation,
        accuracyImprovement: resultHeuristic.finalMetrics.accuracyImprovement,
      },
      bayesian: {
        accuracies: bayesianAccuracies.map((a) => Math.round(a * 1000) / 1000),
        finalAccuracy: bayesianAccuracies[bayesianAccuracies.length - 1],
        weakSkillSurfacing: resultBayesian.finalMetrics.weakSkillSurfacing,
        bktCorrelation: resultBayesian.finalMetrics.bktCorrelation,
        accuracyImprovement: resultBayesian.finalMetrics.accuracyImprovement,
      },
    }).toMatchSnapshot('full-journey-heuristic-vs-bayesian')

    // Both should complete successfully
    expect(resultHeuristic.snapshots).toHaveLength(6)
    expect(resultBayesian.snapshots).toHaveLength(6)
  }, 180000) // 3 minute timeout
})

/**
 * Convergence Speed Results: Heuristic vs Bayesian across all learner types
 *
 * This replicates the main A/B test structure but compares blame methods
 * instead of adaptive vs classic modes.
 */
describe('Blame Attribution: Convergence Speed Results', () => {
  const testSkills = ALL_SKILLS as unknown as string[]

  const profiles = [
    { name: 'Fast Learner', profile: fastLearnerProfile },
    { name: 'Average Learner', profile: averageLearnerProfile },
    { name: 'Slow Learner', profile: slowLearnerProfile },
  ]

  it('Summary: Compare blame methods across all learner types', async () => {
    const baseConfig = {
      sessionCount: 6,
      sessionDurationMinutes: 10,
      seed: 42424,
      practicingSkills: testSkills,
      mode: 'adaptive' as const,
    }

    const results: Array<{
      name: string
      heuristicFinal: number
      bayesianFinal: number
      heuristicCorrelation: number
      bayesianCorrelation: number
      heuristicImprovement: number
      bayesianImprovement: number
    }> = []

    for (const { name, profile } of profiles) {
      // Run with heuristic blame
      const dbH = createEphemeralDatabase()
      setCurrentEphemeralDb(dbH.db)
      const { playerId: pH } = await createTestStudent(dbH.db, `${name}-heuristic`)
      const rngH = new SeededRandom(baseConfig.seed)
      const studentH = new SimulatedStudent(profile, rngH)
      const runnerH = new JourneyRunner(
        dbH.db,
        studentH,
        { ...baseConfig, profile, blameMethod: 'heuristic' as BlameMethod },
        rngH,
        pH
      )
      const resultH = await runnerH.run()
      setCurrentEphemeralDb(null)
      dbH.cleanup()

      // Run with bayesian blame
      const dbB = createEphemeralDatabase()
      setCurrentEphemeralDb(dbB.db)
      const { playerId: pB } = await createTestStudent(dbB.db, `${name}-bayesian`)
      const rngB = new SeededRandom(baseConfig.seed)
      const studentB = new SimulatedStudent(profile, rngB)
      const runnerB = new JourneyRunner(
        dbB.db,
        studentB,
        { ...baseConfig, profile, blameMethod: 'bayesian' as BlameMethod },
        rngB,
        pB
      )
      const resultB = await runnerB.run()
      setCurrentEphemeralDb(null)
      dbB.cleanup()

      results.push({
        name,
        heuristicFinal: resultH.snapshots[resultH.snapshots.length - 1].accuracy,
        bayesianFinal: resultB.snapshots[resultB.snapshots.length - 1].accuracy,
        heuristicCorrelation: resultH.finalMetrics.bktCorrelation,
        bayesianCorrelation: resultB.finalMetrics.bktCorrelation,
        heuristicImprovement: resultH.finalMetrics.accuracyImprovement,
        bayesianImprovement: resultB.finalMetrics.accuracyImprovement,
      })
    }

    // Print summary table
    console.log(`\n${'='.repeat(85)}`)
    console.log('   CONVERGENCE SPEED: HEURISTIC vs BAYESIAN BLAME ATTRIBUTION')
    console.log('='.repeat(85))
    console.log(
      '\n| Learner         | Heur Acc | Bayes Acc | Heur Corr | Bayes Corr | Heur Impr | Bayes Impr |'
    )
    console.log(
      '|-----------------|----------|-----------|-----------|------------|-----------|------------|'
    )
    for (const r of results) {
      console.log(
        `| ${r.name.padEnd(15)} | ${(r.heuristicFinal * 100).toFixed(1).padStart(6)}%  | ${(r.bayesianFinal * 100).toFixed(1).padStart(7)}%  | ${r.heuristicCorrelation.toFixed(3).padStart(9)} | ${r.bayesianCorrelation.toFixed(3).padStart(10)} | ${(r.heuristicImprovement * 100).toFixed(1).padStart(7)}%  | ${(r.bayesianImprovement * 100).toFixed(1).padStart(8)}%  |`
      )
    }

    // Calculate averages
    const avgHeuristicCorr =
      results.reduce((s, r) => s + r.heuristicCorrelation, 0) / results.length
    const avgBayesianCorr = results.reduce((s, r) => s + r.bayesianCorrelation, 0) / results.length
    const avgHeuristicImpr =
      results.reduce((s, r) => s + r.heuristicImprovement, 0) / results.length
    const avgBayesianImpr = results.reduce((s, r) => s + r.bayesianImprovement, 0) / results.length

    console.log(`\nAverage BKT Correlation:`)
    console.log(`  Heuristic: ${avgHeuristicCorr.toFixed(3)}`)
    console.log(`  Bayesian:  ${avgBayesianCorr.toFixed(3)}`)
    console.log(`  Winner:    ${avgHeuristicCorr > avgBayesianCorr ? 'Heuristic' : 'Bayesian'}`)

    console.log(`\nAverage Accuracy Improvement:`)
    console.log(`  Heuristic: ${(avgHeuristicImpr * 100).toFixed(1)}%`)
    console.log(`  Bayesian:  ${(avgBayesianImpr * 100).toFixed(1)}%`)

    // Capture as snapshot
    expect({
      summary: results.map((r) => ({
        name: r.name,
        heuristicFinal: Math.round(r.heuristicFinal * 1000) / 1000,
        bayesianFinal: Math.round(r.bayesianFinal * 1000) / 1000,
        heuristicCorrelation: Math.round(r.heuristicCorrelation * 1000) / 1000,
        bayesianCorrelation: Math.round(r.bayesianCorrelation * 1000) / 1000,
        heuristicImprovement: Math.round(r.heuristicImprovement * 1000) / 1000,
        bayesianImprovement: Math.round(r.bayesianImprovement * 1000) / 1000,
      })),
      averages: {
        heuristicCorrelation: Math.round(avgHeuristicCorr * 1000) / 1000,
        bayesianCorrelation: Math.round(avgBayesianCorr * 1000) / 1000,
        heuristicImprovement: Math.round(avgHeuristicImpr * 1000) / 1000,
        bayesianImprovement: Math.round(avgBayesianImpr * 1000) / 1000,
      },
    }).toMatchSnapshot('convergence-speed-heuristic-vs-bayesian')

    // Both methods should complete all sessions
    expect(results).toHaveLength(3)
  }, 600000) // 10 minute timeout for all profiles

  it('Multi-seed validation: Fast learner heuristic vs bayesian', async () => {
    const seeds = [42424, 12345, 99999, 77777, 55555]
    const testSkillsLocal = ALL_SKILLS as unknown as string[]

    const results: Array<{
      seed: number
      heuristicCorrelation: number
      bayesianCorrelation: number
      heuristicFinal: number
      bayesianFinal: number
    }> = []

    for (const seed of seeds) {
      const baseConfig = {
        sessionCount: 6,
        sessionDurationMinutes: 10,
        seed,
        practicingSkills: testSkillsLocal,
        mode: 'adaptive' as const,
        profile: fastLearnerProfile,
      }

      // Run with heuristic blame
      const dbH = createEphemeralDatabase()
      setCurrentEphemeralDb(dbH.db)
      const { playerId: pH } = await createTestStudent(dbH.db, `fast-heur-${seed}`)
      const rngH = new SeededRandom(seed)
      const studentH = new SimulatedStudent(fastLearnerProfile, rngH)
      const runnerH = new JourneyRunner(
        dbH.db,
        studentH,
        { ...baseConfig, blameMethod: 'heuristic' as BlameMethod },
        rngH,
        pH
      )
      const resultH = await runnerH.run()
      setCurrentEphemeralDb(null)
      dbH.cleanup()

      // Run with bayesian blame
      const dbB = createEphemeralDatabase()
      setCurrentEphemeralDb(dbB.db)
      const { playerId: pB } = await createTestStudent(dbB.db, `fast-bayes-${seed}`)
      const rngB = new SeededRandom(seed)
      const studentB = new SimulatedStudent(fastLearnerProfile, rngB)
      const runnerB = new JourneyRunner(
        dbB.db,
        studentB,
        { ...baseConfig, blameMethod: 'bayesian' as BlameMethod },
        rngB,
        pB
      )
      const resultB = await runnerB.run()
      setCurrentEphemeralDb(null)
      dbB.cleanup()

      results.push({
        seed,
        heuristicCorrelation: resultH.finalMetrics.bktCorrelation,
        bayesianCorrelation: resultB.finalMetrics.bktCorrelation,
        heuristicFinal: resultH.snapshots[resultH.snapshots.length - 1].accuracy,
        bayesianFinal: resultB.snapshots[resultB.snapshots.length - 1].accuracy,
      })
    }

    // Print results table
    console.log(`\n${'='.repeat(70)}`)
    console.log('   MULTI-SEED VALIDATION: FAST LEARNER - HEURISTIC vs BAYESIAN')
    console.log('='.repeat(70))
    console.log('\n| Seed   | Heur Corr | Bayes Corr | Diff    | Winner    |')
    console.log('|--------|-----------|------------|---------|-----------|')
    for (const r of results) {
      const diff = r.bayesianCorrelation - r.heuristicCorrelation
      const winner = diff > 0 ? 'Bayesian' : diff < 0 ? 'Heuristic' : 'Tie'
      console.log(
        `| ${r.seed.toString().padEnd(6)} | ${r.heuristicCorrelation.toFixed(3).padStart(9)} | ${r.bayesianCorrelation.toFixed(3).padStart(10)} | ${(diff > 0 ? '+' : '') + diff.toFixed(3).padStart(6)} | ${winner.padEnd(9)} |`
      )
    }

    // Calculate statistics
    const heuristicCorrs = results.map((r) => r.heuristicCorrelation)
    const bayesianCorrs = results.map((r) => r.bayesianCorrelation)
    const diffs = results.map((r) => r.bayesianCorrelation - r.heuristicCorrelation)

    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
    const std = (arr: number[]) => {
      const m = mean(arr)
      return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
    }

    const heuristicMean = mean(heuristicCorrs)
    const bayesianMean = mean(bayesianCorrs)
    const diffMean = mean(diffs)
    const diffStd = std(diffs)

    // Count wins
    const bayesianWins = diffs.filter((d) => d > 0).length
    const heuristicWins = diffs.filter((d) => d < 0).length

    console.log(`\nSummary Statistics:`)
    console.log(`  Heuristic mean correlation: ${heuristicMean.toFixed(3)}`)
    console.log(`  Bayesian mean correlation:  ${bayesianMean.toFixed(3)}`)
    console.log(
      `  Mean difference (B - H):    ${diffMean > 0 ? '+' : ''}${diffMean.toFixed(3)} ± ${diffStd.toFixed(3)}`
    )
    console.log(`  Bayesian wins: ${bayesianWins}/${seeds.length}`)
    console.log(`  Heuristic wins: ${heuristicWins}/${seeds.length}`)

    // Simple t-test significance (is mean diff significantly different from 0?)
    const tStatistic = diffMean / (diffStd / Math.sqrt(seeds.length))
    console.log(`\n  t-statistic: ${tStatistic.toFixed(3)}`)
    console.log(`  (|t| > 2.78 suggests p < 0.05 for df=4)`)

    const isSignificant = Math.abs(tStatistic) > 2.78
    console.log(
      `  Result: ${isSignificant ? 'STATISTICALLY SIGNIFICANT' : 'NOT statistically significant'}`
    )

    // Capture as snapshot
    expect({
      seeds: results.map((r) => ({
        seed: r.seed,
        heuristicCorrelation: Math.round(r.heuristicCorrelation * 1000) / 1000,
        bayesianCorrelation: Math.round(r.bayesianCorrelation * 1000) / 1000,
        difference: Math.round((r.bayesianCorrelation - r.heuristicCorrelation) * 1000) / 1000,
      })),
      statistics: {
        heuristicMean: Math.round(heuristicMean * 1000) / 1000,
        bayesianMean: Math.round(bayesianMean * 1000) / 1000,
        diffMean: Math.round(diffMean * 1000) / 1000,
        diffStd: Math.round(diffStd * 1000) / 1000,
        tStatistic: Math.round(tStatistic * 1000) / 1000,
        bayesianWins,
        heuristicWins,
        isSignificant,
      },
    }).toMatchSnapshot('multi-seed-fast-learner-validation')

    expect(results).toHaveLength(5)
  }, 900000) // 15 minute timeout for 5 seeds × 2 methods
})
