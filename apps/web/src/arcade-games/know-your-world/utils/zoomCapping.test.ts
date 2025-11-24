import { describe, it, expect } from 'vitest'
import { capZoomAtThreshold, wouldZoomBeCapped } from './zoomCapping'
import type { ZoomCappingContext } from './zoomCapping'

describe('zoomCapping', () => {
  const createContext = (overrides: Partial<ZoomCappingContext> = {}): ZoomCappingContext => ({
    magnifierWidth: 400,
    svgWidth: 800,
    viewBoxWidth: 1000,
    zoom: 50,
    threshold: 20,
    pointerLocked: false,
    ...overrides,
  })

  describe('capZoomAtThreshold', () => {
    it('returns zoom uncapped when pointer is locked', () => {
      const context = createContext({ zoom: 100, pointerLocked: true })
      const result = capZoomAtThreshold(context)

      expect(result.cappedZoom).toBe(100)
      expect(result.wasCapped).toBe(false)
      expect(result.originalZoom).toBe(100)
    })

    it('returns zoom uncapped when ratio is below threshold', () => {
      const context = createContext({ zoom: 10 }) // Low zoom = low ratio
      const result = capZoomAtThreshold(context)

      expect(result.cappedZoom).toBe(10)
      expect(result.wasCapped).toBe(false)
      expect(result.originalZoom).toBe(10)
    })

    it('caps zoom when ratio is at threshold', () => {
      // Calculate zoom that produces exactly threshold ratio
      const magnifierWidth = 400
      const svgWidth = 800
      const threshold = 20
      const maxZoom = threshold / (magnifierWidth / svgWidth) // 20 / 0.5 = 40

      const context = createContext({ zoom: maxZoom, threshold, magnifierWidth, svgWidth })
      const result = capZoomAtThreshold(context)

      expect(result.cappedZoom).toBe(maxZoom)
      expect(result.wasCapped).toBe(true) // isAboveThreshold includes equality (>=)
      expect(result.originalZoom).toBe(maxZoom)
    })

    it('caps zoom when ratio is above threshold', () => {
      const magnifierWidth = 400
      const svgWidth = 800
      const threshold = 20
      const maxZoom = threshold / (magnifierWidth / svgWidth) // 40

      const context = createContext({ zoom: 100, threshold, magnifierWidth, svgWidth })
      const result = capZoomAtThreshold(context)

      expect(result.cappedZoom).toBe(maxZoom)
      expect(result.wasCapped).toBe(true)
      expect(result.originalZoom).toBe(100) // Returns original, not max
    })

    it('returns screen pixel ratio in result', () => {
      const context = createContext({ zoom: 50 })
      const result = capZoomAtThreshold(context)

      // ratio = zoom * (magnifierWidth / svgWidth) = 50 * 0.5 = 25
      expect(result.screenPixelRatio).toBe(25)
    })

    it('never returns zoom above max zoom', () => {
      const context = createContext({ zoom: 1000, threshold: 20 })
      const result = capZoomAtThreshold(context)

      const maxZoom = 20 / (400 / 800) // 40
      expect(result.cappedZoom).toBeLessThanOrEqual(maxZoom)
    })
  })

  describe('wouldZoomBeCapped', () => {
    it('returns false when pointer is locked', () => {
      const context = createContext({ zoom: 100, pointerLocked: true })
      expect(wouldZoomBeCapped(context)).toBe(false)
    })

    it('returns false when ratio is below threshold', () => {
      const context = createContext({ zoom: 10 })
      expect(wouldZoomBeCapped(context)).toBe(false)
    })

    it('returns true when ratio is at threshold', () => {
      const maxZoom = 20 / (400 / 800) // 40
      const context = createContext({ zoom: maxZoom, threshold: 20 })
      expect(wouldZoomBeCapped(context)).toBe(true) // isAboveThreshold includes equality (>=)
    })

    it('returns true when ratio is above threshold', () => {
      const context = createContext({ zoom: 100, threshold: 20 })
      expect(wouldZoomBeCapped(context)).toBe(true)
    })

    it('matches capZoomAtThreshold wasCapped result', () => {
      const testCases = [
        { zoom: 10, pointerLocked: false },
        { zoom: 100, pointerLocked: false },
        { zoom: 100, pointerLocked: true },
        { zoom: 40, pointerLocked: false }, // Exactly at max
        { zoom: 50, pointerLocked: false }, // Just above max
      ]

      for (const tc of testCases) {
        const context = createContext(tc)
        const wouldBeCapped = wouldZoomBeCapped(context)
        const result = capZoomAtThreshold(context)

        expect(wouldBeCapped).toBe(result.wasCapped)
      }
    })
  })

  describe('integration: capping never exceeds max zoom', () => {
    it('verifies capped zoom is always <= max zoom', () => {
      const testCases = [
        { zoom: 50, threshold: 20, magnifierWidth: 400, svgWidth: 800 },
        { zoom: 100, threshold: 15, magnifierWidth: 300, svgWidth: 600 },
        { zoom: 200, threshold: 25, magnifierWidth: 500, svgWidth: 1000 },
        { zoom: 500, threshold: 10, magnifierWidth: 200, svgWidth: 400 },
      ]

      for (const tc of testCases) {
        const context = createContext(tc)
        const result = capZoomAtThreshold(context)
        const maxZoom = tc.threshold / (tc.magnifierWidth / tc.svgWidth)

        expect(result.cappedZoom).toBeLessThanOrEqual(maxZoom)

        // Also verify if it was capped, cappedZoom equals maxZoom
        if (result.wasCapped) {
          expect(result.cappedZoom).toBe(maxZoom)
        }
      }
    })
  })
})
