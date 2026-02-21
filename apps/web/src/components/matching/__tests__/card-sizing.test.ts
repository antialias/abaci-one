import { describe, it, expect } from 'vitest'
import { computeCardSize } from '../MemoryGrid'

describe('computeCardSize', () => {
  const gap = 6

  it('computes card size constrained by width on a wide container', () => {
    // Wide container: 1200×800, 6 cols × 3 rows
    // Width should be the binding constraint
    const result = computeCardSize(1200, 800, 6, 3, gap)
    // hGaps = 5*6 + 16 = 46, maxFromWidth = (1200-46)/6 = 192.33
    // vGaps = 2*6 = 12, maxFromHeight = ((800-12)/3) * 0.75 = 197
    // min(192.33, 197) = 192.33 → width-constrained
    expect(result.w).toBeCloseTo(192.33, 1)
    expect(result.h).toBeCloseTo(result.w * (4 / 3), 5)
  })

  it('computes card size constrained by height on a tall container', () => {
    // Tall container: 600×400, 6 cols × 5 rows
    // Height should be the binding constraint
    const result = computeCardSize(600, 400, 6, 5, gap)
    // hGaps = 5*6 + 16 = 46, maxFromWidth = (600-46)/6 = 92.33
    // vGaps = 4*6 = 24, maxFromHeight = ((400-24)/5) * 0.75 = 56.4
    // min(92.33, 56.4) = 56.4 → height-constrained (but below 60 floor? no, 56.4 < 60)
    // clamped to 60
    expect(result.w).toBe(60)
    expect(result.h).toBeCloseTo(80, 5)
  })

  it('maintains 3:4 aspect ratio (h = w * 4/3)', () => {
    const result = computeCardSize(1000, 800, 5, 4, gap)
    expect(result.h).toBeCloseTo(result.w * (4 / 3), 10)
  })

  it('clamps to minimum width of 60px', () => {
    // Tiny container where computed size would be below 60
    const result = computeCardSize(200, 150, 6, 5, gap)
    expect(result.w).toBe(60)
    expect(result.h).toBeCloseTo(80, 5)
  })

  it('clamps to maximum width of 200px', () => {
    // Huge container where computed size would exceed 200
    const result = computeCardSize(3000, 3000, 2, 2, gap)
    expect(result.w).toBe(200)
    expect(result.h).toBeCloseTo(200 * (4 / 3), 5)
  })

  it('accounts for horizontal gaps and grid padding', () => {
    // With 4 cols: hGaps = 3*6 + 16 = 34
    // availW = 434 → (434-34)/4 = 100
    // Make height non-binding by making it large
    const result = computeCardSize(434, 2000, 4, 2, gap)
    expect(result.w).toBe(100)
  })

  it('accounts for vertical gaps', () => {
    // With 4 rows: vGaps = 3*6 = 18
    // availH = 618 → ((618-18)/4) * 0.75 = 112.5
    // Make width non-binding by making it large
    const result = computeCardSize(2000, 618, 4, 4, gap)
    expect(result.w).toBeCloseTo(112.5, 5)
  })

  it('handles single column grid', () => {
    const result = computeCardSize(400, 800, 1, 6, gap)
    // hGaps = 0*6 + 16 = 16, maxFromWidth = (400-16)/1 = 384 → capped at 200
    // vGaps = 5*6 = 30, maxFromHeight = ((800-30)/6) * 0.75 = 96.25
    // min(200, 96.25) = 96.25
    expect(result.w).toBeCloseTo(96.25, 1)
  })

  it('handles single row grid', () => {
    const result = computeCardSize(800, 400, 6, 1, gap)
    // hGaps = 5*6 + 16 = 46, maxFromWidth = (800-46)/6 = 125.67
    // vGaps = 0*6 = 0, maxFromHeight = ((400-0)/1) * 0.75 = 300 → capped at 200
    // min(125.67, 200) = 125.67
    expect(result.w).toBeCloseTo(125.67, 1)
  })

  describe('game-break scenario (constrained vertical space)', () => {
    it('fits 30 cards (5×6) in 680px vertical space', () => {
      // Desktop game-break: ~900px wide, ~680px available height
      const result = computeCardSize(900, 680, 5, 6, gap)
      const totalH = result.h * 6 + 5 * gap
      expect(totalH).toBeLessThanOrEqual(680)
      expect(result.w).toBeGreaterThanOrEqual(60)
    })

    it('hits minimum floor at 503px vertical space (cards remain usable)', () => {
      // Smaller viewport: unclamped width would be 59.125px, but min floor keeps it at 60
      const result = computeCardSize(723, 503, 5, 6, gap)
      expect(result.w).toBe(60)
      expect(result.h).toBeCloseTo(80, 5)
      // Total grid height slightly exceeds container due to min floor — expected
      const totalH = result.h * 6 + 5 * gap
      expect(totalH).toBe(510)
    })
  })

  it('uses default gap of 6 when not specified', () => {
    const withDefault = computeCardSize(800, 600, 4, 3)
    const withExplicit = computeCardSize(800, 600, 4, 3, 6)
    expect(withDefault).toEqual(withExplicit)
  })
})
