/**
 * Skill Difficulty Model Tests
 *
 * Tests that validate the skill-specific difficulty multipliers in the
 * SimulatedStudent model. Uses snapshots to capture learning curves
 * and detect changes in model behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './EphemeralDatabase'
import { JourneyRunner } from './JourneyRunner'
import { SeededRandom } from './SeededRandom'
import { getTrueMultiplier, SimulatedStudent } from './SimulatedStudent'
import type { JourneyConfig, JourneyResult, StudentProfile } from './types'

// Mock the @/db module to use our ephemeral database
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

// =============================================================================
// Test Constants
// =============================================================================

/** Standard profile for consistent testing */
const STANDARD_PROFILE: StudentProfile = {
  name: 'Standard Test Profile',
  description: 'Baseline profile for skill difficulty testing',
  halfMaxExposure: 10, // Base K=10, multiplied by skill difficulty
  hillCoefficient: 2.0, // Standard curve shape
  initialExposures: {}, // Start from scratch
  helpUsageProbabilities: [1.0, 0], // No help for clean measurements
  helpBonuses: [0, 0],
  baseResponseTimeMs: 5000,
  responseTimeVariance: 0.3,
}

/** Representative skills from each category */
const TEST_SKILLS = {
  basic: ['basic.directAddition', 'basic.heavenBead', 'basic.directSubtraction'],
  fiveComplement: ['fiveComplements.4=5-1', 'fiveComplements.3=5-2', 'fiveComplements.1=5-4'],
  tenComplement: [
    'tenComplements.9=10-1',
    'tenComplements.6=10-4',
    'tenComplements.1=10-9', // Hardest
  ],
} as const

// =============================================================================
// Proposal A: Learning Trajectory by Skill Category
// =============================================================================

describe('Learning Trajectory by Skill Category', () => {
  it('should show basic skills mastering faster than complements', () => {
    const rng = new SeededRandom(42)
    const student = new SimulatedStudent(STANDARD_PROFILE, rng)

    // Track exposures needed to reach 80% for each skill
    const exposuresToMastery: Record<string, number> = {}

    for (const category of Object.keys(TEST_SKILLS) as Array<keyof typeof TEST_SKILLS>) {
      for (const skillId of TEST_SKILLS[category]) {
        student.ensureSkillTracked(skillId)

        // Simulate exposures until 80% mastery
        let exposures = 0
        while (student.getTrueProbability(skillId) < 0.8 && exposures < 100) {
          // Manually increment exposure (simulating practice)
          const currentExp = student.getExposure(skillId)
          // Use reflection to set exposure directly for clean measurement
          ;(student as unknown as { skillExposures: Map<string, number> }).skillExposures.set(
            skillId,
            currentExp + 1
          )
          exposures++
        }

        exposuresToMastery[skillId] = exposures
      }
    }

    // Calculate category averages
    const categoryAverages = {
      basic: average(TEST_SKILLS.basic.map((s) => exposuresToMastery[s])),
      fiveComplement: average(TEST_SKILLS.fiveComplement.map((s) => exposuresToMastery[s])),
      tenComplement: average(TEST_SKILLS.tenComplement.map((s) => exposuresToMastery[s])),
    }

    // Snapshot the results
    expect({
      exposuresToMastery,
      categoryAverages,
      ordering: {
        basicFasterThanFive: categoryAverages.basic < categoryAverages.fiveComplement,
        fiveFasterThanTen: categoryAverages.fiveComplement < categoryAverages.tenComplement,
      },
    }).toMatchSnapshot('learning-trajectory-by-category')

    // Assertions
    expect(categoryAverages.basic).toBeLessThan(categoryAverages.fiveComplement)
    expect(categoryAverages.fiveComplement).toBeLessThan(categoryAverages.tenComplement)
  })
})

// =============================================================================
// Proposal B: A/B Test - With vs Without Skill Difficulty
// =============================================================================

describe('A/B Test: Skill Difficulty Impact', () => {
  it('should show different learning curves with vs without difficulty multipliers', () => {
    const exposurePoints = [5, 10, 15, 20, 25, 30, 40, 50]

    // With skill difficulty (current model)
    const withDifficulty = measureLearningCurves(exposurePoints, true)

    // Without skill difficulty (all multipliers = 1.0)
    const withoutDifficulty = measureLearningCurves(exposurePoints, false)

    // Calculate differences
    const differences: Record<string, number[]> = {}
    for (const skillId of Object.keys(withDifficulty.curves)) {
      differences[skillId] = withDifficulty.curves[skillId].map(
        (p, i) => withoutDifficulty.curves[skillId][i] - p
      )
    }

    expect({
      withDifficulty: withDifficulty.curves,
      withoutDifficulty: withoutDifficulty.curves,
      differences,
      summary: {
        withDifficulty: withDifficulty.summary,
        withoutDifficulty: withoutDifficulty.summary,
      },
    }).toMatchSnapshot('skill-difficulty-ab-comparison')

    // Verify that difficulty multipliers create differentiation
    // With difficulty: ten-complements should lag behind basic
    const tenCompAt20 = withDifficulty.curves['tenComplements.9=10-1'][3] // index 3 = 20 exposures
    const basicAt20 = withDifficulty.curves['basic.directAddition'][3]
    expect(basicAt20).toBeGreaterThan(tenCompAt20)

    // Without difficulty: all skills should be identical
    const tenCompAt20NoDiff = withoutDifficulty.curves['tenComplements.9=10-1'][3]
    const basicAt20NoDiff = withoutDifficulty.curves['basic.directAddition'][3]
    expect(basicAt20NoDiff).toBeCloseTo(tenCompAt20NoDiff, 1) // Should be equal
  })
})

// =============================================================================
// Proposal C: Skill Category Mastery Curves (Table Format)
// =============================================================================

describe('Skill Category Mastery Curves', () => {
  it('should produce expected mastery curves at key exposure points', () => {
    const rng = new SeededRandom(42)
    const student = new SimulatedStudent(STANDARD_PROFILE, rng)

    const exposurePoints = [0, 5, 10, 15, 20, 30, 40, 50]
    const representativeSkills = {
      'basic.directAddition': 'Basic (0.8x)',
      'fiveComplements.4=5-1': 'Five-Comp (1.2x)',
      'tenComplements.9=10-1': 'Ten-Comp Easy (1.6x)',
      'tenComplements.1=10-9': 'Ten-Comp Hard (2.0x)',
    }

    // Build the mastery table
    const masteryTable: Record<string, Record<number, string>> = {}

    for (const [skillId, label] of Object.entries(representativeSkills)) {
      masteryTable[label] = {}
      student.ensureSkillTracked(skillId)

      for (const exposure of exposurePoints) {
        // Set exposure directly
        ;(student as unknown as { skillExposures: Map<string, number> }).skillExposures.set(
          skillId,
          exposure
        )
        const prob = student.getTrueProbability(skillId)
        masteryTable[label][exposure] = `${(prob * 100).toFixed(0)}%`
      }
    }

    // Format as readable table for snapshot
    const tableRows = exposurePoints.map((exp) => ({
      exposures: exp,
      ...Object.fromEntries(
        Object.entries(masteryTable).map(([label, probs]) => [label, probs[exp]])
      ),
    }))

    expect({
      table: tableRows,
      description:
        'P(correct) at each exposure level, showing how skill difficulty affects learning speed',
    }).toMatchSnapshot('mastery-curves-table')
  })

  it('should show consistent ratios between skill categories', () => {
    const rng = new SeededRandom(42)
    const student = new SimulatedStudent(STANDARD_PROFILE, rng)

    // At what exposure does each skill reach 50%?
    const exposuresFor50Percent: Record<string, number> = {}

    const skills = [
      'basic.directAddition', // 0.8x multiplier
      'fiveComplements.4=5-1', // 1.2x multiplier
      'tenComplements.9=10-1', // 1.6x multiplier
      'tenComplements.1=10-9', // 2.0x multiplier
    ]

    for (const skillId of skills) {
      student.ensureSkillTracked(skillId)

      // Binary search for 50% threshold
      let low = 0
      let high = 50
      while (high - low > 0.5) {
        const mid = (low + high) / 2
        ;(student as unknown as { skillExposures: Map<string, number> }).skillExposures.set(
          skillId,
          mid
        )
        const prob = student.getTrueProbability(skillId)
        if (prob < 0.5) {
          low = mid
        } else {
          high = mid
        }
      }
      exposuresFor50Percent[skillId] = Math.round((low + high) / 2)
    }

    // Calculate ratios relative to basic skill
    const basicExp = exposuresFor50Percent['basic.directAddition']
    const ratios = Object.fromEntries(
      Object.entries(exposuresFor50Percent).map(([skill, exp]) => [
        skill,
        (exp / basicExp).toFixed(2),
      ])
    )

    expect({
      exposuresFor50Percent,
      ratiosRelativeToBasic: ratios,
    }).toMatchSnapshot('fifty-percent-threshold-ratios')
  })
})

// =============================================================================
// Proposal D: Validation Against Real Learning Expectations
// =============================================================================

describe('Validation Against Learning Expectations', () => {
  it('should match expected mastery levels at key milestones', () => {
    const rng = new SeededRandom(42)
    const student = new SimulatedStudent(STANDARD_PROFILE, rng)

    const skills = {
      basic: 'basic.directAddition',
      fiveComp: 'fiveComplements.4=5-1',
      tenCompEasy: 'tenComplements.9=10-1',
      tenCompHard: 'tenComplements.1=10-9',
    }

    for (const skillId of Object.values(skills)) {
      student.ensureSkillTracked(skillId)
    }

    // Set 20 exposures for all skills
    for (const skillId of Object.values(skills)) {
      ;(student as unknown as { skillExposures: Map<string, number> }).skillExposures.set(
        skillId,
        20
      )
    }

    const probsAt20 = {
      basic: student.getTrueProbability(skills.basic),
      fiveComp: student.getTrueProbability(skills.fiveComp),
      tenCompEasy: student.getTrueProbability(skills.tenCompEasy),
      tenCompHard: student.getTrueProbability(skills.tenCompHard),
    }

    // After 20 exposures:
    // - Basic skills (K=8) should be >60% (actually ~86%)
    // - Ten-complement hard (K=20) should be <60% (actually 50%)
    expect(probsAt20.basic).toBeGreaterThan(0.6)
    expect(probsAt20.tenCompHard).toBeLessThan(0.6)

    // The gap between easiest and hardest should be significant
    const gap = probsAt20.basic - probsAt20.tenCompHard
    expect(gap).toBeGreaterThan(0.2) // At least 20 percentage points

    // Snapshot all expectations
    expect({
      at20Exposures: {
        basic: `${(probsAt20.basic * 100).toFixed(1)}%`,
        fiveComp: `${(probsAt20.fiveComp * 100).toFixed(1)}%`,
        tenCompEasy: `${(probsAt20.tenCompEasy * 100).toFixed(1)}%`,
        tenCompHard: `${(probsAt20.tenCompHard * 100).toFixed(1)}%`,
      },
      gapBetweenEasiestAndHardest: `${(gap * 100).toFixed(1)} percentage points`,
      assertions: {
        basicAbove60Percent: probsAt20.basic > 0.6,
        tenCompHardBelow60Percent: probsAt20.tenCompHard < 0.6,
        gapAtLeast20Points: gap > 0.2,
      },
    }).toMatchSnapshot('learning-expectations-validation')
  })

  it('should require ~2x more exposures for ten-complement vs basic to reach same mastery', () => {
    const rng = new SeededRandom(42)
    const student = new SimulatedStudent(STANDARD_PROFILE, rng)

    const basicSkill = 'basic.directAddition' // 0.8x multiplier → K=8
    const tenCompSkill = 'tenComplements.9=10-1' // 1.6x multiplier → K=16

    student.ensureSkillTracked(basicSkill)
    student.ensureSkillTracked(tenCompSkill)

    // Find exposures needed for 70% mastery
    const findExposuresFor = (skillId: string, targetProb: number): number => {
      for (let exp = 1; exp <= 100; exp++) {
        ;(student as unknown as { skillExposures: Map<string, number> }).skillExposures.set(
          skillId,
          exp
        )
        if (student.getTrueProbability(skillId) >= targetProb) {
          return exp
        }
      }
      return 100
    }

    const basicExposuresFor70 = findExposuresFor(basicSkill, 0.7)
    const tenCompExposuresFor70 = findExposuresFor(tenCompSkill, 0.7)
    const ratio = tenCompExposuresFor70 / basicExposuresFor70

    expect({
      targetMastery: '70%',
      basicExposures: basicExposuresFor70,
      tenCompExposures: tenCompExposuresFor70,
      ratio: ratio.toFixed(2),
      ratioMatchesMultiplierRatio: Math.abs(ratio - 1.6 / 0.8) < 0.5, // ~2.0
    }).toMatchSnapshot('exposure-ratio-for-equal-mastery')

    // The ratio should be close to the multiplier ratio (1.6/0.8 = 2.0)
    expect(ratio).toBeGreaterThan(1.5)
    expect(ratio).toBeLessThan(2.5)
  })
})

// =============================================================================
// Fatigue Multiplier Tests
// =============================================================================

describe('Fatigue Multipliers', () => {
  it('should return correct multipliers for probability ranges', () => {
    const testCases = [
      { prob: 0.95, expected: 1.0 },
      { prob: 0.9, expected: 1.0 },
      { prob: 0.85, expected: 1.5 },
      { prob: 0.7, expected: 1.5 },
      { prob: 0.6, expected: 2.0 },
      { prob: 0.5, expected: 2.0 },
      { prob: 0.4, expected: 3.0 },
      { prob: 0.3, expected: 3.0 },
      { prob: 0.2, expected: 4.0 },
      { prob: 0.1, expected: 4.0 },
    ]

    const results = testCases.map(({ prob, expected }) => ({
      probability: `${(prob * 100).toFixed(0)}%`,
      expectedMultiplier: expected,
      actualMultiplier: getTrueMultiplier(prob),
      matches: getTrueMultiplier(prob) === expected,
    }))

    expect(results).toMatchSnapshot('fatigue-multipliers')

    for (const { prob, expected } of testCases) {
      expect(getTrueMultiplier(prob)).toBe(expected)
    }
  })
})

// =============================================================================
// Proposal E: A/B Mastery Trajectories (Session-by-Session)
// =============================================================================

/**
 * A/B Mastery Trajectories Test
 *
 * Runs Adaptive vs Classic comparisons for multiple deficient skills and
 * captures session-by-session mastery progression in snapshots.
 * This data is used by the blog post charts.
 */
describe('A/B Mastery Trajectories', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  it('should capture mastery trajectories for multiple deficient skills', async () => {
    // Skills to test - each represents a different difficulty category
    const deficientSkills = [
      'fiveComplements.3=5-2', // Medium difficulty
      'fiveComplementsSub.-3=-5+2', // Medium difficulty (subtraction variant)
      'tenComplements.9=10-1', // Hard (but easier ten-comp)
      'tenComplements.5=10-5', // Hard (middle ten-comp)
      'tenComplementsSub.-9=+1-10', // Very hard (subtraction)
      'tenComplementsSub.-5=+5-10', // Very hard (subtraction)
    ]

    // All skills the student can practice (deficient + mastered prerequisites)
    const allSkills = [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.directSubtraction',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplementsSub.-4=-5+1',
      'fiveComplementsSub.-3=-5+2',
      'tenComplements.9=10-1',
      'tenComplements.5=10-5',
      'tenComplementsSub.-9=+1-10',
      'tenComplementsSub.-5=+5-10',
    ]

    // Create profiles where the student has mastered prerequisites but not the target skill
    const createDeficientProfile = (deficientSkillId: string): StudentProfile => ({
      name: `Deficient in ${deficientSkillId}`,
      description: `Student who missed lessons on ${deficientSkillId}`,
      halfMaxExposure: 10,
      hillCoefficient: 2.0,
      // Pre-seed all skills EXCEPT the deficient one
      initialExposures: Object.fromEntries(
        allSkills.filter((s) => s !== deficientSkillId).map((s) => [s, 25]) // 25 exposures = ~86% mastery for basic, ~73% for five-comp
      ),
      helpUsageProbabilities: [0.7, 0.3], // 70% no help, 30% uses help
      helpBonuses: [0, 0.25], // Help bonus when used
      baseResponseTimeMs: 5000,
      responseTimeVariance: 0.3,
    })

    const trajectories: Record<
      string,
      {
        adaptive: { session: number; mastery: number }[]
        classic: { session: number; mastery: number }[]
        sessionsTo50Adaptive: number | null
        sessionsTo50Classic: number | null
        sessionsTo80Adaptive: number | null
        sessionsTo80Classic: number | null
      }
    > = {}

    const sessionConfig = {
      sessionCount: 12,
      sessionDurationMinutes: 15,
      seed: 98765,
      practicingSkills: allSkills,
    }

    for (const deficientSkillId of deficientSkills) {
      const profile = createDeficientProfile(deficientSkillId)

      // Run adaptive mode
      const adaptiveResult = await runJourney(ephemeralDb, {
        ...sessionConfig,
        profile,
        mode: 'adaptive',
      })

      // Run classic mode (same seed for fair comparison)
      const classicResult = await runJourney(ephemeralDb, {
        ...sessionConfig,
        profile,
        mode: 'classic',
      })

      // Extract mastery trajectory for the deficient skill
      const adaptiveTrajectory = extractSkillTrajectory(adaptiveResult, deficientSkillId)
      const classicTrajectory = extractSkillTrajectory(classicResult, deficientSkillId)

      trajectories[deficientSkillId] = {
        adaptive: adaptiveTrajectory,
        classic: classicTrajectory,
        sessionsTo50Adaptive: findSessionForMastery(adaptiveTrajectory, 0.5),
        sessionsTo50Classic: findSessionForMastery(classicTrajectory, 0.5),
        sessionsTo80Adaptive: findSessionForMastery(adaptiveTrajectory, 0.8),
        sessionsTo80Classic: findSessionForMastery(classicTrajectory, 0.8),
      }
    }

    // Compute summary statistics
    const summary = {
      skills: deficientSkills,
      adaptiveWins50: 0,
      classicWins50: 0,
      adaptiveWins80: 0,
      classicWins80: 0,
      ties50: 0,
      ties80: 0,
    }

    for (const skillId of deficientSkills) {
      const t = trajectories[skillId]

      // 50% comparison
      if (t.sessionsTo50Adaptive !== null && t.sessionsTo50Classic !== null) {
        if (t.sessionsTo50Adaptive < t.sessionsTo50Classic) summary.adaptiveWins50++
        else if (t.sessionsTo50Adaptive > t.sessionsTo50Classic) summary.classicWins50++
        else summary.ties50++
      } else if (t.sessionsTo50Adaptive !== null) {
        summary.adaptiveWins50++
      } else if (t.sessionsTo50Classic !== null) {
        summary.classicWins50++
      }

      // 80% comparison
      if (t.sessionsTo80Adaptive !== null && t.sessionsTo80Classic !== null) {
        if (t.sessionsTo80Adaptive < t.sessionsTo80Classic) summary.adaptiveWins80++
        else if (t.sessionsTo80Adaptive > t.sessionsTo80Classic) summary.classicWins80++
        else summary.ties80++
      } else if (t.sessionsTo80Adaptive !== null) {
        summary.adaptiveWins80++
      } else if (t.sessionsTo80Classic !== null) {
        summary.classicWins80++
      }
    }

    // Snapshot the full trajectory data
    expect({
      trajectories,
      summary,
      config: {
        sessionCount: sessionConfig.sessionCount,
        sessionDurationMinutes: sessionConfig.sessionDurationMinutes,
        seed: sessionConfig.seed,
      },
    }).toMatchSnapshot('ab-mastery-trajectories')

    // Adaptive should generally outperform classic
    expect(summary.adaptiveWins50 + summary.adaptiveWins80).toBeGreaterThan(
      summary.classicWins50 + summary.classicWins80
    )
  }, 300000) // 5 minute timeout for multiple simulations
})

/** Run a journey simulation and return results */
async function runJourney(
  ephemeralDb: EphemeralDbResult,
  config: JourneyConfig
): Promise<JourneyResult> {
  const suffix = `${config.mode}-${config.seed}-${Date.now()}`
  const { playerId } = await createTestStudent(ephemeralDb.db, `student-${suffix}`)

  const rng = new SeededRandom(config.seed)
  const student = new SimulatedStudent(config.profile, rng)
  const runner = new JourneyRunner(ephemeralDb.db, student, config, rng, playerId)

  return runner.run()
}

/** Extract mastery trajectory for a specific skill from journey results */
function extractSkillTrajectory(
  result: JourneyResult,
  skillId: string
): { session: number; mastery: number }[] {
  return result.snapshots.map((snapshot) => ({
    session: snapshot.sessionNumber,
    mastery: Math.round((snapshot.trueSkillProbabilities.get(skillId) ?? 0) * 100) / 100,
  }))
}

/** Find the first session where mastery reaches or exceeds threshold */
function findSessionForMastery(
  trajectory: { session: number; mastery: number }[],
  threshold: number
): number | null {
  for (const point of trajectory) {
    if (point.mastery >= threshold) {
      return point.session
    }
  }
  return null
}

// =============================================================================
// Helper Functions
// =============================================================================

function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Measure learning curves for representative skills.
 *
 * @param exposurePoints - Array of exposure counts to measure
 * @param useDifficulty - If false, bypasses skill difficulty multipliers
 */
function measureLearningCurves(
  exposurePoints: number[],
  useDifficulty: boolean
): {
  curves: Record<string, number[]>
  summary: Record<string, { avgAt20: number }>
} {
  const skills = [
    'basic.directAddition',
    'fiveComplements.4=5-1',
    'tenComplements.9=10-1',
    'tenComplements.1=10-9',
  ]

  const curves: Record<string, number[]> = {}
  const summary: Record<string, { avgAt20: number }> = {}

  // Use different K values based on difficulty flag
  const profile: StudentProfile = {
    ...STANDARD_PROFILE,
    halfMaxExposure: useDifficulty ? 10 : 10,
  }

  const rng = new SeededRandom(42)
  const student = new SimulatedStudent(profile, rng)

  for (const skillId of skills) {
    student.ensureSkillTracked(skillId)
    curves[skillId] = []

    for (const exposure of exposurePoints) {
      ;(student as unknown as { skillExposures: Map<string, number> }).skillExposures.set(
        skillId,
        exposure
      )

      let prob: number
      if (useDifficulty) {
        // Use normal getTrueProbability (includes difficulty multiplier)
        prob = student.getTrueProbability(skillId)
      } else {
        // Calculate without difficulty multiplier
        // P = exposure^n / (K^n + exposure^n) with K=10 for all
        const K = profile.halfMaxExposure
        const n = profile.hillCoefficient
        prob = exposure === 0 ? 0 : exposure ** n / (K ** n + exposure ** n)
      }

      curves[skillId].push(Math.round(prob * 100) / 100)
    }

    // Summary stat: probability at 20 exposures
    const idx20 = exposurePoints.indexOf(20)
    summary[skillId] = { avgAt20: idx20 >= 0 ? curves[skillId][idx20] : 0 }
  }

  return { curves, summary }
}
