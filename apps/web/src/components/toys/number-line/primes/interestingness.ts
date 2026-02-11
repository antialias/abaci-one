/**
 * Prime interestingness scoring system.
 *
 * Each visible prime gets a score based on its mathematical properties.
 * At high zoom all primes are shown; at low zoom only primes above a
 * density-adaptive threshold appear.
 */

import { computeVisiblePrimes, smallestPrimeFactor } from './sieve'
import { MERSENNE_PRIMES } from './specialPrimes'
import type { PrimeInterestTag, LandmarkPrime } from './landmarkPrimes'
import { getLandmarksInRange } from './landmarkPrimes'

export type { PrimeInterestTag }

export interface InterestingPrime {
  value: number
  score: number
  tags: PrimeInterestTag[]
  note?: string
}

// --- Helpers ---

function isPrime(n: number): boolean {
  return n >= 2 && smallestPrimeFactor(n) === n
}

function isPalindrome(n: number): boolean {
  const s = String(n)
  const len = s.length
  for (let i = 0; i < len >>> 1; i++) {
    if (s[i] !== s[len - 1 - i]) return false
  }
  return true
}

// --- Gap record computation (cached) ---

let gapRecordPrimes: Set<number> | null = null
let gapRecordSizes: Map<number, number> | null = null

/**
 * Lazily compute gap record primes from the sieve range (primes up to ~100K).
 * A gap-record prime is one that starts a gap larger than all previous gaps.
 */
function ensureGapRecords(): { primes: Set<number>; sizes: Map<number, number> } {
  if (gapRecordPrimes && gapRecordSizes) {
    return { primes: gapRecordPrimes, sizes: gapRecordSizes }
  }

  gapRecordPrimes = new Set<number>()
  gapRecordSizes = new Map<number, number>()

  let maxGap = 0
  let prevPrime = 2
  // Scan sieve range
  for (let n = 3; n < 100_001; n++) {
    if (!isPrime(n)) continue
    const gap = n - prevPrime
    if (gap > maxGap) {
      maxGap = gap
      gapRecordPrimes.add(prevPrime)
      gapRecordPrimes.add(n)
      gapRecordSizes.set(prevPrime, gap)
    }
    prevPrime = n
  }

  return { primes: gapRecordPrimes, sizes: gapRecordSizes }
}

// --- Scoring ---

/**
 * Score a single prime based on its mathematical properties.
 *
 * | Tag              | Score  |
 * |------------------|--------|
 * | Base (every)     |   1    |
 * | Twin             | +10    |
 * | Cousin           | +5     |
 * | Sexy             | +3     |
 * | Triplet member   | +30    |
 * | Quadruplet member| +50    |
 * | Palindrome       | +20    |
 * | Gap record       | +30    |
 * | High merit (>10) | +25    |
 * | Mersenne         | +100   |
 * | Sophie Germain   | +5     |
 */
function scorePrime(
  p: number,
  prevPrime: number | null,
  gapRecords: Set<number>
): InterestingPrime {
  let score = 1
  const tags: PrimeInterestTag[] = []

  // Twin (gap 2)
  if (isPrime(p + 2) || (p - 2 >= 2 && isPrime(p - 2))) {
    score += 10
    tags.push('twin')
  }

  // Cousin (gap 4)
  if (isPrime(p + 4) || (p - 4 >= 2 && isPrime(p - 4))) {
    score += 5
    tags.push('cousin')
  }

  // Sexy (gap 6)
  if (isPrime(p + 6) || (p - 6 >= 2 && isPrime(p - 6))) {
    score += 3
    tags.push('sexy')
  }

  // Prime triplet: (p, p+2, p+6) or (p, p+4, p+6)
  const isTriplet = (
    (isPrime(p + 2) && isPrime(p + 6)) ||
    (isPrime(p + 4) && isPrime(p + 6)) ||
    (p - 2 >= 2 && isPrime(p - 2) && isPrime(p + 4)) ||
    (p - 4 >= 2 && isPrime(p - 4) && isPrime(p + 2)) ||
    (p - 6 >= 2 && isPrime(p - 6) && isPrime(p - 4)) ||
    (p - 6 >= 2 && isPrime(p - 6) && isPrime(p - 2))
  )
  if (isTriplet) {
    score += 30
    tags.push('triplet')
  }

  // Prime quadruplet: (p, p+2, p+6, p+8)
  const isQuad = (
    (isPrime(p + 2) && isPrime(p + 6) && isPrime(p + 8)) ||
    (p - 2 >= 2 && isPrime(p - 2) && isPrime(p + 4) && isPrime(p + 6)) ||
    (p - 6 >= 2 && isPrime(p - 6) && isPrime(p - 4) && isPrime(p + 2)) ||
    (p - 8 >= 2 && isPrime(p - 8) && isPrime(p - 6) && isPrime(p - 2))
  )
  if (isQuad) {
    score += 50
    tags.push('quadruplet')
  }

  // Palindrome
  if (isPalindrome(p)) {
    score += 20
    tags.push('palindrome')
  }

  // Gap record (from sieve-range cache)
  if (gapRecords.has(p)) {
    score += 30
    tags.push('gap-record')
  }

  // High merit gap: merit = gap / ln(p) > 10
  if (prevPrime !== null && p > 2) {
    const gap = p - prevPrime
    const merit = gap / Math.log(p)
    if (merit > 10) {
      score += 25
      tags.push('high-merit')
    }
  }

  // Mersenne prime
  if (MERSENNE_PRIMES.has(p)) {
    score += 100
    tags.push('mersenne')
  }

  // Sophie Germain: 2p+1 is also prime
  const safePrime = 2 * p + 1
  if (safePrime < 1e12 && isPrime(safePrime)) {
    score += 5
    tags.push('sophie-germain')
  }

  return { value: p, score, tags }
}

// --- Density-adaptive threshold ---

/**
 * Compute the score threshold based on prime density (primes per pixel).
 */
function computeScoreThreshold(primeCount: number, cssWidth: number): number {
  if (cssWidth <= 0 || primeCount <= 0) return 0
  const primesPerPixel = primeCount / cssWidth

  if (primesPerPixel < 0.05) return 0    // sparse — show all
  if (primesPerPixel < 0.5) return 15
  if (primesPerPixel < 2) return 30
  return 50                              // extreme density
}

// --- Main entry point ---

/**
 * Compute interesting primes for the visible range.
 *
 * Tier 1 (live): If computeVisiblePrimes returns results, score all of them.
 * Tier 2 (landmark): Fall back to precomputed landmark table.
 *
 * Returns a filtered list based on density-adaptive threshold.
 */
export function computeInterestingPrimes(
  leftValue: number,
  rightValue: number,
  cssWidth: number
): InterestingPrime[] {
  const livePrimes = computeVisiblePrimes(leftValue, rightValue)

  let scored: InterestingPrime[]

  if (livePrimes.length > 0) {
    // Tier 1: live scoring
    const { primes: gapRecords } = ensureGapRecords()
    scored = []
    let prevPrime: number | null = null
    for (const p of livePrimes) {
      scored.push(scorePrime(p, prevPrime, gapRecords))
      prevPrime = p
    }
  } else {
    // Tier 2: landmark fallback
    const landmarks = getLandmarksInRange(leftValue, rightValue)
    scored = landmarks.map((lp: LandmarkPrime) => ({
      value: lp.value,
      score: lp.score,
      tags: lp.tags,
      note: lp.note,
    }))
  }

  if (scored.length === 0) return []

  // Apply density-adaptive threshold
  const threshold = computeScoreThreshold(scored.length, cssWidth)
  if (threshold === 0) return scored

  return scored.filter(p => p.score >= threshold)
}
