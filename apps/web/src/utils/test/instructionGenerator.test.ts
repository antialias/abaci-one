import { describe, it, expect } from 'vitest'
import {
  generateAbacusInstructions,
  numberToAbacusState,
  detectComplementOperation,
  validateInstruction
} from '../abacusInstructionGenerator'

describe('Automatic Abacus Instruction Generator', () => {
  describe('numberToAbacusState', () => {
    it('should convert numbers to correct abacus states', () => {
      expect(numberToAbacusState(0)).toEqual({
        0: { heavenActive: false, earthActive: 0 },
        1: { heavenActive: false, earthActive: 0 },
        2: { heavenActive: false, earthActive: 0 },
        3: { heavenActive: false, earthActive: 0 },
        4: { heavenActive: false, earthActive: 0 }
      })

      expect(numberToAbacusState(5)).toEqual({
        0: { heavenActive: true, earthActive: 0 },
        1: { heavenActive: false, earthActive: 0 },
        2: { heavenActive: false, earthActive: 0 },
        3: { heavenActive: false, earthActive: 0 },
        4: { heavenActive: false, earthActive: 0 }
      })

      expect(numberToAbacusState(7)).toEqual({
        0: { heavenActive: true, earthActive: 2 },
        1: { heavenActive: false, earthActive: 0 },
        2: { heavenActive: false, earthActive: 0 },
        3: { heavenActive: false, earthActive: 0 },
        4: { heavenActive: false, earthActive: 0 }
      })

      expect(numberToAbacusState(23)).toEqual({
        0: { heavenActive: false, earthActive: 3 },
        1: { heavenActive: false, earthActive: 2 },
        2: { heavenActive: false, earthActive: 0 },
        3: { heavenActive: false, earthActive: 0 },
        4: { heavenActive: false, earthActive: 0 }
      })
    })
  })

  describe('detectComplementOperation', () => {
    it('should detect five complement operations', () => {
      // 3 + 4 = 7 (need complement because only 1 earth space available)
      const result = detectComplementOperation(3, 7, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('five')
      expect(result.complementDetails?.addValue).toBe(5)
      expect(result.complementDetails?.subtractValue).toBe(1)
    })

    it('should detect ten complement operations', () => {
      // 7 + 4 = 11 (need to carry to tens place)
      const result = detectComplementOperation(7, 11, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('ten')
    })

    it('should not detect complement for direct operations', () => {
      // 1 + 1 = 2 (direct addition)
      const result = detectComplementOperation(1, 2, 0)
      expect(result.needsComplement).toBe(false)
      expect(result.complementType).toBe('none')
    })
  })

  describe('generateAbacusInstructions', () => {
    it('should generate correct instructions for basic addition', () => {
      const instruction = generateAbacusInstructions(0, 1)

      expect(instruction.highlightBeads).toHaveLength(1)
      expect(instruction.highlightBeads[0]).toEqual({
        placeValue: 0,
        beadType: 'earth',
        position: 0
      })
      expect(instruction.expectedAction).toBe('add')
      expect(instruction.actionDescription).toContain('earth bead')
    })

    it('should generate correct instructions for heaven bead', () => {
      const instruction = generateAbacusInstructions(0, 5)

      expect(instruction.highlightBeads).toHaveLength(1)
      expect(instruction.highlightBeads[0]).toEqual({
        placeValue: 0,
        beadType: 'heaven'
      })
      expect(instruction.expectedAction).toBe('add')
      expect(instruction.actionDescription).toContain('heaven bead')
    })

    it('should generate correct instructions for five complement', () => {
      const instruction = generateAbacusInstructions(3, 7) // 3 + 4

      expect(instruction.highlightBeads).toHaveLength(2)
      expect(instruction.expectedAction).toBe('multi-step')
      expect(instruction.actionDescription).toContain('five complement')
      expect(instruction.multiStepInstructions).toBeDefined()
      expect(instruction.multiStepInstructions).toHaveLength(2)

      // Should highlight heaven bead to add
      const heavenBead = instruction.highlightBeads.find(b => b.beadType === 'heaven')
      expect(heavenBead).toBeDefined()

      // Should highlight earth bead to remove (the last one in the sequence)
      const earthBead = instruction.highlightBeads.find(b => b.beadType === 'earth')
      expect(earthBead).toBeDefined()
      expect(earthBead?.position).toBe(2) // Position 2 (third earth bead) needs to be removed
    })

    it('should generate correct instructions for ten complement', () => {
      const instruction = generateAbacusInstructions(7, 11) // 7 + 4

      expect(instruction.highlightBeads).toHaveLength(3) // tens earth + ones heaven + 1 ones earth
      expect(instruction.expectedAction).toBe('multi-step')
      expect(instruction.actionDescription).toContain('ten complement')

      // Should highlight tens place earth bead (to add 1 in tens place)
      const tensEarth = instruction.highlightBeads.find(b => b.placeValue === 1 && b.beadType === 'earth')
      expect(tensEarth).toBeDefined()

      // Should highlight ones place beads to change
      const onesBeads = instruction.highlightBeads.filter(b => b.placeValue === 0)
      expect(onesBeads).toHaveLength(2) // ones heaven + 1 ones earth to remove
    })

    it('should generate correct instructions for direct multi-bead addition', () => {
      const instruction = generateAbacusInstructions(6, 8) // 6 + 2

      expect(instruction.highlightBeads).toHaveLength(2)
      expect(instruction.expectedAction).toBe('multi-step')

      // Should highlight earth beads at positions 1 and 2
      instruction.highlightBeads.forEach(bead => {
        expect(bead.beadType).toBe('earth')
        expect(bead.placeValue).toBe(0)
        expect([1, 2]).toContain(bead.position)
      })
    })

    it('should generate correct instructions for multi-place operations', () => {
      const instruction = generateAbacusInstructions(15, 23) // 15 + 8

      // Should involve both ones and tens places
      const onesBeads = instruction.highlightBeads.filter(b => b.placeValue === 0)
      const tensBeads = instruction.highlightBeads.filter(b => b.placeValue === 1)

      expect(onesBeads.length + tensBeads.length).toBe(instruction.highlightBeads.length)
      expect(instruction.expectedAction).toBe('multi-step')
    })
  })

  describe('validateInstruction', () => {
    it('should validate correct instructions', () => {
      const instruction = generateAbacusInstructions(0, 1)
      const validation = validateInstruction(instruction, 0, 1)

      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it('should catch invalid place values', () => {
      const instruction = generateAbacusInstructions(0, 1)
      // Manually corrupt the instruction
      instruction.highlightBeads[0].placeValue = 5 as any

      const validation = validateInstruction(instruction, 0, 1)
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Invalid place value: 5')
    })

    it('should catch missing multi-step instructions', () => {
      const instruction = generateAbacusInstructions(3, 7)
      // Manually corrupt the instruction
      instruction.multiStepInstructions = undefined

      const validation = validateInstruction(instruction, 3, 7)
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Multi-step action without step instructions')
    })
  })

  describe('Real-world tutorial examples', () => {
    const examples = [
      { start: 0, target: 1, name: "Basic: 0 + 1" },
      { start: 1, target: 2, name: "Basic: 1 + 1" },
      { start: 2, target: 3, name: "Basic: 2 + 1" },
      { start: 3, target: 4, name: "Basic: 3 + 1" },
      { start: 0, target: 5, name: "Heaven: 0 + 5" },
      { start: 5, target: 6, name: "Heaven + Earth: 5 + 1" },
      { start: 3, target: 7, name: "Five complement: 3 + 4" },
      { start: 2, target: 5, name: "Five complement: 2 + 3" },
      { start: 6, target: 8, name: "Direct: 6 + 2" },
      { start: 7, target: 11, name: "Ten complement: 7 + 4" }
    ]

    examples.forEach(({ start, target, name }) => {
      it(`should generate valid instructions for ${name}`, () => {
        const instruction = generateAbacusInstructions(start, target)
        const validation = validateInstruction(instruction, start, target)

        expect(validation.isValid).toBe(true)
        expect(instruction.highlightBeads.length).toBeGreaterThan(0)
        expect(instruction.actionDescription).toBeTruthy()
        expect(instruction.tooltip.content).toBeTruthy()
        expect(instruction.errorMessages.wrongBead).toBeTruthy()
      })
    })
  })

  describe('Edge cases and boundary conditions', () => {
    it('should handle subtraction operations', () => {
      const instruction = generateAbacusInstructions(5, 3) // 5 - 2
      expect(instruction.expectedAction).toBe('multi-step')
      expect(instruction.actionDescription).toContain('subtract')

      const validation = validateInstruction(instruction, 5, 3)
      expect(validation.isValid).toBe(true)
    })

    it('should handle zero difference (same start and target)', () => {
      const instruction = generateAbacusInstructions(7, 7) // 7 - 0
      expect(instruction.highlightBeads).toHaveLength(0)
      expect(instruction.expectedAction).toBe('add')
      expect(instruction.actionDescription).toContain('No change needed')

      const validation = validateInstruction(instruction, 7, 7)
      expect(validation.isValid).toBe(true)
    })

    it('should handle maximum single-digit values', () => {
      const instruction = generateAbacusInstructions(0, 9) // 0 + 9
      expect(instruction.highlightBeads.length).toBeGreaterThan(0)

      const validation = validateInstruction(instruction, 0, 9)
      expect(validation.isValid).toBe(true)
    })

    it('should handle maximum two-digit values', () => {
      const instruction = generateAbacusInstructions(0, 99) // 0 + 99
      expect(instruction.highlightBeads.length).toBeGreaterThan(0)

      // Should involve both ones and tens places
      const onesBeads = instruction.highlightBeads.filter(b => b.placeValue === 0)
      const tensBeads = instruction.highlightBeads.filter(b => b.placeValue === 1)
      expect(onesBeads.length + tensBeads.length).toBe(instruction.highlightBeads.length)

      const validation = validateInstruction(instruction, 0, 99)
      expect(validation.isValid).toBe(true)
    })

    it('should handle complex complement operations across place values', () => {
      const instruction = generateAbacusInstructions(89, 95) // 89 + 6
      expect(instruction.expectedAction).toBe('multi-step')

      const validation = validateInstruction(instruction, 89, 95)
      expect(validation.isValid).toBe(true)
    })

    it('should handle large subtraction with borrowing', () => {
      const instruction = generateAbacusInstructions(50, 7) // 50 - 43
      expect(instruction.expectedAction).toBe('multi-step')
      expect(instruction.actionDescription).toContain('subtract')

      const validation = validateInstruction(instruction, 50, 7)
      expect(validation.isValid).toBe(true)
    })

    it('should handle all possible five complement scenarios', () => {
      const fiveComplementCases = [
        { start: 1, target: 4 }, // 1 + 3 = 4 (no complement needed)
        { start: 1, target: 5 }, // 1 + 4 = 5 (complement needed)
        { start: 2, target: 5 }, // 2 + 3 = 5 (complement needed)
        { start: 3, target: 7 }, // 3 + 4 = 7 (complement needed)
        { start: 4, target: 8 }  // 4 + 4 = 8 (complement needed)
      ]

      fiveComplementCases.forEach(({ start, target }) => {
        const instruction = generateAbacusInstructions(start, target)
        const validation = validateInstruction(instruction, start, target)
        expect(validation.isValid).toBe(true)
      })
    })

    it('should handle all possible ten complement scenarios', () => {
      const tenComplementCases = [
        { start: 6, target: 10 }, // 6 + 4 = 10
        { start: 7, target: 11 }, // 7 + 4 = 11
        { start: 8, target: 12 }, // 8 + 4 = 12
        { start: 9, target: 13 }, // 9 + 4 = 13
        { start: 19, target: 23 }, // 19 + 4 = 23 (tens place)
        { start: 29, target: 33 }  // 29 + 4 = 33 (tens place)
      ]

      tenComplementCases.forEach(({ start, target }) => {
        const instruction = generateAbacusInstructions(start, target)
        const validation = validateInstruction(instruction, start, target)
        expect(validation.isValid).toBe(true)
      })
    })
  })

  describe('Stress testing with random operations', () => {
    it('should handle 100 random addition operations', () => {
      const failedCases: Array<{start: number, target: number, error: string}> = []

      for (let i = 0; i < 100; i++) {
        const start = Math.floor(Math.random() * 90) // 0-89
        const additionAmount = Math.floor(Math.random() * 10) + 1 // 1-10
        const target = start + additionAmount

        // Skip if target exceeds our max value
        if (target > 99) continue

        try {
          const instruction = generateAbacusInstructions(start, target)
          const validation = validateInstruction(instruction, start, target)

          if (!validation.isValid) {
            failedCases.push({
              start,
              target,
              error: `Validation failed: ${validation.issues.join(', ')}`
            })
          }
        } catch (error) {
          failedCases.push({
            start,
            target,
            error: `Exception: ${error instanceof Error ? error.message : String(error)}`
          })
        }
      }

      if (failedCases.length > 0) {
        console.error('Failed stress test cases:', failedCases)
      }

      expect(failedCases).toHaveLength(0)
    })

    it('should handle 50 random subtraction operations', () => {
      const failedCases: Array<{start: number, target: number, error: string}> = []

      for (let i = 0; i < 50; i++) {
        const start = Math.floor(Math.random() * 89) + 10 // 10-98
        const subtractionAmount = Math.floor(Math.random() * Math.min(start, 10)) + 1 // 1 to min(start, 10)
        const target = start - subtractionAmount

        try {
          const instruction = generateAbacusInstructions(start, target)
          const validation = validateInstruction(instruction, start, target)

          if (!validation.isValid) {
            failedCases.push({
              start,
              target,
              error: `Validation failed: ${validation.issues.join(', ')}`
            })
          }
        } catch (error) {
          failedCases.push({
            start,
            target,
            error: `Exception: ${error instanceof Error ? error.message : String(error)}`
          })
        }
      }

      if (failedCases.length > 0) {
        console.error('Failed subtraction stress test cases:', failedCases)
      }

      expect(failedCases).toHaveLength(0)
    })

    it('should handle all systematic single-digit operations', () => {
      const failedCases: Array<{start: number, target: number, error: string}> = []

      // Test every possible single-digit to single-digit operation
      for (let start = 0; start <= 9; start++) {
        for (let target = 0; target <= 9; target++) {
          if (start === target) continue // Skip no-change operations

          try {
            const instruction = generateAbacusInstructions(start, target)
            const validation = validateInstruction(instruction, start, target)

            if (!validation.isValid) {
              failedCases.push({
                start,
                target,
                error: `Validation failed: ${validation.issues.join(', ')}`
              })
            }
          } catch (error) {
            failedCases.push({
              start,
              target,
              error: `Exception: ${error instanceof Error ? error.message : String(error)}`
            })
          }
        }
      }

      if (failedCases.length > 0) {
        console.error('Failed systematic single-digit test cases:', failedCases)
      }

      expect(failedCases).toHaveLength(0)
    })
  })

  describe('Performance benchmarks', () => {
    it('should generate instructions quickly for simple operations', () => {
      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        generateAbacusInstructions(3, 7) // Five complement operation
      }

      const end = performance.now()
      const timePerOperation = (end - start) / 1000

      // Should take less than 1ms per operation on average
      expect(timePerOperation).toBeLessThan(1)
    })

    it('should generate instructions quickly for complex operations', () => {
      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        generateAbacusInstructions(89, 95) // Complex multi-place operation
      }

      const end = performance.now()
      const timePerOperation = (end - start) / 1000

      // Should take less than 2ms per operation on average
      expect(timePerOperation).toBeLessThan(2)
    })
  })

  describe('Input validation and error handling', () => {
    it('should handle negative start values gracefully', () => {
      expect(() => generateAbacusInstructions(-1, 5)).not.toThrow()
    })

    it('should handle negative target values gracefully', () => {
      expect(() => generateAbacusInstructions(5, -1)).not.toThrow()
    })

    it('should handle values exceeding normal abacus range', () => {
      expect(() => generateAbacusInstructions(0, 12345)).not.toThrow()
    })

    it('should handle very large differences', () => {
      expect(() => generateAbacusInstructions(1, 999)).not.toThrow()
    })
  })
})