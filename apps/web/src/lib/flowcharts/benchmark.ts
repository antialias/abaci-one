/**
 * Benchmark script for comparing example generation performance.
 *
 * Usage: Import and call runBenchmark() from browser console or a test page.
 */

import type { ExecutableFlowchart } from './schema'
import type { GenerationConstraints } from './loader'
import { generateDiverseExamples, DEFAULT_CONSTRAINTS } from './loader'
import { generateExamplesAsync } from './example-generator-client'

interface BenchmarkResult {
  method: string
  runs: number
  times: number[]
  mean: number
  median: number
  min: number
  max: number
  stdDev: number
}

function calculateStats(times: number[]): Omit<BenchmarkResult, 'method' | 'runs' | 'times'> {
  const sorted = [...times].sort((a, b) => a - b)
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length
  const stdDev = Math.sqrt(variance)

  return { mean, median, min, max, stdDev }
}

/**
 * Run benchmark comparing sync vs parallel generation
 */
export async function runBenchmark(
  flowchart: ExecutableFlowchart,
  options: {
    runs?: number
    count?: number
    constraints?: GenerationConstraints
    warmupRuns?: number
  } = {}
): Promise<{ sync: BenchmarkResult; parallel: BenchmarkResult; speedup: number }> {
  const { runs = 5, count = 100, constraints = DEFAULT_CONSTRAINTS, warmupRuns = 1 } = options

  console.log(`\n🎲 Example Generation Benchmark`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Flowchart: ${flowchart.definition.title}`)
  console.log(`Runs: ${runs} (+ ${warmupRuns} warmup)`)
  console.log(`Example count: ${count}`)
  console.log(`CPU cores: ${navigator.hardwareConcurrency}`)
  console.log(``)

  // Warmup runs (not counted)
  console.log(`⏳ Warming up...`)
  for (let i = 0; i < warmupRuns; i++) {
    generateDiverseExamples(flowchart, count, constraints)
    await generateExamplesAsync(flowchart, count, constraints)
  }

  // Benchmark synchronous version
  console.log(`\n📊 Testing SYNC (main thread)...`)
  const syncTimes: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    generateDiverseExamples(flowchart, count, constraints)
    const elapsed = performance.now() - start
    syncTimes.push(elapsed)
    console.log(`  Run ${i + 1}: ${elapsed.toFixed(1)}ms`)
  }

  // Benchmark parallel version
  console.log(
    `\n📊 Testing PARALLEL (${Math.min(navigator.hardwareConcurrency - 1, 6)} workers)...`
  )
  const parallelTimes: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    await generateExamplesAsync(flowchart, count, constraints)
    const elapsed = performance.now() - start
    parallelTimes.push(elapsed)
    console.log(`  Run ${i + 1}: ${elapsed.toFixed(1)}ms`)
  }

  // Calculate results
  const syncResult: BenchmarkResult = {
    method: 'sync (main thread)',
    runs,
    times: syncTimes,
    ...calculateStats(syncTimes),
  }

  const parallelResult: BenchmarkResult = {
    method: 'parallel (workers)',
    runs,
    times: parallelTimes,
    ...calculateStats(parallelTimes),
  }

  const speedup = syncResult.mean / parallelResult.mean

  // Print summary
  console.log(`\n📈 RESULTS`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(``)
  console.log(`SYNC (main thread):`)
  console.log(`  Mean:   ${syncResult.mean.toFixed(1)}ms`)
  console.log(`  Median: ${syncResult.median.toFixed(1)}ms`)
  console.log(`  Range:  ${syncResult.min.toFixed(1)}ms - ${syncResult.max.toFixed(1)}ms`)
  console.log(`  StdDev: ${syncResult.stdDev.toFixed(1)}ms`)
  console.log(``)
  console.log(`PARALLEL (${Math.min(navigator.hardwareConcurrency - 1, 6)} workers):`)
  console.log(`  Mean:   ${parallelResult.mean.toFixed(1)}ms`)
  console.log(`  Median: ${parallelResult.median.toFixed(1)}ms`)
  console.log(`  Range:  ${parallelResult.min.toFixed(1)}ms - ${parallelResult.max.toFixed(1)}ms`)
  console.log(`  StdDev: ${parallelResult.stdDev.toFixed(1)}ms`)
  console.log(``)
  console.log(`🚀 SPEEDUP: ${speedup.toFixed(2)}x faster`)
  console.log(`   (${syncResult.mean.toFixed(0)}ms → ${parallelResult.mean.toFixed(0)}ms)`)
  console.log(``)

  return { sync: syncResult, parallel: parallelResult, speedup }
}

/**
 * Quick benchmark with default settings
 */
export async function quickBenchmark(flowchart: ExecutableFlowchart): Promise<number> {
  const result = await runBenchmark(flowchart, { runs: 3, warmupRuns: 1 })
  return result.speedup
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  const w = window as Window & {
    runExampleBenchmark?: typeof runBenchmark
    quickExampleBenchmark?: typeof quickBenchmark
  }
  w.runExampleBenchmark = runBenchmark
  w.quickExampleBenchmark = quickBenchmark
}
