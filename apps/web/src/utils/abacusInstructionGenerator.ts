// Automatic instruction generator for abacus tutorial steps
import { ValidPlaceValues } from '@soroban/abacus-react'

export interface BeadState {
  heavenActive: boolean
  earthActive: number // 0-4
}

export interface AbacusState {
  [placeValue: number]: BeadState
}

export interface BeadHighlight {
  placeValue: ValidPlaceValues
  beadType: 'heaven' | 'earth'
  position?: number
}

export interface GeneratedInstruction {
  highlightBeads: BeadHighlight[]
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string
  multiStepInstructions?: string[]
  tooltip: {
    content: string
    explanation: string
  }
  errorMessages: {
    wrongBead: string
    wrongAction: string
    hint: string
  }
}

// Convert a number to abacus state representation
export function numberToAbacusState(value: number, maxPlaces: number = 5): AbacusState {
  const state: AbacusState = {}

  for (let place = 0; place < maxPlaces; place++) {
    const placeValueNum = Math.pow(10, place)
    const digit = Math.floor(value / placeValueNum) % 10

    state[place] = {
      heavenActive: digit >= 5,
      earthActive: digit >= 5 ? digit - 5 : digit
    }
  }

  return state
}

// Calculate the difference between two abacus states
export function calculateBeadChanges(startState: AbacusState, targetState: AbacusState): {
  additions: BeadHighlight[]
  removals: BeadHighlight[]
  placeValue: number
} {
  const additions: BeadHighlight[] = []
  const removals: BeadHighlight[] = []
  let mainPlaceValue = 0

  for (const placeStr in targetState) {
    const place = parseInt(placeStr) as ValidPlaceValues
    const start = startState[place] || { heavenActive: false, earthActive: 0 }
    const target = targetState[place]

    // Check heaven bead changes
    if (!start.heavenActive && target.heavenActive) {
      additions.push({ placeValue: place, beadType: 'heaven' })
      mainPlaceValue = place
    } else if (start.heavenActive && !target.heavenActive) {
      removals.push({ placeValue: place, beadType: 'heaven' })
      mainPlaceValue = place
    }

    // Check earth bead changes
    if (target.earthActive > start.earthActive) {
      // Adding earth beads
      for (let pos = start.earthActive; pos < target.earthActive; pos++) {
        additions.push({ placeValue: place, beadType: 'earth', position: pos })
        mainPlaceValue = place
      }
    } else if (target.earthActive < start.earthActive) {
      // Removing earth beads
      for (let pos = start.earthActive - 1; pos >= target.earthActive; pos--) {
        removals.push({ placeValue: place, beadType: 'earth', position: pos })
        mainPlaceValue = place
      }
    }
  }

  return { additions, removals, placeValue: mainPlaceValue }
}

// Detect if a complement operation is needed
export function detectComplementOperation(startValue: number, targetValue: number, placeValue: number): {
  needsComplement: boolean
  complementType: 'five' | 'ten' | 'none'
  complementDetails?: {
    addValue: number
    subtractValue: number
    description: string
  }
} {
  const difference = targetValue - startValue

  // Ten complement detection (carrying to next place) - check this FIRST
  if (difference > 0 && targetValue >= 10 && startValue < 10) {
    return {
      needsComplement: true,
      complementType: 'ten',
      complementDetails: {
        addValue: 10,
        subtractValue: 10 - difference,
        description: `Add 10, subtract ${10 - difference}`
      }
    }
  }

  // Five complement detection (within same place)
  if (placeValue === 0 && difference > 0) {
    const startDigit = startValue % 10
    const earthSpaceAvailable = 4 - (startDigit >= 5 ? startDigit - 5 : startDigit)

    if (difference > earthSpaceAvailable && difference <= 4 && targetValue < 10) {
      return {
        needsComplement: true,
        complementType: 'five',
        complementDetails: {
          addValue: 5,
          subtractValue: 5 - difference,
          description: `${difference} = 5 - ${5 - difference}`
        }
      }
    }
  }

  return { needsComplement: false, complementType: 'none' }
}

// Generate step-by-step instructions
export function generateStepInstructions(
  additions: BeadHighlight[],
  removals: BeadHighlight[],
  isComplement: boolean
): string[] {
  const instructions: string[] = []

  if (isComplement) {
    // For complement operations, order matters: additions first, then removals
    additions.forEach(bead => {
      const placeDesc = bead.placeValue === 0 ? 'ones' :
                       bead.placeValue === 1 ? 'tens' :
                       bead.placeValue === 2 ? 'hundreds' : `place ${bead.placeValue}`

      if (bead.beadType === 'heaven') {
        instructions.push(`Click the heaven bead in the ${placeDesc} column to add it`)
      } else {
        instructions.push(`Click earth bead ${bead.position! + 1} in the ${placeDesc} column to add it`)
      }
    })

    removals.forEach(bead => {
      const placeDesc = bead.placeValue === 0 ? 'ones' :
                       bead.placeValue === 1 ? 'tens' :
                       bead.placeValue === 2 ? 'hundreds' : `place ${bead.placeValue}`

      if (bead.beadType === 'heaven') {
        instructions.push(`Click the heaven bead in the ${placeDesc} column to remove it`)
      } else {
        instructions.push(`Click earth bead ${bead.position! + 1} in the ${placeDesc} column to remove it`)
      }
    })
  } else {
    // For simple operations, just describe the additions
    additions.forEach(bead => {
      const placeDesc = bead.placeValue === 0 ? 'ones' :
                       bead.placeValue === 1 ? 'tens' :
                       bead.placeValue === 2 ? 'hundreds' : `place ${bead.placeValue}`

      if (bead.beadType === 'heaven') {
        instructions.push(`Click the heaven bead in the ${placeDesc} column`)
      } else {
        instructions.push(`Click earth bead ${bead.position! + 1} in the ${placeDesc} column`)
      }
    })
  }

  return instructions
}

// Main function to generate complete instructions
export function generateAbacusInstructions(
  startValue: number,
  targetValue: number,
  operation?: string
): GeneratedInstruction {
  const startState = numberToAbacusState(startValue)
  const targetState = numberToAbacusState(targetValue)
  const { additions, removals, placeValue } = calculateBeadChanges(startState, targetState)
  const complement = detectComplementOperation(startValue, targetValue, placeValue)

  const difference = targetValue - startValue
  const isAddition = difference > 0
  const operationSymbol = isAddition ? '+' : '-'
  const operationWord = isAddition ? 'add' : 'subtract'
  const actualOperation = operation || `${startValue} ${operationSymbol} ${Math.abs(difference)}`

  // Combine all beads that need to be highlighted
  const allHighlights = [...additions, ...removals]

  // Determine action type
  const actionType = allHighlights.length === 1 ?
    (isAddition ? 'add' : 'remove') : 'multi-step'

  // Generate action description
  let actionDescription: string
  if (complement.needsComplement) {
    if (complement.complementType === 'five') {
      actionDescription = `Use five complement: ${complement.complementDetails!.description}`
    } else {
      actionDescription = `Use ten complement: ${complement.complementDetails!.description}`
    }
  } else if (additions.length === 1 && removals.length === 0) {
    const bead = additions[0]
    actionDescription = `Click the ${bead.beadType} bead to ${operationWord} ${Math.abs(difference)}`
  } else if (additions.length > 1 && removals.length === 0) {
    actionDescription = `Click ${additions.length} beads to ${operationWord} ${Math.abs(difference)}`
  } else {
    actionDescription = `Multi-step operation: ${operationWord} ${Math.abs(difference)}`
  }

  // Generate step-by-step instructions
  const stepInstructions = generateStepInstructions(additions, removals, complement.needsComplement)

  // Generate tooltip
  const tooltip = {
    content: complement.needsComplement ?
      `${complement.complementType === 'five' ? 'Five' : 'Ten'} Complement Operation` :
      `Direct ${isAddition ? 'Addition' : 'Subtraction'}`,
    explanation: complement.needsComplement ?
      `When direct ${operationWord} isn't possible, use complement: ${complement.complementDetails!.description}` :
      `${isAddition ? 'Add' : 'Remove'} beads directly to represent ${Math.abs(difference)}`
  }

  // Generate error messages
  const errorMessages = {
    wrongBead: complement.needsComplement ?
      'Follow the complement sequence: ' + (additions.length > 0 ? 'add first, then remove' : 'use the highlighted beads') :
      `Click the highlighted ${allHighlights.length === 1 ? 'bead' : 'beads'}`,
    wrongAction: complement.needsComplement ?
      `Use ${complement.complementType} complement method` :
      `${isAddition ? 'Move beads UP to add' : 'Move beads DOWN to remove'}`,
    hint: `${actualOperation} = ${targetValue}` +
      (complement.needsComplement ? `, using ${complement.complementDetails!.description}` : '')
  }

  return {
    highlightBeads: allHighlights,
    expectedAction: actionType,
    actionDescription,
    multiStepInstructions: stepInstructions.length > 1 ? stepInstructions : undefined,
    tooltip,
    errorMessages
  }
}

// Utility function to validate generated instructions
export function validateInstruction(instruction: GeneratedInstruction, startValue: number, targetValue: number): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check if highlights exist
  if (!instruction.highlightBeads || instruction.highlightBeads.length === 0) {
    issues.push('No beads highlighted')
  }

  // Check for multi-step consistency
  if (instruction.expectedAction === 'multi-step' && !instruction.multiStepInstructions) {
    issues.push('Multi-step action without step instructions')
  }

  // Check place value validity
  instruction.highlightBeads.forEach(bead => {
    if (bead.placeValue < 0 || bead.placeValue > 4) {
      issues.push(`Invalid place value: ${bead.placeValue}`)
    }

    if (bead.beadType === 'earth' && (bead.position === undefined || bead.position < 0 || bead.position > 3)) {
      issues.push(`Invalid earth bead position: ${bead.position}`)
    }
  })

  return {
    isValid: issues.length === 0,
    issues
  }
}

// Example usage and testing
export function testInstructionGenerator(): void {
  console.log('🧪 Testing Automatic Instruction Generator\n')

  const testCases = [
    { start: 0, target: 1, description: 'Basic addition' },
    { start: 0, target: 5, description: 'Heaven bead introduction' },
    { start: 3, target: 7, description: 'Five complement (3+4)' },
    { start: 2, target: 5, description: 'Five complement (2+3)' },
    { start: 6, target: 8, description: 'Direct addition' },
    { start: 7, target: 11, description: 'Ten complement' },
    { start: 5, target: 2, description: 'Subtraction' },
    { start: 12, target: 25, description: 'Multi-place operation' }
  ]

  testCases.forEach(({ start, target, description }, index) => {
    console.log(`\n${index + 1}. ${description}: ${start} → ${target}`)
    const instruction = generateAbacusInstructions(start, target)
    console.log(`   Action: ${instruction.actionDescription}`)
    console.log(`   Highlights: ${instruction.highlightBeads.length} beads`)
    console.log(`   Type: ${instruction.expectedAction}`)

    if (instruction.multiStepInstructions) {
      console.log(`   Steps: ${instruction.multiStepInstructions.length}`)
    }

    const validation = validateInstruction(instruction, start, target)
    console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`)

    if (!validation.isValid) {
      console.log(`   Issues: ${validation.issues.join(', ')}`)
    }
  })
}