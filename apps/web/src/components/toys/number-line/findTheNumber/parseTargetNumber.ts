/**
 * Parse a user-entered target number string into a numeric value.
 *
 * Supported formats:
 * - Integers: "42", "-7"
 * - Decimals: "3.14", "-0.005"
 * - Simple fractions: "1/3", "7/8", "-2/5"
 * - Mixed numbers: "3 1/4", "-2 3/8" (space-separated whole + fraction)
 * - Improper fractions: "22/7"
 *
 * Returns `null` for invalid input.
 */
export function parseTargetNumber(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  // Mixed number: "3 1/4", "-2 3/8"
  const mixedMatch = trimmed.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10)
    const num = parseInt(mixedMatch[2], 10)
    const den = parseInt(mixedMatch[3], 10)
    if (den === 0) return null
    const sign = whole < 0 ? -1 : 1
    return whole + sign * (num / den)
  }

  // Fraction: "1/3", "-2/5", "22/7"
  const fractionMatch = trimmed.match(/^(-?\d+)\/(\d+)$/)
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10)
    const den = parseInt(fractionMatch[2], 10)
    if (den === 0) return null
    return num / den
  }

  // Decimal or integer: "42", "-7", "3.14", "-0.005"
  const decimalMatch = trimmed.match(/^-?\d+(\.\d+)?$/)
  if (decimalMatch) {
    const value = parseFloat(trimmed)
    if (!isFinite(value)) return null
    return value
  }

  return null
}
