// Unified step generator that computes all tutorial step information simultaneously
// to guarantee consistency between pedagogical decomposition, English instructions,
// expected states, and bead mappings.

import { ValidPlaceValues } from '@soroban/abacus-react'
import {
  BeadState,
  AbacusState,
  BeadHighlight,
  StepBeadHighlight,
  numberToAbacusState,
  calculateBeadChanges
} from './abacusInstructionGenerator'

export interface UnifiedStepData {
  stepIndex: number

  // Pedagogical decomposition - the math term for this step
  mathematicalTerm: string  // e.g., "10", "(5 - 1)", "-6"
  termPosition: { startIndex: number; endIndex: number } // Position in full decomposition

  // English instruction - what the user should do
  englishInstruction: string  // e.g., "Click earth bead 1 in tens column"

  // Expected ending state/value after this step
  expectedValue: number  // e.g., 13, 17, 11
  expectedState: AbacusState

  // Bead movements for this step (for arrows/highlights)
  beadMovements: StepBeadHighlight[]

  // Validation
  isValid: boolean
  validationIssues?: string[]
}

export interface UnifiedInstructionSequence {
  // Overall pedagogical decomposition
  fullDecomposition: string  // e.g., "3 + 14 = 3 + 10 + (5 - 1) = 17"

  // Whether the decomposition is meaningful (not redundant)
  isMeaningfulDecomposition: boolean

  // Step-by-step breakdown
  steps: UnifiedStepData[]

  // Summary
  startValue: number
  targetValue: number
  totalSteps: number
}

/**
 * THE UNIFIED FUNCTION: Generates all tutorial step information simultaneously
 * to ensure perfect consistency between math, instructions, states, and bead mappings.
 */
export function generateUnifiedInstructionSequence(
  startValue: number,
  targetValue: number
): UnifiedInstructionSequence {

  const difference = targetValue - startValue

  // Step 1: Calculate actual bead movements
  const startState = numberToAbacusState(startValue)
  const targetState = numberToAbacusState(targetValue)
  const { additions, removals } = calculateBeadChanges(startState, targetState)

  // Step 2: Generate pedagogical decomposition terms based on actual bead movements
  const decompositionTerms = generateDecompositionTerms(startValue, targetValue, additions, removals)

  // Step 3: Generate unified steps - each step computes ALL aspects simultaneously
  const steps: UnifiedStepData[] = []
  let currentValue = startValue
  let currentState = { ...startState }

  for (let stepIndex = 0; stepIndex < decompositionTerms.length; stepIndex++) {
    const term = decompositionTerms[stepIndex]

    // Calculate what this step should accomplish
    const stepResult = calculateStepResult(currentValue, term)
    const newValue = stepResult.newValue
    const newState = numberToAbacusState(newValue)

    // Find the bead movements for this specific step
    const stepBeadMovements = calculateStepBeadMovements(
      currentState,
      newState,
      stepIndex
    )

    // Generate English instruction from our algorithm data
    // Check if this is a five-complement context (5 followed by negative term)
    const isComplementContext = term === '5' &&
      stepIndex + 1 < decompositionTerms.length &&
      decompositionTerms[stepIndex + 1].startsWith('-')
    const englishInstruction = generateInstructionFromTerm(term, stepIndex, isComplementContext)

    // Validate that everything is consistent
    const validation = validateStepConsistency(
      term,
      englishInstruction,
      currentValue,
      newValue,
      stepBeadMovements
    )

    // Create the unified step data
    const stepData: UnifiedStepData = {
      stepIndex,
      mathematicalTerm: term,
      termPosition: { startIndex: 0, endIndex: 0 }, // Will be set later
      englishInstruction,
      expectedValue: newValue,
      expectedState: newState,
      beadMovements: stepBeadMovements,
      isValid: validation.isValid,
      validationIssues: validation.issues
    }

    steps.push(stepData)

    // Move to next step
    currentValue = newValue
    currentState = { ...newState }
  }

  // Step 4: Build full decomposition string and calculate term positions
  const { fullDecomposition, termPositions } = buildFullDecompositionWithPositions(startValue, targetValue, decompositionTerms)

  // Step 5: Determine if this decomposition is meaningful
  const isMeaningfulDecomposition = isDecompositionMeaningful(startValue, targetValue, decompositionTerms, fullDecomposition)

  // Step 6: Add position information to each step
  steps.forEach((step, index) => {
    if (termPositions[index]) {
      step.termPosition = termPositions[index]
    }
  })

  return {
    fullDecomposition,
    isMeaningfulDecomposition,
    steps,
    startValue,
    targetValue,
    totalSteps: steps.length
  }
}

/**
 * Generate decomposition terms based on actual bead movements
 */
interface AbacusPlaceState {
  heavenActive: boolean
  earthActive: number // 0-4
}

interface DecompositionStep {
  operation: string // The mathematical term like "7", "(10 - 3)", etc.
  description: string // What this step does pedagogically
  targetValue: number // Expected value after this step
}

/**
 * NEW ALGORITHM: Generate pedagogical decomposition using proper soroban logic
 * Process addend left-to-right, checking abacus state constraints at each place
 */
function generateDecompositionTerms(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[], // Legacy parameter - not used in new algo
  removals: BeadHighlight[]   // Legacy parameter - not used in new algo
): string[] {
  const addend = targetValue - startValue
  if (addend === 0) return []
  if (addend < 0) {
    // TODO: Handle subtraction in separate sprint
    throw new Error('Subtraction not implemented yet')
  }

  // Convert to abacus state representation with correct dimensions
  let currentState = numberToAbacusState(startValue, 5) // Support up to 5 places
  let currentValue = startValue
  const steps: DecompositionStep[] = []

  // Process addend digit by digit from left to right (highest to lowest place)
  const addendStr = addend.toString()
  const addendLength = addendStr.length

  for (let digitIndex = 0; digitIndex < addendLength; digitIndex++) {
    const digit = parseInt(addendStr[digitIndex])
    const placeValue = addendLength - 1 - digitIndex

    if (digit === 0) continue // Skip zeros

    // Get current digit at this place value
    const currentDigitAtPlace = getDigitAtPlace(currentValue, placeValue)

    // DEBUG: Log the processing for troubleshooting
    // console.log(`Processing place ${placeValue}: digit=${digit}, current=${currentDigitAtPlace}, sum=${currentDigitAtPlace + digit}`)

    // Apply the pedagogical algorithm decision tree
    const stepResult = processDigitAtPlace(
      digit,
      placeValue,
      currentDigitAtPlace,
      currentState,
      addend  // Pass the full addend to determine if it's multi-place
    )

    // Apply the step result to our current state
    steps.push(...stepResult.steps)
    currentValue = stepResult.newValue
    currentState = stepResult.newState
  }

  // Convert steps to string terms for compatibility
  return steps.map(step => step.operation)
}

/**
 * Process a single digit at a specific place value using soroban algorithm
 */
function processDigitAtPlace(
  digit: number,
  placeValue: number,
  currentDigitAtPlace: number,
  currentState: AbacusState,
  addend: number
): { steps: DecompositionStep[], newValue: number, newState: AbacusState } {

  const a = currentDigitAtPlace
  const d = digit

  // Decision: Direct addition vs 10's complement
  if (a + d <= 9) {
    // Case A: Direct addition at this place
    return processDirectAddition(d, placeValue, currentState, addend)
  } else {
    // Case B: 10's complement required
    return processTensComplement(d, placeValue, currentState)
  }
}

/**
 * Handle direct addition at a place value (a + d ≤ 9)
 */
function processDirectAddition(
  digit: number,
  placeValue: number,
  currentState: AbacusState,
  addend: number
): { steps: DecompositionStep[], newValue: number, newState: AbacusState } {

  const placeState = currentState[placeValue] || { heavenActive: false, earthActive: 0 }
  const steps: DecompositionStep[] = []
  const newState = { ...currentState }

  if (digit <= 4) {
    // For digits 1-4: try to add earth beads directly
    if (placeState.earthActive + digit <= 4) {
      // Direct earth bead addition
      const termValue = digit * Math.pow(10, placeValue)
      steps.push({
        operation: termValue.toString(),
        description: `Add ${digit} earth bead${digit > 1 ? 's' : ''} at place ${placeValue}`,
        targetValue: 0 // Will be calculated later
      })
      newState[placeValue] = {
        ...placeState,
        earthActive: placeState.earthActive + digit
      }
    } else if (!placeState.heavenActive) {
      // Use 5's complement: digit = (5 - (5 - digit)) when pedagogically valuable
      const complement = 5 - digit
      const termValue = digit * Math.pow(10, placeValue)

      // Check if this is part of a multi-place operation
      const isMultiPlaceOperation = addend >= 10 // If adding a multi-digit number

      if (isMultiPlaceOperation) {
        // Multi-place operation: use direct representation
        steps.push({
          operation: termValue.toString(),
          description: `Add ${digit} using heaven bead adjustment`,
          targetValue: 0
        })
      } else {
        // Single-place operation: show complement pedagogy as separate steps
        const fiveValue = 5 * Math.pow(10, placeValue)
        const subtractValue = complement * Math.pow(10, placeValue)

        steps.push({
          operation: fiveValue.toString(),
          description: `Add heaven bead at place ${placeValue}`,
          targetValue: 0
        })

        steps.push({
          operation: `-${subtractValue}`,
          description: `Remove ${complement} earth beads at place ${placeValue}`,
          targetValue: 0
        })
      }

      newState[placeValue] = {
        heavenActive: true,
        earthActive: placeState.earthActive - complement
      }
    }
  } else {
    // For digits 5-9: always fits under Case A assumption (a + d ≤ 9)
    // Activate heaven bead and add remainder earth beads
    const earthBeadsNeeded = digit - 5
    const fiveValue = 5 * Math.pow(10, placeValue)
    const remainderValue = earthBeadsNeeded * Math.pow(10, placeValue)

    steps.push({
      operation: fiveValue.toString(),
      description: `Add heaven bead at place ${placeValue}`,
      targetValue: 0
    })

    if (earthBeadsNeeded > 0) {
      steps.push({
        operation: remainderValue.toString(),
        description: `Add ${earthBeadsNeeded} earth beads at place ${placeValue}`,
        targetValue: 0
      })
    }

    newState[placeValue] = {
      heavenActive: true,
      earthActive: placeState.earthActive + earthBeadsNeeded
    }
  }

  // Calculate new total value
  const currentValue = abacusStateToNumber(currentState)
  const newValue = abacusStateToNumber(newState)

  return { steps, newValue, newState }
}

/**
 * Handle 10's complement when a + d ≥ 10
 */
function processTensComplement(
  digit: number,
  placeValue: number,
  currentState: AbacusState
): { steps: DecompositionStep[], newValue: number, newState: AbacusState } {

  const steps: DecompositionStep[] = []
  const complementToSubtract = 10 - digit
  const currentValue = abacusStateToNumber(currentState)

  // Check if this requires cascading (next place is 9)
  const nextPlaceDigit = getDigitAtPlace(currentValue, placeValue + 1)
  const requiresCascading = nextPlaceDigit === 9

  if (requiresCascading) {
    // Generate cascading complement terms in parenthesized format
    const cascadeSteps = generateCascadeComplementSteps(currentValue, placeValue, complementToSubtract)
    steps.push(...cascadeSteps)
  } else {
    // Simple ten-complement: generate separate add/subtract steps
    const higherPlaceValue = Math.pow(10, placeValue + 1)
    const subtractValue = complementToSubtract * Math.pow(10, placeValue)

    steps.push({
      operation: higherPlaceValue.toString(),
      description: `Add 1 to ${getPlaceName(placeValue + 1)} (carry)`,
      targetValue: 0
    })

    steps.push({
      operation: `-${subtractValue}`,
      description: `Remove ${complementToSubtract} earth beads (no borrow needed)`,
      targetValue: 0
    })
  }

  // Calculate new value mathematically
  const newValue = currentValue + (digit * Math.pow(10, placeValue))

  return {
    steps,
    newValue,
    newState: numberToAbacusState(newValue, 5)
  }
}

/**
 * Generate cascade complement steps as individual terms for UI tracking
 */
function generateCascadeComplementSteps(currentValue: number, startPlace: number, onesComplement: number): DecompositionStep[] {
  const steps: DecompositionStep[] = []

  // First, add to the highest non-9 place
  let checkPlace = startPlace + 1
  while (getDigitAtPlace(currentValue, checkPlace) === 9) {
    checkPlace += 1
    if (checkPlace > 10) break
  }

  // Add 1 to the highest place (this creates the cascade)
  const higherPlaceValue = Math.pow(10, checkPlace)
  steps.push({
    operation: higherPlaceValue.toString(),
    description: `Add 1 to ${getPlaceName(checkPlace)} (cascade trigger)`,
    targetValue: 0
  })

  // Clear all the 9s in between (working downward)
  for (let clearPlace = checkPlace - 1; clearPlace > startPlace; clearPlace--) {
    const digitAtClearPlace = getDigitAtPlace(currentValue, clearPlace)
    if (digitAtClearPlace === 9) {
      const clearValue = 9 * Math.pow(10, clearPlace)
      steps.push({
        operation: `-${clearValue}`,
        description: `Remove 9 from ${getPlaceName(clearPlace)} (cascade)`,
        targetValue: 0
      })
    }
  }

  // Finally, subtract at the original place
  const onesSubtractValue = onesComplement * Math.pow(10, startPlace)
  steps.push({
    operation: `-${onesSubtractValue}`,
    description: `Remove ${onesComplement} earth beads (ten's complement)`,
    targetValue: 0
  })

  return steps
}

/**
 * Generate ripple-carry steps for ten-complement cascading (legacy)
 */
function generateRippleCarrySteps(currentValue: number, startPlace: number): DecompositionStep[] {
  const steps: DecompositionStep[] = []

  // Find the first non-9 place above startPlace
  let checkPlace = startPlace + 1
  let ninesCleared = 0

  // Check each higher place value
  while (true) {
    const digitAtPlace = getDigitAtPlace(currentValue, checkPlace)

    if (digitAtPlace === 9) {
      // This place is 9, will be set to 0 during cascade
      ninesCleared += 1
      checkPlace += 1
    } else {
      // Found non-9 place, increment it
      const incrementValue = Math.pow(10, checkPlace)

      // Handle the cascade in reverse order (highest to lowest)
      // First increment the non-9 place
      steps.push({
        operation: incrementValue.toString(),
        description: `Add 1 to ${getPlaceName(checkPlace)} (ripple-carry)`,
        targetValue: 0
      })

      // Then clear all the 9s in between
      for (let clearPlace = checkPlace - 1; clearPlace > startPlace; clearPlace--) {
        const clearValue = 9 * Math.pow(10, clearPlace)
        steps.push({
          operation: `-${clearValue}`,
          description: `Clear 9s at ${getPlaceName(clearPlace)} (cascade)`,
          targetValue: 0
        })
      }

      break
    }

    // Safety check to prevent infinite loop
    if (checkPlace > 10) {
      // If we get here, create a new leading place
      const newLeadingValue = Math.pow(10, checkPlace)
      steps.push({
        operation: newLeadingValue.toString(),
        description: `Create new leading 1 at ${getPlaceName(checkPlace)}`,
        targetValue: 0
      })
      break
    }
  }

  return steps
}

/**
 * Generate English instruction from mathematical term
 */
function generateInstructionFromTerm(term: string, stepIndex: number, isComplementContext: boolean = false): string {
  // Parse the term to determine what instruction to give

  // Handle parenthesized complements like "(5 - 2)" or "(10 - 3)"
  if (term.startsWith('(') && term.includes(' - ')) {
    const match = term.match(/\((\d+) - (\d+)\)/)
    if (match) {
      const add = parseInt(match[1])
      const subtract = parseInt(match[2])

      if (add === 5) {
        return `add heaven bead and remove ${subtract} earth beads`
      } else if (add === 10) {
        return `add 1 to tens and remove ${subtract} earth beads`
      } else if (add >= 100) {
        const place = Math.log10(add)
        return `add 1 to ${getPlaceName(place)} and remove ${subtract} earth beads`
      }
    }
  }

  // Handle negative numbers FIRST
  if (term.startsWith('-')) {
    const value = parseInt(term.substring(1))
    if (value <= 4) {
      return `remove ${value} earth bead${value > 1 ? 's' : ''}`
    } else if (value === 5) {
      return 'deactivate heaven bead'
    } else if (value >= 10) {
      const place = Math.floor(Math.log10(value))
      const digit = Math.floor(value / Math.pow(10, place))
      return `remove ${digit} from ${getPlaceName(place)}`
    }
  }

  // Handle simple positive numbers
  const value = parseInt(term)
  if (!isNaN(value) && value > 0) {
    if (value === 5) {
      return isComplementContext ? 'add 5' : 'activate heaven bead'
    } else if (value <= 4) {
      return `add ${value} earth bead${value > 1 ? 's' : ''}`
    } else if (value === 10) {
      return 'add 1 to tens place'
    } else if (value >= 10) {
      const place = Math.floor(Math.log10(value))
      const digit = Math.floor(value / Math.pow(10, place))
      return `add ${digit} to ${getPlaceName(place)}`
    } else if (value >= 6 && value <= 9) {
      const earthBeads = value - 5
      return `activate heaven bead and add ${earthBeads} earth beads`
    }
  }

  return `perform operation: ${term}`
}

function getPlaceName(place: number): string {
  switch (place) {
    case 0: return 'ones'
    case 1: return 'tens'
    case 2: return 'hundreds'
    case 3: return 'thousands'
    default: return `${place} place`
  }
}

/**
 * Helper functions
 */
function getDigitAtPlace(value: number, placeValue: number): number {
  return Math.floor(value / Math.pow(10, placeValue)) % 10
}

function abacusStateToNumber(state: AbacusState): number {
  let total = 0
  Object.entries(state).forEach(([place, beadState]) => {
    const placeNum = parseInt(place)
    const placeValue = (beadState.heavenActive ? 5 : 0) + beadState.earthActive
    total += placeValue * Math.pow(10, placeNum)
  })
  return total
}

/**
 * Calculate what a mathematical term should accomplish
 */
function calculateStepResult(currentValue: number, term: string): {
  newValue: number
  operation: 'add' | 'subtract' | 'complement'
  addAmount?: number
  subtractAmount?: number
} {

  // Parse the term to understand the operation
  if (term.startsWith('(') && term.includes(' - ')) {
    // Complement operation like "(10 - 6)"
    const match = term.match(/\((\d+) - (\d+)\)/)
    if (match) {
      const addAmount = parseInt(match[1])
      const subtractAmount = parseInt(match[2])
      return {
        newValue: currentValue + addAmount - subtractAmount,
        operation: 'complement',
        addAmount,
        subtractAmount
      }
    }
  } else if (term.startsWith('-')) {
    // Pure subtraction like "-6"
    const amount = parseInt(term.substring(1))
    return {
      newValue: currentValue - amount,
      operation: 'subtract',
      subtractAmount: amount
    }
  } else {
    // Pure addition like "10"
    const amount = parseInt(term)
    return {
      newValue: currentValue + amount,
      operation: 'add',
      addAmount: amount
    }
  }

  // Fallback
  return {
    newValue: currentValue,
    operation: 'add'
  }
}

/**
 * Calculate bead movements for a specific step
 */
function calculateStepBeadMovements(
  fromState: AbacusState,
  toState: AbacusState,
  stepIndex: number
): StepBeadHighlight[] {

  const { additions, removals } = calculateBeadChanges(fromState, toState)
  const movements: StepBeadHighlight[] = []

  // Convert additions to step bead movements
  additions.forEach((bead, index) => {
    movements.push({
      ...bead,
      stepIndex,
      direction: 'activate',
      order: index
    })
  })

  // Convert removals to step bead movements
  removals.forEach((bead, index) => {
    movements.push({
      ...bead,
      stepIndex,
      direction: 'deactivate',
      order: additions.length + index
    })
  })

  return movements
}

/**
 * Generate English instruction based on actual bead movements
 */
function generateStepInstruction(
  beadMovements: StepBeadHighlight[],
  mathematicalTerm: string,
  stepResult: any
): string {

  if (beadMovements.length === 0) {
    return 'No bead movements required'
  }

  // Group by place and direction
  const byPlace: { [place: number]: { adds: StepBeadHighlight[], removes: StepBeadHighlight[] } } = {}

  beadMovements.forEach(bead => {
    if (!byPlace[bead.placeValue]) {
      byPlace[bead.placeValue] = { adds: [], removes: [] }
    }

    if (bead.direction === 'activate') {
      byPlace[bead.placeValue].adds.push(bead)
    } else {
      byPlace[bead.placeValue].removes.push(bead)
    }
  })

  // Generate instruction for each place
  const instructions: string[] = []

  Object.keys(byPlace)
    .map(p => parseInt(p))
    .sort((a, b) => b - a) // Pedagogical order: highest place first
    .forEach(place => {

      const placeName = place === 0 ? 'ones' :
                       place === 1 ? 'tens' :
                       place === 2 ? 'hundreds' : `place ${place}`

      const placeData = byPlace[place]

      // Handle additions
      if (placeData.adds.length > 0) {
        const instruction = generatePlaceInstruction(placeData.adds, 'add', placeName)
        instructions.push(instruction)
      }

      // Handle removals
      if (placeData.removes.length > 0) {
        const instruction = generatePlaceInstruction(placeData.removes, 'remove', placeName)
        instructions.push(instruction)
      }
    })

  return instructions.join(', then ')
}

/**
 * Generate instruction for a specific place
 */
function generatePlaceInstruction(
  beads: StepBeadHighlight[],
  action: 'add' | 'remove',
  placeName: string
): string {

  const heavenBeads = beads.filter(b => b.beadType === 'heaven')
  const earthBeads = beads.filter(b => b.beadType === 'earth')

  const parts: string[] = []

  if (heavenBeads.length > 0) {
    const verb = action === 'add' ? 'add' : 'remove'
    parts.push(`${verb} heaven bead in ${placeName} column`)
  }

  if (earthBeads.length > 0) {
    const verb = action === 'add' ? 'add' : 'remove'
    const count = earthBeads.length
    const beadText = count === 1 ? 'earth bead' : `${count} earth beads`
    parts.push(`${verb} ${beadText} in ${placeName} column`)
  }

  return parts.join(' and ')
}

/**
 * Validate that all aspects of a step are consistent
 */
function validateStepConsistency(
  mathematicalTerm: string,
  englishInstruction: string,
  startValue: number,
  expectedValue: number,
  beadMovements: StepBeadHighlight[]
): { isValid: boolean; issues: string[] } {

  const issues: string[] = []

  // Validate that bead movements produce the expected value
  const startState = numberToAbacusState(startValue)
  const expectedState = numberToAbacusState(expectedValue)

  // Apply bead movements to start state
  let simulatedState = { ...startState }
  beadMovements.forEach(movement => {
    if (movement.direction === 'activate') {
      if (movement.beadType === 'heaven') {
        simulatedState[movement.placeValue].heavenActive = true
      } else {
        simulatedState[movement.placeValue].earthActive++
      }
    } else {
      if (movement.beadType === 'heaven') {
        simulatedState[movement.placeValue].heavenActive = false
      } else {
        simulatedState[movement.placeValue].earthActive--
      }
    }
  })

  // Check if simulated state matches expected state
  for (const place in expectedState) {
    const placeNum = parseInt(place)
    const expected = expectedState[placeNum]
    const simulated = simulatedState[placeNum]

    if (expected.heavenActive !== simulated.heavenActive) {
      issues.push(`Place ${place}: heaven bead mismatch`)
    }

    if (expected.earthActive !== simulated.earthActive) {
      issues.push(`Place ${place}: earth bead count mismatch`)
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}

/**
 * Build the full pedagogical decomposition string with term positions
 */
function buildFullDecompositionWithPositions(
  startValue: number,
  targetValue: number,
  terms: string[]
): {
  fullDecomposition: string
  termPositions: Array<{ startIndex: number; endIndex: number }>
} {

  const difference = targetValue - startValue

  // Handle zero difference special case
  if (difference === 0) {
    return {
      fullDecomposition: `${startValue} + 0 = ${targetValue}`,
      termPositions: []
    }
  }

  // Handle term joining with special logic for ten-complements
  let termString = ''

  // Special case for cascading ten-complement pattern like ["100", "-90", "-2"]
  if (terms.length === 3 &&
      isPowerOfTen(parseInt(terms[0])) &&
      terms[1].startsWith('-') &&
      terms[2].startsWith('-')) {
    const firstAdd = parseInt(terms[0])
    const firstSubtract = parseInt(terms[1].substring(1))
    const secondSubtract = parseInt(terms[2].substring(1))

    // Check if this looks like a cascading pattern (e.g., 100, -90, -2)
    if (firstAdd === 100 && firstSubtract === 90 && secondSubtract <= 9) {
      termString = `(${terms[0]} - ${firstSubtract} - ${secondSubtract})`

      // Build and return immediately for this special case
      const leftSide = `${startValue} + ${difference} = ${startValue} + `
      const rightSide = ` = ${targetValue}`
      const fullDecomposition = leftSide + termString + rightSide

      // Calculate proper term positions for the cascading case
      const termPositions: Array<{ startIndex: number; endIndex: number }> = []
      let currentIndex = leftSide.length

      // For the cascading case, we need to map each original term to positions within the parenthesized expression
      // terms[0] = "100" maps to position within "(100 - 90 - 2)"
      termPositions.push({
        startIndex: currentIndex + 1, // Skip the opening parenthesis
        endIndex: currentIndex + 1 + terms[0].length
      })

      // terms[1] = "-90" maps to position within the parentheses
      termPositions.push({
        startIndex: currentIndex + 1 + terms[0].length + 3, // Skip "100 - "
        endIndex: currentIndex + 1 + terms[0].length + 3 + firstSubtract.toString().length
      })

      // terms[2] = "-2" maps to position within the parentheses
      termPositions.push({
        startIndex: currentIndex + 1 + terms[0].length + 3 + firstSubtract.toString().length + 3, // Skip "100 - 90 - "
        endIndex: currentIndex + 1 + terms[0].length + 3 + firstSubtract.toString().length + 3 + secondSubtract.toString().length
      })

      return {
        fullDecomposition,
        termPositions
      }
    }
  }
  if (terms.length > 0) {
    let i = 0
    while (i < terms.length) {
      if (i === 0) {
        // Check if first two terms form a ten-complement pattern
        if (i + 1 < terms.length && isTenComplementPattern(terms[i], terms[i + 1])) {
          const complement = extractComplementValue(terms[i], terms[i + 1])
          termString = `(${terms[i]} - ${complement})`
          i += 2 // Skip both terms as they're combined
        } else if (terms[i].startsWith('(')) {
          termString = terms[i]
          i++
        } else {
          termString = terms[i]
          i++
        }
      } else {
        // Check if this and next term form a ten-complement pattern
        if (i + 1 < terms.length && isTenComplementPattern(terms[i], terms[i + 1])) {
          const complement = extractComplementValue(terms[i], terms[i + 1])
          termString += ` + (${terms[i]} - ${complement})`
          i += 2
        } else {
          const term = terms[i]
          if (term.startsWith('-')) {
            termString += ` ${term}` // Keep the negative sign
          } else if (term.startsWith('(')) {
            termString += ` + ${term}` // Add plus before parentheses
          } else {
            termString += ` + ${term}` // Normal addition
          }
          i++
        }
      }
    }
  }

  // Build the full string: "4 + 7 = 4 + (10 - 3) = 11"
  const leftSide = `${startValue} + ${difference} = ${startValue} + `
  const rightSide = ` = ${targetValue}`
  const fullDecomposition = leftSide + termString + rightSide

  // Calculate positions for each term within the decomposition
  const termPositions: Array<{ startIndex: number; endIndex: number }> = []
  let currentIndex = leftSide.length

  terms.forEach((term, index) => {
    const startIndex = currentIndex
    const endIndex = startIndex + term.length

    termPositions.push({ startIndex, endIndex })

    // Move past this term and the separator
    currentIndex = endIndex
    if (index < terms.length - 1) {
      // Account for " + " or " - " separator (check if next term starts with -)
      const nextTerm = terms[index + 1]
      if (nextTerm.startsWith('-')) {
        currentIndex += 3 // " - "
      } else {
        currentIndex += 3 // " + "
      }
    }
  })

  return { fullDecomposition, termPositions }
}

/**
 * Check if two consecutive terms form a complement pattern (e.g., "5" and "-2", "10" and "-3", or "100" and "-90")
 */
function isTenComplementPattern(term1: string, term2: string): boolean {
  if (!term2.startsWith('-')) return false

  const addValue = parseInt(term1)
  const subtractValue = parseInt(term2.substring(1))

  // Check for five-complements (5 and -X) or ten-complements (powers of 10 and -Y)
  if (addValue === 5 && subtractValue <= 4) {
    return true // Five-complement pattern
  }

  // Check if it's a power of 10 being added and any value being subtracted
  // This covers both simple ten-complements (10 - 3) and cascade complements (100 - 90)
  return addValue >= 10 && isPowerOfTen(addValue)
}

/**
 * Check if a number is a power of 10
 */
function isPowerOfTen(num: number): boolean {
  if (num < 10) return false
  while (num > 1) {
    if (num % 10 !== 0) return false
    num = num / 10
  }
  return true
}

/**
 * Extract the complement value from a ten-complement pair
 */
function extractComplementValue(term1: string, term2: string): string {
  const subtractValue = parseInt(term2.substring(1))
  return subtractValue.toString()
}

/**
 * Determine if a pedagogical decomposition is meaningful (not redundant)
 */
function isDecompositionMeaningful(
  startValue: number,
  targetValue: number,
  decompositionTerms: string[],
  fullDecomposition: string
): boolean {
  const difference = targetValue - startValue

  // No change = not meaningful
  if (difference === 0) {
    return false
  }

  // Check if we have complement expressions (parentheses)
  const hasComplementOperations = decompositionTerms.some(term => term.includes('(') && term.includes(')'))

  // Complement operations are always meaningful (they show soroban technique)
  if (hasComplementOperations) {
    return true
  }

  // Multiple terms without complements can be meaningful for multi-place operations
  // but not for simple natural breakdowns like 6 = 5 + 1
  if (decompositionTerms.length > 1) {
    // Check if it's a simple natural breakdown (like 5 + 1, 5 + 2, 5 + 3, 5 + 4)
    if (decompositionTerms.length === 2) {
      const [first, second] = decompositionTerms
      if (first === '5' && parseInt(second) >= 1 && parseInt(second) <= 4) {
        return false // Natural soroban representation, not pedagogically meaningful
      }
    }
    return true
  }

  // Single term that equals the difference = not meaningful (redundant)
  if (decompositionTerms.length === 1) {
    const term = decompositionTerms[0]
    if (term === Math.abs(difference).toString()) {
      return false
    }
  }

  // For complex cases with multiple breakdowns, check if it's just restating
  const decompositionPart = fullDecomposition.split(' = ')[1]?.split(' = ')[0]
  if (decompositionPart) {
    // If the middle part is just the same as "start + difference", it's redundant
    const simplePattern = `${startValue} + ${Math.abs(difference)}`
    if (decompositionPart.replace(/\s/g, '') === simplePattern.replace(/\s/g, '')) {
      return false
    }
  }

  // Default to meaningful
  return true
}