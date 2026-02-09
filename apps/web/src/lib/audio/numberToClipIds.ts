/**
 * Convert a number (0-9999) to an array of clip IDs.
 *
 * Parallel to `numberToEnglish` but returns clip ID strings
 * that map to entries in `clips/numbers.ts`.
 *
 * Examples:
 *   numberToClipIds(5)    → ['number-5']
 *   numberToClipIds(42)   → ['number-40', 'number-2']
 *   numberToClipIds(157)  → ['number-1', 'number-hundred', 'number-50', 'number-7']
 *   numberToClipIds(2000) → ['number-2', 'number-thousand']
 */
export function numberToClipIds(n: number): string[] {
  if (n < 0 || n > 9999 || !Number.isInteger(n)) {
    throw new Error(`numberToClipIds: expected integer 0-9999, got ${n}`)
  }

  if (n <= 20) {
    return [`number-${n}`]
  }

  const clips: string[] = []

  // Thousands
  const thousands = Math.floor(n / 1000)
  if (thousands > 0) {
    clips.push(`number-${thousands}`)
    clips.push('number-thousand')
  }

  // Hundreds
  const hundreds = Math.floor((n % 1000) / 100)
  if (hundreds > 0) {
    clips.push(`number-${hundreds}`)
    clips.push('number-hundred')
  }

  // Remainder (0-99)
  const remainder = n % 100
  if (remainder === 0) {
    // Nothing to add
  } else if (remainder <= 20) {
    clips.push(`number-${remainder}`)
  } else {
    const tens = Math.floor(remainder / 10)
    const ones = remainder % 10
    clips.push(`number-${tens * 10}`)
    if (ones > 0) {
      clips.push(`number-${ones}`)
    }
  }

  return clips
}
