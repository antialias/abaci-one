/**
 * @vitest-environment node
 *
 * Comprehensive A/B Test: Per-Skill Deficiency Profiles
 *
 * Tests BKT-driven adaptive mode vs classic mode across ALL 32 abacus skills.
 * Each test creates a student deficient in ONE specific skill, with all
 * prerequisites mastered.
 *
 * Configuration (4x the previous test):
 * - 24 sessions per journey (was 6)
 * - 40 minutes per session (was 10) → ~48 problems per session
 * - Total: ~1,152 problems per journey
 *
 * This provides statistical power to detect if BKT correctly identifies
 * and targets the specific deficient skill.
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
import {
  generateDeficientProfile,
  getPracticingSkillsForDeficiency,
  getRepresentativeProfilesAllLearners,
  LEARNER_TYPES,
  type LearnerType,
  SKILL_ORDER,
} from './profiles'
import { formatJourneyResults } from './reporters'
import { SeededRandom } from './SeededRandom'
import { SimulatedStudent } from './SimulatedStudent'
import type { JourneyConfig } from './types'

// Mock the @/db module to use our ephemeral database
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

// Test configuration
const COMPREHENSIVE_CONFIG = {
  sessionCount: 24, // 4x previous (was 6)
  sessionDurationMinutes: 40, // 4x previous (was 10) → ~48 problems
  seed: 54321,
}

// Quick test configuration (for development)
const QUICK_CONFIG = {
  sessionCount: 12,
  sessionDurationMinutes: 20, // ~24 problems
  seed: 54321,
}

describe('Comprehensive A/B Test: Per-Skill Deficiency', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  describe('Representative Skills - All Learner Types (Quick)', () => {
    // 10 representative skills × 3 learner types = 30 profiles
    const representativeProfiles = getRepresentativeProfilesAllLearners()

    for (const { skillId, learnerType, profile, practicingSkills } of representativeProfiles) {
      it(`[${learnerType}] ${skillId}: Adaptive should identify and target deficiency`, async () => {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, '-')
        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `adaptive-${learnerType}-${skillSlug}`
        )
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `classic-${learnerType}-${skillSlug}`
        )

        const baseConfig = {
          ...QUICK_CONFIG,
          practicingSkills,
        }

        // Run adaptive mode
        const adaptiveConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: 'adaptive',
        }

        const adaptiveRng = new SeededRandom(baseConfig.seed)
        const adaptiveStudent = new SimulatedStudent(profile, adaptiveRng)
        const adaptiveRunner = new JourneyRunner(
          ephemeralDb.db,
          adaptiveStudent,
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId
        )
        const adaptiveResult = await adaptiveRunner.run()

        // Run classic mode (same seed for fair comparison)
        const classicConfig: JourneyConfig = {
          ...baseConfig,
          profile,
          mode: 'classic',
        }

        const classicRng = new SeededRandom(baseConfig.seed)
        const classicStudent = new SimulatedStudent(profile, classicRng)
        const classicRunner = new JourneyRunner(
          ephemeralDb.db,
          classicStudent,
          classicConfig,
          classicRng,
          classicPlayerId
        )
        const classicResult = await classicRunner.run()

        // Output results
        console.log(`\n${'='.repeat(70)}`)
        console.log(`SKILL: ${skillId} | LEARNER: ${learnerType}`)
        console.log(`${'='.repeat(70)}`)
        console.log('\n--- ADAPTIVE ---')
        console.log(formatJourneyResults(adaptiveResult))
        console.log('\n--- CLASSIC ---')
        console.log(formatJourneyResults(classicResult))

        // Compare final accuracy
        const adaptiveFinal = adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1].accuracy
        const classicFinal = classicResult.snapshots[classicResult.snapshots.length - 1].accuracy

        console.log(`\n--- COMPARISON ---`)
        console.log(`Adaptive final accuracy: ${(adaptiveFinal * 100).toFixed(1)}%`)
        console.log(`Classic final accuracy:  ${(classicFinal * 100).toFixed(1)}%`)
        console.log(
          `Winner: ${adaptiveFinal > classicFinal ? 'ADAPTIVE' : adaptiveFinal < classicFinal ? 'CLASSIC' : 'TIE'}`
        )

        // Check if BKT identified the deficient skill
        const lastSnapshot = adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1]
        const deficientSkillBkt = lastSnapshot.bktEstimates.get(skillId)

        if (deficientSkillBkt) {
          console.log(`\nBKT estimate for deficient skill (${skillId}):`)
          console.log(`  P(known): ${(deficientSkillBkt.pKnown * 100).toFixed(1)}%`)
          console.log(`  Confidence: ${deficientSkillBkt.confidence.toFixed(2)}`)
        }

        // Verify results are different (modes are working)
        const adaptiveAccuracies = adaptiveResult.snapshots.map((s) => s.accuracy)
        const classicAccuracies = classicResult.snapshots.map((s) => s.accuracy)
        const accuracyDiffs = adaptiveAccuracies.map((a, i) => Math.abs(a - classicAccuracies[i]))
        const totalDiff = accuracyDiffs.reduce((sum, d) => sum + d, 0)

        // Modes should produce different trajectories (unless identical by chance)
        if (totalDiff === 0) {
          console.log('⚠️ WARNING: Identical trajectories - modes may not be differentiating')
        }
      }, 300000) // 5 minute timeout per skill
    }
  })

  describe('Summary: All Learner Types Comparison', () => {
    it('should output aggregate comparison across all learner types and representative skills', async () => {
      // 10 representative skills × 3 learner types = 30 profiles
      const representativeProfiles = getRepresentativeProfilesAllLearners()
      const results: Array<{
        skillId: string
        learnerType: LearnerType
        adaptiveFinal: number
        classicFinal: number
        winner: 'adaptive' | 'classic' | 'tie'
      }> = []

      for (const { skillId, learnerType, profile, practicingSkills } of representativeProfiles) {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, '-')
        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `sum-adaptive-${learnerType}-${skillSlug}`
        )
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `sum-classic-${learnerType}-${skillSlug}`
        )

        const baseConfig = {
          ...QUICK_CONFIG,
          practicingSkills,
        }

        // Adaptive
        const adaptiveConfig: JourneyConfig = { ...baseConfig, profile, mode: 'adaptive' }
        const adaptiveRng = new SeededRandom(baseConfig.seed)
        const adaptiveResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, adaptiveRng),
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId
        ).run()

        // Classic
        const classicConfig: JourneyConfig = { ...baseConfig, profile, mode: 'classic' }
        const classicRng = new SeededRandom(baseConfig.seed)
        const classicResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, classicRng),
          classicConfig,
          classicRng,
          classicPlayerId
        ).run()

        const adaptiveFinal = adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1].accuracy
        const classicFinal = classicResult.snapshots[classicResult.snapshots.length - 1].accuracy

        results.push({
          skillId,
          learnerType,
          adaptiveFinal,
          classicFinal,
          winner:
            adaptiveFinal > classicFinal
              ? 'adaptive'
              : adaptiveFinal < classicFinal
                ? 'classic'
                : 'tie',
        })
      }

      // Output summary table
      console.log(`\n${'='.repeat(90)}`)
      console.log('AGGREGATE SUMMARY: All Learner Types × Representative Skills')
      console.log('='.repeat(90))
      console.log('\n| Learner  | Skill ID                       | Adaptive | Classic | Winner   |')
      console.log('|----------|--------------------------------|----------|---------|----------|')

      for (const r of results) {
        console.log(
          `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${(r.adaptiveFinal * 100).toFixed(1).padStart(6)}% | ${(r.classicFinal * 100).toFixed(1).padStart(5)}% | ${r.winner.padEnd(8)} |`
        )
      }

      const adaptiveWins = results.filter((r) => r.winner === 'adaptive').length
      const classicWins = results.filter((r) => r.winner === 'classic').length
      const ties = results.filter((r) => r.winner === 'tie').length

      // Group by learner type
      const byLearner = {
        fast: results.filter((r) => r.learnerType === 'fast'),
        average: results.filter((r) => r.learnerType === 'average'),
        slow: results.filter((r) => r.learnerType === 'slow'),
      }

      console.log('\n--- TOTALS ---')
      console.log(
        `Total: Adaptive wins: ${adaptiveWins}, Classic wins: ${classicWins}, Ties: ${ties}`
      )

      for (const [type, typeResults] of Object.entries(byLearner)) {
        const aWins = typeResults.filter((r) => r.winner === 'adaptive').length
        const cWins = typeResults.filter((r) => r.winner === 'classic').length
        const tWins = typeResults.filter((r) => r.winner === 'tie').length
        console.log(
          `${type.padEnd(8)}: Adaptive wins: ${aWins}, Classic wins: ${cWins}, Ties: ${tWins}`
        )
      }

      // BKT should help in majority of cases
      expect(adaptiveWins).toBeGreaterThanOrEqual(classicWins)
    }, 1200000) // 20 minute timeout for summary (30 profiles now)
  })

  describe('Per-Skill Assessment Comparison', () => {
    it('should show adaptive gives more exposure to deficient skill', async () => {
      // Test a subset of profiles with per-skill assessment
      const testProfiles = getRepresentativeProfilesAllLearners().slice(0, 15) // First 15 for speed
      const results: Array<{
        skillId: string
        learnerType: LearnerType
        adaptiveExposure: number
        classicExposure: number
        adaptiveTrueProb: number
        classicTrueProb: number
        adaptiveAssessment: number
        classicAssessment: number
        exposureWinner: 'adaptive' | 'classic' | 'tie'
        masteryWinner: 'adaptive' | 'classic' | 'tie'
      }> = []

      for (const { skillId, learnerType, profile, practicingSkills } of testProfiles) {
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, '-')
        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `assess-adaptive-${learnerType}-${skillSlug}`
        )
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `assess-classic-${learnerType}-${skillSlug}`
        )

        const baseConfig = {
          ...QUICK_CONFIG,
          practicingSkills,
        }

        // Run adaptive mode
        const adaptiveConfig: JourneyConfig = { ...baseConfig, profile, mode: 'adaptive' }
        const adaptiveRng = new SeededRandom(baseConfig.seed)
        const adaptiveStudent = new SimulatedStudent(profile, adaptiveRng)
        await new JourneyRunner(
          ephemeralDb.db,
          adaptiveStudent,
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId
        ).run()

        // Run classic mode
        const classicConfig: JourneyConfig = { ...baseConfig, profile, mode: 'classic' }
        const classicRng = new SeededRandom(baseConfig.seed)
        const classicStudent = new SimulatedStudent(profile, classicRng)
        await new JourneyRunner(
          ephemeralDb.db,
          classicStudent,
          classicConfig,
          classicRng,
          classicPlayerId
        ).run()

        // Assess the DEFICIENT skill specifically (no learning during assessment)
        const adaptiveAssessment = adaptiveStudent.assessSkill(skillId, 50)
        const classicAssessment = classicStudent.assessSkill(skillId, 50)

        const exposureWinner =
          adaptiveAssessment.exposure > classicAssessment.exposure
            ? 'adaptive'
            : adaptiveAssessment.exposure < classicAssessment.exposure
              ? 'classic'
              : 'tie'

        const masteryWinner =
          adaptiveAssessment.trueProbability > classicAssessment.trueProbability
            ? 'adaptive'
            : adaptiveAssessment.trueProbability < classicAssessment.trueProbability
              ? 'classic'
              : 'tie'

        results.push({
          skillId,
          learnerType,
          adaptiveExposure: adaptiveAssessment.exposure,
          classicExposure: classicAssessment.exposure,
          adaptiveTrueProb: adaptiveAssessment.trueProbability,
          classicTrueProb: classicAssessment.trueProbability,
          adaptiveAssessment: adaptiveAssessment.assessedAccuracy,
          classicAssessment: classicAssessment.assessedAccuracy,
          exposureWinner,
          masteryWinner,
        })
      }

      // Output per-skill assessment table
      console.log(`\n${'='.repeat(120)}`)
      console.log('PER-SKILL ASSESSMENT: Deficient Skill Exposure & Mastery')
      console.log('='.repeat(120))
      console.log(
        '\n| Learner  | Deficient Skill                | A.Exp | C.Exp | Exp Win  | A.P(k) | C.P(k) | Mastery Win |'
      )
      console.log(
        '|----------|--------------------------------|-------|-------|----------|--------|--------|-------------|'
      )

      for (const r of results) {
        console.log(
          `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${String(r.adaptiveExposure).padStart(5)} | ${String(r.classicExposure).padStart(5)} | ${r.exposureWinner.padEnd(8)} | ${(r.adaptiveTrueProb * 100).toFixed(0).padStart(5)}% | ${(r.classicTrueProb * 100).toFixed(0).padStart(5)}% | ${r.masteryWinner.padEnd(11)} |`
        )
      }

      // Statistics
      const exposureAdaptiveWins = results.filter((r) => r.exposureWinner === 'adaptive').length
      const exposureClassicWins = results.filter((r) => r.exposureWinner === 'classic').length
      const exposureTies = results.filter((r) => r.exposureWinner === 'tie').length

      const masteryAdaptiveWins = results.filter((r) => r.masteryWinner === 'adaptive').length
      const masteryClassicWins = results.filter((r) => r.masteryWinner === 'classic').length
      const masteryTies = results.filter((r) => r.masteryWinner === 'tie').length

      const avgAdaptiveExposure =
        results.reduce((sum, r) => sum + r.adaptiveExposure, 0) / results.length
      const avgClassicExposure =
        results.reduce((sum, r) => sum + r.classicExposure, 0) / results.length

      const avgAdaptiveMastery =
        results.reduce((sum, r) => sum + r.adaptiveTrueProb, 0) / results.length
      const avgClassicMastery =
        results.reduce((sum, r) => sum + r.classicTrueProb, 0) / results.length

      console.log(`\n${'='.repeat(60)}`)
      console.log('TOTALS')
      console.log('='.repeat(60))
      console.log(
        `\nExposure: Adaptive wins: ${exposureAdaptiveWins}, Classic wins: ${exposureClassicWins}, Ties: ${exposureTies}`
      )
      console.log(
        `Mastery:  Adaptive wins: ${masteryAdaptiveWins}, Classic wins: ${masteryClassicWins}, Ties: ${masteryTies}`
      )
      console.log(
        `\nAvg Deficient Skill Exposure: Adaptive=${avgAdaptiveExposure.toFixed(1)}, Classic=${avgClassicExposure.toFixed(1)}`
      )
      console.log(
        `Avg Deficient Skill Mastery:  Adaptive=${(avgAdaptiveMastery * 100).toFixed(1)}%, Classic=${(avgClassicMastery * 100).toFixed(1)}%`
      )

      // Adaptive should give MORE exposure to the deficient skill
      expect(exposureAdaptiveWins).toBeGreaterThanOrEqual(exposureClassicWins)
    }, 1200000)
  })
})

/**
 * Full comprehensive test (run separately due to time)
 *
 * This tests ALL 32 skills × 3 learner types = 96 profiles with full configuration.
 * Each profile runs adaptive vs classic = 192 total journeys.
 *
 * Run with: npx vitest run comprehensive-ab-test.test.ts --testNamePattern="Full 32-Skill"
 */
describe('Full 32-Skill A/B Test - All Learner Types', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  const learnerTypes: LearnerType[] = ['fast', 'average', 'slow']

  for (const learnerType of learnerTypes) {
    describe(`${LEARNER_TYPES[learnerType].name}`, () => {
      for (const skillId of SKILL_ORDER) {
        it(`[${learnerType}] ${skillId}: Comprehensive comparison`, async () => {
          const profile = generateDeficientProfile(skillId, learnerType)
          const practicingSkills = getPracticingSkillsForDeficiency(skillId)
          const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, '-')

          const { playerId: adaptivePlayerId } = await createTestStudent(
            ephemeralDb.db,
            `full-adaptive-${learnerType}-${skillSlug}`
          )
          const { playerId: classicPlayerId } = await createTestStudent(
            ephemeralDb.db,
            `full-classic-${learnerType}-${skillSlug}`
          )

          const baseConfig = {
            ...COMPREHENSIVE_CONFIG,
            practicingSkills,
          }

          // Adaptive
          const adaptiveConfig: JourneyConfig = { ...baseConfig, profile, mode: 'adaptive' }
          const adaptiveRng = new SeededRandom(baseConfig.seed)
          const adaptiveResult = await new JourneyRunner(
            ephemeralDb.db,
            new SimulatedStudent(profile, adaptiveRng),
            adaptiveConfig,
            adaptiveRng,
            adaptivePlayerId
          ).run()

          // Classic
          const classicConfig: JourneyConfig = { ...baseConfig, profile, mode: 'classic' }
          const classicRng = new SeededRandom(baseConfig.seed)
          const classicResult = await new JourneyRunner(
            ephemeralDb.db,
            new SimulatedStudent(profile, classicRng),
            classicConfig,
            classicRng,
            classicPlayerId
          ).run()

          const adaptiveFinal =
            adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1].accuracy
          const classicFinal = classicResult.snapshots[classicResult.snapshots.length - 1].accuracy
          const winner =
            adaptiveFinal > classicFinal
              ? 'ADAPTIVE'
              : adaptiveFinal < classicFinal
                ? 'CLASSIC'
                : 'TIE'

          console.log(
            `[${learnerType}] ${skillId}: Adaptive=${(adaptiveFinal * 100).toFixed(1)}% Classic=${(classicFinal * 100).toFixed(1)}% → ${winner}`
          )
        }, 600000) // 10 minute timeout per skill
      }
    })
  }
})

/**
 * Aggregate Summary Test
 *
 * Runs ALL 96 profiles and produces a comprehensive summary table.
 * Run with: npx vitest run comprehensive-ab-test.test.ts --testNamePattern="Aggregate Summary"
 */
describe('Aggregate Summary: Full 32-Skill × 3 Learner Types', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  it('should output comprehensive comparison across all skills and learner types', async () => {
    const learnerTypes: LearnerType[] = ['fast', 'average', 'slow']
    const results: Array<{
      skillId: string
      learnerType: LearnerType
      adaptiveFinal: number
      classicFinal: number
      winner: 'adaptive' | 'classic' | 'tie'
    }> = []

    let completed = 0
    const total = SKILL_ORDER.length * learnerTypes.length

    for (const learnerType of learnerTypes) {
      for (const skillId of SKILL_ORDER) {
        const profile = generateDeficientProfile(skillId, learnerType)
        const practicingSkills = getPracticingSkillsForDeficiency(skillId)
        const skillSlug = skillId.replace(/[^a-zA-Z0-9]/g, '-')

        const { playerId: adaptivePlayerId } = await createTestStudent(
          ephemeralDb.db,
          `agg-adaptive-${learnerType}-${skillSlug}`
        )
        const { playerId: classicPlayerId } = await createTestStudent(
          ephemeralDb.db,
          `agg-classic-${learnerType}-${skillSlug}`
        )

        const baseConfig = {
          ...COMPREHENSIVE_CONFIG,
          practicingSkills,
        }

        // Adaptive
        const adaptiveConfig: JourneyConfig = { ...baseConfig, profile, mode: 'adaptive' }
        const adaptiveRng = new SeededRandom(baseConfig.seed)
        const adaptiveResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, adaptiveRng),
          adaptiveConfig,
          adaptiveRng,
          adaptivePlayerId
        ).run()

        // Classic
        const classicConfig: JourneyConfig = { ...baseConfig, profile, mode: 'classic' }
        const classicRng = new SeededRandom(baseConfig.seed)
        const classicResult = await new JourneyRunner(
          ephemeralDb.db,
          new SimulatedStudent(profile, classicRng),
          classicConfig,
          classicRng,
          classicPlayerId
        ).run()

        const adaptiveFinal = adaptiveResult.snapshots[adaptiveResult.snapshots.length - 1].accuracy
        const classicFinal = classicResult.snapshots[classicResult.snapshots.length - 1].accuracy

        results.push({
          skillId,
          learnerType,
          adaptiveFinal,
          classicFinal,
          winner:
            adaptiveFinal > classicFinal
              ? 'adaptive'
              : adaptiveFinal < classicFinal
                ? 'classic'
                : 'tie',
        })

        completed++
        console.log(`Progress: ${completed}/${total} (${((completed / total) * 100).toFixed(1)}%)`)
      }
    }

    // Output comprehensive summary table
    console.log(`\n${'='.repeat(100)}`)
    console.log('COMPREHENSIVE SUMMARY: 32 Skills × 3 Learner Types = 96 Profiles')
    console.log('='.repeat(100))
    console.log(
      '\n| Learner  | Skill ID                       | Adaptive | Classic | Diff   | Winner   |'
    )
    console.log(
      '|----------|--------------------------------|----------|---------|--------|----------|'
    )

    for (const r of results) {
      const diff = ((r.adaptiveFinal - r.classicFinal) * 100).toFixed(1)
      const diffStr = r.adaptiveFinal >= r.classicFinal ? `+${diff}%` : `${diff}%`
      console.log(
        `| ${r.learnerType.padEnd(8)} | ${r.skillId.padEnd(30)} | ${(r.adaptiveFinal * 100).toFixed(1).padStart(6)}% | ${(r.classicFinal * 100).toFixed(1).padStart(5)}% | ${diffStr.padStart(6)} | ${r.winner.padEnd(8)} |`
      )
    }

    // Statistics
    const adaptiveWins = results.filter((r) => r.winner === 'adaptive').length
    const classicWins = results.filter((r) => r.winner === 'classic').length
    const ties = results.filter((r) => r.winner === 'tie').length

    // Group by learner type
    const byLearner = {
      fast: results.filter((r) => r.learnerType === 'fast'),
      average: results.filter((r) => r.learnerType === 'average'),
      slow: results.filter((r) => r.learnerType === 'slow'),
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log('TOTALS')
    console.log('='.repeat(60))
    console.log(
      `\nOverall: Adaptive wins: ${adaptiveWins}, Classic wins: ${classicWins}, Ties: ${ties}`
    )
    console.log(
      `Win rate: Adaptive ${((adaptiveWins / results.length) * 100).toFixed(1)}%, Classic ${((classicWins / results.length) * 100).toFixed(1)}%`
    )

    console.log('\nBy Learner Type:')
    for (const [type, typeResults] of Object.entries(byLearner)) {
      const aWins = typeResults.filter((r) => r.winner === 'adaptive').length
      const cWins = typeResults.filter((r) => r.winner === 'classic').length
      const tWins = typeResults.filter((r) => r.winner === 'tie').length
      const avgAdaptive =
        typeResults.reduce((sum, r) => sum + r.adaptiveFinal, 0) / typeResults.length
      const avgClassic =
        typeResults.reduce((sum, r) => sum + r.classicFinal, 0) / typeResults.length
      console.log(
        `  ${type.padEnd(8)}: Adaptive wins: ${aWins}, Classic wins: ${cWins}, Ties: ${tWins} | Avg: Adaptive ${(avgAdaptive * 100).toFixed(1)}%, Classic ${(avgClassic * 100).toFixed(1)}%`
      )
    }

    // BKT should help in majority of cases
    expect(adaptiveWins).toBeGreaterThanOrEqual(classicWins)
  }, 7200000) // 2 hour timeout for full comprehensive test (96 profiles)
})
