// Problem generation logic for addition worksheets (supports 1-5 digit problems)

import type {
  AdditionProblem,
  ProblemCategory,
  SubtractionProblem,
  WorksheetProblem,
} from '@/app/create/worksheets/types'
import { estimateUniqueProblemSpace } from './utils/validateProblemSpace'

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
 * Fisher-Yates shuffle with deterministic PRNG
 */
function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
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
 * Check if addition problem has regrouping
 * Returns { hasAny: boolean, hasMultiple: boolean }
 */
function checkRegrouping(a: number, b: number): { hasAny: boolean; hasMultiple: boolean } {
  const maxPlaces = Math.max(countDigits(a), countDigits(b))
  let carryCount = 0
  let carry = 0

  for (let pos = 0; pos < maxPlaces; pos++) {
    const digitA = getDigit(a, pos)
    const digitB = getDigit(b, pos)
    const sum = digitA + digitB + carry

    if (sum >= 10) {
      carryCount++
      carry = 1
    } else {
      carry = 0
    }
  }

  return { hasAny: carryCount > 0, hasMultiple: carryCount > 1 }
}

/**
 * Count the number of regrouping operations (carries) in an addition problem
 * Returns a number representing difficulty: 0 = no regrouping, 1+ = increasing difficulty
 */
export function countRegroupingOperations(a: number, b: number): number {
  const maxPlaces = Math.max(countDigits(a), countDigits(b))
  let carryCount = 0
  let carry = 0

  for (let pos = 0; pos < maxPlaces; pos++) {
    const digitA = getDigit(a, pos)
    const digitB = getDigit(b, pos)
    const sum = digitA + digitB + carry

    if (sum >= 10) {
      carryCount++
      carry = 1
    } else {
      carry = 0
    }
  }

  return carryCount
}

/**
 * Generate ALL valid addition problems for a given digit range and regrouping constraints
 * Used for small problem spaces where enumeration is faster than retry loops
 */
function generateAllAdditionProblems(
  minDigits: number,
  maxDigits: number,
  pAnyStart: number,
  pAllStart: number
): AdditionProblem[] {
  const problems: AdditionProblem[] = []

  // Generate all possible number pairs within digit range
  for (let digitsA = minDigits; digitsA <= maxDigits; digitsA++) {
    for (let digitsB = minDigits; digitsB <= maxDigits; digitsB++) {
      const minA = digitsA === 1 ? 0 : 10 ** (digitsA - 1)
      const maxA = digitsA === 1 ? 9 : 10 ** digitsA - 1
      const minB = digitsB === 1 ? 0 : 10 ** (digitsB - 1)
      const maxB = digitsB === 1 ? 9 : 10 ** digitsB - 1

      for (let a = minA; a <= maxA; a++) {
        for (let b = minB; b <= maxB; b++) {
          const regroup = checkRegrouping(a, b)

          // Filter based on regrouping requirements
          // pAnyStart = 1.0 means ONLY regrouping problems
          // pAllStart = 1.0 means ONLY multiple regrouping problems
          // pAnyStart = 0.0 means ONLY non-regrouping problems

          const includeThis =
            (pAnyStart === 1.0 && regroup.hasAny) || // Only regrouping
            (pAllStart === 1.0 && regroup.hasMultiple) || // Only multiple regrouping
            (pAnyStart === 0.0 && !regroup.hasAny) || // Only non-regrouping
            (pAnyStart > 0 && pAnyStart < 1) // Mixed mode - include everything, will sample later

          if (includeThis) {
            problems.push({ a, b, operator: 'add' })
          }
        }
      }
    }
  }

  return problems
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
  list.push({ a, b, operator: 'add' })
  return true
}

/**
 * Generate a complete set of addition problems with configurable difficulty
 *
 * STRATEGY SELECTION:
 * - Small problem spaces (< 10,000 unique): Generate-all + shuffle for zero retries
 * - Large problem spaces (≥ 10,000): Retry-based generation allows some duplicates
 *
 * CYCLING BEHAVIOR (when total > unique problems available):
 * - Non-interpolate mode: Repeats entire shuffled sequence (problems 0-44, 45-89, 90+...)
 * - Interpolate mode: Clears "seen" set after exhausting problems, maintains difficulty curve
 *
 * EXAMPLES:
 * - 1-digit 100% regrouping: Only 45 unique problems exist (will cycle after problem 44)
 * - 2-digit mixed regrouping: ~4,000 unique problems (generate-all used)
 * - 3-digit any regrouping: ~400,000 unique problems (retry-based used)
 *
 * @param total Total number of problems to generate
 * @param pAnyStart Target probability of ANY regrouping occurring (0-1)
 *                  0.0 = no regrouping, 1.0 = all problems must have regrouping
 * @param pAllStart Target probability of MULTIPLE regrouping (0-1), must be ≤ pAnyStart
 * @param interpolate If true, difficulty increases progressively from easy→hard
 *                    If false, all problems at constant difficulty
 * @param seed Random seed for deterministic reproducible generation
 * @param digitRange Digit range for problem operands (1-5 digits)
 * @returns Array of addition problems matching constraints
 */
export function generateProblems(
  total: number,
  pAnyStart: number,
  pAllStart: number,
  interpolate: boolean,
  seed: number,
  digitRange: { min: number; max: number } = { min: 2, max: 2 }
): AdditionProblem[] {
  console.log(
    `[ADD GEN] Starting: ${total} problems, digitRange: ${digitRange.min}-${digitRange.max}, pAnyStart: ${pAnyStart}, pAllStart: ${pAllStart}`
  )
  const startTime = Date.now()

  const rand = createPRNG(seed)
  const { min: minDigits, max: maxDigits } = digitRange

  // Estimate problem space size
  const estimatedSpace = estimateUniqueProblemSpace(digitRange, pAnyStart, 'addition')
  console.log(`[ADD GEN] Estimated unique problem space: ${estimatedSpace} (requesting ${total})`)

  // ========================================================================
  // STRATEGY 1: Generate-All + Shuffle (Small Problem Spaces)
  // ========================================================================
  // Used when estimated unique problems < 10,000
  // Advantages:
  // - Zero retries (no random generation needed)
  // - Guaranteed coverage (all unique problems appear before repeating)
  // - Deterministic (same seed = same worksheet)
  const THRESHOLD = 10000
  if (estimatedSpace < THRESHOLD) {
    console.log(
      `[ADD GEN] Using generate-all + shuffle (space < ${THRESHOLD}, interpolate=${interpolate})`
    )
    const allProblems = generateAllAdditionProblems(minDigits, maxDigits, pAnyStart, pAllStart)
    console.log(`[ADD GEN] Generated ${allProblems.length} unique problems`)

    if (interpolate) {
      // ===== PROGRESSIVE DIFFICULTY MODE =====
      // Sort all problems by difficulty (carry count), then sample based on
      // position in worksheet to create easy→medium→hard progression

      // CRITICAL: Handle empty problem space to prevent crashes
      if (allProblems.length === 0) {
        console.error(
          `[ADD GEN] ERROR: No valid problems exist for constraints digitRange=${minDigits}-${maxDigits}, pAnyStart=${pAnyStart}. Using fallback problems.`
        )
        // Return fallback problems to prevent crash
        const fallbackProblems: AdditionProblem[] = []
        for (let i = 0; i < total; i++) {
          fallbackProblems.push({
            a: minDigits === 1 ? 3 : 23,
            b: minDigits === 1 ? 4 : 45,
            operator: 'add',
          })
        }
        const elapsed = Date.now() - startTime
        console.log(
          `[ADD GEN] Complete: ${fallbackProblems.length} fallback problems in ${elapsed}ms (empty problem space)`
        )
        return fallbackProblems
      }

      console.log(`[ADD GEN] Sorting problems by difficulty for progressive difficulty`)
      const sortedByDifficulty = [...allProblems].sort((a, b) => {
        const diffA = countRegroupingOperations(a.a, a.b)
        const diffB = countRegroupingOperations(b.a, b.b)
        return diffA - diffB // Easier (fewer regroups) first
      })

      // Sample problems based on difficulty curve
      const result: AdditionProblem[] = []
      const seen = new Set<string>()
      let cycleCount = 0 // Track how many times we've cycled through all problems

      for (let i = 0; i < total; i++) {
        // Calculate difficulty fraction (0.0 = easy, 1.0 = hard)
        const frac = total <= 1 ? 0 : i / (total - 1)
        // Map frac (0 to 1) to index in sorted array
        // frac=0 (start) → sample from easy problems (low index)
        // frac=1 (end) → sample from hard problems (high index)
        const targetIndex = Math.floor(frac * (sortedByDifficulty.length - 1))

        // Define a window around the target index to add variety
        // Window size is 20% of total problems, minimum 3
        const windowSize = Math.max(3, Math.floor(sortedByDifficulty.length * 0.2))
        const windowStart = Math.max(0, targetIndex - Math.floor(windowSize / 2))
        const windowEnd = Math.min(sortedByDifficulty.length, windowStart + windowSize)

        // Collect unused problems within the window
        const candidatesInWindow: AdditionProblem[] = []
        for (let j = windowStart; j < windowEnd; j++) {
          const candidate = sortedByDifficulty[j]
          const candidateKey = `${candidate.a},${candidate.b}`
          if (!seen.has(candidateKey)) {
            candidatesInWindow.push(candidate)
          }
        }

        let problem: AdditionProblem | undefined
        if (candidatesInWindow.length > 0) {
          // Randomly pick from unused problems in the window
          const randomIdx = Math.floor(rand() * candidatesInWindow.length)
          problem = candidatesInWindow[randomIdx]
          const key = `${problem.a},${problem.b}`
          seen.add(key)
        } else {
          // If no unused problems in window, search outward from target
          let found = false
          for (let offset = 1; offset < sortedByDifficulty.length; offset++) {
            for (const direction of [1, -1]) {
              const idx = targetIndex + direction * offset
              if (idx >= 0 && idx < sortedByDifficulty.length) {
                problem = sortedByDifficulty[idx]
                const newKey = `${problem.a},${problem.b}`
                if (!seen.has(newKey)) {
                  seen.add(newKey)
                  found = true
                  break
                }
              }
            }
            if (found) break
          }
          // If still not found, we've exhausted ALL unique problems
          // Clear the "seen" set and start a new cycle through the sorted array
          if (!found) {
            cycleCount++
            console.log(
              `[ADD GEN] Exhausted all ${sortedByDifficulty.length} unique problems at position ${i}. Starting cycle ${cycleCount + 1}.`
            )
            seen.clear()
            // Use the target problem for this position (beginning of new cycle)
            problem = sortedByDifficulty[targetIndex]
            const key = `${problem.a},${problem.b}`
            seen.add(key)
          }
        }

        // Safety: If problem is still undefined, use the target problem
        if (!problem) {
          problem = sortedByDifficulty[targetIndex]
          const key = `${problem.a},${problem.b}`
          seen.add(key)
        }

        result.push(problem)
      }

      const elapsed = Date.now() - startTime
      console.log(
        `[ADD GEN] Complete: ${result.length} problems in ${elapsed}ms (0 retries, generate-all with progressive difficulty, ${cycleCount} cycles)`
      )
      return result
    } else {
      // ===== CONSTANT DIFFICULTY MODE =====
      // Shuffle all problems randomly, no sorting by difficulty
      const shuffled = shuffleArray(allProblems, rand)

      // CRITICAL: Handle empty problem space to prevent division by zero and infinite loops
      // This can happen when constraints are impossible to satisfy
      if (shuffled.length === 0) {
        console.error(
          `[ADD GEN] ERROR: No valid problems exist for constraints digitRange=${minDigits}-${maxDigits}, pAnyStart=${pAnyStart}. Using fallback problems.`
        )
        // Return fallback problems to prevent crash
        const fallbackProblems: AdditionProblem[] = []
        for (let i = 0; i < total; i++) {
          fallbackProblems.push({
            a: minDigits === 1 ? 3 : 23,
            b: minDigits === 1 ? 4 : 45,
            operator: 'add',
          })
        }
        const elapsed = Date.now() - startTime
        console.log(
          `[ADD GEN] Complete: ${fallbackProblems.length} fallback problems in ${elapsed}ms (empty problem space)`
        )
        return fallbackProblems
      }

      // If we need more problems than available, cycle through the shuffled array
      // Example: 45 unique problems, requesting 100
      //   - Problems 0-44: First complete shuffle
      //   - Problems 45-89: Second complete shuffle (same order as first)
      //   - Problems 90-99: First 10 from third shuffle
      if (total > shuffled.length) {
        const cyclesNeeded = Math.ceil(total / shuffled.length)
        console.warn(
          `[ADD GEN] Warning: Requested ${total} problems but only ${shuffled.length} unique problems exist. Will cycle ${cyclesNeeded} times.`
        )
        // Build result by repeating the entire shuffled array as many times as needed
        // Using modulo ensures we cycle through: problem[0], problem[1], ..., problem[N-1], problem[0], ...
        const result: AdditionProblem[] = []
        for (let i = 0; i < total; i++) {
          result.push(shuffled[i % shuffled.length])
        }
        const elapsed = Date.now() - startTime
        console.log(
          `[ADD GEN] Complete: ${result.length} problems in ${elapsed}ms (0 retries, generate-all method, ${cyclesNeeded} cycles)`
        )
        return result
      }

      // Take first N problems from shuffled array (typical case: enough unique problems)
      const elapsed = Date.now() - startTime
      console.log(
        `[ADD GEN] Complete: ${total} problems in ${elapsed}ms (0 retries, generate-all method)`
      )
      return shuffled.slice(0, total)
    }
  }

  // ========================================================================
  // STRATEGY 2: Retry-Based Generation (Large Problem Spaces)
  // ========================================================================
  // Used when estimated unique problems ≥ 10,000
  // Randomly generates problems and retries on duplicates
  // Allows some duplicates after 100 retries to prevent infinite loops
  console.log(`[ADD GEN] Using retry-based approach (space >= ${THRESHOLD})`)
  const problems: AdditionProblem[] = []
  const seen = new Set<string>()

  let totalRetries = 0
  for (let i = 0; i < total; i++) {
    // Log progress every 100 problems for large sets
    if (i > 0 && i % 100 === 0) {
      console.log(
        `[ADD GEN] Progress: ${i}/${total} problems (${totalRetries} total retries so far)`
      )
    }
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
    // Reduced from 3000 to 100 - for large worksheets with constrained digit ranges,
    // 3000 retries per problem = millions of iterations. Better to allow some duplicates.
    let tries = 0
    let ok = false
    while (tries++ < 100 && !ok) {
      let a: number, b: number
      if (picked === 'both') {
        ;[a, b] = generateBoth(rand, minDigits, maxDigits)
      } else if (picked === 'onesOnly') {
        ;[a, b] = generateOnesOnly(rand, minDigits, maxDigits)
      } else {
        ;[a, b] = generateNonRegroup(rand, minDigits, maxDigits)
      }
      ok = uniquePush(problems, a, b, seen)

      // If stuck, try a different category - but respect the difficulty constraints
      // Don't switch to a harder category if pAny is 0 (no regrouping allowed)
      if (!ok && tries % 50 === 0) {
        if (pAny > 0) {
          // Can use any category
          picked = pick(['both', 'onesOnly', 'non'], rand)
        }
        // If pAny is 0, keep trying 'non' - don't switch to regrouping categories
      }
    }
    totalRetries += tries

    // Last resort: use the appropriate generator one more time, even if not unique
    // This respects the difficulty constraints (non/onesOnly/both)
    if (!ok) {
      let a: number, b: number
      if (picked === 'both') {
        ;[a, b] = generateBoth(rand, minDigits, maxDigits)
      } else if (picked === 'onesOnly') {
        ;[a, b] = generateOnesOnly(rand, minDigits, maxDigits)
      } else {
        ;[a, b] = generateNonRegroup(rand, minDigits, maxDigits)
      }
      // Allow duplicate as last resort - add with operator property
      problems.push({ a, b, operator: 'add' })
    }
  }

  const elapsed = Date.now() - startTime
  console.log(
    `[ADD GEN] Complete: ${problems.length} problems in ${elapsed}ms (${totalRetries} total retries, avg ${Math.round(totalRetries / total)} per problem)`
  )

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
  // Fallback: Return safe problems that require ones-place borrowing
  // For single-digit: Use teens minus singles (13-7, 15-8)
  // For two-digit: Use problems like 52-17
  return minDigits === 1 ? [13, 7] : [52, 17]
}

/**
 * Check if subtraction problem has borrowing
 * Returns { hasAny: boolean, hasMultiple: boolean }
 */
function checkBorrowing(
  minuend: number,
  subtrahend: number
): { hasAny: boolean; hasMultiple: boolean } {
  const borrowCount = countBorrows(minuend, subtrahend)
  return { hasAny: borrowCount > 0, hasMultiple: borrowCount > 1 }
}

/**
 * Generate ALL valid subtraction problems for a given digit range and borrowing constraints
 * Used for small problem spaces where enumeration is faster than retry loops
 */
function generateAllSubtractionProblems(
  minDigits: number,
  maxDigits: number,
  pAnyBorrow: number,
  pAllBorrow: number
): SubtractionProblem[] {
  const problems: SubtractionProblem[] = []

  // Generate all possible number pairs within digit range where minuend >= subtrahend
  for (let digitsM = minDigits; digitsM <= maxDigits; digitsM++) {
    for (let digitsS = minDigits; digitsS <= maxDigits; digitsS++) {
      const minM = digitsM === 1 ? 0 : 10 ** (digitsM - 1)
      const maxM = digitsM === 1 ? 9 : 10 ** digitsM - 1
      const minS = digitsS === 1 ? 0 : 10 ** (digitsS - 1)
      const maxS = digitsS === 1 ? 9 : 10 ** digitsS - 1

      for (let minuend = minM; minuend <= maxM; minuend++) {
        for (let subtrahend = minS; subtrahend <= maxS; subtrahend++) {
          // Ensure minuend >= subtrahend (no negative results)
          if (minuend < subtrahend) continue

          const borrow = checkBorrowing(minuend, subtrahend)

          // Filter based on borrowing requirements (same logic as addition)
          const includeThis =
            (pAnyBorrow === 1.0 && borrow.hasAny) || // Only borrowing
            (pAllBorrow === 1.0 && borrow.hasMultiple) || // Only multiple borrowing
            (pAnyBorrow === 0.0 && !borrow.hasAny) || // Only non-borrowing
            (pAnyBorrow > 0 && pAnyBorrow < 1) // Mixed mode - include everything

          if (includeThis) {
            problems.push({ minuend, subtrahend, operator: 'sub' })
          }
        }
      }
    }
  }

  return problems
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
    const digitM = minuendDigits[pos]

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
  console.log(
    `[SUB GEN] Starting: ${count} problems, digitRange: ${digitRange.min}-${digitRange.max}, pAnyBorrow: ${pAnyBorrow}, pAllBorrow: ${pAllBorrow}`
  )
  const startTime = Date.now()

  const rand = createPRNG(seed)
  const minDigits = digitRange.min
  const maxDigits = digitRange.max

  // Estimate problem space size
  const estimatedSpace = estimateUniqueProblemSpace(digitRange, pAnyBorrow, 'subtraction')
  console.log(`[SUB GEN] Estimated unique problem space: ${estimatedSpace} (requesting ${count})`)

  // For small problem spaces, use generate-all + shuffle approach
  const THRESHOLD = 10000
  if (estimatedSpace < THRESHOLD && !interpolate) {
    console.log(`[SUB GEN] Using generate-all + shuffle (space < ${THRESHOLD})`)
    const allProblems = generateAllSubtractionProblems(minDigits, maxDigits, pAnyBorrow, pAllBorrow)
    console.log(`[SUB GEN] Generated ${allProblems.length} unique problems`)

    // Shuffle deterministically using seed
    const shuffled = shuffleArray(allProblems, rand)

    // CRITICAL: Handle empty problem space to prevent infinite loop
    // This can happen when constraints are impossible to satisfy (e.g., 1-digit with 100% borrowing)
    if (shuffled.length === 0) {
      console.error(
        `[SUB GEN] ERROR: No valid problems exist for constraints digitRange=${minDigits}-${maxDigits}, pAnyBorrow=${pAnyBorrow}. Using fallback problems.`
      )
      // Return fallback problems to prevent infinite loop
      const fallbackProblems: SubtractionProblem[] = []
      for (let i = 0; i < count; i++) {
        // Use safe fallback that always works
        fallbackProblems.push({
          minuend: minDigits === 1 ? 9 : 52,
          subtrahend: minDigits === 1 ? 3 : 17,
          operator: 'sub',
        })
      }
      const elapsed = Date.now() - startTime
      console.log(
        `[SUB GEN] Complete: ${fallbackProblems.length} fallback problems in ${elapsed}ms (empty problem space)`
      )
      return fallbackProblems
    }

    // If we need more problems than available, we'll have duplicates
    if (count > shuffled.length) {
      console.warn(
        `[SUB GEN] Warning: Requested ${count} problems but only ${shuffled.length} unique problems exist. Some duplicates will occur.`
      )
      // Repeat the shuffled array to fill the request
      const result: SubtractionProblem[] = []
      while (result.length < count) {
        result.push(...shuffled.slice(0, Math.min(shuffled.length, count - result.length)))
      }
      const elapsed = Date.now() - startTime
      console.log(
        `[SUB GEN] Complete: ${result.length} problems in ${elapsed}ms (0 retries, generate-all method)`
      )
      return result
    }

    // Take first N problems from shuffled array
    const elapsed = Date.now() - startTime
    console.log(
      `[SUB GEN] Complete: ${count} problems in ${elapsed}ms (0 retries, generate-all method)`
    )
    return shuffled.slice(0, count)
  }

  // For large problem spaces or interpolated difficulty, use retry-based approach
  console.log(
    `[SUB GEN] Using retry-based approach (space >= ${THRESHOLD} or interpolate=${interpolate})`
  )
  const problems: SubtractionProblem[] = []
  const seen = new Set<string>()

  function uniquePush(minuend: number, subtrahend: number): boolean {
    const key = `${minuend}-${subtrahend}`
    if (!seen.has(key)) {
      seen.add(key)
      problems.push({ minuend, subtrahend, operator: 'sub' })
      return true
    }
    return false
  }

  let totalRetries = 0
  for (let i = 0; i < count; i++) {
    // Log progress every 100 problems for large sets
    if (i > 0 && i % 100 === 0) {
      console.log(
        `[SUB GEN] Progress: ${i}/${count} problems (${totalRetries} total retries so far)`
      )
    }
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
    // Reduced from 3000 to 100 - for large worksheets with constrained digit ranges,
    // 3000 retries per problem = millions of iterations. Better to allow some duplicates.
    let tries = 0
    let ok = false
    while (tries++ < 100 && !ok) {
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
    totalRetries += tries

    // Last resort: add any valid problem in digit range
    if (!ok) {
      const digitsM = randint(minDigits, maxDigits, rand)
      const digitsS = randint(minDigits, maxDigits, rand)
      let minuend = generateNumber(digitsM, rand)
      let subtrahend = generateNumber(digitsS, rand)

      // Ensure minuend > subtrahend (strictly greater to avoid 0-0 and ensure borrowing is possible)
      if (minuend <= subtrahend) {
        ;[minuend, subtrahend] = [subtrahend, minuend]
      }

      // Final safety check: ensure minuend is actually greater
      if (minuend <= subtrahend) {
        // Both were equal or something went wrong - use safe fallback
        if (minDigits === 1) {
          minuend = 13
          subtrahend = 7
        } else {
          minuend = 52
          subtrahend = 17
        }
      }

      uniquePush(minuend, subtrahend)
    }
  }

  const elapsed = Date.now() - startTime
  console.log(
    `[SUB GEN] Complete: ${problems.length} problems in ${elapsed}ms (${totalRetries} total retries, avg ${Math.round(totalRetries / count)} per problem)`
  )

  return problems
}

/**
 * Generate mixed addition and subtraction problems for MASTERY MODE
 *
 * KEY DIFFERENCES from manual mixed mode:
 * - Uses SEPARATE skill-based configs for addition vs subtraction
 * - Addition problems based on addition skill (e.g., 2-digit 30% regrouping)
 * - Subtraction problems based on subtraction skill (e.g., 1-2 digit 70% borrowing)
 * - Problems can have different difficulties within same worksheet
 *
 * PROBLEM SPACE VALIDATION:
 * - Validation is SKIPPED for mastery+mixed mode (too complex with separate configs)
 * - See WorksheetPreviewContext.tsx:53-56
 *
 * EXAMPLE:
 * - Addition skill: Level 5 → {digitRange: {min:2, max:2}, pAnyStart: 0.3}
 * - Subtraction skill: Level 3 → {digitRange: {min:1, max:2}, pAnyStart: 0.7}
 * - Result: 50 easy 2-digit additions + 50 harder 1-2 digit subtractions, shuffled
 *
 * @param count Total number of problems to generate (split 50/50 between operators)
 * @param additionConfig Difficulty config from current addition skill level
 * @param subtractionConfig Difficulty config from current subtraction skill level
 * @param seed Random seed for deterministic generation and shuffling
 * @returns Array of mixed problems shuffled randomly (no interpolation in mastery mode)
 */
export function generateMasteryMixedProblems(
  count: number,
  additionConfig: {
    digitRange: { min: number; max: number }
    pAnyStart: number
    pAllStart: number
  },
  subtractionConfig: {
    digitRange: { min: number; max: number }
    pAnyStart: number
    pAllStart: number
  },
  seed: number
): WorksheetProblem[] {
  console.log(`[MASTERY MIXED] Generating ${count} mixed problems (50/50 split)...`)

  // Generate half from each operator
  const halfCount = Math.floor(count / 2)
  const addCount = halfCount
  const subCount = count - halfCount // Handle odd counts

  console.log(`[MASTERY MIXED] Step 1: Generating ${addCount} addition problems...`)
  const addStart = Date.now()
  // Generate addition problems using addition skill config
  const addProblems = generateProblems(
    addCount,
    additionConfig.pAnyStart,
    additionConfig.pAllStart,
    false, // No interpolation in mastery mode
    seed,
    additionConfig.digitRange
  )
  console.log(
    `[MASTERY MIXED] Step 1: ✓ Generated ${addProblems.length} addition problems in ${Date.now() - addStart}ms`
  )

  console.log(`[MASTERY MIXED] Step 2: Generating ${subCount} subtraction problems...`)
  const subStart = Date.now()
  // Generate subtraction problems using subtraction skill config
  const subProblems = generateSubtractionProblems(
    subCount,
    subtractionConfig.digitRange,
    subtractionConfig.pAnyStart,
    subtractionConfig.pAllStart,
    false, // No interpolation in mastery mode
    seed + 1000000 // Different seed space
  )
  console.log(
    `[MASTERY MIXED] Step 2: ✓ Generated ${subProblems.length} subtraction problems in ${Date.now() - subStart}ms`
  )

  console.log(`[MASTERY MIXED] Step 3: Shuffling ${count} problems...`)
  const shuffleStart = Date.now()
  // Combine and shuffle
  const allProblems = [...addProblems, ...subProblems]
  const rand = createPRNG(seed + 2000000)

  // Fisher-Yates shuffle
  for (let i = allProblems.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[allProblems[i], allProblems[j]] = [allProblems[j], allProblems[i]]
  }
  console.log(`[MASTERY MIXED] Step 3: ✓ Shuffled in ${Date.now() - shuffleStart}ms`)

  return allProblems
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
