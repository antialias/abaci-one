// Unified step generator that computes all tutorial step information simultaneously
// to guarantee consistency between pedagogical decomposition, English instructions,
// expected states, and bead mappings.

import {
  AbacusState,
  BeadHighlight,
  StepBeadHighlight,
  numberToAbacusState,
  calculateBeadChanges
} from './abacusInstructionGenerator'

export type PedagogicalRule = 'Direct' | 'FiveComplement' | 'TenComplement' | 'Cascade'

export interface SegmentDecision {
  /** Short, machine-readable rule fired at this segment */
  rule: PedagogicalRule
  /** Guard conditions that selected this rule */
  conditions: string[] // e.g., ["a+d=6 ≤ 9", "L+d=5 > 4"]
  /** Friendly bullets explaining the why */
  explanation: string[] // e.g., ["No room for 3 lowers → use +5 − (5−3)"]
}

export interface PedagogicalSegment {
  id: string                 // e.g., "P1-d4-#2"
  place: number              // P
  digit: number              // d
  a: number                  // digit currently showing at P before the segment
  L: number                  // lowers down at P
  U: 0 | 1                   // upper down?
  goal: string               // "Increase tens by 4 without carry"
  plan: SegmentDecision[]    // one or more rules (Cascade includes TenComplement+Cascade)
  /** Expression for the whole segment, e.g., "40" or "(100 - 90 - 6)" */
  expression: string
  /** Indices into the flat `steps` array that belong to this segment */
  stepIndices: number[]
  /** Indices into the decompositionTerms list that belong to this segment */
  termIndices: number[]
  /** character range inside `fullDecomposition` spanning the expression */
  termRange: { startIndex: number; endIndex: number }

  /** Segment start→end snapshot (optional but useful for UI tooltips) */
  startValue: number
  endValue: number
  startState: AbacusState
  endState: AbacusState
}

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

  /** Link to pedagogy segment this step belongs to */
  segmentId?: string
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

  /** NEW: Schema version for compatibility */
  schemaVersion?: '1' | '2'
  /** NEW: High-level "chapters" that explain the why */
  segments: PedagogicalSegment[]
}

// Internal draft interface for building segments
interface SegmentDraft {
  id: string
  place: number
  digit: number
  a: number
  L: number
  U: 0 | 1
  plan: SegmentDecision[]
  goal: string
  /** contiguous indices into steps[] / terms[] for this segment */
  stepIndices: number[]
  termIndices: number[]
  // Value/state snapshots
  startValue: number
  startState: AbacusState
  endValue: number
  endState: AbacusState
}

/**
 * Helper functions for building segment decisions and explanations
 */

function isPowerOfTen(n: number): boolean {
  if (n < 1) return false
  return /^10*$/.test(n.toString())
}
function inferGoal(seg: SegmentDraft): string {
  const placeName = getPlaceName(seg.place)
  switch (seg.plan[0]?.rule) {
    case 'Direct':
      return `Increase ${placeName} by ${seg.digit} without carry`
    case 'FiveComplement':
      return `Add ${seg.digit} to ${placeName} using 5's complement`
    case 'TenComplement':
      return `Add ${seg.digit} to ${placeName} with a carry`
    case 'Cascade':
      return `Carry through ${placeName}+ to nearest non‑9 place`
    default:
      return `Apply operation at ${placeName}`
  }
}

function decisionForDirect(a: number, d: number, L: number): SegmentDecision[] {
  if (L + d <= 4) {
    return [{
      rule: 'Direct',
      conditions: [`a+d=${a}+${d}=${a+d} ≤ 9`],
      explanation: ['Fits inside this place; add earth beads directly.']
    }]
  } else {
    const s = 5 - d
    return [{
      rule: 'FiveComplement',
      conditions: [`a+d=${a}+${d}=${a+d} ≤ 9`, `L+d=${L}+${d}=${L+d} > 4`],
      explanation: [
        'No room for that many earth beads.',
        `Use +5 − (5−${d}) = +5 − ${s}; subtraction is possible because lowers ≥ ${s}.`
      ]
    }]
  }
}

function decisionForFiveComplement(a: number, d: number): SegmentDecision[] {
  const s = 5 - d
  return [{
    rule: 'FiveComplement',
    conditions: [`a+d=${a}+${d}=${a+d} ≤ 9`, `L+d > 4`],
    explanation: [
      'No room for that many earth beads.',
      `Use +5 − (5−${d}) = +5 − ${s}; subtraction is possible because lowers ≥ ${s}.`
    ]
  }]
}

function decisionForTenComplement(a: number, d: number, nextIs9: boolean): SegmentDecision[] {
  const base: SegmentDecision = {
    rule: 'TenComplement',
    conditions: [`a+d=${a}+${d}=${a+d} ≥ 10`, `a ≥ 10−d = ${10-d}`],
    explanation: [
      'Need a carry to the next higher place.',
      `No borrow at this place because a ≥ ${10-d}.`
    ]
  }
  if (!nextIs9) return [base]
  return [
    base,
    {
      rule: 'Cascade',
      conditions: ['next place is 9 ⇒ ripple carry'],
      explanation: ['Increment nearest non‑9 place; clear intervening 9s.']
    }
  ]
}

function formatSegmentExpression(terms: string[]): string {
  // single term -> "40"
  if (terms.length === 1 && !terms[0].startsWith('-')) return terms[0]

  // complement group -> "(pos - n1 - n2 - ...)"
  const pos = terms[0]
  const negs = terms.slice(1).map(t => t.replace(/^-/, ''))
  return `(${pos} - ${negs.join(' - ')})`
}

function formatSegmentGoal(digit: number, placeValue: number): string {
  const placeName = getPlaceName(placeValue)
  return `Add ${digit} to ${placeName}`
}

function buildSegmentsWithPositions(
  segmentsPlan: SegmentDraft[],
  fullDecomposition: string,
  steps: UnifiedStepData[]
): PedagogicalSegment[] {
  return segmentsPlan.map(draft => {
    const segmentTerms = draft.stepIndices
      .map(i => steps[i]?.mathematicalTerm)
      .filter((t): t is string => !!t)

    // Range from steps -> exact, no string search
    const ranges = draft.stepIndices
      .map(i => steps[i]?.termPosition)
      .filter((r): r is {startIndex:number; endIndex:number} => !!r)

    let start = Math.min(...ranges.map(r => r.startIndex))
    let end   = Math.max(...ranges.map(r => r.endIndex))

    // Optionally include surrounding parentheses for complement groups
    if (fullDecomposition[start - 1] === '(' && fullDecomposition[end] === ')') {
      start -= 1; end += 1
    }

    return {
      id: draft.id,
      place: draft.place,
      digit: draft.digit,
      a: draft.a,
      L: draft.L,
      U: draft.U,
      goal: draft.goal,
      plan: draft.plan,
      expression: formatSegmentExpression(segmentTerms),
      stepIndices: draft.stepIndices,
      termIndices: draft.termIndices,
      termRange: { startIndex: start, endIndex: end },
      startValue: draft.startValue,
      endValue: draft.endValue,
      startState: draft.startState,
      endState: draft.endState
    }
  })
}


function determineSegmentDecisions(
  digit: number,
  place: number,
  currentDigit: number,
  steps: DecompositionStep[]
): SegmentDecision[] {
  const sum = currentDigit + digit

  if (steps.length === 1) {
    return [{
      rule: 'Direct',
      conditions: [`a+d=${currentDigit}+${digit}=${sum} ≤ 9`],
      explanation: ['Fits in this place; add earth beads directly.']
    }]
  }

  const hasPositive = steps.some(s => !s.operation.startsWith('-'))
  const hasNegative = steps.some(s =>  s.operation.startsWith('-'))

  if (hasPositive && hasNegative) {
    const positives = steps.filter(s => !s.operation.startsWith('-')).map(s => parseInt(s.operation, 10))
    const hasFiveAdd = positives.some(v => Number.isInteger(v / 5) && isPowerOfTen(v / 5))
    const hasTenAdd  = positives.some(v => isPowerOfTen(v))

    if (hasFiveAdd && !hasTenAdd) {
      return decisionForFiveComplement(currentDigit, digit)
    }
    if (hasTenAdd) {
      const nextIs9 = positives.length > 1 // cascade if ripple seen
      return decisionForTenComplement(currentDigit, digit, nextIs9)
    }
  }

  return [{
    rule: 'Direct',
    conditions: [`processing digit ${digit} at ${getPlaceName(place)}`],
    explanation: ['Standard operation.']
  }]
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

  // Ensure consistent width across all state conversions to prevent place misalignment
  const digits = (n: number) => Math.max(1, Math.floor(Math.log10(Math.abs(n))) + 1)
  const width = Math.max(digits(startValue), digits(targetValue), digits(Math.abs(targetValue - startValue))) + 1 // +1 to absorb carries
  const toState = (n: number) => numberToAbacusState(n, width)

  // Step 1: Calculate actual bead movements
  const startState = toState(startValue)
  const targetState = toState(targetValue)
  const { additions, removals } = calculateBeadChanges(startState, targetState)

  // Step 2: Generate pedagogical decomposition terms and segment plan based on actual bead movements
  const { terms: decompositionTerms, segmentsPlan } = generateDecompositionTerms(startValue, targetValue, additions, removals, toState)

  // Step 3: Generate unified steps - each step computes ALL aspects simultaneously
  const steps: UnifiedStepData[] = []
  let currentValue = startValue
  let currentState = { ...startState }

  for (let stepIndex = 0; stepIndex < decompositionTerms.length; stepIndex++) {
    const term = decompositionTerms[stepIndex]

    // Calculate what this step should accomplish
    const stepResult = calculateStepResult(currentValue, term)
    const newValue = stepResult.newValue
    const newState = toState(newValue)

    // Find the bead movements for this specific step
    const stepBeadMovements = calculateStepBeadMovements(
      currentState,
      newState,
      stepIndex
    )

    // Generate English instruction with hybrid approach
    // Use term-based for consistency with tests, bead-movements as validation
    const isComplementContext = term === '5' &&
      stepIndex + 1 < decompositionTerms.length &&
      decompositionTerms[stepIndex + 1].startsWith('-')
    const englishInstruction =
      generateInstructionFromTerm(term, stepIndex, isComplementContext)
      || (stepBeadMovements.length > 0
           ? generateStepInstruction(stepBeadMovements, term, stepResult)
           : `perform operation: ${term}`)

    // Validate that everything is consistent
    const validation = validateStepConsistency(
      term,
      englishInstruction,
      currentValue,
      newValue,
      stepBeadMovements,
      toState
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

  // Defensive check: ensure position count matches term count
  if (termPositions.length !== decompositionTerms.length) {
    throw new Error(`Position count mismatch: ${termPositions.length} positions for ${decompositionTerms.length} terms`)
  }

  // Step 5: Determine if this decomposition is meaningful
  const isMeaningfulDecomposition = isDecompositionMeaningful(startValue, targetValue, decompositionTerms, fullDecomposition)

  // Step 6: Attach term positions and segment ids to steps
  steps.forEach((step, idx) => {
    if (termPositions[idx]) step.termPosition = termPositions[idx]
  })

  // (optional) annotate steps with the segment they belong to
  segmentsPlan.forEach(seg => seg.stepIndices.forEach(i => { if (steps[i]) steps[i].segmentId = seg.id }))

  // Step 7: Build segments using step positions (exact indices, robust)
  const segments = buildSegmentsWithPositions(segmentsPlan, fullDecomposition, steps)

  return {
    schemaVersion: '2' as const,
    fullDecomposition,
    isMeaningfulDecomposition,
    steps,
    segments,
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
  removals: BeadHighlight[],   // Legacy parameter - not used in new algo
  toState: (n: number) => AbacusState
): { terms: string[]; segmentsPlan: SegmentDraft[] } {
  const addend = targetValue - startValue
  if (addend === 0) return { terms: [], segmentsPlan: [] }
  if (addend < 0) {
    // TODO: Handle subtraction in separate sprint
    throw new Error('Subtraction not implemented yet')
  }

  // Convert to abacus state representation with correct dimensions
  let currentState = toState(startValue)
  let currentValue = startValue
  const steps: DecompositionStep[] = []
  const segmentsPlan: SegmentDraft[] = []

  // Process addend digit by digit from left to right (highest to lowest place)
  const addendStr = addend.toString()
  const addendLength = addendStr.length

  for (let digitIndex = 0; digitIndex < addendLength; digitIndex++) {
    const digit = parseInt(addendStr[digitIndex])
    const placeValue = addendLength - 1 - digitIndex

    if (digit === 0) continue // Skip zeros

    // Get current digit at this place value
    const currentDigitAtPlace = getDigitAtPlace(currentValue, placeValue)
    const startStepCount = steps.length

    // DEBUG: Log the processing for troubleshooting
    // console.log(`Processing place ${placeValue}: digit=${digit}, current=${currentDigitAtPlace}, sum=${currentDigitAtPlace + digit}`)

    // Apply the pedagogical algorithm decision tree
    const stepResult = processDigitAtPlace(
      digit,
      placeValue,
      currentDigitAtPlace,
      currentState,
      addend,  // Pass the full addend to determine if it's multi-place
      toState  // Pass consistent state converter
    )

    const segmentId = `place-${placeValue}-digit-${digit}`
    const segmentStartValue = currentValue
    const segmentStartState = { ...currentState }
    const placeStart = segmentStartState[placeValue] ?? { heavenActive: false, earthActive: 0 }
    const L = placeStart.earthActive
    const U: 0 | 1 = placeStart.heavenActive ? 1 : 0

    // Apply the step result
    steps.push(...stepResult.steps)
    currentValue = stepResult.newValue
    currentState = stepResult.newState

    const endStepCount = steps.length
    const stepIndices = Array.from({ length: endStepCount - startStepCount }, (_, i) => startStepCount + i)

    // Decide pedagogy
    const plan = determineSegmentDecisions(digit, placeValue, currentDigitAtPlace, stepResult.steps)
    const goal = inferGoal({ id: segmentId, place: placeValue, digit, a: currentDigitAtPlace, L, U, plan,
      goal: '', stepIndices, termIndices: stepIndices, startValue: segmentStartValue,
      startState: segmentStartState, endValue: currentValue, endState: { ...currentState } })

    const segment: SegmentDraft = {
      id: segmentId,
      place: placeValue,
      digit,
      a: currentDigitAtPlace,
      L,
      U,
      plan,
      goal,
      stepIndices,
      termIndices: stepIndices,
      startValue: segmentStartValue,
      startState: segmentStartState,
      endValue: currentValue,
      endState: { ...currentState }
    }

    segmentsPlan.push(segment)
  }

  // Convert steps to string terms for compatibility
  const terms = steps.map(step => step.operation)
  return { terms, segmentsPlan }
}

/**
 * Process a single digit at a specific place value using soroban algorithm
 */
function processDigitAtPlace(
  digit: number,
  placeValue: number,
  currentDigitAtPlace: number,
  currentState: AbacusState,
  addend: number,
  toState: (n: number) => AbacusState
): { steps: DecompositionStep[], newValue: number, newState: AbacusState } {

  const a = currentDigitAtPlace
  const d = digit

  // Decision: Direct addition vs 10's complement
  if (a + d <= 9) {
    // Case A: Direct addition at this place
    return processDirectAddition(d, placeValue, currentState, addend, toState)
  } else {
    // Case B: 10's complement required
    return processTensComplement(d, placeValue, currentState, toState)
  }
}

/**
 * Handle direct addition at a place value (a + d ≤ 9)
 */
function processDirectAddition(
  digit: number,
  placeValue: number,
  currentState: AbacusState,
  addend: number,
  toState: (n: number) => AbacusState
): { steps: DecompositionStep[], newValue: number, newState: AbacusState } {

  const placeState = currentState[placeValue] || { heavenActive: false, earthActive: 0 }
  const L = placeState.earthActive // Current earth beads (matches algorithm spec)
  const steps: DecompositionStep[] = []
  const newState = { ...currentState }

  if (digit <= 4) {
    // For digits 1-4: try to add earth beads directly
    if (L + digit <= 4) {
      // Direct earth bead addition
      steps.push({
        operation: (digit * Math.pow(10, placeValue)).toString(),
        description: `Add ${digit} earth bead${digit > 1 ? 's' : ''} at place ${placeValue}`,
        targetValue: 0 // Will be calculated later
      })
      newState[placeValue] = {
        ...placeState,
        earthActive: L + digit
      }
    } else if (!placeState.heavenActive) {
      // Use 5's complement: digit = (5 - (5 - digit)) when pedagogically valuable
      const complement = 5 - digit

      // Always show five-complement pedagogy as separate steps
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
  currentState: AbacusState,
  toState: (n: number) => AbacusState
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
    newState: toState(newValue)
  }
}

/**
 * Generate cascade complement steps as individual terms for UI tracking
 */
function generateCascadeComplementSteps(currentValue: number, startPlace: number, onesComplement: number): DecompositionStep[] {
  const steps: DecompositionStep[] = []

  // First, add to the highest non-9 place
  let checkPlace = startPlace + 1
  const maxCheck = Math.max(1, Math.floor(Math.log10(Math.max(1, currentValue))) + 1) + 2
  while (getDigitAtPlace(currentValue, checkPlace) === 9 && checkPlace <= maxCheck) {
    checkPlace += 1
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
 * Generate English instruction from mathematical term
 */
function generateInstructionFromTerm(term: string, stepIndex: number, isComplementContext: boolean = false): string {
  // Parse the term to determine what instruction to give


  // Handle negative numbers FIRST
  if (term.startsWith('-')) {
    const value = parseInt(term.substring(1))
    if (value <= 4) {
      return `remove ${value} earth bead${value > 1 ? 's' : ''}`
    } else if (value === 5) {
      return 'deactivate heaven bead'
    } else if (value >= 6 && value <= 9) {
      const e = value - 5
      return `deactivate heaven bead and remove ${e} earth bead${e > 1 ? 's' : ''}`
    } else if (isPowerOfTen(value)) {
      const place = Math.round(Math.log10(value))
      return `remove 1 from ${getPlaceName(place)}`
    } else if (value >= 10) {
      const place = Math.floor(Math.log10(value))
      const digit = Math.floor(value / Math.pow(10, place))
      if (digit === 5) return `deactivate heaven bead in ${getPlaceName(place)} column`
      if (digit > 5)  return `deactivate heaven bead and remove ${digit - 5} earth beads in ${getPlaceName(place)} column`
      // (digit 6..9 handled above; digit 1..4 would be rare here)
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
    } else if (value >= 6 && value <= 9) {
      const earthBeads = value - 5
      return `activate heaven bead and add ${earthBeads} earth beads`
    } else if (isPowerOfTen(value)) {
      const place = Math.round(Math.log10(value))
      return `add 1 to ${getPlaceName(place)}`
    } else if (value >= 10) {
      const place = Math.floor(Math.log10(value))
      const digit = Math.floor(value / Math.pow(10, place))
      if (digit === 5) return `activate heaven bead in ${getPlaceName(place)} column`
      if (digit > 5)  return `activate heaven bead and add ${digit - 5} earth beads in ${getPlaceName(place)} column`
      return `add ${digit} to ${getPlaceName(place)}`
    }
  }

  return `perform operation: ${term}`
}

function getPlaceName(place: number): string {
  const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions']
  return names[place] ?? `${place} place`
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
  if (term.startsWith('-')) {
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

  // Stabilize movement ordering for consistent UI animations
  // Priority: higher place → heaven beads → activations first
  movements.sort((a, b) => (
    b.placeValue - a.placeValue ||            // Higher place first (tens before ones)
    (a.beadType === 'heaven' ? -1 : 1) - (b.beadType === 'heaven' ? -1 : 1) ||  // Heaven before earth
    (a.direction === 'activate' ? -1 : 1) - (b.direction === 'activate' ? -1 : 1) // Activate before deactivate
  ))

  // Reassign order indices after sorting
  movements.forEach((movement, index) => {
    movement.order = index
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
    parts.push(action === 'add'
      ? `activate heaven bead in ${placeName} column`
      : `deactivate heaven bead in ${placeName} column`)
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
  beadMovements: StepBeadHighlight[],
  toState: (n: number) => AbacusState
): { isValid: boolean; issues: string[] } {

  const issues: string[] = []

  // Validate that bead movements produce the expected value
  const startState = toState(startValue)
  const expectedState = toState(expectedValue)

  // Apply bead movements to start state
  let simulatedState = { ...startState }
  beadMovements.forEach(movement => {
    // Ensure place exists before mutating
    if (!simulatedState[movement.placeValue]) {
      simulatedState[movement.placeValue] = { heavenActive: false, earthActive: 0 }
    }
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

  // Validate bead ranges after applying movements
  for (const place in simulatedState) {
    const placeNum = parseInt(place)
    const state = simulatedState[placeNum]

    if (state.earthActive < 0 || state.earthActive > 4) {
      issues.push(`Place ${place}: earth beads out of range (${state.earthActive})`)
    }

    if (typeof state.heavenActive !== 'boolean') {
      issues.push(`Place ${place}: heaven bead state invalid (${state.heavenActive})`)
    }
  }

  // Check if simulated state matches expected state
  for (const place in expectedState) {
    const placeNum = parseInt(place)
    const expected = expectedState[placeNum]
    const simulated = simulatedState[placeNum]

    if (!simulated) {
      issues.push(`Place ${place}: missing in simulated state`)
      continue
    }

    if (expected.heavenActive !== simulated.heavenActive) {
      issues.push(`Place ${place}: heaven bead mismatch`)
    }

    if (expected.earthActive !== simulated.earthActive) {
      issues.push(`Place ${place}: earth bead count mismatch`)
    }
  }

  // Check for extra places in simulated state that shouldn't exist
  for (const place in simulatedState) {
    if (!(place in expectedState)) {
      const placeNum = parseInt(place)
      const s = simulatedState[placeNum]
      if (s.heavenActive || s.earthActive > 0) {
        issues.push(`Place ${place}: unexpected nonzero state in simulation`)
      }
    }
  }

  // Final numeric equivalence check
  const simulatedValue = abacusStateToNumber(simulatedState)
  if (simulatedValue !== expectedValue) {
    issues.push(`Numeric mismatch: simulated=${simulatedValue}, expected=${expectedValue}`)
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}

/**
 * Build the full pedagogical decomposition string with term positions
 */
export function buildFullDecompositionWithPositions(
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

  // Group consecutive complement terms into segments
  const segments: Array<{
    terms: string[]
    isComplement: boolean
  }> = []

  let i = 0
  while (i < terms.length) {
    const currentTerm = terms[i]

    // Check if this starts a complement sequence (positive term followed by negative(s))
    if (i + 1 < terms.length &&
        !currentTerm.startsWith('-') &&
        terms[i + 1].startsWith('-')) {

      // Collect all consecutive negative terms after this positive term
      const complementTerms = [currentTerm]
      let j = i + 1
      while (j < terms.length && terms[j].startsWith('-')) {
        complementTerms.push(terms[j])
        j++
      }

      segments.push({
        terms: complementTerms,
        isComplement: true
      })
      i = j // Jump past all consumed terms
    } else {
      // Single term (not part of complement)
      segments.push({
        terms: [currentTerm],
        isComplement: false
      })
      i++
    }
  }

  // Build decomposition string with proper segment formatting
  let termString = ''
  const termPositions: Array<{ startIndex: number; endIndex: number }> = []

  segments.forEach((segment, segmentIndex) => {
    if (segment.isComplement) {
      // Format as parenthesized complement: (10 - 3) or (1000 - 900 - 90 - 2)
      const positiveStr = segment.terms[0]
      const negativeStrs = segment.terms.slice(1).map(t => t.substring(1)) // Remove - signs

      const segmentStr = `(${positiveStr} - ${negativeStrs.join(' - ')})`

      if (segmentIndex === 0) {
        termString = segmentStr
      } else {
        termString += ` + ${segmentStr}`
      }
    } else {
      // Single term
      const term = segment.terms[0]
      if (segmentIndex === 0) {
        termString = term
      } else if (term.startsWith('-')) {
        termString += ` ${term}` // Keep negative sign
      } else {
        termString += ` + ${term}`
      }
    }
  })

  // Build full decomposition
  const leftSide = `${startValue} + ${difference} = ${startValue} + `
  const rightSide = ` = ${targetValue}`
  const fullDecomposition = leftSide + termString + rightSide

  // Calculate precise positions for each original term
  let currentPos = leftSide.length
  let segmentTermIndex = 0

  segments.forEach((segment, segmentIndex) => {
    if (segment.isComplement) {
      // Account for " + " delimiter before complement segments (except first)
      if (segmentIndex > 0) {
        currentPos += 3 // Skip " + "
      }

      // Position within parenthesized complement
      currentPos += 1 // Skip opening '('

      segment.terms.forEach((term, termInSegmentIndex) => {
        const startIndex = currentPos

        if (termInSegmentIndex === 0) {
          // Positive term
          termPositions[segmentTermIndex] = {
            startIndex,
            endIndex: startIndex + term.length
          }
          currentPos += term.length
        } else {
          // Negative term (but we position on just the number part)
          currentPos += 3 // Skip ' - '
          const numberStr = term.substring(1) // Remove '-'
          termPositions[segmentTermIndex] = {
            startIndex: currentPos,
            endIndex: currentPos + numberStr.length
          }
          currentPos += numberStr.length
        }
        segmentTermIndex++
      })

      currentPos += 1 // Skip closing ')'
    } else {
      // Single term segment
      const term = segment.terms[0]

      if (segmentIndex > 0) {
        if (term.startsWith('-')) {
          currentPos += 1 // Skip ' ' before negative
        } else {
          currentPos += 3 // Skip ' + '
        }
      }

      const isNegative = term.startsWith('-')
      const startIndex = isNegative ? (currentPos + 1) : currentPos   // skip the '−' for mapping
      const endIndex   = isNegative ? (startIndex + (term.length - 1)) : (startIndex + term.length)
      termPositions[segmentTermIndex] = { startIndex, endIndex }
      currentPos += term.length  // actual text includes the '−'
      segmentTermIndex++
    }
  })

  return { fullDecomposition, termPositions }
}


/**
 * Check if a number is a power of 10
 */


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
  const hasComplementOperations = fullDecomposition.includes('(')

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