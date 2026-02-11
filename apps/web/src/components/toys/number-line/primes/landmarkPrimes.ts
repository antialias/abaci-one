/**
 * Precomputed table of "landmark" primes — notable primes that should remain
 * visible even when zoomed far out (beyond the range where live sieve scanning
 * is practical).
 *
 * Sources: OEIS A002386 (maximal prime gaps), A000668 (Mersenne primes),
 * notable palindromic primes.
 */

export type PrimeInterestTag =
  | 'twin'
  | 'cousin'
  | 'sexy'
  | 'triplet'
  | 'quadruplet'
  | 'palindrome'
  | 'gap-record'
  | 'high-merit'
  | 'mersenne'
  | 'sophie-germain'

export interface LandmarkPrime {
  value: number
  score: number
  tags: PrimeInterestTag[]
  note?: string
}

/**
 * Sorted by value for binary search.
 *
 * Includes:
 * - Mersenne primes up to 2^31-1
 * - Maximal prime gap endpoints (from OEIS A002386 / A005250)
 * - Notable palindromic primes
 * - First-occurrence gap milestones
 */
/** Helper to ensure tag arrays are properly typed */
function lp(value: number, score: number, tags: PrimeInterestTag[], note?: string): LandmarkPrime {
  return note ? { value, score, tags, note } : { value, score, tags }
}

export const LANDMARK_PRIMES: LandmarkPrime[] = [
  // Mersenne primes (score 100+)
  lp(3, 110, ['mersenne', 'twin'], 'Mersenne prime 2²−1'),
  lp(7, 105, ['mersenne', 'twin'], 'Mersenne prime 2³−1'),
  lp(31, 105, ['mersenne', 'twin'], 'Mersenne prime 2⁵−1'),
  lp(127, 100, ['mersenne'], 'Mersenne prime 2⁷−1'),
  lp(8191, 100, ['mersenne'], 'Mersenne prime 2¹³−1'),
  lp(131071, 100, ['mersenne'], 'Mersenne prime 2¹⁷−1'),
  lp(524287, 100, ['mersenne'], 'Mersenne prime 2¹⁹−1'),
  lp(2147483647, 100, ['mersenne'], 'Mersenne prime 2³¹−1'),

  // Maximal prime gap records (OEIS A002386: primes starting record gaps)
  // Format: prime before gap, prime after gap, gap size
  lp(2, 40, ['gap-record'], 'Record gap of 1 (to 3)'),
  lp(7, 40, ['gap-record', 'mersenne'], 'Record gap of 4 (to 11)'),
  lp(11, 30, ['gap-record'], 'End of record gap of 4'),
  lp(23, 35, ['gap-record'], 'Record gap of 6 (to 29)'),
  lp(29, 30, ['gap-record', 'twin'], 'End of record gap of 6'),
  lp(89, 35, ['gap-record'], 'Record gap of 8 (to 97)'),
  lp(97, 30, ['gap-record'], 'End of record gap of 8'),
  lp(113, 38, ['gap-record'], 'Record gap of 14 (to 127)'),
  lp(523, 38, ['gap-record'], 'Record gap of 18 (to 541)'),
  lp(541, 30, ['gap-record'], 'End of record gap of 18'),
  lp(887, 38, ['gap-record'], 'Record gap of 20 (to 907)'),
  lp(907, 30, ['gap-record'], 'End of record gap of 20'),
  lp(1129, 38, ['gap-record'], 'Record gap of 22 (to 1151)'),
  lp(1151, 30, ['gap-record'], 'End of record gap of 22'),
  lp(1327, 42, ['gap-record'], 'Record gap of 34 (to 1361)'),
  lp(1361, 32, ['gap-record'], 'End of record gap of 34'),
  lp(9551, 42, ['gap-record'], 'Record gap of 36 (to 9587)'),
  lp(9587, 32, ['gap-record'], 'End of record gap of 36'),
  lp(15683, 44, ['gap-record'], 'Record gap of 44 (to 15727)'),
  lp(15727, 34, ['gap-record'], 'End of record gap of 44'),
  lp(19609, 46, ['gap-record'], 'Record gap of 52 (to 19661)'),
  lp(19661, 36, ['gap-record'], 'End of record gap of 52'),
  lp(31397, 50, ['gap-record'], 'Record gap of 72 (to 31469)'),
  lp(31469, 40, ['gap-record'], 'End of record gap of 72'),
  lp(155921, 52, ['gap-record'], 'Record gap of 86 (to 156007)'),
  lp(156007, 42, ['gap-record'], 'End of record gap of 86'),
  lp(360653, 54, ['gap-record'], 'Record gap of 96 (to 360749)'),
  lp(360749, 44, ['gap-record'], 'End of record gap of 96'),
  lp(370261, 56, ['gap-record'], 'Record gap of 112 (to 370373)'),
  lp(370373, 46, ['gap-record'], 'End of record gap of 112'),
  lp(492113, 56, ['gap-record'], 'Record gap of 114 (to 492227)'),
  lp(492227, 46, ['gap-record'], 'End of record gap of 114'),
  lp(1349533, 58, ['gap-record'], 'Record gap of 118 (to 1349651)'),
  lp(1349651, 48, ['gap-record'], 'End of record gap of 118'),
  lp(1357201, 60, ['gap-record'], 'Record gap of 132 (to 1357333)'),
  lp(1357333, 50, ['gap-record'], 'End of record gap of 132'),
  lp(2010733, 62, ['gap-record'], 'Record gap of 148 (to 2010881)'),
  lp(2010881, 52, ['gap-record'], 'End of record gap of 148'),
  lp(4652353, 62, ['gap-record'], 'Record gap of 154 (to 4652507)'),
  lp(4652507, 52, ['gap-record'], 'End of record gap of 154'),
  lp(17051707, 65, ['gap-record'], 'Record gap of 180 (to 17051887)'),
  lp(17051887, 55, ['gap-record'], 'End of record gap of 180'),
  lp(20831323, 68, ['gap-record'], 'Record gap of 210 (to 20831533)'),
  lp(20831533, 58, ['gap-record'], 'End of record gap of 210'),
  lp(47326693, 68, ['gap-record'], 'Record gap of 220 (to 47326913)'),
  lp(47326913, 58, ['gap-record'], 'End of record gap of 220'),
  lp(122164747, 68, ['gap-record'], 'Record gap of 222 (to 122164969)'),
  lp(122164969, 58, ['gap-record'], 'End of record gap of 222'),
  lp(189695659, 70, ['gap-record'], 'Record gap of 234 (to 189695893)'),
  lp(189695893, 60, ['gap-record'], 'End of record gap of 234'),
  lp(191912783, 72, ['gap-record'], 'Record gap of 248 (to 191913031)'),
  lp(191913031, 62, ['gap-record'], 'End of record gap of 248'),
  lp(387096133, 72, ['gap-record'], 'Record gap of 250 (to 387096383)'),
  lp(387096383, 62, ['gap-record'], 'End of record gap of 250'),
  lp(436273009, 75, ['gap-record'], 'Record gap of 282 (to 436273291)'),
  lp(436273291, 65, ['gap-record'], 'End of record gap of 282'),
  lp(2300942549, 75, ['gap-record'], 'Record gap of 288 (to 2300942837)'),
  lp(2300942837, 65, ['gap-record'], 'End of record gap of 288'),
  lp(3842610773, 75, ['gap-record'], 'Record gap of 292 (to 3842611065)'),
  lp(3842611063, 65, ['gap-record'], 'End of record gap of 292'),
  lp(4302407359, 78, ['gap-record'], 'Record gap of 320 (to 4302407679)'),
  lp(4302407677, 68, ['gap-record'], 'End of record gap of 320'),

  // Notable palindromic primes (various digit counts)
  lp(11, 25, ['palindrome'], 'Smallest 2-digit palindrome prime'),
  lp(101, 25, ['palindrome'], 'Smallest 3-digit palindrome prime'),
  lp(131, 22, ['palindrome'], 'Palindrome prime'),
  lp(151, 22, ['palindrome'], 'Palindrome prime'),
  lp(181, 22, ['palindrome'], 'Palindrome prime'),
  lp(191, 22, ['palindrome'], 'Palindrome prime'),
  lp(313, 22, ['palindrome'], 'Palindrome prime'),
  lp(353, 22, ['palindrome'], 'Palindrome prime'),
  lp(373, 22, ['palindrome'], 'Palindrome prime'),
  lp(383, 22, ['palindrome'], 'Palindrome prime'),
  lp(727, 22, ['palindrome'], 'Palindrome prime'),
  lp(757, 22, ['palindrome'], 'Palindrome prime'),
  lp(787, 22, ['palindrome'], 'Palindrome prime'),
  lp(797, 22, ['palindrome'], 'Palindrome prime'),
  lp(919, 22, ['palindrome'], 'Palindrome prime'),
  lp(929, 22, ['palindrome'], 'Palindrome prime'),
  lp(10301, 28, ['palindrome'], 'Smallest 5-digit palindrome prime'),
  lp(1003001, 30, ['palindrome'], '7-digit palindrome prime'),
  lp(100030001, 32, ['palindrome'], '9-digit palindrome prime'),

  // First occurrence of gap ≥ N milestones
  lp(396733, 45, ['gap-record'], 'First prime gap ≥ 100 (gap 100)'),
  lp(396833, 35, ['gap-record'], 'End of first gap ≥ 100'),
  lp(2010733, 50, ['gap-record'], 'First prime gap ≥ 148'),
  lp(20831323, 55, ['gap-record'], 'First prime gap ≥ 200 (gap 210)'),
].sort((a, b) => a.value - b.value)

// Deduplicate: if same value appears multiple times, merge tags and keep highest score
const deduped = new Map<number, LandmarkPrime>()
for (const entry of LANDMARK_PRIMES) {
  const existing = deduped.get(entry.value)
  if (existing) {
    existing.score = Math.max(existing.score, entry.score)
    for (const tag of entry.tags) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag)
    }
    // Prefer the note from the higher-scored entry
    if (entry.score >= existing.score && entry.note) existing.note = entry.note
  } else {
    deduped.set(entry.value, { ...entry, tags: [...entry.tags] })
  }
}

const DEDUPLICATED_LANDMARKS: LandmarkPrime[] = [...deduped.values()].sort((a, b) => a.value - b.value)

/**
 * Binary search for landmark primes in [left, right].
 */
export function getLandmarksInRange(left: number, right: number): LandmarkPrime[] {
  const landmarks = DEDUPLICATED_LANDMARKS
  if (landmarks.length === 0) return []

  // Binary search for first landmark >= left
  let lo = 0
  let hi = landmarks.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (landmarks[mid].value < left) lo = mid + 1
    else hi = mid
  }

  const result: LandmarkPrime[] = []
  for (let i = lo; i < landmarks.length && landmarks[i].value <= right; i++) {
    result.push(landmarks[i])
  }
  return result
}
