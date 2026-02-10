const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/**
 * Convert a number (0-9999) to English words.
 *
 * Examples:
 *   numberToEnglish(5)    → "five"
 *   numberToEnglish(42)   → "forty two"
 *   numberToEnglish(157)  → "one hundred fifty seven"
 *   numberToEnglish(2345) → "two thousand three hundred forty five"
 */
export function numberToEnglish(n: number): string {
  if (n < 0 || n > 9999 || !Number.isInteger(n)) {
    throw new Error(`numberToEnglish: expected integer 0-9999, got ${n}`)
  }

  if (n <= 20) {
    return ONES[n]
  }

  const parts: string[] = []

  // Thousands
  const thousands = Math.floor(n / 1000)
  if (thousands > 0) {
    parts.push(ONES[thousands])
    parts.push('thousand')
  }

  // Hundreds
  const hundreds = Math.floor((n % 1000) / 100)
  if (hundreds > 0) {
    parts.push(ONES[hundreds])
    parts.push('hundred')
  }

  // Remainder (0-99)
  const remainder = n % 100
  if (remainder === 0) {
    // Nothing to add
  } else if (remainder <= 20) {
    parts.push(ONES[remainder])
  } else {
    const tens = Math.floor(remainder / 10)
    const ones = remainder % 10
    parts.push(TENS[tens])
    if (ones > 0) {
      parts.push(ONES[ones])
    }
  }

  return parts.join(' ')
}
