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

    // Generate English instruction based on the actual bead movements
    const englishInstruction = generateStepInstruction(
      stepBeadMovements,
      term,
      stepResult
    )

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

  // Convert to abacus state representation
  let currentState = numberToAbacusState(startValue, 5)
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

    // Apply the pedagogical algorithm decision tree
    const stepResult = processDigitAtPlace(
      digit,
      placeValue,
      currentDigitAtPlace,
      currentState
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
  currentState: AbacusState
): { steps: DecompositionStep[], newValue: number, newState: AbacusState } {

  const a = currentDigitAtPlace
  const d = digit

  // Decision: Direct addition vs 10's complement
  if (a + d <= 9) {
    // Case A: Direct addition at this place
    return processDirectAddition(d, placeValue, currentState)
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
  currentState: AbacusState
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
    } else {
      // Use 5's complement: digit = (5 - (5 - digit))
      const complement = 5 - digit
      const termValue = digit * Math.pow(10, placeValue)
      steps.push({
        operation: `(5 - ${complement})`,
        description: `Add heaven bead and remove ${complement} earth beads at place ${placeValue}`,
        targetValue: 0
      })
      newState[placeValue] = {
        heavenActive: true,
        earthActive: placeState.earthActive - complement
      }
    }
  } else {
    // For digits 5-9: activate heaven bead + earth beads
    const earthBeadsNeeded = digit - 5
    if (!placeState.heavenActive && placeState.earthActive + earthBeadsNeeded <= 4) {
      // Direct heaven + earth addition
      const termValue = digit * Math.pow(10, placeValue)
      steps.push({
        operation: termValue.toString(),
        description: `Add heaven bead and ${earthBeadsNeeded} earth beads at place ${placeValue}`,
        targetValue: 0
      })
      newState[placeValue] = {
        heavenActive: true,
        earthActive: placeState.earthActive + earthBeadsNeeded
      }
    } else {
      // Fall back to 10's complement (this shouldn't happen if a + d ≤ 9, but safety check)
      return processTensComplement(digit, placeValue, currentState)
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
  const newState = { ...currentState }

  // Use 10's complement: d = (10 - (10-d))
  const complementToSubtract = 10 - digit

  // Generate single complement term instead of separate add/subtract
  steps.push({
    operation: `(10 - ${complementToSubtract})`,
    description: `Ten's complement: add 10 to higher place, subtract ${complementToSubtract}`,
    targetValue: 0
  })

  // TODO: Implement proper bead state updates for carries and borrows
  // For now, calculate new value mathematically
  const currentValue = abacusStateToNumber(currentState)
  const newValue = currentValue + (digit * Math.pow(10, placeValue))

  return {
    steps,
    newValue,
    newState: numberToAbacusState(newValue, 5)
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

  // Handle term joining more carefully to preserve parentheses and signs
  let termString = ''
  if (terms.length > 0) {
    termString = terms[0]
    for (let i = 1; i < terms.length; i++) {
      const term = terms[i]
      if (term.startsWith('-')) {
        termString += ` ${term}` // Keep the negative sign
      } else if (term.startsWith('(')) {
        termString += ` + ${term}` // Add plus before parentheses
      } else {
        termString += ` + ${term}` // Normal addition
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
 * Determine if a pedagogical decomposition is meaningful (not redundant)
 */
function isDecompositionMeaningful(
  startValue: number,
  targetValue: number,
  decompositionTerms: string[],
  fullDecomposition: string
): boolean {
  // Simple heuristics to determine if the decomposition adds pedagogical value

  const difference = targetValue - startValue

  // If there's no change, it's definitely not meaningful
  if (difference === 0) {
    return false
  }

  // If there's only one term and it equals the difference, it's redundant
  if (decompositionTerms.length === 1 && decompositionTerms[0] === Math.abs(difference).toString()) {
    return false
  }

  // Check if we have complement operations (parentheses) or multiple terms
  const hasComplementOperations = decompositionTerms.some(term => term.includes('(') && term.includes(')'))
  const hasMultipleTerms = decompositionTerms.length > 1

  // For very simple differences (< 5), even complement operations might be redundant
  if (Math.abs(difference) < 5 && hasComplementOperations && !hasMultipleTerms) {
    // Check if it's a simple complement that doesn't add pedagogical value
    // For example: 5 -> 4 using (4-5) is probably not worth showing
    return false
  }

  // If we have multiple terms, it's definitely meaningful
  if (hasMultipleTerms) {
    return true
  }

  // For larger differences with complement operations, it's meaningful
  if (hasComplementOperations && Math.abs(difference) >= 5) {
    return true
  }

  // For single terms, check if it's a simple difference that doesn't need decomposition
  if (decompositionTerms.length === 1) {
    const term = decompositionTerms[0]

    // If it's just the raw difference (positive or negative), it's redundant
    if (term === difference.toString() || term === Math.abs(difference).toString() || term === `-${Math.abs(difference)}`) {
      return false
    }

    // If the difference is small (< 10) and it's a simple term, likely redundant
    if (Math.abs(difference) < 10) {
      return false
    }
  }

  // Check for actual decomposition complexity in the full string
  // If it just restates the problem without breaking it down, it's redundant
  const originalProblem = `${startValue} ${difference >= 0 ? '+' : '-'} ${Math.abs(difference)}`

  // If the decomposition is essentially just restating the original, it's not meaningful
  // This catches cases like "0 + 1 = 0 + 1 = 1"
  const decompositionPart = fullDecomposition.split(' = ')[1]?.split(' = ')[0] // Get middle part
  if (decompositionPart && decompositionPart.replace(/\s/g, '') === `${startValue}+${Math.abs(difference)}`.replace(/\s/g, '')) {
    return false
  }

  // Default to meaningful for cases that don't match simple patterns
  return true
}