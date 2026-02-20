import { describe, it, expect } from 'vitest'
import { computeSlopeGuides, guideIntegerIntersections } from '../slopeGuides'

describe('slopeGuides', () => {
  // ── computeSlopeGuides ───────────────────────────────────────────

  describe('computeSlopeGuides', () => {
    it('returns state with anchor and handle coords', () => {
      const state = computeSlopeGuides(0, 0, 3, 2)
      expect(state.anchorX).toBe(0)
      expect(state.anchorY).toBe(0)
      expect(state.handleX).toBe(3)
      expect(state.handleY).toBe(2)
    })

    it('includes guides for all defined slopes', () => {
      const state = computeSlopeGuides(0, 0, 5, 3)
      // Should have all slopes: 0, ±1..±11, ±1/2..±1/11, vertical
      // = 1 + 22 + 20 + 1 = 44
      expect(state.guides.length).toBe(44)
    })

    it('each guide has a slope with num, den, and label', () => {
      const state = computeSlopeGuides(0, 0, 1, 1)
      for (const g of state.guides) {
        expect(g.slope).toHaveProperty('num')
        expect(g.slope).toHaveProperty('den')
        expect(g.slope).toHaveProperty('label')
        expect(typeof g.slope.label).toBe('string')
      }
    })

    it('includes slope 0', () => {
      const state = computeSlopeGuides(0, 0, 3, 1)
      const zero = state.guides.find((g) => g.slope.num === 0 && g.slope.den === 1)
      expect(zero).toBeDefined()
    })

    it('includes vertical slope', () => {
      const state = computeSlopeGuides(0, 0, 3, 1)
      const vert = state.guides.find((g) => g.slope.den === 0)
      expect(vert).toBeDefined()
      expect(vert!.slope.label).toBe('\u221E')
    })

    it('includes slopes up to ±11', () => {
      const state = computeSlopeGuides(0, 0, 3, 1)
      const s11 = state.guides.find((g) => g.slope.num === 11 && g.slope.den === 1)
      const sNeg11 = state.guides.find((g) => g.slope.num === -11 && g.slope.den === 1)
      expect(s11).toBeDefined()
      expect(sNeg11).toBeDefined()
    })

    it('includes inverse slopes up to ±1/11', () => {
      const state = computeSlopeGuides(0, 0, 3, 1)
      const inv11 = state.guides.find((g) => g.slope.num === 1 && g.slope.den === 11)
      const invNeg11 = state.guides.find((g) => g.slope.num === -1 && g.slope.den === 11)
      expect(inv11).toBeDefined()
      expect(invNeg11).toBeDefined()
    })
  })

  // ── guideIntegerIntersections ────────────────────────────────────

  describe('guideIntegerIntersections', () => {
    it('finds integer points along slope=1 line through origin', () => {
      const slope = { num: 1, den: 1, label: '1' }
      const pts = guideIntegerIntersections(0, 0, slope, -5, 5, -5, 5)
      // Every integer x gives integer y on y=x
      expect(pts).toContainEqual({ x: 0, y: 0 })
      expect(pts).toContainEqual({ x: 1, y: 1 })
      expect(pts).toContainEqual({ x: -3, y: -3 })
      expect(pts.length).toBe(11) // -5..5
    })

    it('finds integer points along slope=2 line through origin', () => {
      const slope = { num: 2, den: 1, label: '2' }
      const pts = guideIntegerIntersections(0, 0, slope, -3, 3, -10, 10)
      expect(pts).toContainEqual({ x: 0, y: 0 })
      expect(pts).toContainEqual({ x: 1, y: 2 })
      expect(pts).toContainEqual({ x: -2, y: -4 })
    })

    it('finds integer points along slope=1/2 line through origin', () => {
      const slope = { num: 1, den: 2, label: '\u00BD' }
      const pts = guideIntegerIntersections(0, 0, slope, -6, 6, -5, 5)
      // y = x/2, integer y only when x is even
      expect(pts).toContainEqual({ x: 0, y: 0 })
      expect(pts).toContainEqual({ x: 2, y: 1 })
      expect(pts).toContainEqual({ x: -4, y: -2 })
      // Odd x values should not appear
      expect(pts.find((p) => p.x === 1)).toBeUndefined()
      expect(pts.find((p) => p.x === 3)).toBeUndefined()
    })

    it('finds integer points along slope=1/3 from non-origin anchor', () => {
      const slope = { num: 1, den: 3, label: '\u2153' }
      // anchor (1, 2): y = 2 + (x-1)/3, integer y when (x-1) % 3 === 0
      // x=1 -> y=2, x=4 -> y=3, x=7 -> y=4, x=-2 -> y=1
      const pts = guideIntegerIntersections(1, 2, slope, -5, 10, -5, 10)
      expect(pts).toContainEqual({ x: 1, y: 2 })
      expect(pts).toContainEqual({ x: 4, y: 3 })
      expect(pts).toContainEqual({ x: 7, y: 4 })
      expect(pts).toContainEqual({ x: -2, y: 1 })
    })

    it('handles vertical line', () => {
      const slope = { num: 1, den: 0, label: '\u221E' }
      const pts = guideIntegerIntersections(3, 0, slope, -5, 5, -2, 2)
      // All points at x=3, integer y from -2 to 2
      expect(pts.length).toBe(5)
      for (const pt of pts) {
        expect(pt.x).toBe(3)
      }
      expect(pts).toContainEqual({ x: 3, y: 0 })
      expect(pts).toContainEqual({ x: 3, y: 2 })
      expect(pts).toContainEqual({ x: 3, y: -2 })
    })

    it('handles horizontal line (slope=0)', () => {
      const slope = { num: 0, den: 1, label: '0' }
      const pts = guideIntegerIntersections(0, 5, slope, -3, 3, 0, 10)
      // All points at y=5, integer x from -3 to 3
      expect(pts.length).toBe(7)
      for (const pt of pts) {
        expect(pt.y).toBe(5)
      }
    })

    it('excludes points outside y range', () => {
      const slope = { num: 3, den: 1, label: '3' }
      // y = 3x, with y range [-5, 5]: x can only be -1, 0, 1
      const pts = guideIntegerIntersections(0, 0, slope, -10, 10, -5, 5)
      expect(pts).toContainEqual({ x: 0, y: 0 })
      expect(pts).toContainEqual({ x: 1, y: 3 })
      expect(pts).toContainEqual({ x: -1, y: -3 })
      // x=2 -> y=6 is out of range
      expect(pts.find((p) => p.x === 2)).toBeUndefined()
    })

    it('handles negative slope', () => {
      const slope = { num: -1, den: 1, label: '\u22121' }
      const pts = guideIntegerIntersections(0, 0, slope, -3, 3, -3, 3)
      expect(pts).toContainEqual({ x: 1, y: -1 })
      expect(pts).toContainEqual({ x: -2, y: 2 })
    })

    it('returns empty for range with no integer intersections', () => {
      const slope = { num: 1, den: 2, label: '\u00BD' }
      // anchor (0,0), slope 1/2: integer points at even x only
      // range x: [1,1] => only x=1, but (1-0)%2 !== 0 => no point
      const pts = guideIntegerIntersections(0, 0, slope, 1, 1, -10, 10)
      expect(pts.length).toBe(0)
    })
  })
})
