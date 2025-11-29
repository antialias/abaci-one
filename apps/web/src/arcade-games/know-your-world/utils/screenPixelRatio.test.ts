import { describe, it, expect } from 'vitest'
import {
  calculateScreenPixelRatio,
  isAboveThreshold,
  calculateMaxZoomAtThreshold,
  createZoomContext,
} from './screenPixelRatio'

describe('screenPixelRatio', () => {
  describe('isAboveThreshold', () => {
    it('returns true when ratio equals threshold', () => {
      expect(isAboveThreshold(20, 20)).toBe(true)
    })

    it('returns true when ratio is above threshold', () => {
      expect(isAboveThreshold(25, 20)).toBe(true)
    })

    it('returns false when ratio is below threshold', () => {
      expect(isAboveThreshold(15, 20)).toBe(false)
    })

    it('handles decimal values correctly', () => {
      expect(isAboveThreshold(20.5, 20)).toBe(true)
      expect(isAboveThreshold(19.9, 20)).toBe(false)
    })
  })

  describe('calculateScreenPixelRatio', () => {
    it('calculates ratio using formula: zoom * (magnifierWidth / svgWidth)', () => {
      const context = {
        magnifierWidth: 400,
        svgWidth: 800,
        viewBoxWidth: 1000,
        zoom: 10,
      }

      const ratio = calculateScreenPixelRatio(context)
      const expected = 10 * (400 / 800) // 10 * 0.5 = 5
      expect(ratio).toBe(expected)
    })

    it('returns higher ratio with higher zoom', () => {
      const baseContext = {
        magnifierWidth: 400,
        svgWidth: 800,
        viewBoxWidth: 1000,
        zoom: 10,
      }

      const ratio1 = calculateScreenPixelRatio(baseContext)
      const ratio2 = calculateScreenPixelRatio({ ...baseContext, zoom: 20 })

      expect(ratio2).toBe(ratio1 * 2)
    })

    it('returns higher ratio with larger magnifier width', () => {
      const baseContext = {
        magnifierWidth: 400,
        svgWidth: 800,
        viewBoxWidth: 1000,
        zoom: 10,
      }

      const ratio1 = calculateScreenPixelRatio(baseContext)
      const ratio2 = calculateScreenPixelRatio({
        ...baseContext,
        magnifierWidth: 800,
      })

      expect(ratio2).toBe(ratio1 * 2)
    })

    it('returns lower ratio with larger svg width', () => {
      const baseContext = {
        magnifierWidth: 400,
        svgWidth: 800,
        viewBoxWidth: 1000,
        zoom: 10,
      }

      const ratio1 = calculateScreenPixelRatio(baseContext)
      const ratio2 = calculateScreenPixelRatio({
        ...baseContext,
        svgWidth: 1600,
      })

      expect(ratio2).toBe(ratio1 / 2)
    })
  })

  describe('calculateMaxZoomAtThreshold', () => {
    it('calculates max zoom using formula: threshold / (magnifierWidth / svgWidth)', () => {
      const maxZoom = calculateMaxZoomAtThreshold(20, 400, 800)
      const expected = 20 / (400 / 800) // 20 / 0.5 = 40
      expect(maxZoom).toBe(expected)
    })

    it('returns higher max zoom with higher threshold', () => {
      const maxZoom1 = calculateMaxZoomAtThreshold(20, 400, 800)
      const maxZoom2 = calculateMaxZoomAtThreshold(40, 400, 800)

      expect(maxZoom2).toBe(maxZoom1 * 2)
    })

    it('returns higher max zoom with larger svg width', () => {
      const maxZoom1 = calculateMaxZoomAtThreshold(20, 400, 800)
      const maxZoom2 = calculateMaxZoomAtThreshold(20, 400, 1600)

      expect(maxZoom2).toBe(maxZoom1 * 2)
    })

    it('returns lower max zoom with larger magnifier width', () => {
      const maxZoom1 = calculateMaxZoomAtThreshold(20, 400, 800)
      const maxZoom2 = calculateMaxZoomAtThreshold(20, 800, 800)

      expect(maxZoom2).toBe(maxZoom1 / 2)
    })
  })

  describe('integration: max zoom produces threshold ratio', () => {
    it('verifies that max zoom at threshold produces exactly the threshold ratio', () => {
      const threshold = 20
      const magnifierWidth = 400
      const svgWidth = 800
      const viewBoxWidth = 1000

      const maxZoom = calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgWidth)

      const context = {
        magnifierWidth,
        svgWidth,
        viewBoxWidth,
        zoom: maxZoom,
      }

      const ratio = calculateScreenPixelRatio(context)

      expect(ratio).toBeCloseTo(threshold, 10)
    })

    it('verifies inverse relationship for various dimensions', () => {
      const testCases = [
        {
          threshold: 20,
          magnifierWidth: 400,
          svgWidth: 800,
          viewBoxWidth: 1000,
        },
        {
          threshold: 15,
          magnifierWidth: 300,
          svgWidth: 600,
          viewBoxWidth: 2000,
        },
        {
          threshold: 25,
          magnifierWidth: 500,
          svgWidth: 1000,
          viewBoxWidth: 1500,
        },
      ]

      for (const tc of testCases) {
        const maxZoom = calculateMaxZoomAtThreshold(tc.threshold, tc.magnifierWidth, tc.svgWidth)
        const context = {
          magnifierWidth: tc.magnifierWidth,
          svgWidth: tc.svgWidth,
          viewBoxWidth: tc.viewBoxWidth,
          zoom: maxZoom,
        }
        const ratio = calculateScreenPixelRatio(context)
        expect(ratio).toBeCloseTo(tc.threshold, 10)
      }
    })
  })
})
