import { describe, it, expect } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('Unified Step Generator', () => {
  it('should generate consistent step data for 3 + 14 = 17', () => {
    const sequence = generateUnifiedInstructionSequence(3, 17)

    // Check overall decomposition
    expect(sequence.fullDecomposition).toContain('3 + 14 = 3 +')
    expect(sequence.fullDecomposition).toContain('= 17')
    expect(sequence.startValue).toBe(3)
    expect(sequence.targetValue).toBe(17)

    // Should have multiple steps
    expect(sequence.steps.length).toBeGreaterThan(1)

    // Each step should be valid
    sequence.steps.forEach((step, index) => {
      expect(step.isValid).toBe(true)
      expect(step.stepIndex).toBe(index)
      expect(step.mathematicalTerm).toBeDefined()
      expect(step.englishInstruction).toBeDefined()
      expect(step.expectedValue).toBeGreaterThan(3)
      expect(step.expectedValue).toBeLessThanOrEqual(17)
      expect(step.beadMovements.length).toBeGreaterThan(0)
    })

    // Steps should progress logically
    expect(sequence.steps[0].expectedValue).toBeGreaterThan(3)
    expect(sequence.steps[sequence.steps.length - 1].expectedValue).toBe(17)

    console.log('3 + 14 = 17 Unified Sequence:')
    console.log('Full decomposition:', sequence.fullDecomposition)
    sequence.steps.forEach((step, i) => {
      console.log(`Step ${i + 1}:`)
      console.log(`  Math term: ${step.mathematicalTerm}`)
      console.log(`  Instruction: ${step.englishInstruction}`)
      console.log(`  Expected value: ${step.expectedValue}`)
      console.log(`  Bead movements: ${step.beadMovements.length}`)
    })
  })

  it('should generate consistent step data for 7 + 4 = 11 (ten complement)', () => {
    const sequence = generateUnifiedInstructionSequence(7, 11)

    expect(sequence.fullDecomposition).toContain('7 + 4 = 7 +')
    expect(sequence.fullDecomposition).toContain('= 11')

    // Should have steps involving both tens and ones places
    const allMovements = sequence.steps.flatMap(step => step.beadMovements)
    const places = new Set(allMovements.map(movement => movement.placeValue))
    expect(places).toContain(0) // ones place
    expect(places).toContain(1) // tens place

    // Each step should be valid and consistent
    sequence.steps.forEach(step => {
      expect(step.isValid).toBe(true)
      expect(step.validationIssues).toEqual([])
    })

    console.log('7 + 4 = 11 Unified Sequence:')
    console.log('Full decomposition:', sequence.fullDecomposition)
    sequence.steps.forEach((step, i) => {
      console.log(`Step ${i + 1}:`)
      console.log(`  Math term: ${step.mathematicalTerm}`)
      console.log(`  Instruction: ${step.englishInstruction}`)
      console.log(`  Expected value: ${step.expectedValue}`)
      console.log(`  Movements: ${step.beadMovements.map(m => `${m.placeValue}:${m.beadType}:${m.direction}`).join(', ')}`)
    })
  })

  it('should ensure perfect consistency between all aspects', () => {
    const testCases = [
      { start: 3, target: 17 },
      { start: 7, target: 11 },
      { start: 2, target: 5 },
      { start: 56, target: 104 }
    ]

    testCases.forEach(({ start, target }) => {
      const sequence = generateUnifiedInstructionSequence(start, target)

      // All steps must be valid (no inconsistencies)
      sequence.steps.forEach((step, index) => {
        expect(step.isValid).toBe(true)

        if (!step.isValid) {
          console.error(`Step ${index} validation failed for ${start} + ${target - start}:`, step.validationIssues)
        }
      })

      // Final step should reach target value
      const lastStep = sequence.steps[sequence.steps.length - 1]
      expect(lastStep.expectedValue).toBe(target)

      // No step should have impossible expected values
      sequence.steps.forEach(step => {
        expect(step.expectedValue).toBeGreaterThanOrEqual(0)
        expect(step.expectedValue).toBeLessThan(10000) // reasonable bounds
      })
    })
  })

  it('should maintain pedagogical ordering', () => {
    const sequence = generateUnifiedInstructionSequence(99, 100)

    // Should process highest place values first
    const firstStepMovements = sequence.steps[0].beadMovements
    const firstStepPlaces = firstStepMovements.map(m => m.placeValue)

    // First step should involve hundreds place for 99 + 1
    expect(firstStepPlaces).toContain(2) // hundreds place

    console.log('99 + 1 = 100 Unified Sequence:')
    console.log('Full decomposition:', sequence.fullDecomposition)
    sequence.steps.forEach((step, i) => {
      console.log(`Step ${i + 1}:`)
      console.log(`  Math term: ${step.mathematicalTerm}`)
      console.log(`  Instruction: ${step.englishInstruction}`)
      console.log(`  Expected value: ${step.expectedValue}`)
    })
  })

  it('should handle edge cases without errors', () => {
    const edgeCases = [
      { start: 0, target: 1 },
      { start: 4, target: 5 },
      { start: 9, target: 10 },
      { start: 99, target: 100 }
    ]

    edgeCases.forEach(({ start, target }) => {
      expect(() => {
        const sequence = generateUnifiedInstructionSequence(start, target)
        expect(sequence.steps.length).toBeGreaterThan(0)
        expect(sequence.steps.every(step => step.isValid)).toBe(true)
      }).not.toThrow()
    })
  })

  it('should generate correct term positions for precise highlighting', () => {
    const sequence = generateUnifiedInstructionSequence(3, 17)

    // Full decomposition should be "3 + 14 = 3 + 10 + (5 - 1) = 17"
    expect(sequence.fullDecomposition).toBe('3 + 14 = 3 + 10 + (5 - 1) = 17')

    // Each step should have valid position information
    sequence.steps.forEach((step, index) => {
      expect(step.termPosition).toBeDefined()
      expect(step.termPosition.startIndex).toBeGreaterThanOrEqual(0)
      expect(step.termPosition.endIndex).toBeGreaterThan(step.termPosition.startIndex)

      // Extract the term using the position and verify it matches
      const { startIndex, endIndex } = step.termPosition
      const extractedTerm = sequence.fullDecomposition.substring(startIndex, endIndex)
      expect(extractedTerm).toBe(step.mathematicalTerm)

      console.log(`Step ${index + 1}: "${step.mathematicalTerm}" at position ${startIndex}-${endIndex} = "${extractedTerm}"`)
    })

    // Verify specific positions for known case "3 + 14 = 3 + 10 + (5 - 1) = 17"
    //                                             0123456789012345678901234567890123456
    //                                             0         1         2         3
    // First step should be "10" at position around 13-15
    const firstStep = sequence.steps[0]
    expect(firstStep.mathematicalTerm).toBe('10')
    expect(sequence.fullDecomposition.substring(firstStep.termPosition.startIndex, firstStep.termPosition.endIndex)).toBe('10')

    // Second step should be "(5 - 1)" at position around 18-25
    const secondStep = sequence.steps[1]
    expect(secondStep.mathematicalTerm).toBe('(5 - 1)')
    expect(sequence.fullDecomposition.substring(secondStep.termPosition.startIndex, secondStep.termPosition.endIndex)).toBe('(5 - 1)')
  })
})