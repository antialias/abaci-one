import { smallestPrimeFactor } from './sieve'

// --- Known Mersenne primes (2^n - 1) up to practical display range ---

export const MERSENNE_PRIMES = new Set([3, 7, 31, 127, 8191, 131071, 524287, 2147483647])

export const MERSENNE_EXPONENTS = new Map<number, number>([
  [3, 2], [7, 3], [31, 5], [127, 7], [8191, 13],
  [131071, 17], [524287, 19], [2147483647, 31],
])

// --- Pair arc types ---

export interface PrimePairArc {
  p1: number
  p2: number
  type: 'twin' | 'cousin' | 'sexy'
}

function isPrime(n: number): boolean {
  return n >= 2 && smallestPrimeFactor(n) === n
}

/**
 * Compute connecting arcs between prime pairs in the visible range.
 * Only forward pairs (p1 < p2) to avoid duplicates.
 */
export function computePrimePairArcs(visiblePrimes: number[]): PrimePairArc[] {
  if (visiblePrimes.length > 3000) return [] // too dense, arcs would be invisible

  const primeSet = new Set(visiblePrimes)
  const arcs: PrimePairArc[] = []

  for (const p of visiblePrimes) {
    if (primeSet.has(p + 2)) arcs.push({ p1: p, p2: p + 2, type: 'twin' })
    if (primeSet.has(p + 4)) arcs.push({ p1: p, p2: p + 4, type: 'cousin' })
    if (primeSet.has(p + 6)) arcs.push({ p1: p, p2: p + 6, type: 'sexy' })
  }

  return arcs
}

// --- Special prime labels for tooltip ---

export interface SpecialPrimeLabel {
  type: 'twin' | 'cousin' | 'sexy' | 'triplet' | 'quadruplet' | 'mersenne' | 'sophie-germain' | 'palindrome' | 'gap-record' | 'high-merit'
  text: string
}

/**
 * Get all special properties of a prime for display in the tooltip.
 * Only call for primes (isPrime must be true).
 */
export function getSpecialPrimeLabels(p: number): SpecialPrimeLabel[] {
  const labels: SpecialPrimeLabel[] = []

  // Twin pairs (gap 2)
  const twinBelow = isPrime(p - 2) && p - 2 >= 2
  const twinAbove = isPrime(p + 2)
  if (twinBelow || twinAbove) {
    const partners = []
    if (twinBelow) partners.push(`(${p - 2}, ${p})`)
    if (twinAbove) partners.push(`(${p}, ${p + 2})`)
    labels.push({ type: 'twin', text: `Twin prime ${partners.join(', ')}` })
  }

  // Cousin pairs (gap 4)
  const cousinBelow = isPrime(p - 4) && p - 4 >= 2
  const cousinAbove = isPrime(p + 4)
  if (cousinBelow || cousinAbove) {
    const partners = []
    if (cousinBelow) partners.push(`(${p - 4}, ${p})`)
    if (cousinAbove) partners.push(`(${p}, ${p + 4})`)
    labels.push({ type: 'cousin', text: `Cousin prime ${partners.join(', ')}` })
  }

  // Sexy pairs (gap 6)
  const sexyBelow = isPrime(p - 6) && p - 6 >= 2
  const sexyAbove = isPrime(p + 6)
  if (sexyBelow || sexyAbove) {
    const partners = []
    if (sexyBelow) partners.push(`(${p - 6}, ${p})`)
    if (sexyAbove) partners.push(`(${p}, ${p + 6})`)
    labels.push({ type: 'sexy', text: `Sexy prime ${partners.join(', ')}` })
  }

  // Prime triplets: (p, p+2, p+6) or (p, p+4, p+6)
  // Check all positions this prime could occupy in a triplet
  const triplets: number[][] = []
  // Form 1: (p, p+2, p+6)
  if (isPrime(p + 2) && isPrime(p + 6)) triplets.push([p, p + 2, p + 6])
  // p is middle of (p-2, p, p+4)
  if (p - 2 >= 2 && isPrime(p - 2) && isPrime(p + 4)) triplets.push([p - 2, p, p + 4])
  // p is end of (p-6, p-4, p) [form 1] or (p-6, p-2, p) [form 2]
  if (p - 6 >= 2 && isPrime(p - 6) && isPrime(p - 4)) triplets.push([p - 6, p - 4, p])
  // Form 2: (p, p+4, p+6)
  if (isPrime(p + 4) && isPrime(p + 6)) triplets.push([p, p + 4, p + 6])
  // p is middle of form 2: (p-4, p, p+2)
  if (p - 4 >= 2 && isPrime(p - 4) && isPrime(p + 2)) triplets.push([p - 4, p, p + 2])
  // p is end of form 2: (p-6, p-2, p)
  if (p - 6 >= 2 && isPrime(p - 6) && isPrime(p - 2)) triplets.push([p - 6, p - 2, p])

  // Deduplicate triplets by their string representation
  const uniqueTriplets = new Map<string, number[]>()
  for (const t of triplets) {
    const key = t.join(',')
    if (!uniqueTriplets.has(key)) uniqueTriplets.set(key, t)
  }
  for (const t of uniqueTriplets.values()) {
    labels.push({ type: 'triplet', text: `Prime triplet (${t.join(', ')})` })
  }

  // Prime quadruplets: (p, p+2, p+6, p+8)
  const quadruplets: number[][] = []
  if (isPrime(p + 2) && isPrime(p + 6) && isPrime(p + 8))
    quadruplets.push([p, p + 2, p + 6, p + 8])
  if (p - 2 >= 2 && isPrime(p - 2) && isPrime(p + 4) && isPrime(p + 6))
    quadruplets.push([p - 2, p, p + 4, p + 6])
  if (p - 6 >= 2 && isPrime(p - 6) && isPrime(p - 4) && isPrime(p + 2))
    quadruplets.push([p - 6, p - 4, p, p + 2])
  if (p - 8 >= 2 && isPrime(p - 8) && isPrime(p - 6) && isPrime(p - 2))
    quadruplets.push([p - 8, p - 6, p - 2, p])

  const uniqueQuads = new Map<string, number[]>()
  for (const q of quadruplets) {
    const key = q.join(',')
    if (!uniqueQuads.has(key)) uniqueQuads.set(key, q)
  }
  for (const q of uniqueQuads.values()) {
    labels.push({ type: 'quadruplet', text: `Prime quadruplet (${q.join(', ')})` })
  }

  // Mersenne prime
  const exp = MERSENNE_EXPONENTS.get(p)
  if (exp !== undefined) {
    labels.push({ type: 'mersenne', text: `Mersenne prime (2${superscriptStr(exp)} \u2212 1)` })
  }

  // Sophie Germain: p is Sophie Germain if 2p+1 is also prime
  const safePrime = 2 * p + 1
  if (safePrime < 1e12 && isPrime(safePrime)) {
    labels.push({ type: 'sophie-germain', text: `Sophie Germain (2\u00d7${p}+1 = ${safePrime} is prime)` })
  }

  // Palindrome prime
  const s = String(p)
  let isPalin = true
  for (let i = 0; i < s.length >>> 1; i++) {
    if (s[i] !== s[s.length - 1 - i]) { isPalin = false; break }
  }
  if (isPalin && s.length >= 2) {
    labels.push({ type: 'palindrome', text: `Palindrome prime (${s.length} digits)` })
  }

  return labels
}

function superscriptStr(n: number): string {
  const superDigits = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079'
  return String(n).split('').map(d => superDigits[parseInt(d)]).join('')
}

// --- Arc colors (used by both render and tooltip) ---

export const ARC_COLORS = {
  twin: { dark: 'rgba(245, 180, 60, A)', light: 'rgba(180, 130, 20, A)' },
  cousin: { dark: 'rgba(80, 200, 190, A)', light: 'rgba(40, 140, 130, A)' },
  sexy: { dark: 'rgba(180, 120, 220, A)', light: 'rgba(130, 70, 180, A)' },
} as const

export const LABEL_COLORS = {
  twin: { dark: '#f5b43c', light: '#b48214' },
  cousin: { dark: '#50c8be', light: '#288c82' },
  sexy: { dark: '#b478dc', light: '#8246b4' },
  triplet: { dark: '#e0e0e0', light: '#555555' },
  quadruplet: { dark: '#e0e0e0', light: '#555555' },
  mersenne: { dark: '#ff9eee', light: '#a0308e' },
  'sophie-germain': { dark: '#a0d0a0', light: '#3a7a3a' },
  palindrome: { dark: '#f0c060', light: '#9a7020' },
  'gap-record': { dark: '#ff8888', light: '#b03030' },
  'high-merit': { dark: '#ffa070', light: '#a04020' },
} as const

/** Short definitions for each special prime type, shown as footnotes. */
export const PRIME_TYPE_DESCRIPTIONS: Record<SpecialPrimeLabel['type'], string> = {
  twin: 'Twin primes differ by 2.',
  cousin: 'Cousin primes differ by 4.',
  sexy: 'Sexy primes differ by 6 (from Latin "sex").',
  triplet: 'A prime triplet is three primes of the form (p, p+2, p+6) or (p, p+4, p+6).',
  quadruplet: 'A prime quadruplet is four primes of the form (p, p+2, p+6, p+8).',
  mersenne: 'A Mersenne prime has the form 2\u207f \u2212 1.',
  'sophie-germain': 'A Sophie Germain prime p is one where 2p + 1 is also prime.',
  palindrome: 'A palindrome prime reads the same forwards and backwards.',
  'gap-record': 'A gap-record prime starts or ends the largest known gap up to that point.',
  'high-merit': 'A high-merit gap has merit (gap/ln(p)) exceeding 10.',
}
