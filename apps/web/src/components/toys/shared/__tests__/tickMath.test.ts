import { describe, it, expect } from 'vitest'
import {
  smoothstep,
  computeProminence,
  lerpLandmarks,
  formatTickLabel,
  getTickHeight,
  getTickLineWidth,
  getTickAlpha,
  getTickFontSize,
  getTickFontWeight,
  HEIGHTS,
  LINE_WIDTHS,
  TICK_ALPHAS,
  FONT_SIZES,
  FONT_WEIGHTS,
} from '../tickMath'

describe('tickMath', () => {
  // ── smoothstep ───────────────────────────────────────────────────

  describe('smoothstep', () => {
    it('returns 0 at t=0', () => {
      expect(smoothstep(0)).toBe(0)
    })

    it('returns 1 at t=1', () => {
      expect(smoothstep(1)).toBe(1)
    })

    it('returns 0.5 at t=0.5', () => {
      expect(smoothstep(0.5)).toBe(0.5)
    })

    it('clamps below 0', () => {
      expect(smoothstep(-1)).toBe(0)
      expect(smoothstep(-0.5)).toBe(0)
    })

    it('clamps above 1', () => {
      expect(smoothstep(2)).toBe(1)
      expect(smoothstep(1.5)).toBe(1)
    })

    it('is monotonically increasing in [0,1]', () => {
      let prev = 0
      for (let t = 0.05; t <= 1; t += 0.05) {
        const val = smoothstep(t)
        expect(val).toBeGreaterThanOrEqual(prev)
        prev = val
      }
    })

    it('has zero derivative at endpoints (symmetry check)', () => {
      // smoothstep(0.01) should be very close to 0, smoothstep(0.99) close to 1
      expect(smoothstep(0.01)).toBeLessThan(0.01)
      expect(smoothstep(0.99)).toBeGreaterThan(0.99)
    })
  })

  // ── computeProminence ────────────────────────────────────────────

  describe('computeProminence', () => {
    it('returns 1.0 for zero ticks', () => {
      expect(computeProminence(0, 10, 30)).toBe(1.0)
    })

    it('returns 1.0 for negative ticks', () => {
      expect(computeProminence(-5, 10, 30)).toBe(1.0)
    })

    it('returns 0.0 past fadeEnd', () => {
      // fadeEnd = mediumMax * 1.5 = 30 * 1.5 = 45
      expect(computeProminence(50, 10, 30)).toBe(0.0)
      expect(computeProminence(45, 10, 30)).toBe(0.0)
    })

    it('returns 0.5 at boundary between anchor and medium segments', () => {
      // At numTicks = anchorMax, smoothstep(1) = 1, prominence = 1 - 1*0.5 = 0.5
      expect(computeProminence(10, 10, 30)).toBe(0.5)
    })

    it('returns 0.15 at boundary between medium and fine segments', () => {
      // At numTicks = mediumMax, smoothstep(1) = 1, prominence = 0.5 - 1*0.35 = 0.15
      expect(computeProminence(30, 10, 30)).toBeCloseTo(0.15)
    })

    it('decreases monotonically', () => {
      let prev = 1.0
      for (let n = 1; n <= 50; n++) {
        const p = computeProminence(n, 10, 30)
        expect(p).toBeLessThanOrEqual(prev)
        prev = p
      }
    })
  })

  // ── lerpLandmarks ────────────────────────────────────────────────

  describe('lerpLandmarks', () => {
    it('returns anchor value at prominence=1.0', () => {
      expect(lerpLandmarks(1.0, 40, 24, 12)).toBe(40)
    })

    it('returns medium value at prominence=0.5', () => {
      expect(lerpLandmarks(0.5, 40, 24, 12)).toBe(24)
    })

    it('returns fine value at prominence=0.0', () => {
      expect(lerpLandmarks(0.0, 40, 24, 12)).toBe(12)
    })

    it('interpolates between anchor and medium', () => {
      const val = lerpLandmarks(0.75, 40, 24, 12)
      expect(val).toBe(32) // 24 + 0.5 * (40 - 24) = 24 + 8 = 32
    })

    it('interpolates between medium and fine', () => {
      const val = lerpLandmarks(0.25, 40, 24, 12)
      expect(val).toBe(18) // 12 + 0.5 * (24 - 12) = 12 + 6 = 18
    })
  })

  // ── get* visual property helpers ─────────────────────────────────

  describe('getTickHeight', () => {
    it('returns anchor height at prominence=1.0 for large canvas', () => {
      // canvasHeight=1000 -> maxHeight=500, maxForLevel = 500*0.6=300
      // raw = HEIGHTS.anchor = 40, capped to min(40, 300) = 40
      expect(getTickHeight(1.0, 1000)).toBe(HEIGHTS.anchor)
    })

    it('returns fine height at prominence=0.0 for large canvas', () => {
      expect(getTickHeight(0.0, 1000)).toBe(HEIGHTS.fine)
    })

    it('caps height for small canvas', () => {
      // canvasHeight=40 -> maxHeight=20, maxForLevel at p=1 = 20*0.6=12
      // raw=40, capped to min(40, 12) = 12
      expect(getTickHeight(1.0, 40)).toBe(12)
    })
  })

  describe('getTickLineWidth', () => {
    it('returns anchor width at prominence=1.0', () => {
      expect(getTickLineWidth(1.0)).toBe(LINE_WIDTHS.anchor)
    })

    it('returns fine width at prominence=0.0', () => {
      expect(getTickLineWidth(0.0)).toBe(LINE_WIDTHS.fine)
    })
  })

  describe('getTickAlpha', () => {
    it('returns anchor alpha at prominence=1.0', () => {
      expect(getTickAlpha(1.0)).toBe(TICK_ALPHAS.anchor)
    })

    it('returns fine alpha at prominence=0.0', () => {
      expect(getTickAlpha(0.0)).toBe(TICK_ALPHAS.fine)
    })
  })

  describe('getTickFontSize', () => {
    it('returns anchor font size at prominence=1.0', () => {
      expect(getTickFontSize(1.0)).toBe(FONT_SIZES.anchor)
    })

    it('returns fine font size at prominence=0.0', () => {
      expect(getTickFontSize(0.0)).toBe(FONT_SIZES.fine)
    })
  })

  describe('getTickFontWeight', () => {
    it('returns anchor font weight at prominence=1.0', () => {
      expect(getTickFontWeight(1.0)).toBe(FONT_WEIGHTS.anchor)
    })

    it('returns fine font weight at prominence=0.0', () => {
      expect(getTickFontWeight(0.0)).toBe(FONT_WEIGHTS.fine)
    })

    it('returns integer', () => {
      expect(Number.isInteger(getTickFontWeight(0.73))).toBe(true)
    })
  })

  // ── formatTickLabel ──────────────────────────────────────────────

  describe('formatTickLabel', () => {
    it('formats integer correctly', () => {
      expect(formatTickLabel(5, 0)).toBe('5')
    })

    it('normalizes negative zero', () => {
      expect(formatTickLabel(-0, 0)).toBe('0')
    })

    it('formats decimal with appropriate precision', () => {
      const label = formatTickLabel(1.5, -1)
      // Should show 1 decimal place (power = -1 -> fractionDigits = 1)
      expect(label).toContain('1')
      expect(label).toContain('5')
    })

    it('uses scientific notation for very large numbers', () => {
      const label = formatTickLabel(1e8, 0)
      expect(label).toContain('e')
    })

    it('uses scientific notation for very small numbers', () => {
      const label = formatTickLabel(0.00001, -5)
      expect(label).toContain('e')
    })

    it('does not use scientific notation for zero', () => {
      expect(formatTickLabel(0, 0)).toBe('0')
    })
  })
})
