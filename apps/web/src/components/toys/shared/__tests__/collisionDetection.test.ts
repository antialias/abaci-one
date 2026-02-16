import { describe, it, expect } from 'vitest'
import { computeCollisionOpacity } from '../collisionDetection'
import type { CollisionFadeMap } from '../collisionDetection'

describe('collisionDetection', () => {
  describe('computeCollisionOpacity', () => {
    it('returns opacity=1 for a new visible label (at t=0, still animating)', () => {
      const fadeMap: CollisionFadeMap = new Map()
      const result = computeCollisionOpacity(5, true, fadeMap, 1000, 500)
      expect(result.opacity).toBe(1)
      // At t=0 elapsed=0 so t<1 → animating is true (entry just created)
      expect(result.animating).toBe(true)
    })

    it('returns opacity=0 for a new hidden label (at t=0, still animating)', () => {
      const fadeMap: CollisionFadeMap = new Map()
      const result = computeCollisionOpacity(5, false, fadeMap, 1000, 500)
      expect(result.opacity).toBe(0)
      expect(result.animating).toBe(true)
    })

    it('settles to not-animating after full duration', () => {
      const fadeMap: CollisionFadeMap = new Map()
      computeCollisionOpacity(5, true, fadeMap, 0, 500)
      const result = computeCollisionOpacity(5, true, fadeMap, 500, 500)
      expect(result.opacity).toBe(1)
      expect(result.animating).toBe(false)
    })

    it('creates a fade map entry on first call', () => {
      const fadeMap: CollisionFadeMap = new Map()
      computeCollisionOpacity(5, true, fadeMap, 1000, 500)
      expect(fadeMap.has(5)).toBe(true)
    })

    it('animates fade-out when visibility changes from true to false', () => {
      const fadeMap: CollisionFadeMap = new Map()
      // First call: visible, let it settle
      computeCollisionOpacity(5, true, fadeMap, 1000, 500)
      computeCollisionOpacity(5, true, fadeMap, 1500, 500) // settled

      // Toggle to hidden at t=2000, check partway through at t=2200
      computeCollisionOpacity(5, false, fadeMap, 2000, 500)
      const result = computeCollisionOpacity(5, false, fadeMap, 2200, 500)
      expect(result.animating).toBe(true)
      expect(result.opacity).toBeLessThan(1)
      expect(result.opacity).toBeGreaterThan(0)
    })

    it('completes fade-out after full duration', () => {
      const fadeMap: CollisionFadeMap = new Map()
      computeCollisionOpacity(5, true, fadeMap, 1000, 500)

      // Toggle to hidden at t=1000
      computeCollisionOpacity(5, false, fadeMap, 1000, 500)

      // After full fade duration
      const result = computeCollisionOpacity(5, false, fadeMap, 1500, 500)
      expect(result.opacity).toBe(0)
      expect(result.animating).toBe(false)
    })

    it('partially fades over half the duration', () => {
      const fadeMap: CollisionFadeMap = new Map()
      computeCollisionOpacity(5, true, fadeMap, 0, 500)
      computeCollisionOpacity(5, false, fadeMap, 0, 500)
      const result = computeCollisionOpacity(5, false, fadeMap, 250, 500)
      expect(result.opacity).toBeCloseTo(0.5, 1)
      expect(result.animating).toBe(true)
    })

    it('handles rapid toggle correctly', () => {
      const fadeMap: CollisionFadeMap = new Map()
      // Start visible
      computeCollisionOpacity(5, true, fadeMap, 0, 500)
      // Start hiding at t=0
      computeCollisionOpacity(5, false, fadeMap, 0, 500)
      // Halfway through fade-out (opacity ~0.5), toggle back to visible
      const mid = computeCollisionOpacity(5, true, fadeMap, 250, 500)
      // Should now be animating back toward 1 from ~0.5
      expect(mid.animating).toBe(true)
      expect(mid.opacity).toBeGreaterThan(0.4)
      expect(mid.opacity).toBeLessThan(0.6)
    })

    it('tracks separate entries for different values', () => {
      const fadeMap: CollisionFadeMap = new Map()
      computeCollisionOpacity(1, true, fadeMap, 0, 500)
      computeCollisionOpacity(2, false, fadeMap, 0, 500)
      expect(fadeMap.size).toBe(2)

      const r1 = computeCollisionOpacity(1, true, fadeMap, 0, 500)
      const r2 = computeCollisionOpacity(2, false, fadeMap, 0, 500)
      expect(r1.opacity).toBe(1)
      expect(r2.opacity).toBe(0)
    })
  })
})
