/**
 * @vitest-environment node
 *
 * Problem Generator Targeting Validation
 *
 * Tests whether the problem generator actually produces problems
 * with the target skills we request. This is a critical component
 * for BKT-driven adaptive learning to work.
 *
 * If targeting doesn't work reliably, adaptive mode cannot outperform classic.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { generateProblemFromConstraints } from '@/lib/curriculum/problem-generator'
import type { ProblemConstraints } from '@/db/schema/session-plans'

/**
 * Skill sets for testing
 */
const BASIC_SKILLS = ['basic.directAddition', 'basic.heavenBead', 'basic.simpleCombinations']

const FIVE_COMPLEMENT_SKILLS = [
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
]

const TEN_COMPLEMENT_SKILLS = [
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
  'tenComplements.5=10-5',
]

const ALL_TEST_SKILLS = [...BASIC_SKILLS, ...FIVE_COMPLEMENT_SKILLS, ...TEN_COMPLEMENT_SKILLS]

/**
 * Convert skill ID array to SkillSet format for constraints
 */
function skillIdsToSkillSet(skillIds: string[]): Record<string, Record<string, boolean>> {
  const skillSet: Record<string, Record<string, boolean>> = {}

  for (const skillId of skillIds) {
    const [category, skill] = skillId.split('.')
    if (!skillSet[category]) {
      skillSet[category] = {}
    }
    skillSet[category][skill] = true
  }

  return skillSet
}

/**
 * Check if generated problem uses any of the target skills
 */
function usesTargetSkill(skillsUsed: string[], targetSkillIds: string[]): boolean {
  return skillsUsed.some((skill) => targetSkillIds.includes(skill))
}

/**
 * Count how many target skills appear in the generated problem
 */
function countTargetSkills(skillsUsed: string[], targetSkillIds: string[]): number {
  return skillsUsed.filter((skill) => targetSkillIds.includes(skill)).length
}

/**
 * Run a batch of problem generations and measure targeting effectiveness
 */
function runTargetingBatch(
  allowedSkills: string[],
  targetSkills: string[] | null,
  iterations: number,
  seed: number
): {
  totalProblems: number
  problemsWithTarget: number
  targetSkillOccurrences: number
  avgTargetSkillsPerProblem: number
  targetHitRate: number
  skillDistribution: Record<string, number>
} {
  // Seed Math.random for reproducibility
  const originalRandom = Math.random
  let currentSeed = seed
  Math.random = () => {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff
    return currentSeed / 0x7fffffff
  }

  const skillDistribution: Record<string, number> = {}
  let problemsWithTarget = 0
  let targetSkillOccurrences = 0
  let successfulGenerations = 0

  const constraints: ProblemConstraints = {
    digitRange: { min: 1, max: 1 },
    termCount: { min: 2, max: 4 },
    allowedSkills: skillIdsToSkillSet(allowedSkills),
    targetSkills: targetSkills ? skillIdsToSkillSet(targetSkills) : undefined,
  }

  for (let i = 0; i < iterations; i++) {
    try {
      const problem = generateProblemFromConstraints(constraints)

      if (problem && problem.skillsRequired) {
        successfulGenerations++

        // Track skill distribution
        for (const skill of problem.skillsRequired) {
          skillDistribution[skill] = (skillDistribution[skill] || 0) + 1
        }

        // Track target skill hits
        if (targetSkills) {
          if (usesTargetSkill(problem.skillsRequired, targetSkills)) {
            problemsWithTarget++
          }
          targetSkillOccurrences += countTargetSkills(problem.skillsRequired, targetSkills)
        }
      }
    } catch {
      // Generation failed - count as 0 skills
    }
  }

  // Restore Math.random
  Math.random = originalRandom

  return {
    totalProblems: successfulGenerations,
    problemsWithTarget,
    targetSkillOccurrences,
    avgTargetSkillsPerProblem:
      successfulGenerations > 0 ? targetSkillOccurrences / successfulGenerations : 0,
    targetHitRate: successfulGenerations > 0 ? problemsWithTarget / successfulGenerations : 0,
    skillDistribution,
  }
}

describe('Problem Generator Targeting', () => {
  describe('Basic Targeting Verification', () => {
    it('should generate problems with five complement skills when targeted', () => {
      const allowedSkills = [...BASIC_SKILLS, ...FIVE_COMPLEMENT_SKILLS]
      const targetSkills = FIVE_COMPLEMENT_SKILLS

      // Run with targeting
      const withTarget = runTargetingBatch(allowedSkills, targetSkills, 100, 12345)

      // Run without targeting (same allowed skills)
      const withoutTarget = runTargetingBatch(allowedSkills, null, 100, 12345)

      console.log('\n--- Five Complement Targeting ---')
      console.log(`With targeting:    ${(withTarget.targetHitRate * 100).toFixed(1)}% hit rate`)
      console.log(`Without targeting: ${(withoutTarget.targetHitRate * 100).toFixed(1)}% hit rate`)
      console.log(
        `Improvement: ${((withTarget.targetHitRate - withoutTarget.targetHitRate) * 100).toFixed(1)}pp`
      )

      // Targeting should improve hit rate
      expect(withTarget.targetHitRate).toBeGreaterThan(withoutTarget.targetHitRate)
    })

    it('should generate problems with ten complement skills when targeted', () => {
      const allowedSkills = [...BASIC_SKILLS, ...TEN_COMPLEMENT_SKILLS]
      const targetSkills = TEN_COMPLEMENT_SKILLS

      const withTarget = runTargetingBatch(allowedSkills, targetSkills, 100, 54321)
      const withoutTarget = runTargetingBatch(allowedSkills, null, 100, 54321)

      console.log('\n--- Ten Complement Targeting ---')
      console.log(`With targeting:    ${(withTarget.targetHitRate * 100).toFixed(1)}% hit rate`)
      console.log(`Without targeting: ${(withoutTarget.targetHitRate * 100).toFixed(1)}% hit rate`)
      console.log(
        `Improvement: ${((withTarget.targetHitRate - withoutTarget.targetHitRate) * 100).toFixed(1)}pp`
      )

      expect(withTarget.targetHitRate).toBeGreaterThan(withoutTarget.targetHitRate)
    })
  })

  describe('Large-Scale A/B Testing', () => {
    it('should show statistically significant targeting improvement across many seeds', () => {
      const allowedSkills = [...BASIC_SKILLS, ...FIVE_COMPLEMENT_SKILLS]
      const targetSkills = ['fiveComplements.4=5-1', 'fiveComplements.3=5-2'] // Specific weak skills

      const seeds = [11111, 22222, 33333, 44444, 55555, 66666, 77777, 88888, 99999, 10101]
      const iterationsPerSeed = 50

      let totalWithTarget = 0
      let totalWithoutTarget = 0
      let hitsWithTarget = 0
      let hitsWithoutTarget = 0

      console.log('\n' + '='.repeat(70))
      console.log('    LARGE-SCALE A/B TEST: PROBLEM GENERATOR TARGETING')
      console.log('='.repeat(70))
      console.log(`\nTarget skills: ${targetSkills.join(', ')}`)
      console.log(`Allowed skills: ${allowedSkills.length} total`)
      console.log(`Seeds: ${seeds.length}, Iterations per seed: ${iterationsPerSeed}`)
      console.log(`Total problems: ${seeds.length * iterationsPerSeed * 2}\n`)

      console.log('Seed      With Target    Without Target    Diff')
      console.log('-'.repeat(55))

      for (const seed of seeds) {
        const withTarget = runTargetingBatch(allowedSkills, targetSkills, iterationsPerSeed, seed)
        const withoutTarget = runTargetingBatch(allowedSkills, null, iterationsPerSeed, seed)

        totalWithTarget += withTarget.totalProblems
        totalWithoutTarget += withoutTarget.totalProblems
        hitsWithTarget += withTarget.problemsWithTarget
        hitsWithoutTarget += withoutTarget.problemsWithTarget

        // Count hits without target using same target skill check
        let withoutTargetHits = 0
        for (const skill of targetSkills) {
          withoutTargetHits += withoutTarget.skillDistribution[skill] || 0
        }

        const withRate = (withTarget.targetHitRate * 100).toFixed(1)
        const withoutRate = ((withoutTargetHits / withoutTarget.totalProblems) * 100).toFixed(1)
        const diff = (
          withTarget.targetHitRate * 100 -
          (withoutTargetHits / withoutTarget.totalProblems) * 100
        ).toFixed(1)

        console.log(
          `${seed.toString().padEnd(10)}${withRate.padStart(5)}%          ${withoutRate.padStart(5)}%            ${diff.padStart(6)}pp`
        )
      }

      const overallWithRate = hitsWithTarget / totalWithTarget

      console.log('-'.repeat(55))
      console.log(`\nOVERALL: With targeting: ${(overallWithRate * 100).toFixed(1)}%`)
      console.log(`Total problems generated: ${totalWithTarget + totalWithoutTarget}`)

      // With targeting should have significantly higher hit rate
      expect(overallWithRate).toBeGreaterThan(0.5) // At least 50% should hit target
    })

    it('should compare targeting effectiveness for different skill combinations', () => {
      const scenarios = [
        {
          name: 'Basic + 5comp → target 5comp',
          allowed: [...BASIC_SKILLS, ...FIVE_COMPLEMENT_SKILLS],
          target: FIVE_COMPLEMENT_SKILLS,
        },
        {
          name: 'Basic + 10comp → target 10comp',
          allowed: [...BASIC_SKILLS, ...TEN_COMPLEMENT_SKILLS],
          target: TEN_COMPLEMENT_SKILLS,
        },
        {
          name: 'All skills → target 5comp',
          allowed: ALL_TEST_SKILLS,
          target: FIVE_COMPLEMENT_SKILLS,
        },
        {
          name: 'All skills → target 10comp',
          allowed: ALL_TEST_SKILLS,
          target: TEN_COMPLEMENT_SKILLS,
        },
        {
          name: 'Basic + 5comp → target single skill',
          allowed: [...BASIC_SKILLS, ...FIVE_COMPLEMENT_SKILLS],
          target: ['fiveComplements.4=5-1'],
        },
      ]

      console.log('\n' + '='.repeat(80))
      console.log('    TARGETING EFFECTIVENESS BY SCENARIO')
      console.log('='.repeat(80) + '\n')

      console.log('Scenario                                    With      Without   Δ       Effect')
      console.log('-'.repeat(80))

      const results: Array<{
        name: string
        withRate: number
        withoutRate: number
        delta: number
      }> = []

      for (const scenario of scenarios) {
        const withTarget = runTargetingBatch(scenario.allowed, scenario.target, 200, 42424)
        const withoutTarget = runTargetingBatch(scenario.allowed, null, 200, 42424)

        // Calculate without-target hit rate for the same target skills
        let withoutHits = 0
        for (const skill of scenario.target) {
          withoutHits += withoutTarget.skillDistribution[skill] || 0
        }
        // Count problems that have at least one target skill
        const withoutProblemsWithTarget = Object.entries(withoutTarget.skillDistribution)
          .filter(([skill]) => scenario.target.includes(skill))
          .reduce((sum, [, count]) => sum + count, 0)

        // More accurate: regenerate and count properly
        const withoutTargetProblems = runTargetingBatchWithTargetCheck(
          scenario.allowed,
          null,
          scenario.target,
          200,
          42424
        )

        const withRate = withTarget.targetHitRate
        const withoutRate = withoutTargetProblems.targetHitRate
        const delta = withRate - withoutRate

        results.push({ name: scenario.name, withRate, withoutRate, delta })

        const effect =
          delta > 0.1 ? 'STRONG' : delta > 0.05 ? 'MODERATE' : delta > 0 ? 'WEAK' : 'NONE'

        const diffSign = delta * 100 >= 0 ? '+' : ''
        const line = `${scenario.name.padEnd(44)}${(withRate * 100).toFixed(1).padStart(5)}%    ${(withoutRate * 100).toFixed(1).padStart(5)}%    ${diffSign}${(delta * 100).toFixed(1).padStart(5)}pp  ${effect}`
        console.log(line)
      }

      console.log('-'.repeat(80))

      // All scenarios should show positive delta
      const positiveDeltas = results.filter((r) => r.delta > 0).length
      console.log(`\n${positiveDeltas}/${results.length} scenarios showed targeting improvement`)

      expect(positiveDeltas).toBe(results.length)
    })
  })

  describe('Targeting Reliability by Seed', () => {
    it('should show consistent targeting across 100 different seeds', () => {
      const allowedSkills = [...BASIC_SKILLS, ...FIVE_COMPLEMENT_SKILLS]
      const targetSkills = ['fiveComplements.4=5-1', 'fiveComplements.3=5-2']

      const numSeeds = 100
      const iterationsPerSeed = 20

      const withTargetRates: number[] = []
      const withoutTargetRates: number[] = []

      console.log('\n' + '='.repeat(70))
      console.log('    TARGETING CONSISTENCY ACROSS 100 SEEDS')
      console.log('='.repeat(70))

      for (let i = 0; i < numSeeds; i++) {
        const seed = 10000 + i * 7919 // Prime multiplier for spread

        const withTarget = runTargetingBatch(allowedSkills, targetSkills, iterationsPerSeed, seed)
        const withoutTarget = runTargetingBatchWithTargetCheck(
          allowedSkills,
          null,
          targetSkills,
          iterationsPerSeed,
          seed
        )

        withTargetRates.push(withTarget.targetHitRate)
        withoutTargetRates.push(withoutTarget.targetHitRate)
      }

      // Calculate statistics
      const avgWith = withTargetRates.reduce((a, b) => a + b, 0) / numSeeds
      const avgWithout = withoutTargetRates.reduce((a, b) => a + b, 0) / numSeeds
      const minWith = Math.min(...withTargetRates)
      const maxWith = Math.max(...withTargetRates)
      const minWithout = Math.min(...withoutTargetRates)
      const maxWithout = Math.max(...withoutTargetRates)

      // Standard deviation
      const stdWith = Math.sqrt(
        withTargetRates.reduce((sum, r) => sum + (r - avgWith) ** 2, 0) / numSeeds
      )
      const stdWithout = Math.sqrt(
        withoutTargetRates.reduce((sum, r) => sum + (r - avgWithout) ** 2, 0) / numSeeds
      )

      console.log(`\nWith Targeting:`)
      console.log(`  Mean: ${(avgWith * 100).toFixed(1)}%`)
      console.log(`  Std:  ${(stdWith * 100).toFixed(1)}%`)
      console.log(`  Min:  ${(minWith * 100).toFixed(1)}%`)
      console.log(`  Max:  ${(maxWith * 100).toFixed(1)}%`)

      console.log(`\nWithout Targeting:`)
      console.log(`  Mean: ${(avgWithout * 100).toFixed(1)}%`)
      console.log(`  Std:  ${(stdWithout * 100).toFixed(1)}%`)
      console.log(`  Min:  ${(minWithout * 100).toFixed(1)}%`)
      console.log(`  Max:  ${(maxWithout * 100).toFixed(1)}%`)

      console.log(`\nDifference:`)
      console.log(`  Mean improvement: ${((avgWith - avgWithout) * 100).toFixed(1)}pp`)
      console.log(`  Effect size: ${((avgWith - avgWithout) / stdWithout).toFixed(2)} std devs`)

      // Count wins
      const targetingWins = withTargetRates.filter((r, i) => r > withoutTargetRates[i]).length
      const targetingLosses = withTargetRates.filter((r, i) => r < withoutTargetRates[i]).length
      const ties = numSeeds - targetingWins - targetingLosses

      console.log(`\nHead-to-head:`)
      console.log(`  Targeting wins:  ${targetingWins}`)
      console.log(`  Targeting loses: ${targetingLosses}`)
      console.log(`  Ties:            ${ties}`)
      console.log(`  Win rate:        ${((targetingWins / numSeeds) * 100).toFixed(1)}%`)

      // Targeting should win majority of the time
      expect(targetingWins).toBeGreaterThan(targetingLosses)
      expect(avgWith).toBeGreaterThan(avgWithout)
    }, 60000)
  })
})

/**
 * Run batch but check for target skills even when not targeting
 * (to measure baseline occurrence rate)
 */
function runTargetingBatchWithTargetCheck(
  allowedSkills: string[],
  targetSkills: string[] | null,
  checkSkills: string[],
  iterations: number,
  seed: number
): ReturnType<typeof runTargetingBatch> {
  const originalRandom = Math.random
  let currentSeed = seed
  Math.random = () => {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff
    return currentSeed / 0x7fffffff
  }

  const skillDistribution: Record<string, number> = {}
  let problemsWithTarget = 0
  let targetSkillOccurrences = 0
  let successfulGenerations = 0

  const constraints: ProblemConstraints = {
    digitRange: { min: 1, max: 1 },
    termCount: { min: 2, max: 4 },
    allowedSkills: skillIdsToSkillSet(allowedSkills),
    targetSkills: targetSkills ? skillIdsToSkillSet(targetSkills) : undefined,
  }

  for (let i = 0; i < iterations; i++) {
    try {
      const problem = generateProblemFromConstraints(constraints)

      if (problem && problem.skillsRequired) {
        successfulGenerations++

        for (const skill of problem.skillsRequired) {
          skillDistribution[skill] = (skillDistribution[skill] || 0) + 1
        }

        // Check against checkSkills (not targetSkills)
        if (usesTargetSkill(problem.skillsRequired, checkSkills)) {
          problemsWithTarget++
        }
        targetSkillOccurrences += countTargetSkills(problem.skillsRequired, checkSkills)
      }
    } catch {
      // Generation failed
    }
  }

  Math.random = originalRandom

  return {
    totalProblems: successfulGenerations,
    problemsWithTarget,
    targetSkillOccurrences,
    avgTargetSkillsPerProblem:
      successfulGenerations > 0 ? targetSkillOccurrences / successfulGenerations : 0,
    targetHitRate: successfulGenerations > 0 ? problemsWithTarget / successfulGenerations : 0,
    skillDistribution,
  }
}
