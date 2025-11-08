// Problem generation logic for addition worksheets (supports 1-5 digit problems)

import type {
  AdditionProblem,
  SubtractionProblem,
  WorksheetProblem,
  ProblemCategory,
} from './types'

/**
 * Mulberry32 PRNG for reproducible random number generation
 */
export function createPRNG(seed: number) {
  let state = seed
  return function rand(): number {
    let t = (state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pick a random element from an array
 */
function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randint(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

/**
 * Generate a random number with the specified number of digits
 * For n digits, generates numbers in range [10^(n-1), 10^n - 1]
 * Examples:
 * - 1 digit: 0-9
 * - 2 digits: 10-99
 * - 3 digits: 100-999
 * - 5 digits: 10000-99999
 */
export function generateNumber(digits: number, rand: () => number): number {
  if (digits < 1 || digits > 5) {
    throw new Error(`Invalid digit count: ${digits}. Must be 1-5.`)
  }

  // For 1 digit, range is 0-9 (allow 0 as first digit)
  if (digits === 1) {
    return randint(0, 9, rand)
  }

  // For 2+ digits, range is [10^(n-1), 10^n - 1]
  const min = 10 ** (digits - 1)
  const max = 10 ** digits - 1
  return randint(min, max, rand)
}

/**
 * DEPRECATED: Use generateNumber(2, rand) instead
 * Generate a random two-digit number (10-99)
 */
function twoDigit(rand: () => number): number {
  return generateNumber(2, rand)
}

/**
 * Extract digit at position from a number
 * position 0 = ones, 1 = tens, 2 = hundreds, etc.
 */
function getDigit(num: number, position: number): number {
  return Math.floor((num % 10 ** (position + 1)) / 10 ** position)
}

/**
 * Count number of digits in a number (1-5)
 */
function countDigits(num: number): number {
  if (num === 0) return 1
  return Math.floor(Math.log10(Math.abs(num))) + 1
}

/**
 * Generate a problem with NO regrouping
 * No carries in any place value
 *
 * @param minDigits Minimum number of digits per addend
 * @param maxDigits Maximum number of digits per addend
 */
export function generateNonRegroup(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2
): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const digitsA = randint(minDigits, maxDigits, rand)
    const digitsB = randint(minDigits, maxDigits, rand)
    const a = generateNumber(digitsA, rand)
    const b = generateNumber(digitsB, rand)

    // Check all place values for carries
    const maxPlaces = Math.max(countDigits(a), countDigits(b))
    let hasCarry = false
    for (let pos = 0; pos < maxPlaces; pos++) {
      const digitA = getDigit(a, pos)
      const digitB = getDigit(b, pos)
      if (digitA + digitB >= 10) {
        hasCarry = true
        break
      }
    }

    if (!hasCarry) {
      return [a, b]
    }
  }
  // Fallback
  return minDigits === 1 ? [1, 2] : [12, 34]
}

/**
 * Generate a problem with regrouping in ONES only
 * Carry from ones to tens, but no higher carries
 *
 * @param minDigits Minimum number of digits per addend
 * @param maxDigits Maximum number of digits per addend
 */
export function generateOnesOnly(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2
): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const digitsA = randint(minDigits, maxDigits, rand)
    const digitsB = randint(minDigits, maxDigits, rand)
    const a = generateNumber(digitsA, rand)
    const b = generateNumber(digitsB, rand)

    const onesA = getDigit(a, 0)
    const onesB = getDigit(b, 0)

    // Must have ones carry
    if (onesA + onesB < 10) continue

    // Check that no other place values carry
    const maxPlaces = Math.max(countDigits(a), countDigits(b))
    let carry = 1 // carry from ones
    let hasOtherCarry = false
    for (let pos = 1; pos < maxPlaces; pos++) {
      const digitA = getDigit(a, pos)
      const digitB = getDigit(b, pos)
      if (digitA + digitB + carry >= 10) {
        hasOtherCarry = true
        break
      }
      carry = 0 // no more carries after first position
    }

    if (!hasOtherCarry) {
      return [a, b]
    }
  }
  // Fallback
  return minDigits === 1 ? [5, 8] : [58, 31]
}

/**
 * Generate a problem with regrouping in BOTH ones and tens
 * Carries in at least two place values (ones and tens minimum)
 *
 * @param minDigits Minimum number of digits per addend
 * @param maxDigits Maximum number of digits per addend
 */
export function generateBoth(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2
): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const digitsA = randint(minDigits, maxDigits, rand)
    const digitsB = randint(minDigits, maxDigits, rand)
    const a = generateNumber(digitsA, rand)
    const b = generateNumber(digitsB, rand)

    // Check for carries in each place value
    const maxPlaces = Math.max(countDigits(a), countDigits(b))
    let carryCount = 0
    let carry = 0
    for (let pos = 0; pos < maxPlaces; pos++) {
      const digitA = getDigit(a, pos)
      const digitB = getDigit(b, pos)
      if (digitA + digitB + carry >= 10) {
        carryCount++
        carry = 1
      } else {
        carry = 0
      }
    }

    // "Both" means at least 2 carries
    if (carryCount >= 2) {
      return [a, b]
    }
  }
  // Fallback
  return minDigits === 1 ? [8, 9] : [68, 47]
}

/**
 * Try to add a unique problem to the list
 * Returns true if added, false if duplicate
 */
function uniquePush(list: AdditionProblem[], a: number, b: number, seen: Set<string>): boolean {
  const key = [Math.min(a, b), Math.max(a, b)].join('+')
  if (seen.has(key) || a === b) {
    return false
  }
  seen.add(key)
  list.push({ a, b, operator: '+' })
  return true
}

/**
 * Generate a complete set of problems based on difficulty parameters
 *
 * @param total Total number of problems to generate
 * @param pAnyStart Starting probability of any regrouping (0-1)
 * @param pAllStart Starting probability of multiple regrouping (0-1)
 * @param interpolate If true, difficulty increases from start to end
 * @param seed Random seed for reproducible generation
 * @param digitRange Digit range for problem numbers (V4+)
 */
export function generateProblems(
  total: number,
  pAnyStart: number,
  pAllStart: number,
  interpolate: boolean,
  seed: number,
  digitRange: { min: number; max: number } = { min: 2, max: 2 }
): AdditionProblem[] {
  const rand = createPRNG(seed)
  const problems: AdditionProblem[] = []
  const seen = new Set<string>()

  const { min: minDigits, max: maxDigits } = digitRange

  for (let i = 0; i < total; i++) {
    // Calculate position from start (0) to end (1)
    const frac = total <= 1 ? 0 : i / (total - 1)
    // Progressive difficulty: start easy, end hard
    const difficultyMultiplier = interpolate ? frac : 1.0

    // Effective probabilities at this position
    const pAll = Math.max(0, Math.min(1, pAllStart * difficultyMultiplier))
    const pAny = Math.max(0, Math.min(1, pAnyStart * difficultyMultiplier))
    const pOnesOnly = Math.max(0, pAny - pAll)
    const pNon = Math.max(0, 1 - pAny)

    // Sample category based on probabilities
    const r = rand()
    let picked: ProblemCategory
    if (r < pAll) {
      picked = 'both'
    } else if (r < pAll + pOnesOnly) {
      picked = 'onesOnly'
    } else {
      picked = 'non'
    }

    // Generate problem with retries for uniqueness
    let tries = 0
    let ok = false
    while (tries++ < 3000 && !ok) {
      let a: number, b: number
      if (picked === 'both') {
        ;[a, b] = generateBoth(rand, minDigits, maxDigits)
      } else if (picked === 'onesOnly') {
        ;[a, b] = generateOnesOnly(rand, minDigits, maxDigits)
      } else {
        ;[a, b] = generateNonRegroup(rand, minDigits, maxDigits)
      }
      ok = uniquePush(problems, a, b, seen)

      // If stuck, try a different category
      if (!ok && tries % 50 === 0) {
        picked = pick(['both', 'onesOnly', 'non'], rand)
      }
    }

    // Last resort: add any valid problem in digit range
    if (!ok) {
      const digitsA = randint(minDigits, maxDigits, rand)
      const digitsB = randint(minDigits, maxDigits, rand)
      const a = generateNumber(digitsA, rand)
      const b = generateNumber(digitsB, rand)
      uniquePush(problems, a, b, seen)
    }
  }

  return problems
}

// =============================================================================
// SUBTRACTION PROBLEM GENERATION
// =============================================================================

/**
 * Generate a subtraction problem with NO borrowing
 * No borrows in any place value (minuend digit >= subtrahend digit at each place)
 *
 * @param minDigits Minimum number of digits
 * @param maxDigits Maximum number of digits
 */
export function generateNonBorrow(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2
): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const digitsMinuend = randint(minDigits, maxDigits, rand)
    const digitsSubtrahend = randint(minDigits, maxDigits, rand)
    const minuend = generateNumber(digitsMinuend, rand)
    const subtrahend = generateNumber(digitsSubtrahend, rand)

    // Ensure minuend >= subtrahend (no negative results)
    if (minuend < subtrahend) continue

    // Check all place values for borrows
    const maxPlaces = Math.max(countDigits(minuend), countDigits(subtrahend))
    let hasBorrow = false
    for (let pos = 0; pos < maxPlaces; pos++) {
      const digitM = getDigit(minuend, pos)
      const digitS = getDigit(subtrahend, pos)
      if (digitM < digitS) {
        hasBorrow = true
        break
      }
    }

    if (!hasBorrow) {
      return [minuend, subtrahend]
    }
  }
  // Fallback
  return minDigits === 1 ? [9, 2] : [89, 34]
}

/**
 * Generate a subtraction problem with borrowing in ONES only
 * Borrow from tens to ones, but no higher borrows
 *
 * @param minDigits Minimum number of digits
 * @param maxDigits Maximum number of digits
 */
export function generateOnesOnlyBorrow(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2
): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const digitsMinuend = randint(minDigits, maxDigits, rand)
    const digitsSubtrahend = randint(minDigits, maxDigits, rand)
    const minuend = generateNumber(digitsMinuend, rand)
    const subtrahend = generateNumber(digitsSubtrahend, rand)

    // Ensure minuend >= subtrahend
    if (minuend < subtrahend) continue

    const onesM = getDigit(minuend, 0)
    const onesS = getDigit(subtrahend, 0)

    // Must borrow in ones place
    if (onesM >= onesS) continue

    // Check that no other place values borrow
    // Note: For subtraction, we need to track actual borrowing through the places
    const maxPlaces = Math.max(countDigits(minuend), countDigits(subtrahend))
    let tempMinuend = minuend
    let hasOtherBorrow = false

    // Simulate the subtraction place by place
    for (let pos = 0; pos < maxPlaces; pos++) {
      const digitM = getDigit(tempMinuend, pos)
      const digitS = getDigit(subtrahend, pos)

      if (digitM < digitS) {
        if (pos === 0) {
          // Expected borrow in ones
          // Borrow from tens
          const tensDigit = getDigit(tempMinuend, 1)
          if (tensDigit === 0) {
            // Can't borrow from zero - this problem is invalid
            hasOtherBorrow = true
            break
          }
          // Apply the borrow
          tempMinuend -= 10 ** 1 // Subtract 10 from tens place
        } else {
          // Borrow in higher place - not allowed for ones-only
          hasOtherBorrow = true
          break
        }
      }
    }

    if (!hasOtherBorrow) {
      return [minuend, subtrahend]
    }
  }
  // Fallback
  return minDigits === 1 ? [5, 7] : [52, 17]
}

/**
 * Count the number of actual borrow operations needed for subtraction
 * Simulates the standard borrowing algorithm
 *
 * Examples:
 * - 52 - 17: ones digit 2 < 7, borrow from tens → 1 borrow
 * - 534 - 178: ones 4 < 8 (borrow from tens), tens becomes 2 < 7 (borrow from hundreds) → 2 borrows
 * - 100 - 1: ones 0 < 1, borrow across zeros (hundreds → tens → ones) → 2 borrows
 * - 1000 - 1: ones 0 < 1, borrow across 3 zeros → 3 borrows
 */
function countBorrows(minuend: number, subtrahend: number): number {
  const maxPlaces = Math.max(countDigits(minuend), countDigits(subtrahend))
  let borrowCount = 0
  const minuendDigits: number[] = []

  // Extract all digits of minuend into array
  for (let pos = 0; pos < maxPlaces; pos++) {
    minuendDigits[pos] = getDigit(minuend, pos)
  }

  // Simulate subtraction with borrowing
  for (let pos = 0; pos < maxPlaces; pos++) {
    const digitS = getDigit(subtrahend, pos)
    let digitM = minuendDigits[pos]

    if (digitM < digitS) {
      // Need to borrow
      borrowCount++

      // Find next non-zero digit to borrow from
      let borrowPos = pos + 1
      while (borrowPos < maxPlaces && minuendDigits[borrowPos] === 0) {
        borrowCount++ // Borrowing across a zero counts as an additional borrow
        borrowPos++
      }

      // Perform the borrow operation
      if (borrowPos < maxPlaces) {
        minuendDigits[borrowPos]-- // Take 1 from higher place

        // Set intermediate zeros to 9
        for (let p = borrowPos - 1; p > pos; p--) {
          minuendDigits[p] = 9
        }

        // Add 10 to current position
        minuendDigits[pos] += 10
      }
    }
  }

  return borrowCount
}

/**
 * Generate a subtraction problem with borrowing in BOTH ones and tens
 * Requires actual borrowing operations in at least two different place values
 *
 * NOTE: For 1-2 digit numbers, it's mathematically impossible to have 2+ borrows
 * without the result being negative. This function requires minDigits >= 3 or
 * will fall back to a ones-only borrow problem.
 *
 * @param minDigits Minimum number of digits
 * @param maxDigits Maximum number of digits
 */
export function generateBothBorrow(
  rand: () => number,
  minDigits: number = 2,
  maxDigits: number = 2
): [number, number] {
  // For 1-2 digit ranges, 2+ borrows are impossible
  // Fall back to ones-only borrowing
  if (maxDigits <= 2) {
    return generateOnesOnlyBorrow(rand, minDigits, maxDigits)
  }

  for (let i = 0; i < 5000; i++) {
    // Favor higher digit counts for better chance of 2+ borrows
    const digitsMinuend = randint(Math.max(minDigits, 3), maxDigits, rand)
    const digitsSubtrahend = randint(Math.max(minDigits, 2), maxDigits, rand)
    const minuend = generateNumber(digitsMinuend, rand)
    const subtrahend = generateNumber(digitsSubtrahend, rand)

    // Ensure minuend > subtrahend
    if (minuend <= subtrahend) continue

    // Count actual borrow operations
    const borrowCount = countBorrows(minuend, subtrahend)

    // Need at least 2 actual borrow operations
    if (borrowCount >= 2) {
      return [minuend, subtrahend]
    }
  }
  // Fallback: 534 - 178 requires borrowing in ones and tens
  // 100 - 1 requires borrowing across zero (2 borrows)
  return [534, 178]
}

/**
 * Generate subtraction problems with variable digit ranges (1-5 digits)
 * Similar to addition problem generation but for subtraction
 *
 * @param count Number of problems to generate
 * @param digitRange Digit range for problem generation
 * @param pAnyStart Initial probability that any place value requires borrowing
 * @param pAllStart Initial probability that all place values require borrowing
 * @param interpolate If true, difficulty increases linearly from start to end
 * @param seed Random seed for reproducibility
 */
export function generateSubtractionProblems(
  count: number,
  digitRange: { min: number; max: number },
  pAnyBorrow: number,
  pAllBorrow: number,
  interpolate: boolean,
  seed: number
): SubtractionProblem[] {
  const rand = createPRNG(seed)
  const problems: SubtractionProblem[] = []
  const seen = new Set<string>()
  const minDigits = digitRange.min
  const maxDigits = digitRange.max

  function uniquePush(minuend: number, subtrahend: number): boolean {
    const key = `${minuend}-${subtrahend}`
    if (!seen.has(key)) {
      seen.add(key)
      problems.push({ minuend, subtrahend, operator: '−' })
      return true
    }
    return false
  }

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1) // 0.0 to 1.0
    const difficultyMultiplier = interpolate ? t : 1

    // Effective probabilities at this position
    const pAll = Math.max(0, Math.min(1, pAllBorrow * difficultyMultiplier))
    const pAny = Math.max(0, Math.min(1, pAnyBorrow * difficultyMultiplier))
    const pOnesOnly = Math.max(0, pAny - pAll)
    const pNon = Math.max(0, 1 - pAny)

    // Sample category based on probabilities
    const r = rand()
    let picked: ProblemCategory
    if (r < pAll) {
      picked = 'both'
    } else if (r < pAll + pOnesOnly) {
      picked = 'onesOnly'
    } else {
      picked = 'non'
    }

    // Generate problem with retries for uniqueness
    let tries = 0
    let ok = false
    while (tries++ < 3000 && !ok) {
      let minuend: number, subtrahend: number
      if (picked === 'both') {
        ;[minuend, subtrahend] = generateBothBorrow(rand, minDigits, maxDigits)
      } else if (picked === 'onesOnly') {
        ;[minuend, subtrahend] = generateOnesOnlyBorrow(rand, minDigits, maxDigits)
      } else {
        ;[minuend, subtrahend] = generateNonBorrow(rand, minDigits, maxDigits)
      }
      ok = uniquePush(minuend, subtrahend)

      // If stuck, try a different category
      if (!ok && tries % 50 === 0) {
        picked = pick(['both', 'onesOnly', 'non'], rand)
      }
    }

    // Last resort: add any valid problem in digit range
    if (!ok) {
      const digitsM = randint(minDigits, maxDigits, rand)
      const digitsS = randint(minDigits, maxDigits, rand)
      let minuend = generateNumber(digitsM, rand)
      let subtrahend = generateNumber(digitsS, rand)

      // Ensure minuend >= subtrahend
      if (minuend < subtrahend) {
        ;[minuend, subtrahend] = [subtrahend, minuend]
      }

      uniquePush(minuend, subtrahend)
    }
  }

  return problems
}

/**
 * Generate mixed addition and subtraction problems
 * Randomly alternates between addition and subtraction (50/50)
 *
 * @param count Number of problems to generate
 * @param digitRange Digit range for problem generation
 * @param pAnyRegroup Probability any place needs regrouping (carry or borrow)
 * @param pAllRegroup Probability all places need regrouping
 * @param interpolate If true, difficulty increases linearly
 * @param seed Random seed
 */
export function generateMixedProblems(
  count: number,
  digitRange: { min: number; max: number },
  pAnyRegroup: number,
  pAllRegroup: number,
  interpolate: boolean,
  seed: number
): WorksheetProblem[] {
  const rand = createPRNG(seed)
  const problems: WorksheetProblem[] = []

  // Generate half addition, half subtraction (alternating with randomness)
  for (let i = 0; i < count; i++) {
    const useAddition = rand() < 0.5

    if (useAddition) {
      // Generate single addition problem
      const addProblems = generateProblems(
        1,
        pAnyRegroup,
        pAllRegroup,
        false, // Don't interpolate individual problems
        seed + i,
        digitRange
      )
      problems.push(addProblems[0])
    } else {
      // Generate single subtraction problem
      const subProblems = generateSubtractionProblems(
        1,
        digitRange,
        pAnyRegroup,
        pAllRegroup,
        false, // Don't interpolate individual problems
        seed + i + 1000000 // Different seed space
      )
      problems.push(subProblems[0])
    }
  }

  return problems
}
