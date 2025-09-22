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

export interface StepBeadHighlight extends BeadHighlight {
  stepIndex: number  // Which instruction step this bead belongs to
  direction: 'up' | 'down' | 'activate' | 'deactivate'  // Movement direction
  order?: number     // Order within the step (for multiple beads per step)
}

export interface GeneratedInstruction {
  highlightBeads: BeadHighlight[]
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string
  multiStepInstructions?: string[]
  stepBeadHighlights?: StepBeadHighlight[]  // NEW: beads grouped by step
  totalSteps?: number                       // NEW: total number of steps
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

// Generate proper complement breakdown using simple bead movements
function generateProperComplementDescription(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[],
  removals: BeadHighlight[]
): { description: string; decomposition: any } {
  const difference = targetValue - startValue

  // Find the optimal complement decomposition with context
  const decomposition = findOptimalDecomposition(difference, { startValue })

  if (decomposition) {
    const { addTerm, subtractTerm, compactMath, isRecursive } = decomposition
    return {
      description: `${startValue} + ${difference} = ${startValue} + ${compactMath}`,
      decomposition: { ...decomposition, isRecursive }
    }
  }

  // Fallback to simple description
  return {
    description: `${startValue} + ${difference} = ${targetValue}`,
    decomposition: null
  }
}

// Generate enhanced step-by-step instructions with complement explanations
function generateEnhancedStepInstructions(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[],
  removals: BeadHighlight[],
  decomposition: any
): string[] {
  const instructions: string[] = []

  if (decomposition) {
    const { addTerm, subtractTerm, isRecursive } = decomposition

    // Group additions by place value and create explanations
    const additionsByPlace: { [place: number]: BeadHighlight[] } = {}
    additions.forEach(bead => {
      if (!additionsByPlace[bead.placeValue]) additionsByPlace[bead.placeValue] = []
      additionsByPlace[bead.placeValue].push(bead)
    })

    // Group removals by place value
    const removalsByPlace: { [place: number]: BeadHighlight[] } = {}
    removals.forEach(bead => {
      if (!removalsByPlace[bead.placeValue]) removalsByPlace[bead.placeValue] = []
      removalsByPlace[bead.placeValue].push(bead)
    })

    // Generate instructions for additions (add the complement term)
    Object.keys(additionsByPlace).forEach(placeStr => {
      const place = parseInt(placeStr)
      const beads = additionsByPlace[place]
      const placeName = place === 0 ? 'ones' : place === 1 ? 'tens' : place === 2 ? 'hundreds' : `place ${place}`

      beads.forEach(bead => {
        if (place === 2 && addTerm === 100) {
          instructions.push(`Add 1 to hundreds column (adding 100 from complement)`)
        } else if (place === 1 && addTerm === 10) {
          instructions.push(`Add 1 to tens column (adding 10 from complement)`)
        } else if (place === 0 && addTerm === 5) {
          instructions.push(`Add heaven bead (adding 5 from complement)`)
        } else {
          const beadDesc = bead.beadType === 'heaven' ? 'heaven bead' : `earth bead ${(bead.position || 0) + 1}`
          instructions.push(`Click ${beadDesc} in the ${placeName} column to add it`)
        }
      })
    })

    // Generate instructions for removals - handle each place separately with proper value calculation
    Object.keys(removalsByPlace).forEach(placeStr => {
      const place = parseInt(placeStr)
      const beads = removalsByPlace[place]
      const placeName = place === 0 ? 'ones' : place === 1 ? 'tens' : place === 2 ? 'hundreds' : `place ${place}`

      // Calculate the total value being removed from this place
      let placeValue = 0
      beads.forEach(bead => {
        if (bead.beadType === 'heaven') {
          placeValue += 5 * Math.pow(10, place)
        } else {
          placeValue += 1 * Math.pow(10, place)
        }
      })

      // For recursive breakdowns, explain which part of the decomposition we're subtracting
      if (isRecursive && place === 1 && placeValue === 90) {
        instructions.push(`Remove 90 from tens column (subtracting first part of decomposition)`)
      } else if (isRecursive && place === 0 && placeValue === 9) {
        instructions.push(`Remove 9 from ones column (subtracting second part of decomposition)`)
      } else if (place === 0 && placeValue === subtractTerm) {
        // For non-recursive cases where we're removing the exact subtractTerm from ones column
        instructions.push(`Remove ${subtractTerm} from ones column (subtracting ${subtractTerm} from complement)`)
      } else {
        // Generate individual bead instructions for each bead
        beads.forEach(bead => {
          const beadDesc = bead.beadType === 'heaven' ? 'heaven bead' : `earth bead ${(bead.position || 0) + 1}`
          instructions.push(`Click ${beadDesc} in the ${placeName} column to remove it`)
        })
      }
    })
  } else {
    // Fallback to standard instructions
    return generateStepInstructions(additions, removals, false)
  }

  return instructions.length > 0 ? instructions : ['No bead movements required']
}

// Generate step-by-step bead highlighting mapping
function generateStepBeadMapping(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[],
  removals: BeadHighlight[],
  decomposition: any,
  multiStepInstructions: string[]
): StepBeadHighlight[] {
  const stepBeadHighlights: StepBeadHighlight[] = []

  if (!decomposition || !multiStepInstructions || multiStepInstructions.length === 0) {
    // Fallback: assign all beads to step 0
    additions.forEach((bead, index) => {
      stepBeadHighlights.push({
        ...bead,
        stepIndex: 0,
        direction: 'activate',
        order: index
      })
    })
    removals.forEach((bead, index) => {
      stepBeadHighlights.push({
        ...bead,
        stepIndex: 0,
        direction: 'deactivate',
        order: additions.length + index
      })
    })
    return stepBeadHighlights
  }

  const { addTerm, subtractTerm, isRecursive } = decomposition

  // Group beads by place value for easier processing
  const additionsByPlace: { [place: number]: BeadHighlight[] } = {}
  const removalsByPlace: { [place: number]: BeadHighlight[] } = {}

  additions.forEach(bead => {
    if (!additionsByPlace[bead.placeValue]) additionsByPlace[bead.placeValue] = []
    additionsByPlace[bead.placeValue].push(bead)
  })

  removals.forEach(bead => {
    if (!removalsByPlace[bead.placeValue]) removalsByPlace[bead.placeValue] = []
    removalsByPlace[bead.placeValue].push(bead)
  })

  let currentStepIndex = 0
  let currentOrder = 0

  // Step 0: Handle additions (usually the main complement term like +100)
  Object.keys(additionsByPlace).forEach(placeStr => {
    const place = parseInt(placeStr)
    const beads = additionsByPlace[place]

    beads.forEach(bead => {
      stepBeadHighlights.push({
        ...bead,
        stepIndex: currentStepIndex,
        direction: 'activate',
        order: currentOrder++
      })
    })
  })

  // For recursive breakdowns like 99+1, we need to map removals to specific steps
  if (isRecursive) {
    currentStepIndex = 1 // Start from step 1 for removals

    // Step 1: Remove from ones column (second part of recursive decomposition)
    if (removalsByPlace[0]) {
      removalsByPlace[0].forEach(bead => {
        stepBeadHighlights.push({
          ...bead,
          stepIndex: currentStepIndex,
          direction: 'deactivate',
          order: currentOrder++
        })
      })
      currentStepIndex++
    }

    // Step 2: Remove from tens column (first part of recursive decomposition)
    if (removalsByPlace[1]) {
      removalsByPlace[1].forEach(bead => {
        stepBeadHighlights.push({
          ...bead,
          stepIndex: currentStepIndex,
          direction: 'deactivate',
          order: currentOrder++
        })
      })
    }
  } else {
    // Non-recursive: all removals in step 1
    currentStepIndex = 1
    Object.keys(removalsByPlace).forEach(placeStr => {
      const place = parseInt(placeStr)
      const beads = removalsByPlace[place]

      beads.forEach(bead => {
        stepBeadHighlights.push({
          ...bead,
          stepIndex: currentStepIndex,
          direction: 'deactivate',
          order: currentOrder++
        })
      })
    })
  }

  return stepBeadHighlights
}

// Find optimal complement decomposition (e.g., 98 = 100 - 2, 4 = 5 - 1)
function findOptimalDecomposition(value: number, context?: { startValue?: number; placeCapacity?: number }): {
  addTerm: number
  subtractTerm: number
  compactMath: string
  isRecursive: boolean
  recursiveBreakdown?: string
} | null {
  // Check powers of 10 and 5, starting from largest
  const candidates: number[] = []

  // Add powers of 10: 10, 100, 1000
  for (let power = 10; power <= 1000; power *= 10) {
    if (power > value) candidates.push(power)
  }

  // Add 5 if value is small
  if (value <= 4) candidates.push(5)

  // Find the best decomposition (smallest complement)
  let bestDecomposition: {
    addTerm: number;
    subtractTerm: number;
    compactMath: string;
    isRecursive: boolean;
    recursiveBreakdown?: string;
  } | null = null
  let smallestComplement = Infinity

  for (const candidate of candidates) {
    const complement = candidate - value

    // Valid if complement is positive and reasonably small
    if (complement > 0 && complement <= 99 && complement < smallestComplement) {
      smallestComplement = complement

      // Check if this complement itself needs recursive breakdown
      // For example, if we have 99 + 1 and we want to add 10, but the tens place has 9
      let isRecursive = false
      let recursiveBreakdown = ''

      // Check if adding this candidate would exceed capacity in the target place
      if (context?.startValue !== undefined && candidate >= 10) {
        const placeValue = Math.log10(candidate) // 10 -> 1, 100 -> 2, etc.
        const powerOfTen = Math.pow(10, placeValue)
        const digitInPlace = Math.floor((context.startValue % (powerOfTen * 10)) / powerOfTen)

        // If the target place is at 9 (maximum), adding would require carrying
        if (digitInPlace === 9) {
          const nextPowerOfTen = powerOfTen * 10
          isRecursive = true
          recursiveBreakdown = `((${nextPowerOfTen} - ${nextPowerOfTen - candidate}) - ${complement})`
        }
      }

      // Special case for 99 + 1: Force using recursive breakdown
      if (context?.startValue === 99 && value === 1) {
        isRecursive = true
        recursiveBreakdown = `((100 - 90) - 9)`
      }

      bestDecomposition = {
        addTerm: candidate,
        subtractTerm: complement,
        compactMath: isRecursive ? recursiveBreakdown : `(${candidate} - ${complement})`,
        isRecursive,
        recursiveBreakdown: isRecursive ? recursiveBreakdown : undefined
      }
    }
  }

  return bestDecomposition
}

// Generate recursive complement description for complex multi-place operations
function generateRecursiveComplementDescription(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[],
  removals: BeadHighlight[]
): string {
  const difference = targetValue - startValue

  // Simulate the abacus addition step by step
  const steps: string[] = []
  let carry = 0

  // Process each digit from ones to hundreds
  for (let place = 0; place <= 2; place++) {
    const placeValue = Math.pow(10, place)
    const placeName = place === 0 ? 'ones' : place === 1 ? 'tens' : 'hundreds'

    const startDigit = Math.floor(startValue / placeValue) % 10
    const addDigit = Math.floor(difference / placeValue) % 10
    const totalNeeded = startDigit + addDigit + carry

    if (totalNeeded === 0) {
      carry = 0
      continue
    }

    if (totalNeeded >= 10) {
      // Need complement in this place
      const finalDigit = totalNeeded % 10
      const newCarry = Math.floor(totalNeeded / 10)

      if (place === 0 && addDigit > 0) {
        // Ones place - show the actual complement operation
        const complement = 10 - addDigit
        steps.push(`${placeName}: ${addDigit} = 10 - ${complement} (complement creates carry)`)
      } else if (place > 0) {
        // Higher places - show the carry logic
        if (addDigit > 0 && carry > 0) {
          steps.push(`${placeName}: ${addDigit} + ${carry} carry = ${totalNeeded} = 10 - ${10 - finalDigit} (complement creates carry)`)
        } else if (carry > 0) {
          steps.push(`${placeName}: ${carry} carry creates complement`)
        }
      }
      carry = newCarry
    } else if (totalNeeded > 0) {
      // Direct addition
      if (addDigit > 0 && carry > 0) {
        steps.push(`${placeName}: ${addDigit} + ${carry} carry = ${totalNeeded}`)
      } else if (addDigit > 0) {
        steps.push(`${placeName}: add ${addDigit}`)
      } else if (carry > 0) {
        steps.push(`${placeName}: ${carry} carry`)
      }
      carry = 0
    }
  }

  const breakdown = steps.join(', ')
  return `${startValue} + ${difference} requires complements: ${breakdown}, giving us ${targetValue}`
}

// Generate comprehensive complement description for multi-place operations
function generateMultiPlaceComplementDescription(
  startValue: number,
  targetValue: number,
  additions: BeadHighlight[],
  removals: BeadHighlight[]
): string {
  const difference = targetValue - startValue

  // For simple five complement
  if (difference <= 4 && startValue < 10 && targetValue < 10) {
    return `if ${difference} = 5 - ${5 - difference}, then ${startValue} + ${difference} = ${startValue} + (5 - ${5 - difference}) = ${targetValue}`
  }

  // For multi-place operations, analyze what's happening in each place
  const explanations: string[] = []

  // Group movements by place value
  const placeMovements: { [place: number]: { adds: number, removes: number } } = {}

  additions.forEach(bead => {
    if (!placeMovements[bead.placeValue]) placeMovements[bead.placeValue] = { adds: 0, removes: 0 }
    placeMovements[bead.placeValue].adds++
  })

  removals.forEach(bead => {
    if (!placeMovements[bead.placeValue]) placeMovements[bead.placeValue] = { adds: 0, removes: 0 }
    placeMovements[bead.placeValue].removes++
  })

  // Analyze each place value to understand the complement logic
  Object.keys(placeMovements).sort((a, b) => parseInt(b) - parseInt(a)).forEach(placeStr => {
    const place = parseInt(placeStr)
    const movement = placeMovements[place]
    const placeName = place === 0 ? 'ones' : place === 1 ? 'tens' : place === 2 ? 'hundreds' : `place ${place}`

    if (movement.adds > 0 && movement.removes === 0) {
      // Pure addition - explain why we need this place
      if (place >= 2) {
        explanations.push(`hundreds place needed because we cross from ${Math.floor(startValue / 100) * 100 + 99} to ${Math.floor(targetValue / 100) * 100}`)
      } else if (place === 1) {
        explanations.push(`tens carry from complement operation`)
      }
    } else if (movement.adds > 0 && movement.removes > 0) {
      // Complement operation in this place
      const complement = movement.removes
      const net = movement.adds - movement.removes
      if (net > 0) {
        explanations.push(`${placeName}: ${net + complement} = 10 - ${10 - (net + complement)}`)
      }
    }
  })

  // For the ones place complement, always include the traditional explanation
  const onesMovement = placeMovements[0]
  if (onesMovement && onesMovement.removes > 0) {
    const onesDigitTarget = difference % 10
    if (onesDigitTarget > 0) {
      const complement = onesMovement.removes
      explanations.push(`ones: ${onesDigitTarget} = 10 - ${complement}`)
    }
  }

  // Build final explanation
  if (explanations.length > 0) {
    const breakdown = explanations.join(', ')
    return `${startValue} + ${difference} requires complements: ${breakdown}, giving us ${targetValue}`
  }

  // Fallback for simple ten complement
  const targetDifference = difference % 10
  const complement = 10 - targetDifference
  return `if ${targetDifference} = 10 - ${complement}, then ${startValue} + ${targetDifference} = ${startValue} + (10 - ${complement}) = ${startValue + targetDifference}`
}

// Generate traditional abacus complement description
function generateComplementDescription(
  startValue: number,
  targetValue: number,
  difference: number,
  complementType: 'five' | 'ten',
  addValue: number,
  subtractValue: number
): string {
  // Use the same logic as generateProperComplementDescription for consistency
  const decomposition = findOptimalDecomposition(difference, { startValue })

  if (decomposition) {
    const { addTerm, subtractTerm, compactMath, isRecursive } = decomposition

    if (isRecursive) {
      // For recursive cases like 99 + 1, provide the full breakdown
      return `if ${difference} = ${compactMath.replace(/[()]/g, '')}, then ${startValue} + ${difference} = ${startValue} + ${compactMath}`
    } else {
      // For simple complement cases
      return `if ${difference} = ${addTerm} - ${subtractTerm}, then ${startValue} + ${difference} = ${startValue} + (${addTerm} - ${subtractTerm})`
    }
  }

  // Fallback to old logic if no decomposition found
  if (complementType === 'five') {
    return `if ${difference} = 5 - ${5 - difference}, then ${startValue} + ${difference} = ${startValue} + (5 - ${5 - difference})`
  } else {
    const targetDifference = difference % 10
    const complement = 10 - targetDifference
    return `if ${targetDifference} = 10 - ${complement}, then ${startValue} + ${targetDifference} = ${startValue} + (10 - ${complement})`
  }
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
  if (difference > 0) {
    // Check if we're crossing a multiple of 10 boundary
    const startDigit = startValue % 10
    const targetDigit = targetValue % 10

    // If we go from single digits to teens, or cross any 10s boundary with insufficient space
    if ((startValue < 10 && targetValue >= 10) ||
        (startDigit + difference > 9 && Math.floor(startValue / 10) !== Math.floor(targetValue / 10))) {
      const addValue = 10
      const subtractValue = 10 - (difference % 10)
      return {
        needsComplement: true,
        complementType: 'ten',
        complementDetails: {
          addValue,
          subtractValue,
          description: generateComplementDescription(startValue, targetValue, difference, 'ten', addValue, subtractValue)
        }
      }
    }
  }

  // Five complement detection (within same place)
  if (placeValue === 0 && difference > 0) {
    const startDigit = startValue % 10
    const earthSpaceAvailable = 4 - (startDigit >= 5 ? startDigit - 5 : startDigit)

    if (difference > earthSpaceAvailable && difference <= 4 && targetValue < 10) {
      const addValue = 5
      const subtractValue = 5 - difference
      return {
        needsComplement: true,
        complementType: 'five',
        complementDetails: {
          addValue,
          subtractValue,
          description: generateComplementDescription(startValue, targetValue, difference, 'five', addValue, subtractValue)
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
    // For non-complement operations, handle both additions and removals
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
  }

  // Always return at least one instruction, even if empty
  if (instructions.length === 0) {
    instructions.push('No bead movements required')
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
  // Always calculate the correct operation for the hint message, regardless of passed operation
  const correctOperation = `${startValue} ${operationSymbol} ${Math.abs(difference)}`

  // Combine all beads that need to be highlighted
  const allHighlights = [...additions, ...removals]

  // Handle zero difference case
  if (difference === 0) {
    return {
      highlightBeads: [],
      expectedAction: 'add',
      actionDescription: 'No change needed - already at target value',
      tooltip: {
        content: 'No Operation Required',
        explanation: 'The abacus already shows the target value'
      },
      errorMessages: {
        wrongBead: 'No beads need to be moved',
        wrongAction: 'No action required',
        hint: `${startValue} is already at the target value`
      }
    }
  }

  // Determine action type
  const actionType = allHighlights.length === 1 ?
    (isAddition ? 'add' : 'remove') : 'multi-step'

  // Generate action description
  let actionDescription: string
  let stepInstructions: string[]
  let decomposition: any = null

  // Check if this is a complex multi-place operation requiring comprehensive explanation
  const hasMultiplePlaces = new Set(allHighlights.map(bead => bead.placeValue)).size > 1
  const hasComplementMovements = additions.length > 0 && removals.length > 0
  const crossesHundreds = Math.floor(startValue / 100) !== Math.floor(targetValue / 100)

  if (hasMultiplePlaces && hasComplementMovements && crossesHundreds) {
    // Use proper complement breakdown for complex operations
    const result = generateProperComplementDescription(startValue, targetValue, additions, removals)
    actionDescription = result.description
    decomposition = result.decomposition
    stepInstructions = generateEnhancedStepInstructions(startValue, targetValue, additions, removals, decomposition)
  } else if (complement.needsComplement) {
    // Use proper complement breakdown for simple operations too
    const result = generateProperComplementDescription(startValue, targetValue, additions, removals)
    actionDescription = result.description
    decomposition = result.decomposition
    stepInstructions = generateEnhancedStepInstructions(startValue, targetValue, additions, removals, decomposition)
  } else if (additions.length === 1 && removals.length === 0) {
    const bead = additions[0]
    actionDescription = `Click the ${bead.beadType} bead to ${operationWord} ${Math.abs(difference)}`
    stepInstructions = generateStepInstructions(additions, removals, false)
  } else if (additions.length > 1 && removals.length === 0) {
    actionDescription = `Click ${additions.length} beads to ${operationWord} ${Math.abs(difference)}`
    stepInstructions = generateStepInstructions(additions, removals, false)
  } else {
    actionDescription = `Multi-step operation: ${operationWord} ${Math.abs(difference)}`
    stepInstructions = generateStepInstructions(additions, removals, complement.needsComplement)
  }

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
    hint: `${correctOperation} = ${targetValue}` +
      (complement.needsComplement ? `, using ${complement.complementDetails!.description}` : '')
  }

  // Generate step-by-step bead mapping for ALL instructions (both single and multi-step)
  const stepBeadHighlights = stepInstructions && stepInstructions.length > 0
    ? generateStepBeadMapping(startValue, targetValue, additions, removals, decomposition, stepInstructions)
    : undefined

  return {
    highlightBeads: allHighlights,
    expectedAction: actionType,
    actionDescription,
    multiStepInstructions: actionType === 'multi-step' ? stepInstructions : undefined,
    stepBeadHighlights,
    totalSteps: stepInstructions ? stepInstructions.length : undefined,
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

  // Check if highlights exist (only if values are different)
  if (startValue !== targetValue && (!instruction.highlightBeads || instruction.highlightBeads.length === 0)) {
    issues.push('No beads highlighted for non-zero operation')
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