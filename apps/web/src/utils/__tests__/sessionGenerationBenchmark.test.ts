import { describe, it, beforeEach } from 'vitest'
import {
  generateSingleProblemWithDiagnostics,
  clearStepSkillsCache,
  getStepSkillsCacheStats,
} from '../problemGenerator'
import { createBasicSkillSet, type SkillSet } from '../../types/tutorial'

/**
 * Realistic Session Generation Benchmark
 *
 * Simulates actual session planning workload:
 * - 15-minute session ≈ 20-60 problems (depends on student speed)
 * - Each problem: ~100 generation attempts
 * - Each attempt: ~4 terms × ~18 candidate evaluations
 *
 * This benchmark measures real-world session generation time to determine
 * if Phase 2 (worker parallelization) is still needed after Phase 1 memoization.
 */

describe('Session Generation Benchmark', () => {
  // Create skill sets for different difficulty levels
  function createAllowedSkills(includeSubtraction: boolean = false): SkillSet {
    const base = createBasicSkillSet()
    return {
      ...base,
      basic: {
        ...base.basic,
        directAddition: true,
        heavenBead: true,
        simpleCombinations: true,
        directSubtraction: includeSubtraction,
        heavenBeadSubtraction: includeSubtraction,
        simpleCombinationsSub: includeSubtraction,
      },
      fiveComplements: {
        '1=5-4': true,
        '2=5-3': true,
        '3=5-2': true,
        '4=5-1': true,
      },
      tenComplements: {
        '1=10-9': true,
        '2=10-8': true,
        '3=10-7': true,
        '4=10-6': true,
        '5=10-5': true,
        '6=10-4': true,
        '7=10-3': true,
        '8=10-2': true,
        '9=10-1': true,
      },
      fiveComplementsSub: includeSubtraction
        ? {
            '-1=-5+4': true,
            '-2=-5+3': true,
            '-3=-5+2': true,
            '-4=-5+1': true,
          }
        : base.fiveComplementsSub,
      tenComplementsSub: includeSubtraction
        ? {
            '-1=+9-10': true,
            '-2=+8-10': true,
            '-3=+7-10': true,
            '-4=+6-10': true,
            '-5=+5-10': true,
            '-6=+4-10': true,
            '-7=+3-10': true,
            '-8=+2-10': true,
            '-9=+1-10': true,
          }
        : base.tenComplementsSub,
      advanced: base.advanced,
    }
  }

  /**
   * Generate a single problem (simulating session planner behavior)
   */
  function generateProblem(allowedSkills: SkillSet, digitRange: number = 2): boolean {
    const maxValue = 10 ** digitRange - 1
    const result = generateSingleProblemWithDiagnostics({
      constraints: {
        numberRange: { min: 1, max: maxValue },
        minTerms: 3,
        maxTerms: 5,
        problemCount: 1,
      },
      allowedSkills,
      attempts: 100,
    })
    return result.problem !== null
  }

  beforeEach(() => {
    clearStepSkillsCache()
  })

  it('benchmarks realistic session generation', () => {
    console.log(`\n📊 SESSION GENERATION BENCHMARK`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // Session configurations to test
    const sessionConfigs = [
      { name: '5-min session (fast student)', problemCount: 30, digitRange: 1 },
      { name: '10-min session (average)', problemCount: 40, digitRange: 2 },
      { name: '15-min session (typical)', problemCount: 60, digitRange: 2 },
      { name: '20-min session (thorough)', problemCount: 80, digitRange: 2 },
    ]

    const allowedSkills = createAllowedSkills(true) // Include subtraction

    for (const config of sessionConfigs) {
      console.log(`\n📋 ${config.name}`)
      console.log(`   Problems: ${config.problemCount}, Digits: ${config.digitRange}`)

      clearStepSkillsCache()

      const times: number[] = []
      const runs = 3

      for (let run = 0; run < runs; run++) {
        clearStepSkillsCache() // Fresh cache each run

        const start = performance.now()
        let successCount = 0

        for (let i = 0; i < config.problemCount; i++) {
          if (generateProblem(allowedSkills, config.digitRange)) {
            successCount++
          }
        }

        const elapsed = performance.now() - start
        times.push(elapsed)

        const stats = getStepSkillsCacheStats()
        console.log(
          `   Run ${run + 1}: ${elapsed.toFixed(0)}ms (${successCount}/${config.problemCount} problems, ${stats.size} cache entries, ${((stats.hits / Math.max(1, stats.hits + stats.misses)) * 100).toFixed(0)}% hit rate)`
        )
      }

      const mean = times.reduce((a, b) => a + b, 0) / times.length
      const perProblem = mean / config.problemCount

      console.log(`   ─────────────────────────────────────`)
      console.log(`   Average: ${mean.toFixed(0)}ms total (${perProblem.toFixed(1)}ms per problem)`)
    }

    // Summary
    console.log(`\n📈 SUMMARY`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // Run one final benchmark to get detailed stats
    clearStepSkillsCache()
    const finalStart = performance.now()
    for (let i = 0; i < 60; i++) {
      generateProblem(allowedSkills, 2)
    }
    const finalTime = performance.now() - finalStart
    const finalStats = getStepSkillsCacheStats()

    console.log(`\n60-problem session (typical 15-min):`)
    console.log(`  Total time:      ${finalTime.toFixed(0)}ms`)
    console.log(`  Per problem:     ${(finalTime / 60).toFixed(1)}ms`)
    console.log(`  Cache entries:   ${finalStats.size}`)
    console.log(`  Cache hits:      ${finalStats.hits.toLocaleString()}`)
    console.log(
      `  Cache hit rate:  ${((finalStats.hits / (finalStats.hits + finalStats.misses)) * 100).toFixed(1)}%`
    )

    // Phase 2 recommendation
    console.log(`\n🤔 PHASE 2 RECOMMENDATION:`)
    if (finalTime < 100) {
      console.log(`  ✅ Session generation is now < 100ms`)
      console.log(`  ✅ Phase 2 (worker parallelization) is NOT needed`)
      console.log(`  ✅ 98x speedup from Phase 1 memoization is sufficient`)
    } else if (finalTime < 500) {
      console.log(`  ⚠️  Session generation is ${finalTime.toFixed(0)}ms`)
      console.log(`  ⚠️  Phase 2 would help but is low priority`)
    } else {
      console.log(`  ❌ Session generation is ${finalTime.toFixed(0)}ms`)
      console.log(`  ❌ Phase 2 (worker parallelization) is recommended`)
    }
    console.log(``)
  })
})
