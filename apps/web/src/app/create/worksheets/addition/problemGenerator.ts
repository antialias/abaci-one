// Problem generation logic for double-digit addition worksheets

import type { AdditionProblem, ProblemCategory } from './types'

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
 * Generate a random two-digit number (10-99)
 */
function twoDigit(rand: () => number): number {
  const tens = randint(1, 9, rand)
  const ones = randint(0, 9, rand)
  return tens * 10 + ones
}

/**
 * Generate a problem with NO regrouping
 * (ones sum < 10 AND tens sum < 10)
 */
export function generateNonRegroup(rand: () => number): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const a = twoDigit(rand)
    const b = twoDigit(rand)
    const aT = Math.floor((a % 100) / 10)
    const aO = a % 10
    const bT = Math.floor((b % 100) / 10)
    const bO = b % 10

    if (aO + bO < 10 && aT + bT < 10) {
      return [a, b]
    }
  }
  // Fallback
  return [12, 34]
}

/**
 * Generate a problem with regrouping in ONES only
 * (ones sum >= 10 AND tens sum + carry < 10)
 */
export function generateOnesOnly(rand: () => number): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const a = twoDigit(rand)
    const b = twoDigit(rand)
    const aT = Math.floor((a % 100) / 10)
    const aO = a % 10
    const bT = Math.floor((b % 100) / 10)
    const bO = b % 10

    if (aO + bO >= 10 && aT + bT + 1 < 10) {
      return [a, b]
    }
  }
  // Fallback
  return [58, 31]
}

/**
 * Generate a problem with regrouping in BOTH ones and tens
 * (ones sum >= 10 AND tens sum + carry >= 10)
 */
export function generateBoth(rand: () => number): [number, number] {
  for (let i = 0; i < 5000; i++) {
    const a = twoDigit(rand)
    const b = twoDigit(rand)
    const aT = Math.floor((a % 100) / 10)
    const aO = a % 10
    const bT = Math.floor((b % 100) / 10)
    const bO = b % 10

    if (aO + bO >= 10 && aT + bT + 1 >= 10) {
      return [a, b]
    }
  }
  // Fallback
  return [68, 47]
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
  list.push({ a, b })
  return true
}

/**
 * Generate a complete set of problems based on difficulty parameters
 */
export function generateProblems(
  total: number,
  pAnyStart: number,
  pAllStart: number,
  interpolate: boolean,
  seed: number
): AdditionProblem[] {
  const rand = createPRNG(seed)
  const problems: AdditionProblem[] = []
  const seen = new Set<string>()

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
        ;[a, b] = generateBoth(rand)
      } else if (picked === 'onesOnly') {
        ;[a, b] = generateOnesOnly(rand)
      } else {
        ;[a, b] = generateNonRegroup(rand)
      }
      ok = uniquePush(problems, a, b, seen)

      // If stuck, try a different category
      if (!ok && tries % 50 === 0) {
        picked = pick(['both', 'onesOnly', 'non'], rand)
      }
    }

    // Last resort: add any valid two-digit problem
    if (!ok) {
      const a = twoDigit(rand)
      const b = twoDigit(rand)
      uniquePush(problems, a, b, seen)
    }
  }

  return problems
}
