import { describe, it, expect } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('Pedagogical Expansion Algorithm - Addition Only', () => {

  describe('Level 1: Direct Entry (No Complements)', () => {
    const directEntryTests = [
      {
        start: 0, target: 1,
        expected: {
          decomposition: '0 + 1 = 1',
          meaningful: false,
          steps: [{ term: '1', value: 1, instruction: /add.*1.*earth/i }]
        }
      },
      {
        start: 1, target: 3,
        expected: {
          decomposition: '1 + 2 = 3',
          meaningful: false,
          steps: [{ term: '2', value: 3, instruction: /add.*2.*earth/i }]
        }
      },
      {
        start: 0, target: 4,
        expected: {
          decomposition: '0 + 4 = 4',
          meaningful: false,
          steps: [{ term: '4', value: 4, instruction: /add.*4.*earth/i }]
        }
      },
      {
        start: 0, target: 5,
        expected: {
          decomposition: '0 + 5 = 5',
          meaningful: false,
          steps: [{ term: '5', value: 5, instruction: /activate.*heaven/i }]
        }
      },
      {
        start: 5, target: 7,
        expected: {
          decomposition: '5 + 2 = 7',
          meaningful: false,
          steps: [{ term: '2', value: 7, instruction: /add.*2.*earth/i }]
        }
      },
      {
        start: 0, target: 10,
        expected: {
          decomposition: '0 + 10 = 10',
          meaningful: false,
          steps: [{ term: '10', value: 10, instruction: /add.*1.*tens/i }]
        }
      }
    ]

    directEntryTests.forEach(test => {
      it(`should handle direct entry: ${test.start} + ${test.target - test.start} = ${test.target}`, () => {
        const result = generateUnifiedInstructionSequence(test.start, test.target)

        expect(result.fullDecomposition).toContain(test.expected.decomposition)
        expect(result.isMeaningfulDecomposition).toBe(test.expected.meaningful)
        expect(result.steps).toHaveLength(test.expected.steps.length)

        test.expected.steps.forEach((expectedStep, i) => {
          expect(result.steps[i].mathematicalTerm).toBe(expectedStep.term)
          expect(result.steps[i].expectedValue).toBe(expectedStep.value)
          expect(result.steps[i].englishInstruction).toMatch(expectedStep.instruction)
        })
      })
    })
  })

  describe('Level 2: Five-Complements Required', () => {
    const fiveComplementTests = [
      {
        start: 4, target: 7, // 4 + 3, but can't add 3 lowers (4+3=7 lowers, max is 4)
        expected: {
          decomposition: '4 + 3 = 4 + (5 - 2) = 7',
          meaningful: true,
          steps: [
            { term: '5', value: 9, instruction: /add.*5/i }, // Add upper bead
            { term: '-2', value: 7, instruction: /remove.*2.*earth/i } // Remove 2 lowers
          ]
        }
      },
      {
        start: 3, target: 5, // 3 + 2, but can't add 2 lowers (3+2=5 lowers, max is 4)
        expected: {
          decomposition: '3 + 2 = 3 + (5 - 3) = 5',
          meaningful: true,
          steps: [
            { term: '5', value: 8, instruction: /add.*5/i },
            { term: '-3', value: 5, instruction: /remove.*3.*earth/i }
          ]
        }
      },
      {
        start: 2, target: 3, // 2 + 1, but can't add 1 lower (2+1=3 lowers, this should actually be direct)
        expected: {
          decomposition: '2 + 1 = 3',
          meaningful: false, // This is direct addition
          steps: [{ term: '1', value: 3, instruction: /add.*1.*earth/i }]
        }
      },
      {
        start: 0, target: 6, // 0 + 6 = 5 + 1 (direct decomposition, not complement)
        expected: {
          decomposition: '0 + 6 = 0 + 5 + 1 = 6',
          meaningful: false, // Direct: activate heaven, add 1 lower
          steps: [
            { term: '5', value: 5, instruction: /activate.*heaven/i },
            { term: '1', value: 6, instruction: /add.*1.*earth/i }
          ]
        }
      },
      {
        start: 1, target: 5, // 1 + 4, but can't add 4 lowers (1+4=5 lowers, max is 4)
        expected: {
          decomposition: '1 + 4 = 1 + (5 - 1) = 5',
          meaningful: true,
          steps: [
            { term: '5', value: 6, instruction: /add.*5/i },
            { term: '-1', value: 5, instruction: /remove.*1.*earth/i }
          ]
        }
      }
    ]

    fiveComplementTests.forEach(test => {
      it(`should handle five-complement: ${test.start} → ${test.target}`, () => {
        const result = generateUnifiedInstructionSequence(test.start, test.target)

        expect(result.fullDecomposition).toContain(test.expected.decomposition)
        expect(result.isMeaningfulDecomposition).toBe(test.expected.meaningful)
        expect(result.steps).toHaveLength(test.expected.steps.length)

        test.expected.steps.forEach((expectedStep, i) => {
          expect(result.steps[i].mathematicalTerm).toBe(expectedStep.term)
          expect(result.steps[i].expectedValue).toBe(expectedStep.value)
          expect(result.steps[i].englishInstruction).toMatch(expectedStep.instruction)
        })
      })
    })
  })

  describe('Level 3: Ten-Complements Required', () => {
    const tenComplementTests = [
      {
        start: 4, target: 11, // 4 + 7, a+d = 11 ≥ 10
        expected: {
          decomposition: '4 + 7 = 4 + (10 - 3) = 11',
          meaningful: true,
          steps: [
            { term: '10', value: 14, instruction: /add.*1.*tens/i },
            { term: '-3', value: 11, instruction: /remove.*3.*earth/i }
          ]
        }
      },
      {
        start: 6, target: 15, // 6 + 9, a+d = 15 ≥ 10
        expected: {
          decomposition: '6 + 9 = 6 + (10 - 1) = 15',
          meaningful: true,
          steps: [
            { term: '10', value: 16, instruction: /add.*1.*tens/i },
            { term: '-1', value: 15, instruction: /remove.*1.*earth/i }
          ]
        }
      },
      {
        start: 7, target: 15, // 7 + 8, a+d = 15 ≥ 10
        expected: {
          decomposition: '7 + 8 = 7 + (10 - 2) = 15',
          meaningful: true,
          steps: [
            { term: '10', value: 17, instruction: /add.*1.*tens/i },
            { term: '-2', value: 15, instruction: /remove.*2.*earth/i }
          ]
        }
      },
      {
        start: 5, target: 9, // 5 + 4, a+d = 9 ≤ 9 (should be direct)
        expected: {
          decomposition: '5 + 4 = 9',
          meaningful: false,
          steps: [{ term: '4', value: 9, instruction: /add.*4.*earth/i }]
        }
      },
      {
        start: 9, target: 18, // 9 + 9, a+d = 18 ≥ 10
        expected: {
          decomposition: '9 + 9 = 9 + (10 - 1) = 18',
          meaningful: true,
          steps: [
            { term: '10', value: 19, instruction: /add.*1.*tens/i },
            { term: '-1', value: 18, instruction: /remove.*1.*earth/i }
          ]
        }
      }
    ]

    tenComplementTests.forEach(test => {
      it(`should handle ten-complement: ${test.start} → ${test.target}`, () => {
        const result = generateUnifiedInstructionSequence(test.start, test.target)

        expect(result.fullDecomposition).toContain(test.expected.decomposition)
        expect(result.isMeaningfulDecomposition).toBe(test.expected.meaningful)
        expect(result.steps).toHaveLength(test.expected.steps.length)

        test.expected.steps.forEach((expectedStep, i) => {
          expect(result.steps[i].mathematicalTerm).toBe(expectedStep.term)
          expect(result.steps[i].expectedValue).toBe(expectedStep.value)
          expect(result.steps[i].englishInstruction).toMatch(expectedStep.instruction)
        })
      })
    })
  })

  describe('Level 4: Multi-Place Value Operations', () => {
    const multiPlaceTests = [
      {
        start: 12, target: 34,
        expected: {
          decomposition: '12 + 22 = 12 + 20 + 2 = 34',
          meaningful: true,
          steps: [
            { term: '20', value: 32, instruction: /add.*2.*tens/i },
            { term: '2', value: 34, instruction: /add.*2.*earth/i }
          ]
        }
      },
      {
        start: 23, target: 47,
        expected: {
          decomposition: '23 + 24 = 23 + 20 + (5 - 1) = 47',
          meaningful: true,
          steps: [
            { term: '20', value: 43, instruction: /add.*2.*tens/i },
            { term: '5', value: 48, instruction: /add.*5/i },
            { term: '-1', value: 47, instruction: /remove.*1.*earth/i }
          ]
        }
      },
      {
        start: 34, target: 78,
        expected: {
          decomposition: '34 + 44 = 34 + (50 - 10) + (5 - 1) = 78',
          meaningful: true,
          steps: [
            { term: '50', value: 84, instruction: /add.*5.*tens/i },
            { term: '-10', value: 74, instruction: /remove.*1.*tens/i },
            { term: '5', value: 79, instruction: /add.*5/i },
            { term: '-1', value: 78, instruction: /remove.*1.*earth/i }
          ]
        }
      }
    ]

    multiPlaceTests.forEach(test => {
      it(`should handle multi-place: ${test.start} → ${test.target}`, () => {
        const result = generateUnifiedInstructionSequence(test.start, test.target)

        expect(result.fullDecomposition).toContain(test.expected.decomposition)
        expect(result.isMeaningfulDecomposition).toBe(test.expected.meaningful)
        expect(result.steps).toHaveLength(test.expected.steps.length)

        test.expected.steps.forEach((expectedStep, i) => {
          expect(result.steps[i].mathematicalTerm).toBe(expectedStep.term)
          expect(result.steps[i].expectedValue).toBe(expectedStep.value)
          expect(result.steps[i].englishInstruction).toMatch(expectedStep.instruction)
        })
      })
    })
  })

  describe('Level 5: Complex Cases with Cascading Complements', () => {
    const complexTests = [
      {
        start: 89, target: 97,
        expected: {
          decomposition: '89 + 8 = 89 + (10 - 2) = 97',
          meaningful: true,
          steps: [
            { term: '10', value: 99, instruction: /add.*1.*tens/i },
            { term: '-2', value: 97, instruction: /remove.*2.*earth/i }
          ]
        }
      },
      {
        start: 99, target: 107,
        expected: {
          decomposition: '99 + 8 = 99 + (100 - 90 - 2) = 107',
          meaningful: true,
          steps: [
            { term: '100', value: 199, instruction: /add.*1.*hundreds/i },
            { term: '-90', value: 109, instruction: /remove.*9.*tens/i },
            { term: '-2', value: 107, instruction: /remove.*2.*earth/i }
          ]
        }
      }
    ]

    complexTests.forEach(test => {
      it(`should handle cascading complements: ${test.start} → ${test.target}`, () => {
        const result = generateUnifiedInstructionSequence(test.start, test.target)

        expect(result.fullDecomposition).toContain(test.expected.decomposition)
        expect(result.isMeaningfulDecomposition).toBe(test.expected.meaningful)
        expect(result.steps).toHaveLength(test.expected.steps.length)

        test.expected.steps.forEach((expectedStep, i) => {
          expect(result.steps[i].mathematicalTerm).toBe(expectedStep.term)
          expect(result.steps[i].expectedValue).toBe(expectedStep.value)
          expect(result.steps[i].englishInstruction).toMatch(expectedStep.instruction)
        })
      })
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should handle zero difference (no operation)', () => {
      const result = generateUnifiedInstructionSequence(5, 5)
      expect(result.isMeaningfulDecomposition).toBe(false)
      expect(result.steps).toHaveLength(0)
      expect(result.fullDecomposition).toBe('5 + 0 = 5')
    })

    it('should maintain abacus state consistency throughout', () => {
      const result = generateUnifiedInstructionSequence(0, 17)

      // Each step should have valid expected state
      result.steps.forEach(step => {
        expect(step.expectedState).toBeDefined()
        expect(step.expectedValue).toBeGreaterThan(0)
        expect(step.isValid).toBe(true)
      })

      // Final step should reach target
      const finalStep = result.steps[result.steps.length - 1]
      expect(finalStep.expectedValue).toBe(17)
    })

    it('should generate proper bead movement data', () => {
      const result = generateUnifiedInstructionSequence(0, 6)

      result.steps.forEach(step => {
        expect(Array.isArray(step.beadMovements)).toBe(true)
        step.beadMovements.forEach(movement => {
          expect(movement).toHaveProperty('placeValue')
          expect(movement).toHaveProperty('beadType')
          expect(movement).toHaveProperty('direction')
        })
      })
    })
  })

  describe('Algorithm Bookkeeping Verification', () => {
    it('should track abacus state after every operation', () => {
      const result = generateUnifiedInstructionSequence(34, 89)

      let currentValue = 34
      result.steps.forEach(step => {
        // Each step should progress toward target
        expect(step.expectedValue).not.toBe(currentValue)
        currentValue = step.expectedValue

        // State should be valid for abacus constraints
        Object.values(step.expectedState).forEach(beadState => {
          expect(beadState.earthActive).toBeGreaterThanOrEqual(0)
          expect(beadState.earthActive).toBeLessThanOrEqual(4)
          expect(typeof beadState.heavenActive).toBe('boolean')
        })
      })

      // Final value should match target
      expect(currentValue).toBe(89)
    })

    it('should make correct complement decisions based on current state', () => {
      // Test case where heaven bead is already active
      const result = generateUnifiedInstructionSequence(7, 13) // 7 + 6

      // Should NOT use five-complement for 6 since heaven already active
      // Should either use ten-complement or break down 6 differently
      const hasInvalidFiveComplement = result.fullDecomposition.includes('(5 + 1)')
      expect(hasInvalidFiveComplement).toBe(false)
    })
  })
})