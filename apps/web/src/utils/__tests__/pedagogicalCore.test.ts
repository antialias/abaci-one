import { describe, it, expect } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

/**
 * Lean, focused tests for pedagogical algorithm with explicit invariants.
 * Replaces the massive snapshot suite with targeted validation and stable snapshots.
 */

// Helper to create stable, lean snapshots
function createStableSnapshot(result: ReturnType<typeof generateUnifiedInstructionSequence>) {
  return {
    startValue: result.startValue,
    targetValue: result.targetValue,
    fullDecomposition: result.fullDecomposition,
    totalSteps: result.totalSteps,
    isMeaningfulDecomposition: result.isMeaningfulDecomposition,
    steps: result.steps.map(s => ({
      term: s.mathematicalTerm,
      english: s.englishInstruction,
      termPosition: s.termPosition,
      expectedValue: s.expectedValue,
      isValid: s.isValid
    }))
  }
}

// Helper to validate term-to-position mapping
function assertTermMapping(seq: ReturnType<typeof generateUnifiedInstructionSequence>) {
  const text = seq.fullDecomposition
  seq.steps.forEach((step, i) => {
    const slice = text.slice(step.termPosition.startIndex, step.termPosition.endIndex)
    const normalized = step.mathematicalTerm.startsWith('-')
      ? step.mathematicalTerm.slice(1)
      : step.mathematicalTerm
    expect(slice, `Step ${i} term "${step.mathematicalTerm}" should map to "${normalized}" but got "${slice}"`).toBe(normalized)
  })
}

// Helper to validate arithmetic invariant
function assertArithmeticInvariant(seq: ReturnType<typeof generateUnifiedInstructionSequence>) {
  let currentValue = seq.startValue
  seq.steps.forEach((step, i) => {
    const term = step.mathematicalTerm
    const delta = term.startsWith('-') ? -parseInt(term.slice(1), 10) : parseInt(term, 10)
    currentValue += delta
    expect(currentValue, `Step ${i}: ${seq.startValue} + terms should equal ${step.expectedValue}`).toBe(step.expectedValue)
  })
  expect(currentValue).toBe(seq.targetValue)
}

// Helper to validate complement shape contract
function assertComplementShape(seq: ReturnType<typeof generateUnifiedInstructionSequence>) {
  const decomposition = seq.fullDecomposition
  const middlePart = decomposition.split(' = ')[1]?.split(' = ')[0]

  // Should contain proper parenthesized complements
  const complementMatches = middlePart?.match(/\((\d+) - (\d+(?:\s-\s\d+)*)\)/g) || []
  complementMatches.forEach(match => {
    // Each complement should start with a power of 10
    const [, positive] = match.match(/\((\d+)/) || []
    const num = parseInt(positive, 10)
    expect(num, `Complement positive part "${positive}" should be power of 10`).toSatisfy((n: number) => {
      if (n < 10) return n === 5 // Five-complements use 5
      return /^10+$/.test(n.toString()) // Ten-complements use 10, 100, 1000, etc.
    })
  })
}

// Helper to validate meaningfulness
function assertMeaningfulness(seq: ReturnType<typeof generateUnifiedInstructionSequence>, expectedMeaningful: boolean) {
  expect(seq.isMeaningfulDecomposition,
    `${seq.startValue}→${seq.targetValue}: "${seq.fullDecomposition}" meaningfulness`
  ).toBe(expectedMeaningful)

  if (expectedMeaningful) {
    expect(seq.fullDecomposition).toMatch(/\(/) // Should have parentheses for complements
  }
}

describe('Pedagogical Algorithm - Core Validation', () => {

  describe('Term-Position Mapping Invariants', () => {
    const criticalCases = [
      [3456, 3500], // Complex complement: "3456 + 44 = 3456 + 40 + (100 - 90 - 6) = 3500"
      [3, 17],      // Mixed segments: "3 + 14 = 3 + 10 + (5 - 1) = 17"
      [9999, 10007], // Multi-cascade: "9999 + 8 = 9999 + (10000 - 1000 - 100 - 10 - 1) = 10007"
      [4, 7],       // Simple five-complement: "4 + 3 = 4 + (5 - 2) = 7"
      [7, 15],      // Simple ten-complement: "7 + 8 = 7 + (10 - 2) = 15"
    ]

    criticalCases.forEach(([start, target]) => {
      it(`maps terms correctly for ${start} → ${target}`, () => {
        const result = generateUnifiedInstructionSequence(start, target)
        assertTermMapping(result)
        assertArithmeticInvariant(result)
        assertComplementShape(result)
      })
    })
  })

  describe('Meaningfulness Detection', () => {
    it('detects non-meaningful decompositions', () => {
      const nonMeaningful = [
        [0, 0],   // Zero case
        [5, 5],   // No change
        [123, 123], // No change multi-digit
      ]

      nonMeaningful.forEach(([start, target]) => {
        const result = generateUnifiedInstructionSequence(start, target)
        assertMeaningfulness(result, false)
        expect(result.fullDecomposition).not.toMatch(/\(/) // Should not contain parentheses
      })
    })

    it('detects meaningful decompositions with explicit parentheses check', () => {
      const meaningful = [
        [4, 7],       // Five-complement: (5 - 2)
        [7, 15],      // Ten-complement: (10 - 2)
        [99, 107],    // Cascading: (100 - 90 - 2)
        [3, 6],       // Five-complement: (5 - 2)
        [8, 15],      // Ten-complement: (10 - 3)
      ]

      meaningful.forEach(([start, target]) => {
        const result = generateUnifiedInstructionSequence(start, target)
        assertMeaningfulness(result, true)
        expect(result.fullDecomposition, `${start}→${target} should have parentheses for complement`).toMatch(/\(/)
        expect(result.isMeaningfulDecomposition).toBe(true)
      })
    })

    it('validates specific meaningfulness edge cases', () => {
      // Test case that should be meaningful due to complement structure
      const result = generateUnifiedInstructionSequence(0, 6)
      if (result.fullDecomposition.includes('(')) {
        // If it uses complements (5 + 1), it should be meaningful
        expect(result.isMeaningfulDecomposition).toBe(true)
      } else {
        // If it's direct addition, it should be non-meaningful
        expect(result.isMeaningfulDecomposition).toBe(false)
      }
    })
  })

  describe('Representative Snapshots (Lean)', () => {
    // One golden anchor per major pattern type

    it('direct entry pattern', () => {
      const result = generateUnifiedInstructionSequence(0, 3)
      expect(createStableSnapshot(result)).toMatchSnapshot()
    })

    it('five-complement pattern', () => {
      const result = generateUnifiedInstructionSequence(4, 7)
      expect(createStableSnapshot(result)).toMatchSnapshot()
    })

    it('ten-complement pattern', () => {
      const result = generateUnifiedInstructionSequence(7, 15)
      expect(createStableSnapshot(result)).toMatchSnapshot()
    })

    it('cascading complement pattern', () => {
      const result = generateUnifiedInstructionSequence(99, 107)
      expect(createStableSnapshot(result)).toMatchSnapshot()
    })

    it('mixed operations pattern', () => {
      const result = generateUnifiedInstructionSequence(43, 51)
      expect(createStableSnapshot(result)).toMatchSnapshot()
    })

    it('complex multi-cascade pattern', () => {
      const result = generateUnifiedInstructionSequence(9999, 10007)
      expect(createStableSnapshot(result)).toMatchSnapshot()
    })
  })

  describe('Edge Cases & Boundary Conditions', () => {
    const edgeCases = [
      [0, 0],     // Zero operation
      [9, 10],    // Place boundary
      [99, 100],  // Double place boundary
      [999, 1000], // Triple place boundary
    ]

    edgeCases.forEach(([start, target]) => {
      it(`handles edge case ${start} → ${target}`, () => {
        const result = generateUnifiedInstructionSequence(start, target)

        // Validate basic invariants
        expect(result.startValue).toBe(start)
        expect(result.targetValue).toBe(target)
        expect(result.steps.length).toBeGreaterThanOrEqual(0)

        if (result.steps.length > 0) {
          assertTermMapping(result)
          assertArithmeticInvariant(result)
        }
      })
    })
  })

  describe('Micro-Invariant Tests (Critical Behaviors)', () => {
    // Lock specific invariants without snapshots

    it('validates term substring mapping precision', () => {
      const cases = [
        [3456, 3500], // Complex complement: "3456 + 44 = 3456 + 40 + (100 - 90 - 6) = 3500"
        [3, 17],      // Mixed: "3 + 14 = 3 + 10 + (5 - 1) = 17"
        [9999, 10007] // Multi-cascade: "9999 + 8 = 9999 + (10000 - 9000 - 900 - 90 - 2) = 10007"
      ]

      cases.forEach(([start, target]) => {
        const result = generateUnifiedInstructionSequence(start, target)
        assertTermMapping(result)
      })
    })

    it('validates arithmetic step-by-step consistency', () => {
      const result = generateUnifiedInstructionSequence(1234, 1279)

      let runningValue = result.startValue
      result.steps.forEach((step, i) => {
        const term = step.mathematicalTerm
        const delta = term.startsWith('-') ? -parseInt(term.slice(1), 10) : parseInt(term, 10)
        runningValue += delta

        expect(runningValue, `Step ${i + 1}: After applying "${term}" to running total`).toBe(step.expectedValue)
      })

      expect(runningValue).toBe(result.targetValue)
    })

    it('validates complement shape contracts', () => {
      const complementCases = [
        [4, 7],   // (5 - 2)
        [7, 15],  // (10 - 2)
        [99, 107], // (100 - 90 - 2)
        [9999, 10007] // (10000 - 9000 - 900 - 90 - 2)
      ]

      complementCases.forEach(([start, target]) => {
        const result = generateUnifiedInstructionSequence(start, target)
        const decomp = result.fullDecomposition

        // Extract all complement patterns
        const complementMatches = decomp.match(/\((\d+) - ([\d\s-]+)\)/g) || []

        complementMatches.forEach(match => {
          // Each complement should start with power of 10 or 5
          const [, positive] = match.match(/\((\d+)/) || []
          const num = parseInt(positive, 10)

          const isValidStart = num === 5 || (num >= 10 && /^10+$/.test(num.toString()))
          expect(isValidStart, `Complement "${match}" should start with 5 or power of 10, got ${num}`).toBe(true)

          // All subsequent parts should be subtraction
          expect(match, 'Complement should contain only subtraction after first term').toMatch(/\(\d+ - [\d\s-]+\)/)
        })
      })
    })

    it('validates step progression consistency', () => {
      const result = generateUnifiedInstructionSequence(123, 456)

      // Each step should be mathematically valid (arithmetic already tested)
      // and the final value should match target
      expect(result.steps.length).toBeGreaterThan(0)

      const finalStep = result.steps[result.steps.length - 1]
      expect(finalStep.expectedValue).toBe(result.targetValue)

      // All steps should be valid
      result.steps.forEach((step, i) => {
        expect(step.isValid, `Step ${i + 1} should be valid`).toBe(true)
      })
    })
  })

  describe('Stress Test Coverage (No Snapshots)', () => {
    // Fast invariant-only validation for broad coverage
    const stressCases = [
      // Various differences from different starting points
      [0, 1], [5, 6], [9, 10], [15, 16], [99, 100],
      [0, 5], [1, 9], [12, 34], [23, 47], [34, 78],
      [89, 97], [189, 197], [1234, 1279], [9999, 10017],
    ]

    stressCases.forEach(([start, target]) => {
      it(`validates invariants for ${start} → ${target}`, () => {
        const result = generateUnifiedInstructionSequence(start, target)

        // Fast validation - no snapshots
        expect(result.startValue).toBe(start)
        expect(result.targetValue).toBe(target)

        if (result.steps.length > 0) {
          assertArithmeticInvariant(result)
          assertTermMapping(result)
        }

        // All steps should be valid
        result.steps.forEach(step => {
          expect(step.isValid, `Step with term "${step.mathematicalTerm}" should be valid`).toBe(true)
        })
      })
    })
  })

  describe('Pedagogical Segments - Basic Validation', () => {
    const segmentTestCases = [
      [4, 7],   // Five-complement
      [7, 15],  // Ten-complement
      [0, 3],   // Direct entry
      [99, 107] // Cascading
    ]

    segmentTestCases.forEach(([start, target]) => {
      it(`generates valid segments for ${start} → ${target}`, () => {
        const result = generateUnifiedInstructionSequence(start, target)

        // Basic segment validation
        expect(result.segments).toBeDefined()
        expect(Array.isArray(result.segments)).toBe(true)
        expect(result.segments.length).toBeGreaterThan(0)

        // Each segment should have required properties
        result.segments.forEach((segment, i) => {
          expect(segment.id, `Segment ${i} should have id`).toBeDefined()
          expect(segment.goal, `Segment ${i} should have goal`).toBeDefined()
          expect(segment.plan, `Segment ${i} should have plan`).toBeDefined()
          expect(segment.expression, `Segment ${i} should have expression`).toBeDefined()
          expect(segment.startValue, `Segment ${i} should have startValue`).toBeTypeOf('number')
          expect(segment.endValue, `Segment ${i} should have endValue`).toBeTypeOf('number')
          expect(segment.stepIndices, `Segment ${i} should have stepIndices`).toBeDefined()

          // Segment progression should be mathematically sound
          expect(segment.startValue).toBeLessThanOrEqual(segment.endValue)
        })

        // Segments should cover all operations
        const allStepIndices = result.segments.flatMap(s => s.stepIndices)
        expect(allStepIndices.length, 'Segments should cover all steps').toEqual(result.steps.length)
      })
    })

    it('validates segment decision rules are coherent', () => {
      const result = generateUnifiedInstructionSequence(4, 7) // Five-complement case

      const segment = result.segments[0]
      expect(segment.plan.length).toBeGreaterThan(0)

      const decision = segment.plan[0]
      expect(decision.rule).toEqual('FiveComplement')
      expect(decision.conditions).toBeDefined()
      expect(decision.explanation).toBeDefined()
      expect(decision.explanation.length).toBeGreaterThan(0)
    })

    it('validates segment term ranges map to decomposition string', () => {
      const result = generateUnifiedInstructionSequence(99, 107) // Complex cascading case

      result.segments.forEach((segment, i) => {
        const { termRange } = segment
        expect(termRange.startIndex, `Segment ${i} should have valid start index`).toBeGreaterThanOrEqual(0)
        expect(termRange.endIndex, `Segment ${i} should have valid end index`).toBeGreaterThan(termRange.startIndex)
        expect(termRange.endIndex, `Segment ${i} end should not exceed decomposition length`).toBeLessThanOrEqual(result.fullDecomposition.length)

        // The substring should not be empty
        const substring = result.fullDecomposition.slice(termRange.startIndex, termRange.endIndex)
        expect(substring.length, `Segment ${i} should map to non-empty substring`).toBeGreaterThan(0)
      })
    })
  })
})