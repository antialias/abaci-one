import { describe, it, expect } from 'vitest'
import {
  gcd,
  fraction,
  toMixedNumber,
  isInteger,
  solveForY,
  solveForX,
  equationFromPoints,
  toStandardForm,
} from '../fractionMath'

describe('fractionMath', () => {
  // ── gcd ──────────────────────────────────────────────────────────

  describe('gcd', () => {
    it('returns gcd of two positive integers', () => {
      expect(gcd(12, 8)).toBe(4)
      expect(gcd(15, 10)).toBe(5)
      expect(gcd(7, 3)).toBe(1)
    })

    it('handles zero', () => {
      expect(gcd(0, 5)).toBe(5)
      expect(gcd(5, 0)).toBe(5)
      expect(gcd(0, 0)).toBe(0)
    })

    it('handles negative inputs', () => {
      expect(gcd(-12, 8)).toBe(4)
      expect(gcd(12, -8)).toBe(4)
      expect(gcd(-12, -8)).toBe(4)
    })

    it('returns 1 for coprime numbers', () => {
      expect(gcd(13, 17)).toBe(1)
    })

    it('handles equal inputs', () => {
      expect(gcd(6, 6)).toBe(6)
    })
  })

  // ── fraction ─────────────────────────────────────────────────────

  describe('fraction', () => {
    it('reduces to lowest terms', () => {
      expect(fraction(4, 6)).toEqual({ num: 2, den: 3 })
      expect(fraction(10, 5)).toEqual({ num: 2, den: 1 })
    })

    it('keeps denominator positive', () => {
      expect(fraction(3, -4)).toEqual({ num: -3, den: 4 })
      expect(fraction(-3, -4)).toEqual({ num: 3, den: 4 })
    })

    it('handles zero numerator', () => {
      expect(fraction(0, 5)).toEqual({ num: 0, den: 1 })
    })

    it('throws on zero denominator', () => {
      expect(() => fraction(1, 0)).toThrow('Division by zero')
    })

    it('handles already-reduced fractions', () => {
      expect(fraction(3, 7)).toEqual({ num: 3, den: 7 })
    })

    it('reduces negative fractions', () => {
      expect(fraction(-6, 4)).toEqual({ num: -3, den: 2 })
    })
  })

  // ── toMixedNumber ────────────────────────────────────────────────

  describe('toMixedNumber', () => {
    it('converts proper fraction', () => {
      expect(toMixedNumber({ num: 2, den: 3 })).toEqual({
        negative: false,
        whole: 0,
        fracNum: 2,
        fracDen: 3,
      })
    })

    it('converts improper fraction', () => {
      expect(toMixedNumber({ num: 7, den: 3 })).toEqual({
        negative: false,
        whole: 2,
        fracNum: 1,
        fracDen: 3,
      })
    })

    it('converts integer', () => {
      expect(toMixedNumber({ num: 6, den: 3 })).toEqual({
        negative: false,
        whole: 2,
        fracNum: 0,
        fracDen: 3,
      })
    })

    it('converts negative fraction', () => {
      expect(toMixedNumber({ num: -7, den: 3 })).toEqual({
        negative: true,
        whole: 2,
        fracNum: 1,
        fracDen: 3,
      })
    })

    it('converts zero', () => {
      expect(toMixedNumber({ num: 0, den: 1 })).toEqual({
        negative: false,
        whole: 0,
        fracNum: 0,
        fracDen: 1,
      })
    })
  })

  // ── isInteger ────────────────────────────────────────────────────

  describe('isInteger', () => {
    it('returns true for integer fractions', () => {
      expect(isInteger({ num: 5, den: 1 })).toBe(true)
      expect(isInteger({ num: 0, den: 1 })).toBe(true)
      expect(isInteger({ num: -3, den: 1 })).toBe(true)
    })

    it('returns false for non-integer fractions', () => {
      expect(isInteger({ num: 1, den: 2 })).toBe(false)
      expect(isInteger({ num: 7, den: 3 })).toBe(false)
    })
  })

  // ── solveForY ────────────────────────────────────────────────────

  describe('solveForY', () => {
    it('solves y = 2x + 1 at x=3 -> y=7', () => {
      const slope = { num: 2, den: 1 }
      const intercept = { num: 1, den: 1 }
      expect(solveForY(slope, intercept, 3)).toEqual({ num: 7, den: 1 })
    })

    it('solves y = (1/2)x + 0 at x=3 -> y=3/2', () => {
      const slope = { num: 1, den: 2 }
      const intercept = { num: 0, den: 1 }
      expect(solveForY(slope, intercept, 3)).toEqual({ num: 3, den: 2 })
    })

    it('solves y = (-2/3)x + 4 at x=6 -> y=0', () => {
      const slope = { num: -2, den: 3 }
      const intercept = { num: 4, den: 1 }
      expect(solveForY(slope, intercept, 6)).toEqual({ num: 0, den: 1 })
    })

    it('solves at x=0 returns intercept', () => {
      const slope = { num: 5, den: 1 }
      const intercept = { num: 3, den: 7 }
      expect(solveForY(slope, intercept, 0)).toEqual({ num: 3, den: 7 })
    })
  })

  // ── solveForX ────────────────────────────────────────────────────

  describe('solveForX', () => {
    it('solves y = 2x + 1 at y=7 -> x=3', () => {
      const slope = { num: 2, den: 1 }
      const intercept = { num: 1, den: 1 }
      expect(solveForX(slope, intercept, 7)).toEqual({ num: 3, den: 1 })
    })

    it('solves y = (1/3)x + 0 at y=2 -> x=6', () => {
      const slope = { num: 1, den: 3 }
      const intercept = { num: 0, den: 1 }
      expect(solveForX(slope, intercept, 2)).toEqual({ num: 6, den: 1 })
    })

    it('returns fractional x', () => {
      const slope = { num: 2, den: 1 }
      const intercept = { num: 0, den: 1 }
      expect(solveForX(slope, intercept, 3)).toEqual({ num: 3, den: 2 })
    })

    it('throws for zero slope', () => {
      const slope = { num: 0, den: 1 }
      const intercept = { num: 5, den: 1 }
      expect(() => solveForX(slope, intercept, 5)).toThrow('Cannot solve for x with zero slope')
    })
  })

  // ── toStandardForm ──────────────────────────────────────────────

  describe('toStandardForm', () => {
    it('converts y = 2x + 1 to 2x − y = −1', () => {
      // y = 2x + 1 → 2x − 1y = −1
      expect(toStandardForm({ num: 2, den: 1 }, { num: 1, den: 1 })).toEqual({ a: 2, b: -1, c: -1 })
    })

    it('converts y = x + 0 to x − y = 0', () => {
      expect(toStandardForm({ num: 1, den: 1 }, { num: 0, den: 1 })).toEqual({ a: 1, b: -1, c: 0 })
    })

    it('converts y = (1/2)x + 3 to x − 2y = −6', () => {
      expect(toStandardForm({ num: 1, den: 2 }, { num: 3, den: 1 })).toEqual({ a: 1, b: -2, c: -6 })
    })

    it('converts y = −(2/3)x + 4 to 2x + 3y = 12', () => {
      // slope = -2/3, intercept = 4
      // a = -2*1 = -2, b = -(3*1) = -3, c = -(4*3) = -12
      // GCD(2,3,12) = 1 → −2x − 3y = −12 → negate → 2x + 3y = 12
      expect(toStandardForm({ num: -2, den: 3 }, { num: 4, den: 1 })).toEqual({ a: 2, b: 3, c: 12 })
    })

    it('converts y = (3/4)x − (1/2) to 3x − 4y = 2', () => {
      // slope = 3/4, intercept = -1/2
      // a = 3*2 = 6, b = -(4*2) = -8, c = -(-1*4) = 4
      // GCD(6,8,4) = 2 → 3x − 4y = 2
      expect(toStandardForm({ num: 3, den: 4 }, { num: -1, den: 2 })).toEqual({ a: 3, b: -4, c: 2 })
    })

    it('converts y = −x + 0 to x + y = 0', () => {
      // slope = -1, intercept = 0
      // a = -1*1 = -1, b = -(1*1) = -1, c = -(0*1) = 0
      // negate: 1x + 1y = 0
      expect(toStandardForm({ num: -1, den: 1 }, { num: 0, den: 1 })).toEqual({ a: 1, b: 1, c: 0 })
    })

    it('reduces coefficients by GCD', () => {
      // y = (4/6)x + (2/3) → slope reduced = 2/3, intercept = 2/3
      // but we accept Fraction inputs so pass pre-reduced
      // y = (2/3)x + (2/3)
      // a = 2*3 = 6, b = -(3*3) = -9, c = -(2*3) = -6
      // GCD(6,9,6) = 3 → 2x − 3y = −2
      expect(toStandardForm({ num: 2, den: 3 }, { num: 2, den: 3 })).toEqual({ a: 2, b: -3, c: -2 })
    })
  })

  // ── equationFromPoints ───────────────────────────────────────────

  describe('equationFromPoints', () => {
    it('returns point for same point', () => {
      expect(equationFromPoints(3, 4, 3, 4)).toEqual({ kind: 'point', x: 3, y: 4 })
    })

    it('returns vertical for same x, different y', () => {
      expect(equationFromPoints(2, 1, 2, 5)).toEqual({ kind: 'vertical', x: 2 })
    })

    it('returns horizontal for same y, different x', () => {
      expect(equationFromPoints(1, 3, 5, 3)).toEqual({ kind: 'horizontal', y: 3 })
    })

    it('computes general slope and intercept', () => {
      // (0,0) -> (1,1): slope = 1, intercept = 0
      const eq = equationFromPoints(0, 0, 1, 1)
      expect(eq.kind).toBe('general')
      if (eq.kind === 'general') {
        expect(eq.slope).toEqual({ num: 1, den: 1 })
        expect(eq.intercept).toEqual({ num: 0, den: 1 })
      }
    })

    it('computes reduced slope for non-unit rise/run', () => {
      // (0,0) -> (4,2): slope = 1/2, intercept = 0
      const eq = equationFromPoints(0, 0, 4, 2)
      expect(eq.kind).toBe('general')
      if (eq.kind === 'general') {
        expect(eq.slope).toEqual({ num: 1, den: 2 })
        expect(eq.intercept).toEqual({ num: 0, den: 1 })
      }
    })

    it('computes correct intercept for non-origin line', () => {
      // (1,3) -> (3,7): slope = 2, intercept = 1
      const eq = equationFromPoints(1, 3, 3, 7)
      expect(eq.kind).toBe('general')
      if (eq.kind === 'general') {
        expect(eq.slope).toEqual({ num: 2, den: 1 })
        expect(eq.intercept).toEqual({ num: 1, den: 1 })
      }
    })

    it('handles negative slope', () => {
      // (0,4) -> (2,0): slope = -2, intercept = 4
      const eq = equationFromPoints(0, 4, 2, 0)
      expect(eq.kind).toBe('general')
      if (eq.kind === 'general') {
        expect(eq.slope).toEqual({ num: -2, den: 1 })
        expect(eq.intercept).toEqual({ num: 4, den: 1 })
      }
    })

    it('handles fractional intercept', () => {
      // (1,1) -> (2,3): slope = 2, intercept = -1
      const eq = equationFromPoints(1, 1, 2, 3)
      expect(eq.kind).toBe('general')
      if (eq.kind === 'general') {
        expect(eq.slope).toEqual({ num: 2, den: 1 })
        expect(eq.intercept).toEqual({ num: -1, den: 1 })
      }
    })
  })
})
