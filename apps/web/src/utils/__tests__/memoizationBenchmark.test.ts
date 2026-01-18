import { describe, it, beforeEach } from 'vitest'
import {
  analyzeStepSkills,
  analyzeStepSkillsMemoized,
  clearStepSkillsCache,
  getStepSkillsCacheStats,
} from '../problemGenerator'

/**
 * A/B Performance Benchmark: Memoized vs Non-memoized skill analysis
 *
 * This test simulates the real problem generation workload and measures
 * the performance difference between memoized and non-memoized approaches.
 */

describe('A/B Performance Benchmark', () => {
  // Generate a realistic workload that mimics problem generation
  function generateWorkload(): Array<{ currentValue: number; term: number }> {
    const operations: Array<{ currentValue: number; term: number }> = []

    // Simulate 60 problems × 100 attempts × 4 terms × 18 candidates
    // = 432,000 calls in worst case
    // We'll use a scaled version: 20 problems × 50 attempts × 4 terms × 18 candidates
    // = 72,000 calls

    const PROBLEMS = 20
    const ATTEMPTS_PER_PROBLEM = 50
    const TERMS_PER_PROBLEM = 4
    const CANDIDATES_PER_TERM = 18 // 9 additions + 9 subtractions

    for (let problem = 0; problem < PROBLEMS; problem++) {
      for (let attempt = 0; attempt < ATTEMPTS_PER_PROBLEM; attempt++) {
        let accumulator = 0

        for (let termIndex = 0; termIndex < TERMS_PER_PROBLEM; termIndex++) {
          // For each position, evaluate all candidate terms (like the real code does)
          for (let candidate = 1; candidate <= 9; candidate++) {
            // Try addition
            operations.push({ currentValue: accumulator, term: candidate })

            // Try subtraction (if valid)
            if (accumulator >= candidate) {
              operations.push({ currentValue: accumulator, term: -candidate })
            }
          }

          // Pick a random term to advance the accumulator (simulating selection)
          const selectedTerm = (termIndex % 9) + 1
          accumulator += selectedTerm
        }
      }
    }

    return operations
  }

  it('compares memoized vs non-memoized performance', () => {
    const workload = generateWorkload()
    console.log(`\n📊 A/B PERFORMANCE BENCHMARK`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Workload: ${workload.length.toLocaleString()} operations`)
    console.log(``)

    // Warmup both paths
    console.log(`⏳ Warming up...`)
    for (let i = 0; i < 100; i++) {
      analyzeStepSkills(i % 50, (i % 9) + 1, (i % 50) + (i % 9) + 1)
      clearStepSkillsCache()
      analyzeStepSkillsMemoized(i % 50, (i % 9) + 1, (i % 50) + (i % 9) + 1)
    }
    clearStepSkillsCache()

    // ============= NON-MEMOIZED (Baseline) =============
    console.log(`\n🐢 Testing NON-MEMOIZED (baseline)...`)
    const nonMemoizedTimes: number[] = []

    for (let run = 0; run < 3; run++) {
      const start = performance.now()
      for (const { currentValue, term } of workload) {
        analyzeStepSkills(currentValue, term, currentValue + term)
      }
      const elapsed = performance.now() - start
      nonMemoizedTimes.push(elapsed)
      console.log(`  Run ${run + 1}: ${elapsed.toFixed(1)}ms`)
    }

    const nonMemoizedMean = nonMemoizedTimes.reduce((a, b) => a + b, 0) / nonMemoizedTimes.length

    // ============= MEMOIZED =============
    console.log(`\n🚀 Testing MEMOIZED...`)
    const memoizedTimes: number[] = []

    for (let run = 0; run < 3; run++) {
      clearStepSkillsCache() // Start fresh each run
      const start = performance.now()
      for (const { currentValue, term } of workload) {
        analyzeStepSkillsMemoized(currentValue, term, currentValue + term)
      }
      const elapsed = performance.now() - start
      memoizedTimes.push(elapsed)

      const stats = getStepSkillsCacheStats()
      console.log(
        `  Run ${run + 1}: ${elapsed.toFixed(1)}ms (${stats.size} entries, ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}% hit rate)`
      )
    }

    const memoizedMean = memoizedTimes.reduce((a, b) => a + b, 0) / memoizedTimes.length

    // ============= RESULTS =============
    const speedup = nonMemoizedMean / memoizedMean
    const savings = nonMemoizedMean - memoizedMean
    const savingsPercent = (savings / nonMemoizedMean) * 100

    console.log(`\n📈 RESULTS`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(``)
    console.log(`NON-MEMOIZED: ${nonMemoizedMean.toFixed(1)}ms average`)
    console.log(`MEMOIZED:     ${memoizedMean.toFixed(1)}ms average`)
    console.log(``)
    console.log(`🎯 SPEEDUP: ${speedup.toFixed(1)}x faster`)
    console.log(`💰 SAVINGS: ${savings.toFixed(0)}ms (${savingsPercent.toFixed(0)}% reduction)`)
    console.log(``)

    // Get final cache stats
    clearStepSkillsCache()
    for (const { currentValue, term } of workload) {
      analyzeStepSkillsMemoized(currentValue, term, currentValue + term)
    }
    const finalStats = getStepSkillsCacheStats()
    console.log(`📦 CACHE EFFICIENCY:`)
    console.log(`   Unique states: ${finalStats.size.toLocaleString()}`)
    console.log(`   Cache hits:    ${finalStats.hits.toLocaleString()}`)
    console.log(`   Cache misses:  ${finalStats.misses.toLocaleString()}`)
    console.log(
      `   Hit rate:      ${((finalStats.hits / (finalStats.hits + finalStats.misses)) * 100).toFixed(1)}%`
    )
    console.log(
      `   Ops per entry: ${(workload.length / finalStats.size).toFixed(1)} (reuse factor)`
    )
    console.log(``)
  })
})
