import { describe, expect, it } from 'vitest'
import { generateAbacusInstructions } from '../abacusInstructionGenerator'

describe('Pedagogical Decomposition', () => {
  describe('Core Principle: 1:1 Mapping to Bead Movements', () => {
    it('should map each decomposition term to a specific bead movement', () => {
      // Test case: 3 + 14 = 17
      const instruction = generateAbacusInstructions(3, 17)

      // Should show decomposition like "3 + 10 + (5 - 1)" where:
      // - "10" maps to adding 1 earth bead in tens place
      // - "(5 - 1)" maps to adding heaven bead and removing 1 earth bead in ones
      expect(instruction.actionDescription).toContain('3 + 14 = 3 + 10')
      expect(instruction.actionDescription).toContain('(5 - 1)')

      // Verify bead movements match decomposition terms
      const tensBeads = instruction.highlightBeads.filter((b) => b.placeValue === 1)
      const onesBeads = instruction.highlightBeads.filter((b) => b.placeValue === 0)

      expect(tensBeads).toHaveLength(1) // One term "10" = 1 tens bead
      expect(onesBeads).toHaveLength(2) // Term "(5 - 1)" = heaven + 1 earth bead
    })

    it('should handle ten complement with proper breakdown: 7 + 4 = 11', () => {
      const instruction = generateAbacusInstructions(7, 11)

      // Should break down as: 7 + 4 = 7 + 10 - 6
      // - "+10" maps to adding 1 earth bead in tens
      // - "-6" maps to removing heaven bead + 1 earth bead in ones
      expect(instruction.actionDescription).toContain('7 + 4 = 7 + 10 - 6')

      // Verify bead movements: 1 tens addition + 2 ones removals
      expect(instruction.highlightBeads).toHaveLength(3)

      const tensAdditions = instruction.highlightBeads.filter((b) => b.placeValue === 1)
      const onesBeads = instruction.highlightBeads.filter((b) => b.placeValue === 0)

      expect(tensAdditions).toHaveLength(1) // "+10" term
      expect(onesBeads).toHaveLength(2) // "-6" = heaven + earth removal
    })

    it('should handle five complement: 2 + 3 = 5', () => {
      const instruction = generateAbacusInstructions(2, 5)

      // Should show: 2 + 3 = 2 + (5 - 2) where:
      // - "+5" maps to adding heaven bead
      // - "-2" maps to removing 2 earth beads
      expect(instruction.actionDescription).toContain('2 + 3 = 2 + (5 - 2)')

      // Verify bead movements match
      const onesBeads = instruction.highlightBeads.filter((b) => b.placeValue === 0)
      expect(onesBeads).toHaveLength(3) // heaven + 2 earth removals
    })
  })

  describe('Complex Multi-Place Operations', () => {
    it('should decompose 3 + 98 = 101 by place value', () => {
      const instruction = generateAbacusInstructions(3, 98)

      // Should break down like: 3 + 95 = 3 + 90 + 5
      // Each term should map to place-specific bead movements
      expect(instruction.actionDescription).toMatch(/3 \+ 95 = 3 \+ \d+/)

      // Should have beads in multiple places
      const places = new Set(instruction.highlightBeads.map((b) => b.placeValue))
      expect(places.size).toBeGreaterThan(1)
    })

    it('should handle hundred boundary crossing: 99 + 1 = 100', () => {
      const instruction = generateAbacusInstructions(99, 100)

      // Should show recursive breakdown that maps to actual bead movements
      expect(instruction.actionDescription).toContain('99 + 1 = 99 + (100 - 90) - 9')

      // Verify step-by-step bead mapping exists
      expect(instruction.stepBeadHighlights).toBeDefined()
      expect(instruction.multiStepInstructions).toBeDefined()
      expect(instruction.multiStepInstructions!.length).toBeGreaterThan(1)
    })

    it('should decompose 56 → 104 correctly', () => {
      const instruction = generateAbacusInstructions(56, 104)

      // Should break down 48 into place-value components
      expect(instruction.actionDescription).toMatch(/56 \+ 48/)

      // Verify multi-step instructions are properly consolidated
      expect(instruction.multiStepInstructions).toBeDefined()
      expect(instruction.multiStepInstructions!.length).toBeGreaterThan(1)
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle single digit additions', () => {
      const testCases = [
        { start: 1, target: 2, expectedBeads: 1 }, // Add 1 earth bead
        { start: 0, target: 1, expectedBeads: 1 }, // Add 1 earth bead
        { start: 4, target: 5, expectedBeads: 5 }, // Use complement operation (heaven + removals)
      ]

      testCases.forEach(({ start, target, expectedBeads }) => {
        const instruction = generateAbacusInstructions(start, target)
        // Simple operations show action descriptions rather than mathematical breakdown
        expect(instruction.actionDescription).toBeDefined()
        expect(instruction.highlightBeads).toHaveLength(expectedBeads)
      })
    })

    it('should handle five complement edge cases', () => {
      const fiveComplementCases = [
        { start: 1, target: 4 }, // 1 + 3
        { start: 2, target: 6 }, // 2 + 4
        { start: 3, target: 7 }, // 3 + 4
      ]

      fiveComplementCases.forEach(({ start, target }) => {
        const instruction = generateAbacusInstructions(start, target)

        // Should have mathematical breakdown or action description
        expect(instruction.actionDescription).toBeDefined()

        // Should involve bead movements (could be complement or direct)
        expect(instruction.highlightBeads.length).toBeGreaterThan(0)
      })
    })

    it('should handle ten complement edge cases', () => {
      const tenComplementCases = [
        { start: 6, target: 12, description: '6 + 6 crossing tens' },
        { start: 8, target: 15, description: '8 + 7 crossing tens' },
        { start: 9, target: 18, description: '9 + 9 crossing tens' },
      ]

      tenComplementCases.forEach(({ start, target, description }) => {
        const instruction = generateAbacusInstructions(start, target)

        // Should have mathematical breakdown for complex operations
        expect(instruction.actionDescription).toContain(`${start} + ${target - start}`)

        // Should have beads in both ones and tens places
        const places = new Set(instruction.highlightBeads.map((b) => b.placeValue))
        expect(places).toContain(0) // ones place
        expect(places).toContain(1) // tens place
      })
    })

    it('should handle large numbers with multiple complements', () => {
      const instruction = generateAbacusInstructions(87, 134)

      // 87 + 47 should break down by place value
      expect(instruction.actionDescription).toContain('87 + 47')

      // Should have proper multi-step breakdown
      expect(instruction.multiStepInstructions).toBeDefined()
      expect(instruction.stepBeadHighlights).toBeDefined()
    })
  })

  describe('Regression Tests for Known Issues', () => {
    it('should NOT generate unhelpful decompositions like (100 - 86)', () => {
      const instruction = generateAbacusInstructions(3, 17)

      // Should NOT contain large complement subtractions
      expect(instruction.actionDescription).not.toContain('(100 - 86)')
      expect(instruction.actionDescription).not.toMatch(/\(100 - \d{2}\)/)

      // Should contain proper place-value breakdown
      expect(instruction.actionDescription).toContain('10')
      expect(instruction.actionDescription).toContain('(5 - 1)')
    })

    it('should ensure instruction text matches expected state calculations', () => {
      const instruction = generateAbacusInstructions(56, 104)

      if (instruction.multiStepInstructions && instruction.stepBeadHighlights) {
        // Verify that each instruction corresponds to correct expected state
        // This prevents the "impossible" state bug we fixed
        expect(instruction.multiStepInstructions.length).toBeGreaterThan(0)

        // Each step should have corresponding bead highlights
        const stepIndices = new Set(instruction.stepBeadHighlights.map((b) => b.stepIndex))
        expect(stepIndices.size).toBe(instruction.multiStepInstructions.length)
      }
    })

    it('should maintain pedagogical ordering (highest place first)', () => {
      const instruction = generateAbacusInstructions(99, 100)

      if (instruction.multiStepInstructions) {
        // First instruction should involve hundreds place
        expect(instruction.multiStepInstructions[0]).toMatch(/hundreds?/)

        // Later instructions should involve lower places
        const hasOnesInstruction = instruction.multiStepInstructions.some((inst) =>
          inst.includes('ones')
        )
        expect(hasOnesInstruction).toBe(true)
      }
    })

    it('should consolidate multiple beads in same step', () => {
      const instruction = generateAbacusInstructions(56, 104)

      if (instruction.multiStepInstructions) {
        // Instructions should be consolidated (not individual bead references)
        const hasConsolidatedInstruction = instruction.multiStepInstructions.some(
          (inst) => inst.includes('earth beads') || inst.includes('heaven bead')
        )
        expect(hasConsolidatedInstruction).toBe(true)

        // Should not have multiple separate instructions for same step
        expect(instruction.multiStepInstructions.length).toBeLessThan(10)
      }
    })
  })

  describe('Decomposition Term Validation', () => {
    it('should ensure all terms are mathematically valid', () => {
      const testCases = [
        { start: 3, target: 17 },
        { start: 7, target: 11 },
        { start: 56, target: 104 },
        { start: 99, target: 100 },
      ]

      testCases.forEach(({ start, target }) => {
        const instruction = generateAbacusInstructions(start, target)
        const difference = target - start

        // Action description should include the correct operation
        expect(instruction.actionDescription).toContain(`${start} + ${difference}`)
        expect(instruction.actionDescription).toContain(`= ${target}`)
      })
    })

    it('should ensure bead count matches decomposition complexity', () => {
      // Simple operations should have fewer beads
      const simple = generateAbacusInstructions(1, 2)
      expect(simple.highlightBeads.length).toBeLessThanOrEqual(2)

      // Complex operations should have more beads
      const complex = generateAbacusInstructions(87, 134)
      expect(complex.highlightBeads.length).toBeGreaterThan(2)
    })

    it('should validate step bead mapping consistency', () => {
      const instruction = generateAbacusInstructions(3, 17)

      if (instruction.stepBeadHighlights && instruction.multiStepInstructions) {
        // Total step bead highlights should match total highlights
        expect(instruction.stepBeadHighlights.length).toBe(instruction.highlightBeads.length)

        // Each step index should be valid
        instruction.stepBeadHighlights.forEach((bead) => {
          expect(bead.stepIndex).toBeGreaterThanOrEqual(0)
          expect(bead.stepIndex).toBeLessThan(instruction.multiStepInstructions!.length)
        })
      }
    })
  })

  describe('Performance and Consistency', () => {
    it('should generate consistent results for equivalent problems', () => {
      // Same structure in different decades should have same pattern
      const pattern3Plus14 = generateAbacusInstructions(3, 17)
      const pattern13Plus14 = generateAbacusInstructions(13, 27)

      // Both should use similar decomposition patterns
      expect(pattern3Plus14.expectedAction).toBe(pattern13Plus14.expectedAction)

      if (pattern3Plus14.multiStepInstructions && pattern13Plus14.multiStepInstructions) {
        expect(pattern3Plus14.multiStepInstructions.length).toBe(
          pattern13Plus14.multiStepInstructions.length
        )
      }
    })

    it('should handle all numbers 0-999 without errors', () => {
      // Spot check various ranges
      const testCases = [
        [0, 9],
        [10, 19],
        [20, 29],
        [90, 99],
        [100, 109],
        [500, 509],
        [990, 999],
      ]

      testCases.forEach(([start, end]) => {
        for (let i = start; i <= Math.min(end, start + 3); i++) {
          const target = Math.min(i + Math.floor(Math.random() * 10) + 1, 999)

          expect(() => {
            const instruction = generateAbacusInstructions(i, target)
            expect(instruction.actionDescription).toBeDefined()
            expect(instruction.highlightBeads).toBeDefined()
          }).not.toThrow()
        }
      })
    })
  })
})
