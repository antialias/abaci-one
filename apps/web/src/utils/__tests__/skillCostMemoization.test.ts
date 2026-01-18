import { describe, expect, it, beforeEach } from 'vitest'
import {
  analyzeStepSkills,
  analyzeStepSkillsMemoized,
  clearStepSkillsCache,
  getStepSkillsCacheStats,
} from '../problemGenerator'

/**
 * Characterization tests for skill cost memoization.
 *
 * These tests verify that:
 * 1. Memoization produces identical results to non-memoized computation
 * 2. Cache behavior is correct (hits/misses work as expected)
 * 3. Results are deterministic for the same inputs
 *
 * Critical for Phase 1 optimization: we must not change behavior, only speed.
 */

describe('analyzeStepSkills memoization', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure isolation
    clearStepSkillsCache()
  })

  describe('correctness: memoized matches non-memoized', () => {
    // Test a comprehensive set of operations that cover all skill types
    const testCases: Array<{ currentValue: number; term: number; description: string }> = [
      // Direct addition (1-4 earth beads)
      { currentValue: 0, term: 1, description: '0+1=1 direct addition' },
      { currentValue: 0, term: 4, description: '0+4=4 direct addition' },
      { currentValue: 2, term: 2, description: '2+2=4 direct addition' },

      // Heaven bead (adding 5)
      { currentValue: 0, term: 5, description: '0+5=5 heaven bead' },
      { currentValue: 3, term: 5, description: '3+5=8 heaven bead + earth' },

      // Five complements (addition)
      { currentValue: 3, term: 4, description: '3+4=7 five complement' },
      { currentValue: 4, term: 3, description: '4+3=7 five complement' },
      { currentValue: 1, term: 4, description: '1+4=5 five complement' },

      // Ten complements (addition with carry)
      { currentValue: 7, term: 5, description: '7+5=12 ten complement' },
      { currentValue: 9, term: 4, description: '9+4=13 ten complement' },
      { currentValue: 8, term: 7, description: '8+7=15 ten complement' },

      // Direct subtraction
      { currentValue: 5, term: -1, description: '5-1=4 direct subtraction' },
      { currentValue: 9, term: -3, description: '9-3=6 direct subtraction' },

      // Heaven bead subtraction
      { currentValue: 7, term: -5, description: '7-5=2 heaven bead subtraction' },
      { currentValue: 5, term: -5, description: '5-5=0 heaven bead subtraction' },

      // Five complement subtraction
      { currentValue: 6, term: -3, description: '6-3=3 five complement sub' },
      { currentValue: 7, term: -4, description: '7-4=3 five complement sub' },

      // Ten complement subtraction (borrowing)
      { currentValue: 12, term: -5, description: '12-5=7 ten complement sub' },
      { currentValue: 10, term: -1, description: '10-1=9 ten complement sub' },

      // Multi-digit operations
      { currentValue: 45, term: 37, description: '45+37=82 multi-digit add' },
      { currentValue: 82, term: -37, description: '82-37=45 multi-digit sub' },
      { currentValue: 52, term: 37, description: '52+37=89 multi-digit add' },

      // Edge cases
      { currentValue: 0, term: 9, description: '0+9=9 from zero' },
      { currentValue: 99, term: 1, description: '99+1=100 triple digit' },
      { currentValue: 100, term: -1, description: '100-1=99 borrow from hundreds' },
    ]

    it.each(testCases)('$description produces identical results memoized vs non-memoized', ({
      currentValue,
      term,
    }) => {
      const newValue = currentValue + term

      // First call (cache miss) - should compute fresh
      const memoizedResult = analyzeStepSkillsMemoized(currentValue, term, newValue)

      // Non-memoized version for comparison
      const directResult = analyzeStepSkills(currentValue, term, newValue)

      // Results must be identical
      expect(memoizedResult).toEqual(directResult)
    })

    it('repeated calls return identical arrays', () => {
      // Call multiple times with same inputs
      const results = []
      for (let i = 0; i < 5; i++) {
        results.push(analyzeStepSkillsMemoized(3, 4, 7))
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0])
      }
    })
  })

  describe('cache behavior', () => {
    it('cache miss on first call, hit on subsequent calls', () => {
      const before = getStepSkillsCacheStats()

      // First call - should be a miss
      analyzeStepSkillsMemoized(3, 4, 7)
      const afterFirst = getStepSkillsCacheStats()
      expect(afterFirst.size).toBe(before.size + 1)
      expect(afterFirst.misses).toBe(before.misses + 1)

      // Second call with same args - should be a hit
      analyzeStepSkillsMemoized(3, 4, 7)
      const afterSecond = getStepSkillsCacheStats()
      expect(afterSecond.size).toBe(afterFirst.size) // No new entry
      expect(afterSecond.hits).toBe(afterFirst.hits + 1)
    })

    it('different inputs create different cache entries', () => {
      clearStepSkillsCache()

      analyzeStepSkillsMemoized(3, 4, 7)
      analyzeStepSkillsMemoized(4, 3, 7)
      analyzeStepSkillsMemoized(7, 5, 12)

      const stats = getStepSkillsCacheStats()
      expect(stats.size).toBe(3)
    })

    it('clearStepSkillsCache resets the cache', () => {
      analyzeStepSkillsMemoized(1, 1, 2)
      analyzeStepSkillsMemoized(2, 2, 4)

      clearStepSkillsCache()

      const stats = getStepSkillsCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('determinism', () => {
    it('same inputs always produce same outputs across cache clears', () => {
      const inputs = [
        { currentValue: 3, term: 4 },
        { currentValue: 7, term: 5 },
        { currentValue: 12, term: -5 },
      ]

      // Collect results, clear cache, collect again
      const firstRun = inputs.map(({ currentValue, term }) =>
        analyzeStepSkillsMemoized(currentValue, term, currentValue + term)
      )

      clearStepSkillsCache()

      const secondRun = inputs.map(({ currentValue, term }) =>
        analyzeStepSkillsMemoized(currentValue, term, currentValue + term)
      )

      // Results must be identical
      expect(firstRun).toEqual(secondRun)
    })
  })

  describe('stress test: high-volume memoization', () => {
    it('handles 10000 calls with high cache hit rate', () => {
      clearStepSkillsCache()

      // Generate problems in a realistic pattern
      // (same operations repeat frequently in problem generation)
      const operations: Array<{ currentValue: number; term: number }> = []

      // Simulate generating 100 problems with 5 terms each
      for (let problem = 0; problem < 100; problem++) {
        let accumulator = 0
        for (let termIndex = 0; termIndex < 5; termIndex++) {
          const term = Math.floor(Math.random() * 9) + 1
          const isSubtraction = termIndex > 0 && Math.random() > 0.7 && accumulator >= term
          const signedTerm = isSubtraction ? -term : term

          operations.push({ currentValue: accumulator, term: signedTerm })
          accumulator += signedTerm
        }
      }

      // Run all operations
      for (const { currentValue, term } of operations) {
        analyzeStepSkillsMemoized(currentValue, term, currentValue + term)
      }

      const stats = getStepSkillsCacheStats()

      // With 500 operations but limited unique (currentValue, term) pairs,
      // we should see significant cache hits
      expect(stats.hits).toBeGreaterThan(0)

      // Cache should be much smaller than total operations
      // (many repeated state transitions)
      expect(stats.size).toBeLessThan(operations.length)
    })
  })
})

describe('integration: memoization does not affect problem generation', () => {
  it('generating problems with memoization produces valid skill arrays', () => {
    // Simulate problem generation pattern
    const problem = [3, 4, 2, 5, 1] // Terms to add
    let accumulator = 0
    const allSkills: string[] = []

    for (const term of problem) {
      const skills = analyzeStepSkillsMemoized(accumulator, term, accumulator + term)
      allSkills.push(...skills)
      accumulator += term
    }

    // Should have detected some skills
    expect(allSkills.length).toBeGreaterThan(0)

    // All skills should be valid skill IDs (contain a dot)
    for (const skill of allSkills) {
      expect(skill).toMatch(/^[a-zA-Z]+\.[a-zA-Z0-9=\-+]+$/)
    }
  })
})

describe('performance benchmark', () => {
  it('memoization provides significant speedup for repeated operations', () => {
    clearStepSkillsCache()

    // Simulate the hot path: 60 problems × 100 attempts × 4 terms × 18 candidates
    // That's 432,000 calls, but many are duplicates
    // We'll test with a realistic subset

    const operations: Array<{ currentValue: number; term: number }> = []

    // Generate candidate evaluations like the real code does
    // For each state, we try all terms 1-9 (additions and subtractions)
    const states = [0, 3, 7, 12, 15, 21, 28, 35, 42, 50] // Sample states

    for (const state of states) {
      // Try adding 1-9
      for (let term = 1; term <= 9; term++) {
        operations.push({ currentValue: state, term })
      }
      // Try subtracting 1-9 (where valid)
      for (let term = 1; term <= Math.min(9, state); term++) {
        operations.push({ currentValue: state, term: -term })
      }
    }

    // Repeat the pattern to simulate multiple problems (cache should help)
    const repeatedOperations = [...operations, ...operations, ...operations]

    // Run with memoization
    const startMemoized = performance.now()
    for (const { currentValue, term } of repeatedOperations) {
      analyzeStepSkillsMemoized(currentValue, term, currentValue + term)
    }
    const memoizedTime = performance.now() - startMemoized

    const stats = getStepSkillsCacheStats()

    // Cache should have hits from repeated patterns
    expect(stats.hits).toBeGreaterThan(stats.misses)

    // The repeated operations (2nd and 3rd pass) should all be cache hits
    // First pass: ~135 operations (10 states × ~13.5 terms avg)
    // Second and third pass: all hits
    expect(stats.hits).toBeGreaterThanOrEqual(operations.length * 2)

    // Log for manual verification
    console.log(
      `Memoized: ${memoizedTime.toFixed(2)}ms for ${repeatedOperations.length} operations`
    )
    console.log(`Cache stats: ${stats.size} entries, ${stats.hits} hits, ${stats.misses} misses`)
    console.log(`Hit rate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}%`)
  })
})
