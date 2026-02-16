import { describe, it, expect } from 'vitest'
import { decayingSin } from '../animationMath'

describe('animationMath', () => {
  describe('decayingSin', () => {
    it('returns 0 at t=0', () => {
      expect(decayingSin(0, 1, 1)).toBe(0)
    })

    it('peaks near t = 1/(4*freq) for freq=1', () => {
      // sin(0.25 * 1 * 2π) = sin(π/2) = 1, decay = exp(-0.25 * decay)
      const val = decayingSin(0.25, 1, 0)
      expect(val).toBeCloseTo(1, 5)
    })

    it('decays over time', () => {
      const early = Math.abs(decayingSin(0.25, 1, 5))
      const late = Math.abs(decayingSin(2.25, 1, 5))
      expect(early).toBeGreaterThan(late)
    })

    it('approaches zero for large t with decay', () => {
      const val = decayingSin(100, 1, 5)
      expect(Math.abs(val)).toBeLessThan(0.001)
    })

    it('oscillates without decay', () => {
      // With decay=0, should oscillate between -1 and 1
      const a = decayingSin(0.25, 1, 0) // sin(π/2) = 1
      const b = decayingSin(0.75, 1, 0) // sin(3π/2) = -1
      expect(a).toBeCloseTo(1, 5)
      expect(b).toBeCloseTo(-1, 5)
    })

    it('higher frequency oscillates faster', () => {
      // freq=2: first peak at t=0.125 (1/(4*2))
      const val = decayingSin(0.125, 2, 0)
      expect(val).toBeCloseTo(1, 5)
    })

    it('higher decay reduces amplitude faster', () => {
      const lowDecay = Math.abs(decayingSin(1, 1, 1))
      const highDecay = Math.abs(decayingSin(1, 1, 10))
      expect(lowDecay).toBeGreaterThan(highDecay)
    })
  })
})
