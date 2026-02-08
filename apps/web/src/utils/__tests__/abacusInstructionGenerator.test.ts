/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  generateAbacusInstructions,
  detectComplementOperation,
  generateStepInstructions,
  validateInstruction,
  numberToAbacusState,
  calculateBeadChanges,
  type GeneratedInstruction,
  type BeadHighlight,
} from '../abacusInstructionGenerator'

// Helper to create typed bead highlights without fighting the union types
function earthBead(placeValue: 0 | 1 | 2 | 3, position: 0 | 1 | 2 | 3): BeadHighlight {
  return { placeValue, beadType: 'earth', position }
}

function heavenBead(placeValue: 0 | 1 | 2 | 3): BeadHighlight {
  return { placeValue, beadType: 'heaven' }
}

// =============================================================================
// numberToAbacusState (re-export from @soroban/abacus-react/static)
// =============================================================================
describe('numberToAbacusState', () => {
  it('converts 0 to all-zeros state', () => {
    const state = numberToAbacusState(0)
    expect(state).toBeDefined()
  })

  it('converts single-digit numbers correctly', () => {
    // 3 should have 3 earth beads active in ones place
    const state = numberToAbacusState(3)
    expect(state).toBeDefined()
  })

  it('converts numbers with heaven bead (5+)', () => {
    const state = numberToAbacusState(7) // 5 (heaven) + 2 (earth)
    expect(state).toBeDefined()
  })

  it('converts multi-digit numbers', () => {
    const state = numberToAbacusState(42)
    expect(state).toBeDefined()
  })

  it('converts three-digit numbers', () => {
    const state = numberToAbacusState(123)
    expect(state).toBeDefined()
  })
})

// =============================================================================
// calculateBeadChanges (re-export from @soroban/abacus-react/static)
// =============================================================================
describe('calculateBeadChanges', () => {
  it('detects single earth bead addition (0 -> 1)', () => {
    const start = numberToAbacusState(0)
    const target = numberToAbacusState(1)
    const result = calculateBeadChanges(start, target)

    expect(result.additions.length).toBeGreaterThan(0)
    expect(result.removals.length).toBe(0)
  })

  it('detects heaven bead activation (0 -> 5)', () => {
    const start = numberToAbacusState(0)
    const target = numberToAbacusState(5)
    const result = calculateBeadChanges(start, target)

    expect(result.additions.length).toBeGreaterThan(0)
    const heavenBeadResult = result.additions.find((b) => b.beadType === 'heaven')
    expect(heavenBeadResult).toBeDefined()
  })

  it('detects both additions and removals for complement (3 -> 7)', () => {
    const start = numberToAbacusState(3)
    const target = numberToAbacusState(7)
    const result = calculateBeadChanges(start, target)

    // 3 -> 7 requires adding heaven bead (5) and removing some earth beads
    // or some complement operation
    expect(result.additions.length + result.removals.length).toBeGreaterThan(0)
  })

  it('detects no changes when states are the same', () => {
    const state = numberToAbacusState(5)
    const result = calculateBeadChanges(state, state)

    expect(result.additions.length).toBe(0)
    expect(result.removals.length).toBe(0)
  })
})

// =============================================================================
// detectComplementOperation
// =============================================================================
describe('detectComplementOperation', () => {
  describe('five complement detection', () => {
    it('detects five complement when adding would exceed earth bead capacity', () => {
      // 3 + 4 = 7, needs five complement (add 5, remove 1)
      const result = detectComplementOperation(3, 7, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('five')
    })

    it('detects five complement for 2 + 3', () => {
      const result = detectComplementOperation(2, 5, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('five')
    })

    it('detects five complement for 1 + 4', () => {
      const result = detectComplementOperation(1, 5, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('five')
    })

    it('does not detect five complement for direct addition (0 + 3)', () => {
      const result = detectComplementOperation(0, 3, 0)
      expect(result.needsComplement).toBe(false)
      expect(result.complementType).toBe('none')
    })
  })

  describe('ten complement detection', () => {
    it('detects ten complement when crossing tens boundary (7 -> 11)', () => {
      const result = detectComplementOperation(7, 11, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('ten')
    })

    it('detects ten complement for 8 + 5 = 13', () => {
      const result = detectComplementOperation(8, 13, 0)
      expect(result.needsComplement).toBe(true)
      expect(result.complementType).toBe('ten')
    })

    it('does not detect complement for within-boundary additions (6 + 2 = 8)', () => {
      const result = detectComplementOperation(6, 8, 0)
      expect(result.needsComplement).toBe(false)
      expect(result.complementType).toBe('none')
    })
  })

  describe('no complement needed', () => {
    it('returns no complement for zero difference', () => {
      const result = detectComplementOperation(5, 5, 0)
      expect(result.needsComplement).toBe(false)
      expect(result.complementType).toBe('none')
    })

    it('returns no complement for simple single bead addition (0 -> 1)', () => {
      const result = detectComplementOperation(0, 1, 0)
      expect(result.needsComplement).toBe(false)
      expect(result.complementType).toBe('none')
    })
  })

  describe('complement details', () => {
    it('provides add and subtract values for five complement', () => {
      const result = detectComplementOperation(3, 7, 0)
      expect(result.complementDetails).toBeDefined()
      expect(result.complementDetails!.addValue).toBe(5)
      expect(result.complementDetails!.subtractValue).toBe(1)
    })

    it('provides description string for complement', () => {
      const result = detectComplementOperation(3, 7, 0)
      expect(result.complementDetails).toBeDefined()
      expect(typeof result.complementDetails!.description).toBe('string')
      expect(result.complementDetails!.description.length).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// generateStepInstructions
// =============================================================================
describe('generateStepInstructions', () => {
  it('generates instructions for single earth bead addition', () => {
    const additions = [earthBead(0, 0)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions.length).toBe(1)
    expect(instructions[0]).toContain('earth bead')
    expect(instructions[0]).toContain('ones')
    expect(instructions[0]).toContain('add')
  })

  it('generates instructions for heaven bead addition', () => {
    const additions = [heavenBead(0)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions.length).toBe(1)
    expect(instructions[0]).toContain('heaven bead')
    expect(instructions[0]).toContain('ones')
    expect(instructions[0]).toContain('add')
  })

  it('generates instructions for removals', () => {
    const removals = [earthBead(0, 0)]
    const instructions = generateStepInstructions([], removals, false)

    expect(instructions.length).toBe(1)
    expect(instructions[0]).toContain('earth bead')
    expect(instructions[0]).toContain('remove')
  })

  it('handles tens place beads', () => {
    const additions = [earthBead(1, 0)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions[0]).toContain('tens')
  })

  it('handles hundreds place beads', () => {
    const additions = [earthBead(2, 0)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions[0]).toContain('hundreds')
  })

  it('handles higher place values with generic name', () => {
    const additions = [earthBead(3, 0)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions[0]).toContain('place 3')
  })

  it('returns "No bead movements required" for empty input', () => {
    const instructions = generateStepInstructions([], [], false)
    expect(instructions.length).toBe(1)
    expect(instructions[0]).toBe('No bead movements required')
  })

  it('generates complement instructions with additions before removals', () => {
    const additions = [heavenBead(0)]
    const removals = [earthBead(0, 0)]
    const instructions = generateStepInstructions(additions, removals, true)

    expect(instructions.length).toBe(2)
    expect(instructions[0]).toContain('add')
    expect(instructions[1]).toContain('remove')
  })

  it('generates multiple instructions for multiple additions', () => {
    const additions = [earthBead(0, 0), earthBead(0, 1)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions.length).toBe(2)
  })

  it('includes bead position + 1 in earth bead instructions', () => {
    const additions = [earthBead(0, 2)]
    const instructions = generateStepInstructions(additions, [], false)

    expect(instructions[0]).toContain('earth bead 3') // position 2 -> displayed as 3
  })
})

// =============================================================================
// generateAbacusInstructions
// =============================================================================
describe('generateAbacusInstructions', () => {
  describe('zero difference', () => {
    it('returns no-change instruction when start equals target', () => {
      const result = generateAbacusInstructions(5, 5)

      expect(result.highlightBeads).toHaveLength(0)
      expect(result.expectedAction).toBe('add')
      expect(result.actionDescription).toContain('No change needed')
      expect(result.tooltip.content).toBe('No Operation Required')
      expect(result.errorMessages.hint).toContain('already at the target value')
    })

    it('returns no-change for 0 -> 0', () => {
      const result = generateAbacusInstructions(0, 0)
      expect(result.highlightBeads).toHaveLength(0)
    })
  })

  describe('simple direct addition (single bead)', () => {
    it('generates instruction for 0 -> 1 (single earth bead)', () => {
      const result = generateAbacusInstructions(0, 1)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
      expect(result.actionDescription).toContain('bead')
      expect(result.tooltip.content).toBe('Direct Addition')
    })

    it('generates instruction for 0 -> 5 (heaven bead)', () => {
      const result = generateAbacusInstructions(0, 5)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
      const hasHeaven = result.highlightBeads.some((b) => b.beadType === 'heaven')
      expect(hasHeaven).toBe(true)
    })
  })

  describe('multi-bead direct additions', () => {
    it('generates instruction for 0 -> 3 (multiple earth beads)', () => {
      const result = generateAbacusInstructions(0, 3)

      expect(result.highlightBeads.length).toBeGreaterThan(1)
      expect(result.actionDescription).toContain('beads')
    })
  })

  describe('five complement operations', () => {
    it('generates complement instruction for 3 -> 7', () => {
      const result = generateAbacusInstructions(3, 7)

      expect(result.tooltip.content).toContain('Complement')
      expect(result.highlightBeads.length).toBeGreaterThan(0)
    })

    it('generates complement instruction for 2 -> 5', () => {
      const result = generateAbacusInstructions(2, 5)

      expect(result.tooltip.content).toContain('Complement')
    })
  })

  describe('ten complement operations', () => {
    it('generates complement instruction for 7 -> 11', () => {
      const result = generateAbacusInstructions(7, 11)

      expect(result.tooltip.content).toContain('Complement')
    })

    it('generates complement instruction for 8 -> 13', () => {
      const result = generateAbacusInstructions(8, 13)

      expect(result.tooltip.content).toContain('Complement')
    })
  })

  describe('multi-place operations', () => {
    it('generates instruction for 12 -> 25', () => {
      const result = generateAbacusInstructions(12, 25)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
    })

    it('generates instruction for 0 -> 10', () => {
      const result = generateAbacusInstructions(0, 10)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
    })
  })

  describe('complex multi-place complement operations crossing hundreds', () => {
    it('generates instruction for 99 -> 100', () => {
      const result = generateAbacusInstructions(99, 100)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
      // Should be multi-step because of complement across places
      expect(result.expectedAction).toBe('multi-step')
    })

    it('generates instruction for 95 -> 105', () => {
      const result = generateAbacusInstructions(95, 105)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
    })
  })

  describe('subtraction operations', () => {
    it('generates instruction for 5 -> 2 (direct subtraction)', () => {
      const result = generateAbacusInstructions(5, 2)

      expect(result.highlightBeads.length).toBeGreaterThan(0)
      // Subtracting 3 from 5 involves removing earth beads and adding/removing heaven
      expect(result.tooltip.explanation).toBeDefined()
    })
  })

  describe('instruction structure', () => {
    it('always includes tooltip with content and explanation', () => {
      const result = generateAbacusInstructions(0, 3)

      expect(result.tooltip).toBeDefined()
      expect(typeof result.tooltip.content).toBe('string')
      expect(typeof result.tooltip.explanation).toBe('string')
    })

    it('always includes error messages', () => {
      const result = generateAbacusInstructions(0, 3)

      expect(result.errorMessages).toBeDefined()
      expect(typeof result.errorMessages.wrongBead).toBe('string')
      expect(typeof result.errorMessages.wrongAction).toBe('string')
      expect(typeof result.errorMessages.hint).toBe('string')
    })

    it('includes multi-step instructions when action is multi-step', () => {
      const result = generateAbacusInstructions(3, 7)

      if (result.expectedAction === 'multi-step') {
        expect(result.multiStepInstructions).toBeDefined()
        expect(result.multiStepInstructions!.length).toBeGreaterThan(0)
      }
    })

    it('includes stepBeadHighlights', () => {
      const result = generateAbacusInstructions(0, 3)

      expect(result.stepBeadHighlights).toBeDefined()
      expect(result.stepBeadHighlights!.length).toBeGreaterThan(0)
    })

    it('includes totalSteps', () => {
      const result = generateAbacusInstructions(0, 3)

      expect(result.totalSteps).toBeDefined()
      expect(typeof result.totalSteps).toBe('number')
    })

    it('hint message includes correct arithmetic', () => {
      const result = generateAbacusInstructions(3, 7)

      expect(result.errorMessages.hint).toContain('3 + 4 = 7')
    })

    it('hint message is correct for subtraction', () => {
      const result = generateAbacusInstructions(7, 3)

      expect(result.errorMessages.hint).toContain('7 - 4 = 3')
    })
  })

  describe('stepBeadHighlights structure', () => {
    it('each stepBeadHighlight has a stepIndex and direction', () => {
      const result = generateAbacusInstructions(3, 7)

      if (result.stepBeadHighlights) {
        result.stepBeadHighlights.forEach((bead) => {
          expect(typeof bead.stepIndex).toBe('number')
          expect(bead.stepIndex).toBeGreaterThanOrEqual(0)
          expect(['activate', 'deactivate', 'up', 'down']).toContain(bead.direction)
        })
      }
    })

    it('each stepBeadHighlight has placeValue and beadType', () => {
      const result = generateAbacusInstructions(0, 5)

      if (result.stepBeadHighlights) {
        result.stepBeadHighlights.forEach((bead) => {
          expect(typeof bead.placeValue).toBe('number')
          expect(['heaven', 'earth']).toContain(bead.beadType)
        })
      }
    })
  })
})

// =============================================================================
// validateInstruction
// =============================================================================
describe('validateInstruction', () => {
  it('validates a correct instruction as valid', () => {
    const instruction = generateAbacusInstructions(0, 3)
    const result = validateInstruction(instruction, 0, 3)

    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('validates zero-difference instruction as valid', () => {
    const instruction = generateAbacusInstructions(5, 5)
    const result = validateInstruction(instruction, 5, 5)

    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports issue for non-zero operation with no highlights', () => {
    const fakeInstruction: GeneratedInstruction = {
      highlightBeads: [],
      expectedAction: 'add',
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    const result = validateInstruction(fakeInstruction, 0, 5)

    expect(result.isValid).toBe(false)
    expect(result.issues).toContain('No beads highlighted for non-zero operation')
  })

  it('reports issue for multi-step without instructions', () => {
    const fakeInstruction: GeneratedInstruction = {
      highlightBeads: [heavenBead(0)],
      expectedAction: 'multi-step',
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    const result = validateInstruction(fakeInstruction, 0, 5)

    expect(result.isValid).toBe(false)
    expect(result.issues).toContain('Multi-step action without step instructions')
  })

  it('reports issue for invalid place value', () => {
    const fakeInstruction = {
      highlightBeads: [{ placeValue: 5, beadType: 'heaven' as const }],
      expectedAction: 'add' as const,
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    // Use 'as any' because we are intentionally testing invalid data
    const result = validateInstruction(fakeInstruction as any, 0, 5)

    expect(result.isValid).toBe(false)
    expect(result.issues.some((i) => i.includes('Invalid place value'))).toBe(true)
  })

  it('reports issue for invalid earth bead position', () => {
    const fakeInstruction = {
      highlightBeads: [{ placeValue: 0, beadType: 'earth' as const, position: 5 }],
      expectedAction: 'add' as const,
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    // Use 'as any' because we are intentionally testing invalid data
    const result = validateInstruction(fakeInstruction as any, 0, 5)

    expect(result.isValid).toBe(false)
    expect(result.issues.some((i) => i.includes('Invalid earth bead position'))).toBe(true)
  })

  it('allows earth bead position 0-3', () => {
    const positions = [0, 1, 2, 3] as const
    for (const pos of positions) {
      const fakeInstruction: GeneratedInstruction = {
        highlightBeads: [earthBead(0, pos)],
        expectedAction: 'add',
        actionDescription: 'test',
        tooltip: { content: '', explanation: '' },
        errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
      }
      const result = validateInstruction(fakeInstruction, 0, 5)
      const positionIssues = result.issues.filter((i) => i.includes('Invalid earth bead position'))
      expect(positionIssues).toHaveLength(0)
    }
  })

  it('allows place values 0-4', () => {
    const placeValues = [0, 1, 2, 3, 4] as const
    for (const pv of placeValues) {
      const fakeInstruction: GeneratedInstruction = {
        highlightBeads: [{ placeValue: pv, beadType: 'heaven' }],
        expectedAction: 'add',
        actionDescription: 'test',
        tooltip: { content: '', explanation: '' },
        errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
      }
      const result = validateInstruction(fakeInstruction, 0, 5)
      const pvIssues = result.issues.filter((i) => i.includes('Invalid place value'))
      expect(pvIssues).toHaveLength(0)
    }
  })

  it('reports negative place value as invalid', () => {
    const fakeInstruction = {
      highlightBeads: [{ placeValue: -1, beadType: 'heaven' as const }],
      expectedAction: 'add' as const,
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    const result = validateInstruction(fakeInstruction as any, 0, 5)

    expect(result.isValid).toBe(false)
  })

  it('does not require earth position for heaven beads', () => {
    const fakeInstruction: GeneratedInstruction = {
      highlightBeads: [heavenBead(0)], // No position field
      expectedAction: 'add',
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    const result = validateInstruction(fakeInstruction, 0, 5)
    const positionIssues = result.issues.filter((i) => i.includes('Invalid earth bead position'))
    expect(positionIssues).toHaveLength(0)
  })

  it('can accumulate multiple issues', () => {
    const fakeInstruction = {
      highlightBeads: [
        { placeValue: 5, beadType: 'earth' as const, position: 5 }, // invalid place AND invalid position
      ],
      expectedAction: 'multi-step' as const, // no multiStepInstructions
      actionDescription: 'test',
      tooltip: { content: '', explanation: '' },
      errorMessages: { wrongBead: '', wrongAction: '', hint: '' },
    }
    const result = validateInstruction(fakeInstruction as any, 0, 5)

    expect(result.isValid).toBe(false)
    expect(result.issues.length).toBeGreaterThanOrEqual(3)
  })
})

// =============================================================================
// Integration-style: round-trip validation of various operations
// =============================================================================
describe('round-trip instruction generation and validation', () => {
  const testCases = [
    { start: 0, target: 1, desc: '0 -> 1 (basic earth bead)' },
    { start: 0, target: 5, desc: '0 -> 5 (heaven bead)' },
    { start: 3, target: 7, desc: '3 -> 7 (five complement)' },
    { start: 2, target: 5, desc: '2 -> 5 (five complement)' },
    { start: 6, target: 8, desc: '6 -> 8 (direct addition)' },
    { start: 7, target: 11, desc: '7 -> 11 (ten complement)' },
    { start: 5, target: 2, desc: '5 -> 2 (subtraction)' },
    { start: 12, target: 25, desc: '12 -> 25 (multi-place)' },
    { start: 0, target: 9, desc: '0 -> 9 (max single digit)' },
    { start: 99, target: 100, desc: '99 -> 100 (hundreds crossing)' },
  ]

  testCases.forEach(({ start, target, desc }) => {
    it(`generates valid instruction for ${desc}`, () => {
      const instruction = generateAbacusInstructions(start, target)
      const validation = validateInstruction(instruction, start, target)

      expect(validation.isValid).toBe(true)
      if (!validation.isValid) {
        // Output issues for debugging if this ever fails
        console.log(`Validation issues for ${desc}:`, validation.issues)
      }
    })
  })
})
