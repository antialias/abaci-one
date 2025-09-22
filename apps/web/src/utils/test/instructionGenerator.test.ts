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

      // Should highlight earth bead to remove
      const earthBead = instruction.highlightBeads.find(b => b.beadType === 'earth')
      expect(earthBead).toBeDefined()
      expect(earthBead?.position).toBe(0)
    })

    it('should generate correct instructions for ten complement', () => {
      const instruction = generateAbacusInstructions(7, 11) // 7 + 4

      expect(instruction.highlightBeads).toHaveLength(4) // tens heaven + ones heaven + 2 ones earth
      expect(instruction.expectedAction).toBe('multi-step')
      expect(instruction.actionDescription).toContain('ten complement')

      // Should highlight tens place heaven bead
      const tensHeaven = instruction.highlightBeads.find(b => b.placeValue === 1 && b.beadType === 'heaven')
      expect(tensHeaven).toBeDefined()

      // Should highlight ones place beads to remove
      const onesBeads = instruction.highlightBeads.filter(b => b.placeValue === 0)
      expect(onesBeads).toHaveLength(3) // ones heaven + 2 ones earth
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
})