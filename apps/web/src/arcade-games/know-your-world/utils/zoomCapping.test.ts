import { describe, it, expect } from 'vitest'
import { capZoomAtThreshold, wouldZoomBeCapped } from './zoomCapping'

describe('capZoomAtThreshold', () => {
  it('caps zoom when above threshold', () => {
    const result = capZoomAtThreshold({
      zoom: 100, // Want 100x zoom
      threshold: 20, // But threshold is 20 px/px
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // Max zoom at threshold = (20 * 2000) / 500 = 80
    expect(result.cappedZoom).toBe(80)
    expect(result.wasCapped).toBe(true)
    expect(result.screenPixelRatio).toBeCloseTo(20, 10)
  })

  it('does not cap zoom when below threshold', () => {
    const result = capZoomAtThreshold({
      zoom: 50, // Want 50x zoom
      threshold: 20, // Threshold is 20 px/px
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // Zoom 50 produces ratio = (2000/2000) * (500 / (2000/50))
    // = 1 * (500 / 40) = 12.5 px/px
    // This is below 20, so no capping
    expect(result.cappedZoom).toBe(50)
    expect(result.wasCapped).toBe(false)
    expect(result.screenPixelRatio).toBe(12.5)
  })

  it('does not cap zoom when exactly at threshold', () => {
    const result = capZoomAtThreshold({
      zoom: 80, // Exactly at max
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // Zoom 80 produces exactly 20 px/px
    expect(result.cappedZoom).toBe(80)
    expect(result.wasCapped).toBe(false)
    expect(result.screenPixelRatio).toBeCloseTo(20, 10)
  })

  it('handles very high zoom (1000x)', () => {
    const result = capZoomAtThreshold({
      zoom: 1000,
      threshold: 20,
      magnifierWidth: 400,
      viewBoxWidth: 1000,
      svgWidth: 1000,
    })

    // Max zoom = (20 * 1000) / 400 = 50
    expect(result.cappedZoom).toBe(50)
    expect(result.wasCapped).toBe(true)
    expect(result.screenPixelRatio).toBeCloseTo(20, 10)
  })

  it('handles low zoom (< 1x)', () => {
    const result = capZoomAtThreshold({
      zoom: 0.5,
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // Zoom 0.5 produces very low ratio, won't be capped
    expect(result.cappedZoom).toBe(0.5)
    expect(result.wasCapped).toBe(false)
    expect(result.screenPixelRatio).toBeLessThan(1)
  })

  it('handles different SVG scaling', () => {
    const result = capZoomAtThreshold({
      zoom: 100,
      threshold: 15,
      magnifierWidth: 300,
      viewBoxWidth: 2000,
      svgWidth: 1000, // SVG rendered at half size
    })

    // With SVG at half size, scaling factor is 2
    // Max zoom = (15 * 1000) / 300 = 50
    expect(result.cappedZoom).toBe(50)
    expect(result.wasCapped).toBe(true)
  })

  it('returns metadata about capping decision', () => {
    const result1 = capZoomAtThreshold({
      zoom: 100,
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    expect(result1).toHaveProperty('cappedZoom')
    expect(result1).toHaveProperty('wasCapped')
    expect(result1).toHaveProperty('screenPixelRatio')
    expect(result1).toHaveProperty('maxZoomAtThreshold')
    expect(result1.maxZoomAtThreshold).toBe(80)

    const result2 = capZoomAtThreshold({
      zoom: 50,
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    expect(result2.wasCapped).toBe(false)
    expect(result2.maxZoomAtThreshold).toBe(80) // Still reports what max would be
  })
})

describe('wouldZoomBeCapped', () => {
  it('returns true when zoom would be capped', () => {
    const wouldBeCapped = wouldZoomBeCapped({
      zoom: 100,
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    expect(wouldBeCapped).toBe(true)
  })

  it('returns false when zoom would not be capped', () => {
    const wouldBeCapped = wouldZoomBeCapped({
      zoom: 50,
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    expect(wouldBeCapped).toBe(false)
  })

  it('returns false when zoom exactly at threshold', () => {
    const wouldBeCapped = wouldZoomBeCapped({
      zoom: 80, // Exactly at max
      threshold: 20,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    expect(wouldBeCapped).toBe(false)
  })

  it('handles edge cases', () => {
    // Very high zoom
    expect(
      wouldZoomBeCapped({
        zoom: 10000,
        threshold: 20,
        magnifierWidth: 400,
        viewBoxWidth: 1000,
        svgWidth: 1000,
      })
    ).toBe(true)

    // Very low zoom
    expect(
      wouldZoomBeCapped({
        zoom: 0.1,
        threshold: 20,
        magnifierWidth: 400,
        viewBoxWidth: 1000,
        svgWidth: 1000,
      })
    ).toBe(false)

    // Zoom of 1
    expect(
      wouldZoomBeCapped({
        zoom: 1,
        threshold: 20,
        magnifierWidth: 400,
        viewBoxWidth: 1000,
        svgWidth: 1000,
      })
    ).toBe(false)
  })
})

describe('integration: capping behavior', () => {
  const setupContext = () => ({
    threshold: 20,
    magnifierWidth: 500,
    viewBoxWidth: 2000,
    svgWidth: 2000,
  })

  it('consistently caps zooms in the danger zone', () => {
    const context = setupContext()
    const testZooms = [85, 90, 100, 150, 200, 500, 1000]

    testZooms.forEach((zoom) => {
      const result = capZoomAtThreshold({ ...context, zoom })
      expect(result.wasCapped).toBe(true)
      expect(result.cappedZoom).toBe(80) // Always caps to same value
      expect(result.screenPixelRatio).toBeCloseTo(20, 10)
    })
  })

  it('never caps zooms in the safe zone', () => {
    const context = setupContext()
    const testZooms = [1, 10, 20, 40, 60, 75, 80]

    testZooms.forEach((zoom) => {
      const result = capZoomAtThreshold({ ...context, zoom })
      expect(result.wasCapped).toBe(false)
      expect(result.cappedZoom).toBe(zoom) // Returns original zoom
      expect(result.screenPixelRatio).toBeLessThanOrEqual(20)
    })
  })

  it('wouldZoomBeCapped matches capZoomAtThreshold wasCapped', () => {
    const context = setupContext()
    const testZooms = [1, 50, 80, 85, 100, 500]

    testZooms.forEach((zoom) => {
      const fullResult = capZoomAtThreshold({ ...context, zoom })
      const quickCheck = wouldZoomBeCapped({ ...context, zoom })

      expect(quickCheck).toBe(fullResult.wasCapped)
    })
  })

  it('capped zoom always produces threshold ratio', () => {
    const context = setupContext()
    const testZooms = [100, 200, 500, 1000]

    testZooms.forEach((zoom) => {
      const result = capZoomAtThreshold({ ...context, zoom })
      expect(result.screenPixelRatio).toBeCloseTo(context.threshold, 10)
    })
  })
})

describe('edge cases and error handling', () => {
  it('handles zero threshold', () => {
    const result = capZoomAtThreshold({
      zoom: 100,
      threshold: 0,
      magnifierWidth: 500,
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // With threshold 0, any zoom > 0 will be "above" threshold
    // Max zoom will be 0, so everything gets capped to 0
    expect(result.cappedZoom).toBe(0)
    expect(result.wasCapped).toBe(true)
  })

  it('handles very small magnifier', () => {
    const result = capZoomAtThreshold({
      zoom: 1000,
      threshold: 20,
      magnifierWidth: 10, // Tiny magnifier
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // Max zoom = (20 * 2000) / 10 = 4000
    // Zoom 1000 is below this, so not capped
    expect(result.wasCapped).toBe(false)
    expect(result.cappedZoom).toBe(1000)
  })

  it('handles very large magnifier', () => {
    const result = capZoomAtThreshold({
      zoom: 100,
      threshold: 20,
      magnifierWidth: 1900, // Almost full width
      viewBoxWidth: 2000,
      svgWidth: 2000,
    })

    // Max zoom = (20 * 2000) / 1900 ≈ 21
    // Zoom 100 exceeds this, gets capped
    expect(result.wasCapped).toBe(true)
    expect(result.cappedZoom).toBeCloseTo(21.05, 2)
  })
})
