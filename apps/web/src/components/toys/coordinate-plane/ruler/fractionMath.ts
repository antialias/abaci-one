import type { Fraction, MixedNumber, EquationForm } from './types'

// ── GCD / reduce ──────────────────────────────────────────────────

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.floor(a))
  b = Math.abs(Math.floor(b))
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

/** Create a reduced fraction. Denominator is always positive. */
export function fraction(num: number, den: number): Fraction {
  if (den === 0) throw new Error('Division by zero')
  // Normalize sign: denominator always positive
  if (den < 0) {
    num = -num
    den = -den
  }
  const g = gcd(Math.abs(num), den)
  return { num: num / g, den: den / g }
}

// ── Mixed number conversion ────────────────────────────────────────

/** Convert a reduced fraction to a mixed number */
export function toMixedNumber(f: Fraction): MixedNumber {
  const negative = f.num < 0
  const absNum = Math.abs(f.num)
  const whole = Math.floor(absNum / f.den)
  const fracNum = absNum % f.den
  return { negative, whole, fracNum, fracDen: f.den }
}

/** True if the fraction is an integer (denominator divides numerator evenly) */
export function isInteger(f: Fraction): boolean {
  return f.den === 1
}

// ── Solve for opposite variable at integer grid lines ──────────────

/**
 * Given y = (slope)x + intercept, solve for y at integer x.
 * y = (slope.num * x * intercept.den + intercept.num * slope.den) / (slope.den * intercept.den)
 */
export function solveForY(slope: Fraction, intercept: Fraction, x: number): Fraction {
  const num = slope.num * x * intercept.den + intercept.num * slope.den
  const den = slope.den * intercept.den
  return fraction(num, den)
}

/**
 * Given y = (slope)x + intercept, solve for x at integer y.
 * x = (y * intercept.den - intercept.num) * slope.den / (intercept.den * slope.num)
 */
export function solveForX(slope: Fraction, intercept: Fraction, y: number): Fraction {
  if (slope.num === 0) throw new Error('Cannot solve for x with zero slope')
  const num = (y * intercept.den - intercept.num) * slope.den
  const den = intercept.den * slope.num
  return fraction(num, den)
}

// ── Equation from two points ───────────────────────────────────────

/**
 * Compute the linear equation form for the line through (x1, y1) and (x2, y2).
 * All inputs must be integers.
 */
export function equationFromPoints(
  x1: number, y1: number,
  x2: number, y2: number,
): EquationForm {
  // Same point
  if (x1 === x2 && y1 === y2) {
    return { kind: 'point', x: x1, y: y1 }
  }

  // Vertical line
  if (x1 === x2) {
    return { kind: 'vertical', x: x1 }
  }

  // Horizontal line
  if (y1 === y2) {
    return { kind: 'horizontal', y: y1 }
  }

  // General case: slope = (y2 - y1) / (x2 - x1)
  const dy = y2 - y1
  const dx = x2 - x1
  const slope = fraction(dy, dx)

  // intercept = y1 - slope * x1 = (y1 * dx - dy * x1) / dx
  const interceptNum = y1 * dx - dy * x1
  const intercept = fraction(interceptNum, dx)

  return { kind: 'general', slope, intercept }
}
