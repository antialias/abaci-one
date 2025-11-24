import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateAdaptiveThresholds,
  clampViewportToMapBounds,
  isRegionInViewport,
  findOptimalZoom,
  type AdaptiveZoomSearchContext,
} from './adaptiveZoomSearch'
import type { MapData } from '../types'

describe('calculateAdaptiveThresholds', () => {
  it('returns strict thresholds for sub-pixel regions', () => {
    const thresholds = calculateAdaptiveThresholds(0.08) // Gibraltar
    expect(thresholds.min).toBe(0.02) // 2%
    expect(thresholds.max).toBe(0.08) // 8%
  })

  it('returns relaxed thresholds for tiny regions', () => {
    const thresholds = calculateAdaptiveThresholds(3)
    expect(thresholds.min).toBe(0.05) // 5%
    expect(thresholds.max).toBe(0.15) // 15%
  })

  it('returns normal thresholds for small regions', () => {
    const thresholds = calculateAdaptiveThresholds(10)
    expect(thresholds.min).toBe(0.1) // 10%
    expect(thresholds.max).toBe(0.25) // 25%
  })

  it('handles boundary cases', () => {
    expect(calculateAdaptiveThresholds(0.99)).toEqual({ min: 0.02, max: 0.08 })
    expect(calculateAdaptiveThresholds(1)).toEqual({ min: 0.05, max: 0.15 })
    expect(calculateAdaptiveThresholds(4.99)).toEqual({ min: 0.05, max: 0.15 })
    expect(calculateAdaptiveThresholds(5)).toEqual({ min: 0.1, max: 0.25 })
  })
})

describe('clampViewportToMapBounds', () => {
  const mapBounds = {
    left: 0,
    right: 1000,
    top: 0,
    bottom: 500,
  }

  it('does not clamp viewport fully inside bounds', () => {
    const viewport = {
      left: 100,
      right: 200,
      top: 50,
      bottom: 150,
    }

    const result = clampViewportToMapBounds(viewport, mapBounds)

    expect(result).toEqual({ ...viewport, wasClamped: false })
  })

  it('clamps viewport extending beyond left edge', () => {
    const viewport = {
      left: -50,
      right: 50, // 100 units wide
      top: 50,
      bottom: 150,
    }

    const result = clampViewportToMapBounds(viewport, mapBounds)

    expect(result.left).toBe(0) // Shifted right by 50
    expect(result.right).toBe(100) // Shifted right by 50
    expect(result.wasClamped).toBe(true)
  })

  it('clamps viewport extending beyond right edge', () => {
    const viewport = {
      left: 950,
      right: 1050, // Extends 50 beyond right edge
      top: 50,
      bottom: 150,
    }

    const result = clampViewportToMapBounds(viewport, mapBounds)

    expect(result.left).toBe(900) // Shifted left by 50
    expect(result.right).toBe(1000) // Shifted left by 50
    expect(result.wasClamped).toBe(true)
  })

  it('clamps viewport extending beyond top edge', () => {
    const viewport = {
      left: 100,
      right: 200,
      top: -25,
      bottom: 75, // 100 units tall
    }

    const result = clampViewportToMapBounds(viewport, mapBounds)

    expect(result.top).toBe(0) // Shifted down by 25
    expect(result.bottom).toBe(100) // Shifted down by 25
    expect(result.wasClamped).toBe(true)
  })

  it('clamps viewport extending beyond bottom edge', () => {
    const viewport = {
      left: 100,
      right: 200,
      top: 450,
      bottom: 550, // Extends 50 beyond bottom edge
    }

    const result = clampViewportToMapBounds(viewport, mapBounds)

    expect(result.top).toBe(400) // Shifted up by 50
    expect(result.bottom).toBe(500) // Shifted up by 50
    expect(result.wasClamped).toBe(true)
  })

  it('clamps viewport extending beyond multiple edges', () => {
    const viewport = {
      left: -10,
      right: 90,
      top: -20,
      bottom: 80,
    }

    const result = clampViewportToMapBounds(viewport, mapBounds)

    // Should shift right by 10 and down by 20
    expect(result.left).toBe(0)
    expect(result.right).toBe(100)
    expect(result.top).toBe(0)
    expect(result.bottom).toBe(100)
    expect(result.wasClamped).toBe(true)
  })
})

describe('isRegionInViewport', () => {
  const viewport = {
    left: 100,
    right: 200,
    top: 50,
    bottom: 150,
  }

  it('detects region fully inside viewport', () => {
    const region = {
      left: 110,
      right: 190,
      top: 60,
      bottom: 140,
    }

    expect(isRegionInViewport(region, viewport)).toBe(true)
  })

  it('detects region overlapping viewport', () => {
    const region = {
      left: 50, // Extends left of viewport
      right: 150, // Inside viewport
      top: 60,
      bottom: 140,
    }

    expect(isRegionInViewport(region, viewport)).toBe(true)
  })

  it('detects region completely outside viewport (left)', () => {
    const region = {
      left: 0,
      right: 50, // Ends before viewport starts
      top: 60,
      bottom: 140,
    }

    expect(isRegionInViewport(region, viewport)).toBe(false)
  })

  it('detects region completely outside viewport (right)', () => {
    const region = {
      left: 250, // Starts after viewport ends
      right: 300,
      top: 60,
      bottom: 140,
    }

    expect(isRegionInViewport(region, viewport)).toBe(false)
  })

  it('detects region completely outside viewport (above)', () => {
    const region = {
      left: 110,
      right: 190,
      top: 0,
      bottom: 40, // Ends before viewport starts
    }

    expect(isRegionInViewport(region, viewport)).toBe(false)
  })

  it('detects region completely outside viewport (below)', () => {
    const region = {
      left: 110,
      right: 190,
      top: 200, // Starts after viewport ends
      bottom: 300,
    }

    expect(isRegionInViewport(region, viewport)).toBe(false)
  })

  it('detects edge-touching regions as overlapping', () => {
    const region = {
      left: 200, // Touches right edge
      right: 250,
      top: 60,
      bottom: 140,
    }

    // Touches but doesn't overlap (left === right, so no overlap)
    expect(isRegionInViewport(region, viewport)).toBe(false)
  })
})

describe('findOptimalZoom', () => {
  // Create minimal mocks for testing
  const createMockContext = (overrides: Partial<AdaptiveZoomSearchContext> = {}): AdaptiveZoomSearchContext => {
    const mockMapData: MapData = {
      viewBox: '0 0 1000 500',
      regions: [
        { id: 'region1', name: 'Region 1', d: 'M 100 100 L 150 100 L 150 150 L 100 150 Z' },
        { id: 'region2', name: 'Region 2', d: 'M 200 200 L 300 200 L 300 300 L 200 300 Z' },
      ],
    }

    const mockSvgElement = {
      querySelector: vi.fn((selector: string) => {
        const regionId = selector.match(/data-region-id="([^"]+)"/)?.[1]

        return {
          getBoundingClientRect: () => {
            // Return different sizes for different regions
            if (regionId === 'region1') {
              return { width: 5, height: 5, left: 100, top: 100, right: 105, bottom: 105 }
            }
            if (regionId === 'region2') {
              return { width: 20, height: 20, left: 200, top: 200, right: 220, bottom: 220 }
            }
            return { width: 10, height: 10, left: 0, top: 0, right: 10, bottom: 10 }
          },
        }
      }),
    } as unknown as SVGSVGElement

    const mockContainerRect = {
      width: 800,
      height: 400,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
    } as DOMRect

    const mockSvgRect = {
      width: 2000,
      height: 1000,
      left: 0,
      top: 0,
      right: 2000,
      bottom: 1000,
    } as DOMRect

    return {
      detectedRegions: ['region1'],
      detectedSmallestSize: 5,
      cursorX: 400,
      cursorY: 200,
      containerRect: mockContainerRect,
      svgRect: mockSvgRect,
      mapData: mockMapData,
      svgElement: mockSvgElement,
      largestPieceSizesCache: new Map(),
      maxZoom: 1000,
      minZoom: 1,
      zoomStep: 0.9,
      pointerLocked: false,
      ...overrides,
    }
  }

  it('finds optimal zoom for small region', () => {
    const context = createMockContext({
      detectedRegions: ['region1'], // 5px region
      detectedSmallestSize: 5,
    })

    const result = findOptimalZoom(context)

    expect(result.foundGoodZoom).toBe(true)
    expect(result.zoom).toBeGreaterThan(1)
    expect(result.zoom).toBeLessThanOrEqual(1000)
    expect(result.boundingBoxes).toHaveLength(1)
    expect(result.boundingBoxes[0].regionId).toBe('region1')
  })

  it('returns minimum zoom when no good zoom found', () => {
    const context = createMockContext({
      detectedRegions: ['nonexistent'],
      detectedSmallestSize: 5,
    })

    const result = findOptimalZoom(context)

    expect(result.foundGoodZoom).toBe(false)
    expect(result.zoom).toBe(1) // Falls back to minZoom
    expect(result.boundingBoxes).toHaveLength(0)
  })

  it('prefers smaller regions when multiple detected', () => {
    const context = createMockContext({
      detectedRegions: ['region1', 'region2'], // region1 is 5px, region2 is 20px
      detectedSmallestSize: 5,
    })

    const result = findOptimalZoom(context)

    expect(result.foundGoodZoom).toBe(true)
    // Should optimize for region1 (smallest)
    expect(result.boundingBoxes[0].regionId).toBe('region1')
  })

  it('respects maxZoom limit', () => {
    const context = createMockContext({
      maxZoom: 100, // Lower max
      detectedRegions: ['region1'],
      detectedSmallestSize: 5,
    })

    const result = findOptimalZoom(context)

    expect(result.zoom).toBeLessThanOrEqual(100)
  })

  it('respects minZoom limit', () => {
    const context = createMockContext({
      minZoom: 50, // Higher min
      detectedRegions: ['region2'], // Large region
      detectedSmallestSize: 20,
    })

    const result = findOptimalZoom(context)

    expect(result.zoom).toBeGreaterThanOrEqual(50)
  })

  it('uses adaptive thresholds based on region size', () => {
    // Test with sub-pixel region
    const context1 = createMockContext({
      detectedSmallestSize: 0.5, // Sub-pixel
    })

    const result1 = findOptimalZoom(context1)

    // Should accept lower ratios for sub-pixel regions
    expect(result1.foundGoodZoom).toBe(true)

    // Test with normal small region
    const context2 = createMockContext({
      detectedSmallestSize: 10,
    })

    const result2 = findOptimalZoom(context2)

    // Should use standard thresholds
    expect(result2.foundGoodZoom).toBe(true)
  })

  it('uses larger piece size from cache for multi-piece regions', () => {
    const cache = new Map()
    cache.set('region1', { width: 50, height: 50 }) // Override with larger cached size

    const context = createMockContext({
      detectedRegions: ['region1'],
      detectedSmallestSize: 50,
      largestPieceSizesCache: cache,
    })

    const result = findOptimalZoom(context)

    // Should use cached size (50px) instead of queried size (5px)
    expect(result.foundGoodZoom).toBe(true)
    // Zoom should be lower since region appears larger
    expect(result.zoom).toBeLessThan(100) // Arbitrary threshold for this test
  })

  it('logs when pointer locked (for debugging)', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const context = createMockContext({
      pointerLocked: true,
      detectedRegions: ['region1'],
    })

    findOptimalZoom(context)

    // Should have logged adaptive thresholds
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Zoom Search] Adaptive thresholds:'),
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })
})

describe('integration: full zoom search workflow', () => {
  it('finds progressively better zooms as region gets smaller', () => {
    const createContext = (regionSize: number) => {
      const mockSvgElement = {
        querySelector: vi.fn(() => ({
          getBoundingClientRect: () => ({
            width: regionSize,
            height: regionSize,
            left: 100,
            top: 100,
            right: 100 + regionSize,
            bottom: 100 + regionSize,
          }),
        })),
      } as unknown as SVGSVGElement

      return {
        detectedRegions: ['test-region'],
        detectedSmallestSize: regionSize,
        cursorX: 400,
        cursorY: 200,
        containerRect: { width: 800, height: 400, left: 0, top: 0, right: 800, bottom: 400 } as DOMRect,
        svgRect: { width: 2000, height: 1000, left: 0, top: 0, right: 2000, bottom: 1000 } as DOMRect,
        mapData: {
          viewBox: '0 0 1000 500',
          regions: [{ id: 'test-region', name: 'Test', d: 'M 0 0' }],
        },
        svgElement: mockSvgElement,
        largestPieceSizesCache: new Map(),
      } as AdaptiveZoomSearchContext
    }

    // Test with progressively smaller regions
    const result1 = findOptimalZoom(createContext(50)) // Large
    const result2 = findOptimalZoom(createContext(10)) // Medium
    const result3 = findOptimalZoom(createContext(1)) // Small

    // Should find increasing zoom levels for smaller regions
    expect(result1.zoom).toBeLessThan(result2.zoom)
    expect(result2.zoom).toBeLessThan(result3.zoom)
  })
})
