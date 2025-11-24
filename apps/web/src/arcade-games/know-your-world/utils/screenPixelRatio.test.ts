import { describe, it, expect } from 'vitest'
import {
  calculateScreenPixelRatio,
  isAboveThreshold,
  calculateMaxZoomAtThreshold,
  createZoomContext,
} from './screenPixelRatio'

describe('calculateScreenPixelRatio', () => {
  it('calculates screen pixel ratio correctly', () => {
    const ratio = calculateScreenPixelRatio({
      magnifierWidth: 500, // Magnifier is 500px wide
      viewBoxWidth: 1000, // SVG viewBox is 1000 units wide
      svgWidth: 2000, // SVG is rendered at 2000px wide
      zoom: 50, // 50x zoom
    })

    // Expected: (1000/2000) * (500 / (1000/50))
    // = 0.5 * (500 / 20)
    // = 0.5 * 25
    // = 12.5 px/px
    expect(ratio).toBe(12.5)
  })

  it('handles 1x zoom (no magnification)', () => {
    const ratio = calculateScreenPixelRatio({
      magnifierWidth: 400,
      viewBoxWidth: 1000,
      svgWidth: 1000,
      zoom: 1,
    })

    // At 1x zoom, magnifier shows entire viewBox
    // = (1000/1000) * (400 / (1000/1))
    // = 1 * (400 / 1000)
    // = 0.4 px/px
    expect(ratio).toBe(0.4)
  })

  it('handles high zoom (1000x)', () => {
    const ratio = calculateScreenPixelRatio({
      magnifierWidth: 500,
      viewBoxWidth: 1000,
      svgWidth: 2000,
      zoom: 1000,
    })

    // = (1000/2000) * (500 / (1000/1000))
    // = 0.5 * (500 / 1)
    // = 0.5 * 500
    // = 250 px/px
    expect(ratio).toBe(250)
  })

  it('handles different SVG scaling', () => {
    const ratio = calculateScreenPixelRatio({
      magnifierWidth: 300,
      viewBoxWidth: 2000,
      svgWidth: 1000, // SVG rendered at half its viewBox size
      zoom: 10,
    })

    // = (2000/1000) * (300 / (2000/10))
    // = 2 * (300 / 200)
    // = 2 * 1.5
    // = 3 px/px
    expect(ratio).toBe(3)
  })
})

describe('isAboveThreshold', () => {
  it('returns true when ratio exceeds threshold', () => {
    expect(isAboveThreshold(25, 20)).toBe(true)
    expect(isAboveThreshold(20.1, 20)).toBe(true)
    expect(isAboveThreshold(100, 20)).toBe(true)
  })

  it('returns false when ratio equals threshold', () => {
    expect(isAboveThreshold(20, 20)).toBe(false)
  })

  it('returns false when ratio is below threshold', () => {
    expect(isAboveThreshold(19.9, 20)).toBe(false)
    expect(isAboveThreshold(10, 20)).toBe(false)
    expect(isAboveThreshold(0.1, 20)).toBe(false)
  })

  it('handles edge cases', () => {
    expect(isAboveThreshold(0, 20)).toBe(false)
    expect(isAboveThreshold(0.0001, 0)).toBe(true)
  })
})

describe('calculateMaxZoomAtThreshold', () => {
  it('calculates max zoom to hit exact threshold', () => {
    const maxZoom = calculateMaxZoomAtThreshold(
      20, // threshold px/px
      500, // magnifierWidth
      2000 // svgWidth
    )

    // At this zoom, ratio should equal threshold
    // viewBoxWidth = svgWidth = 2000 (for this formula)
    // ratio = (viewBoxWidth/svgWidth) * (magnifierWidth / (viewBoxWidth/zoom))
    // 20 = (2000/2000) * (500 / (2000/zoom))
    // 20 = 1 * (500 / (2000/zoom))
    // 20 = 500 * zoom / 2000
    // zoom = 20 * 2000 / 500 = 80
    expect(maxZoom).toBe(80)
  })

  it('calculates max zoom for lower threshold', () => {
    const maxZoom = calculateMaxZoomAtThreshold(
      10, // threshold px/px
      400, // magnifierWidth
      1000 // svgWidth
    )

    // 10 = (400 * zoom) / 1000
    // zoom = 10 * 1000 / 400 = 25
    expect(maxZoom).toBe(25)
  })

  it('calculates max zoom for different magnifier sizes', () => {
    const maxZoom1 = calculateMaxZoomAtThreshold(20, 500, 2000)
    const maxZoom2 = calculateMaxZoomAtThreshold(20, 1000, 2000)

    // Larger magnifier = higher max zoom for same threshold
    expect(maxZoom2).toBeGreaterThan(maxZoom1)
    expect(maxZoom2).toBe(160) // double the magnifier width = double the zoom
  })

  it('handles small magnifier widths', () => {
    const maxZoom = calculateMaxZoomAtThreshold(20, 100, 2000)

    // 20 = (100 * zoom) / 2000
    // zoom = 20 * 2000 / 100 = 400
    expect(maxZoom).toBe(400)
  })
})

describe('createZoomContext', () => {
  it('creates zoom context from DOM elements', () => {
    // Mock DOM elements
    const container = {
      getBoundingClientRect: () => ({
        width: 1000,
        height: 500,
      }),
    } as HTMLDivElement

    const svg = {
      getBoundingClientRect: () => ({
        width: 2000,
        height: 1000,
      }),
    } as SVGSVGElement

    const context = createZoomContext({
      containerElement: container,
      svgElement: svg,
      viewBox: '0 0 2000 1000',
      zoom: 50,
    })

    expect(context).toEqual({
      magnifierWidth: 500, // 1000 * 0.5
      viewBoxWidth: 2000,
      svgWidth: 2000,
      zoom: 50,
    })
  })

  it('handles different viewBox formats', () => {
    const container = {
      getBoundingClientRect: () => ({ width: 800, height: 400 }),
    } as HTMLDivElement

    const svg = {
      getBoundingClientRect: () => ({ width: 1600, height: 800 }),
    } as SVGSVGElement

    const context = createZoomContext({
      containerElement: container,
      svgElement: svg,
      viewBox: '100 200 1500 750', // x y width height
      zoom: 10,
    })

    expect(context.viewBoxWidth).toBe(1500)
    expect(context.magnifierWidth).toBe(400) // 800 * 0.5
  })

  it('returns null for invalid viewBox', () => {
    const container = {
      getBoundingClientRect: () => ({ width: 1000, height: 500 }),
    } as HTMLDivElement

    const svg = {
      getBoundingClientRect: () => ({ width: 2000, height: 1000 }),
    } as SVGSVGElement

    const context = createZoomContext({
      containerElement: container,
      svgElement: svg,
      viewBox: 'invalid',
      zoom: 50,
    })

    expect(context).toBeNull()
  })

  it('returns null for missing elements', () => {
    const context = createZoomContext({
      containerElement: null,
      svgElement: null,
      viewBox: '0 0 1000 500',
      zoom: 50,
    })

    expect(context).toBeNull()
  })
})

describe('integration: ratio to zoom calculations', () => {
  it('verifies max zoom produces exact threshold ratio', () => {
    const threshold = 20
    const magnifierWidth = 500
    const svgWidth = 2000
    const viewBoxWidth = 2000

    // Calculate max zoom for this threshold
    const maxZoom = calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgWidth)

    // Verify that this zoom produces the threshold ratio
    const ratio = calculateScreenPixelRatio({
      magnifierWidth,
      viewBoxWidth,
      svgWidth,
      zoom: maxZoom,
    })

    expect(ratio).toBeCloseTo(threshold, 10)
  })

  it('verifies zooms above max are above threshold', () => {
    const threshold = 20
    const magnifierWidth = 500
    const svgWidth = 2000
    const viewBoxWidth = 2000

    const maxZoom = calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgWidth)

    // Test zoom 10% higher
    const higherZoom = maxZoom * 1.1
    const ratio = calculateScreenPixelRatio({
      magnifierWidth,
      viewBoxWidth,
      svgWidth,
      zoom: higherZoom,
    })

    expect(isAboveThreshold(ratio, threshold)).toBe(true)
  })

  it('verifies zooms below max are below threshold', () => {
    const threshold = 20
    const magnifierWidth = 500
    const svgWidth = 2000
    const viewBoxWidth = 2000

    const maxZoom = calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgWidth)

    // Test zoom 10% lower
    const lowerZoom = maxZoom * 0.9
    const ratio = calculateScreenPixelRatio({
      magnifierWidth,
      viewBoxWidth,
      svgWidth,
      zoom: lowerZoom,
    })

    expect(isAboveThreshold(ratio, threshold)).toBe(false)
  })
})
