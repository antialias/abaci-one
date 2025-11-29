import { describe, it, expect } from 'vitest'
import {
  calculateAdaptiveThresholds,
  clampViewportToMapBounds,
  isRegionInViewport,
} from './adaptiveZoomSearch'
import type { Bounds } from './adaptiveZoomSearch'

describe('adaptiveZoomSearch', () => {
  describe('calculateAdaptiveThresholds', () => {
    it('returns min 0.02, max 0.08 for very small regions (< 1px)', () => {
      expect(calculateAdaptiveThresholds(0.5)).toEqual({
        min: 0.02,
        max: 0.08,
      })
      expect(calculateAdaptiveThresholds(0.99)).toEqual({
        min: 0.02,
        max: 0.08,
      })
    })

    it('returns min 0.05, max 0.15 for small regions (1px - 5px)', () => {
      expect(calculateAdaptiveThresholds(1)).toEqual({ min: 0.05, max: 0.15 })
      expect(calculateAdaptiveThresholds(3)).toEqual({ min: 0.05, max: 0.15 })
      expect(calculateAdaptiveThresholds(4.99)).toEqual({
        min: 0.05,
        max: 0.15,
      })
    })

    it('returns min 0.1, max 0.25 for larger regions (>= 5px)', () => {
      expect(calculateAdaptiveThresholds(5)).toEqual({ min: 0.1, max: 0.25 })
      expect(calculateAdaptiveThresholds(10)).toEqual({ min: 0.1, max: 0.25 })
      expect(calculateAdaptiveThresholds(100)).toEqual({ min: 0.1, max: 0.25 })
    })

    it('handles boundary cases correctly', () => {
      expect(calculateAdaptiveThresholds(0)).toEqual({ min: 0.02, max: 0.08 })
      expect(calculateAdaptiveThresholds(1)).toEqual({ min: 0.05, max: 0.15 })
      expect(calculateAdaptiveThresholds(5)).toEqual({ min: 0.1, max: 0.25 })
    })
  })

  describe('clampViewportToMapBounds', () => {
    const mapBounds: Bounds = {
      left: 0,
      right: 1000,
      top: 0,
      bottom: 500,
    }

    it('returns viewport unchanged when fully within map bounds', () => {
      const viewport: Bounds = {
        left: 100,
        right: 200,
        top: 50,
        bottom: 100,
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      expect(result.left).toBe(100)
      expect(result.right).toBe(200)
      expect(result.top).toBe(50)
      expect(result.bottom).toBe(100)
      expect(result.wasClamped).toBe(false)
    })

    it('clamps viewport that extends past left edge', () => {
      const viewport: Bounds = {
        left: -50,
        right: 50, // width = 100
        top: 50,
        bottom: 100,
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      expect(result.left).toBe(0) // Clamped to map left
      expect(result.right).toBe(100) // Shifted to maintain width
      expect(result.wasClamped).toBe(true)
    })

    it('clamps viewport that extends past right edge', () => {
      const viewport: Bounds = {
        left: 950,
        right: 1050, // width = 100, extends past 1000
        top: 50,
        bottom: 100,
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      expect(result.left).toBe(900) // Shifted to fit width
      expect(result.right).toBe(1000) // Clamped to map right
      expect(result.wasClamped).toBe(true)
    })

    it('clamps viewport that extends past top edge', () => {
      const viewport: Bounds = {
        left: 100,
        right: 200,
        top: -20,
        bottom: 30, // height = 50
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      expect(result.top).toBe(0) // Clamped to map top
      expect(result.bottom).toBe(50) // Shifted to maintain height
      expect(result.wasClamped).toBe(true)
    })

    it('clamps viewport that extends past bottom edge', () => {
      const viewport: Bounds = {
        left: 100,
        right: 200,
        top: 470,
        bottom: 520, // height = 50, extends past 500
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      expect(result.top).toBe(450) // Shifted to fit height
      expect(result.bottom).toBe(500) // Clamped to map bottom
      expect(result.wasClamped).toBe(true)
    })

    it('clamps viewport that extends past multiple edges', () => {
      const viewport: Bounds = {
        left: -50,
        right: 1050,
        top: -20,
        bottom: 520,
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      // Clamping applies shifts sequentially, not simultaneously
      // When viewport is larger than map bounds, shifts can conflict
      // Left shift: +50 → left: 0, right: 1100
      // Right shift: -100 → left: -100, right: 1000
      // Top shift: +20 → top: 0, bottom: 540
      // Bottom shift: -40 → top: -40, bottom: 500
      expect(result.left).toBe(-100)
      expect(result.right).toBe(1000)
      expect(result.top).toBe(-40)
      expect(result.bottom).toBe(500)
      expect(result.wasClamped).toBe(true)
    })

    it('handles viewport exactly at map edges', () => {
      const viewport: Bounds = {
        left: 0,
        right: 1000,
        top: 0,
        bottom: 500,
      }

      const result = clampViewportToMapBounds(viewport, mapBounds)

      expect(result.left).toBe(0)
      expect(result.right).toBe(1000)
      expect(result.top).toBe(0)
      expect(result.bottom).toBe(500)
      expect(result.wasClamped).toBe(false)
    })
  })

  describe('isRegionInViewport', () => {
    const viewport: Bounds = {
      left: 100,
      right: 200,
      top: 100,
      bottom: 200,
    }

    it('returns true when region is fully within viewport', () => {
      const region: Bounds = {
        left: 120,
        right: 180,
        top: 120,
        bottom: 180,
      }

      expect(isRegionInViewport(region, viewport)).toBe(true)
    })

    it('returns true when region partially overlaps viewport', () => {
      const region: Bounds = {
        left: 150,
        right: 250, // Extends past viewport right
        top: 150,
        bottom: 180,
      }

      expect(isRegionInViewport(region, viewport)).toBe(true)
    })

    it('returns true when region overlaps on left edge', () => {
      const region: Bounds = {
        left: 50, // Starts before viewport
        right: 150,
        top: 150,
        bottom: 180,
      }

      expect(isRegionInViewport(region, viewport)).toBe(true)
    })

    it('returns true when region overlaps on top edge', () => {
      const region: Bounds = {
        left: 150,
        right: 180,
        top: 50, // Starts before viewport
        bottom: 150,
      }

      expect(isRegionInViewport(region, viewport)).toBe(true)
    })

    it('returns true when region overlaps on bottom edge', () => {
      const region: Bounds = {
        left: 150,
        right: 180,
        top: 150,
        bottom: 250, // Extends past viewport
      }

      expect(isRegionInViewport(region, viewport)).toBe(true)
    })

    it('returns false when region is completely to the left', () => {
      const region: Bounds = {
        left: 0,
        right: 50, // Ends before viewport left (100)
        top: 150,
        bottom: 180,
      }

      expect(isRegionInViewport(region, viewport)).toBe(false)
    })

    it('returns false when region is completely to the right', () => {
      const region: Bounds = {
        left: 250, // Starts after viewport right (200)
        right: 300,
        top: 150,
        bottom: 180,
      }

      expect(isRegionInViewport(region, viewport)).toBe(false)
    })

    it('returns false when region is completely above', () => {
      const region: Bounds = {
        left: 150,
        right: 180,
        top: 0,
        bottom: 50, // Ends before viewport top (100)
      }

      expect(isRegionInViewport(region, viewport)).toBe(false)
    })

    it('returns false when region is completely below', () => {
      const region: Bounds = {
        left: 150,
        right: 180,
        top: 250, // Starts after viewport bottom (200)
        bottom: 300,
      }

      expect(isRegionInViewport(region, viewport)).toBe(false)
    })

    it('returns false when region exactly touches viewport edge', () => {
      const region: Bounds = {
        left: 200, // Touches viewport right (but doesn't overlap)
        right: 250,
        top: 150,
        bottom: 180,
      }

      // Uses strict < and >, not <= and >=, so touching doesn't count
      expect(isRegionInViewport(region, viewport)).toBe(false)
    })

    it('is commutative for overlapping regions', () => {
      const region1: Bounds = { left: 150, right: 250, top: 150, bottom: 250 }
      const region2: Bounds = { left: 100, right: 200, top: 100, bottom: 200 }

      expect(isRegionInViewport(region1, region2)).toBe(isRegionInViewport(region2, region1))
    })
  })
})
