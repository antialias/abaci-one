import type { TickMark } from '../types'
import type { PrimeTickInfo } from '../types'

// --- Lazy-initialized sieve of Eratosthenes (smallest prime factor table) ---

const SIEVE_LIMIT = 100_001
let spfTable: Uint32Array | null = null

function ensureSieve(): Uint32Array {
  if (spfTable) return spfTable
  spfTable = new Uint32Array(SIEVE_LIMIT)
  // Initialize: 0 and 1 have no prime factor
  for (let i = 2; i < SIEVE_LIMIT; i++) {
    if (spfTable[i] === 0) {
      // i is prime — mark itself and all multiples
      spfTable[i] = i
      for (let j = i * 2; j < SIEVE_LIMIT; j += i) {
        if (spfTable[j] === 0) {
          spfTable[j] = i
        }
      }
    }
  }
  return spfTable
}

/**
 * Get the smallest prime factor of n.
 * Uses sieve table for n < 100K, trial division for larger values.
 * Returns 0 for n <= 1.
 */
export function smallestPrimeFactor(n: number): number {
  if (n <= 1) return 0
  if (n < SIEVE_LIMIT) {
    return ensureSieve()[n]
  }
  // Trial division fallback for large n
  if (n % 2 === 0) return 2
  if (n % 3 === 0) return 3
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0) return i
    if (n % (i + 2) === 0) return i + 2
  }
  return n // n itself is prime
}

export interface PrimeFactor {
  prime: number
  exponent: number
}

/**
 * Factorize n into its prime factors.
 * Returns an array of {prime, exponent} sorted by prime ascending.
 */
export function factorize(n: number): PrimeFactor[] {
  if (n <= 1) return []
  const factors: PrimeFactor[] = []
  let remaining = n

  while (remaining > 1) {
    const p = smallestPrimeFactor(remaining)
    if (p === 0) break
    let exp = 0
    while (remaining % p === 0) {
      remaining /= p
      exp++
    }
    factors.push({ prime: p, exponent: exp })
  }

  return factors
}

// Safety cutoff for very large numbers (trial division becomes expensive)
const MAX_CLASSIFIABLE = 1e12

/**
 * Compute prime info for all integer ticks >= 2 in the given tick array.
 * Returns a Map from tick value to PrimeTickInfo.
 */
export function computePrimeInfos(ticks: TickMark[]): Map<number, PrimeTickInfo> {
  const map = new Map<number, PrimeTickInfo>()

  for (const tick of ticks) {
    const v = tick.value
    // Skip non-positive, non-integers, and too-large values
    if (v < 2 || !Number.isInteger(v) || v > MAX_CLASSIFIABLE) continue
    // Skip if power is negative (fractional ticks can't be integer)
    if (tick.power < 0) continue
    // Avoid duplicates
    if (map.has(v)) continue

    const spf = smallestPrimeFactor(v)
    const isPrime = spf === v

    map.set(v, {
      value: v,
      smallestPrimeFactor: spf,
      isPrime,
      classification: isPrime ? 'prime' : 'composite',
    })
  }

  // Also handle value 1 if present
  for (const tick of ticks) {
    if (tick.value === 1 && Number.isInteger(tick.value) && tick.power >= 0) {
      if (!map.has(1)) {
        map.set(1, {
          value: 1,
          smallestPrimeFactor: 0,
          isPrime: false,
          classification: 'one',
        })
      }
      break
    }
  }

  return map
}

/**
 * Max integers to scan when computing visible primes.
 * Within sieve range (<100K) each lookup is O(1) so we can scan larger ranges.
 * Beyond sieve range, trial division is O(√n) per integer so we limit more aggressively.
 */
const MAX_SIEVE_SCAN = 500_000
const MAX_TRIAL_SCAN = 50_000

/**
 * Find all primes in the visible range [leftValue, rightValue].
 * Independent of the tick system — works at any zoom level.
 * Returns an array of prime values, or empty if the range is too large.
 */
export function computeVisiblePrimes(leftValue: number, rightValue: number): number[] {
  const start = Math.max(2, Math.ceil(leftValue))
  const end = Math.floor(rightValue)

  if (start > end || end < 2) return []

  const rangeSize = end - start + 1

  // Within sieve range: fast O(1) lookups
  if (end < SIEVE_LIMIT) {
    if (rangeSize > MAX_SIEVE_SCAN) return []
    const sieve = ensureSieve()
    const primes: number[] = []
    for (let n = start; n <= end; n++) {
      if (sieve[n] === n) primes.push(n)
    }
    return primes
  }

  // Partially within sieve range
  if (start < SIEVE_LIMIT) {
    if (rangeSize > MAX_TRIAL_SCAN) return []
    const sieve = ensureSieve()
    const primes: number[] = []
    const sieveEnd = Math.min(end, SIEVE_LIMIT - 1)
    for (let n = start; n <= sieveEnd; n++) {
      if (sieve[n] === n) primes.push(n)
    }
    for (let n = SIEVE_LIMIT; n <= end; n++) {
      if (smallestPrimeFactor(n) === n) primes.push(n)
    }
    return primes
  }

  // Fully beyond sieve: trial division, tighter limit
  if (rangeSize > MAX_TRIAL_SCAN) return []
  const primes: number[] = []
  for (let n = start; n <= end; n++) {
    if (smallestPrimeFactor(n) === n) primes.push(n)
  }
  return primes
}

// Cache prime ordinals for performance (built lazily)
let ordinalCache: Map<number, number> | null = null

export function getPrimeOrdinal(p: number): number {
  if (!ordinalCache) {
    ordinalCache = new Map()
    const sieve = ensureSieve()
    let count = 0
    for (let i = 2; i < SIEVE_LIMIT; i++) {
      if (sieve[i] === i) {
        ordinalCache.set(i, count)
        count++
      }
    }
  }
  const cached = ordinalCache.get(p)
  if (cached !== undefined) return cached
  // Fallback for large primes
  return Math.abs(((p * 2654435761) >>> 0) % 10000)
}
