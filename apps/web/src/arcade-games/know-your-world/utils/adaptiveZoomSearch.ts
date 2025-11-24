/**
 * Adaptive Zoom Search
 *
 * This module implements the adaptive zoom search algorithm that finds the
 * optimal zoom level based on detected region sizes. The algorithm starts from
 * maximum zoom and reduces iteratively until a region fits nicely in the magnifier.
 *
 * Key features:
 * - Adaptive acceptance thresholds based on smallest region size
 * - Viewport clamping to map bounds
 * - Region-in-viewport detection
 * - Support for multi-piece regions (uses largest piece for sizing)
 * - Debug bounding box tracking
 */

import type { MapData } from '../types'

export interface AdaptiveZoomSearchContext {
  /** Detected region IDs, sorted by size (smallest first) */
  detectedRegions: string[]
  /** Size of the smallest detected region in pixels */
  detectedSmallestSize: number
  /** Cursor position in container coordinates */
  cursorX: number
  cursorY: number
  /** Container bounding rect */
  containerRect: DOMRect
  /** SVG element bounding rect */
  svgRect: DOMRect
  /** Map data containing regions and viewBox */
  mapData: MapData
  /** SVG element reference for querying region paths */
  svgElement: SVGSVGElement
  /** Cache of largest piece sizes for multi-piece regions */
  largestPieceSizesCache: Map<string, { width: number; height: number }>
  /** Maximum zoom level (default: 1000) */
  maxZoom?: number
  /** Minimum zoom level (default: 1) */
  minZoom?: number
  /** Zoom step multiplier (default: 0.9 = reduce by 10% each iteration) */
  zoomStep?: number
  /** Whether pointer lock is active (for logging) */
  pointerLocked?: boolean
}

export interface BoundingBox {
  regionId: string
  x: number
  y: number
  width: number
  height: number
}

export interface AdaptiveZoomSearchResult {
  /** The optimal zoom level found */
  zoom: number
  /** Whether a good zoom was found (false = using minimum zoom as fallback) */
  foundGoodZoom: boolean
  /** Debug bounding boxes for visualization */
  boundingBoxes: BoundingBox[]
}

/**
 * Calculate adaptive acceptance thresholds based on smallest region size.
 *
 * For ultra-small regions like Gibraltar (0.08px), we need lower acceptance
 * thresholds because even at 1000× zoom they only occupy ~0.02% of the magnifier.
 *
 * @param smallestSize - Smallest detected region size in pixels
 * @returns Min and max acceptable ratios (region size / magnifier size)
 */
export function calculateAdaptiveThresholds(smallestSize: number): {
  min: number
  max: number
} {
  if (smallestSize < 1) {
    // Sub-pixel regions: accept 2-8% of magnifier
    return { min: 0.02, max: 0.08 }
  }
  if (smallestSize < 5) {
    // Tiny regions (1-5px): accept 5-15% of magnifier
    return { min: 0.05, max: 0.15 }
  }
  // Normal small regions: accept 10-25% of magnifier
  return { min: 0.1, max: 0.25 }
}

/**
 * Clamp viewport bounds to map bounds.
 *
 * When the cursor is near the map edge, the magnified viewport may extend beyond
 * the map. This function shifts the viewport to keep it within map bounds.
 *
 * @param viewport - Initial viewport bounds
 * @param mapBounds - Map bounds
 * @returns Clamped viewport bounds
 */
export function clampViewportToMapBounds(
  viewport: { left: number; right: number; top: number; bottom: number },
  mapBounds: { left: number; right: number; top: number; bottom: number }
): { left: number; right: number; top: number; bottom: number; wasClamped: boolean } {
  let { left, right, top, bottom } = viewport
  let wasClamped = false

  // If viewport extends beyond left edge, shift it right
  if (left < mapBounds.left) {
    const shift = mapBounds.left - left
    left += shift
    right += shift
    wasClamped = true
  }

  // If viewport extends beyond right edge, shift it left
  if (right > mapBounds.right) {
    const shift = right - mapBounds.right
    left -= shift
    right -= shift
    wasClamped = true
  }

  // If viewport extends beyond top edge, shift it down
  if (top < mapBounds.top) {
    const shift = mapBounds.top - top
    top += shift
    bottom += shift
    wasClamped = true
  }

  // If viewport extends beyond bottom edge, shift it up
  if (bottom > mapBounds.bottom) {
    const shift = bottom - mapBounds.bottom
    top -= shift
    bottom -= shift
    wasClamped = true
  }

  return { left, right, top, bottom, wasClamped }
}

/**
 * Check if a region overlaps with the viewport.
 *
 * @param regionBounds - Region bounding box in SVG coordinates
 * @param viewport - Viewport bounds in SVG coordinates
 * @returns True if region overlaps viewport
 */
export function isRegionInViewport(
  regionBounds: { left: number; right: number; top: number; bottom: number },
  viewport: { left: number; right: number; top: number; bottom: number }
): boolean {
  return (
    regionBounds.left < viewport.right &&
    regionBounds.right > viewport.left &&
    regionBounds.top < viewport.bottom &&
    regionBounds.bottom > viewport.top
  )
}

/**
 * Find optimal zoom level for the detected regions.
 *
 * Algorithm:
 * 1. Start from MAX_ZOOM and reduce by ZOOM_STEP each iteration
 * 2. For each zoom level, calculate the magnified viewport
 * 3. Clamp viewport to map bounds
 * 4. Check if any detected region is inside viewport and fits nicely
 * 5. "Fits nicely" = region occupies min-max% of magnifier (adaptive thresholds)
 * 6. Accept first zoom level where a region fits
 * 7. If no zoom found, return MIN_ZOOM as fallback
 *
 * @param context - Search context with regions, dimensions, and configuration
 * @returns Optimal zoom level and debug information
 */
export function findOptimalZoom(context: AdaptiveZoomSearchContext): AdaptiveZoomSearchResult {
  const {
    detectedRegions,
    detectedSmallestSize,
    cursorX,
    cursorY,
    containerRect,
    svgRect,
    mapData,
    svgElement,
    largestPieceSizesCache,
    maxZoom = 1000,
    minZoom = 1,
    zoomStep = 0.9,
    pointerLocked = false,
  } = context

  // Calculate adaptive acceptance thresholds
  const thresholds = calculateAdaptiveThresholds(detectedSmallestSize)
  const { min: minAcceptableRatio, max: maxAcceptableRatio } = thresholds

  if (pointerLocked) {
    console.log('[Zoom Search] Adaptive thresholds:', {
      detectedSmallestSize: `${detectedSmallestSize.toFixed(4)}px`,
      minAcceptableRatio: `${(minAcceptableRatio * 100).toFixed(1)}%`,
      maxAcceptableRatio: `${(maxAcceptableRatio * 100).toFixed(1)}%`,
    })
  }

  // Parse viewBox
  const viewBoxParts = mapData.viewBox.split(' ').map(Number)
  const viewBoxX = viewBoxParts[0] || 0
  const viewBoxY = viewBoxParts[1] || 0
  const viewBoxWidth = viewBoxParts[2] || 1000
  const viewBoxHeight = viewBoxParts[3] || 1000

  // Magnifier dimensions
  const magnifierWidth = containerRect.width * 0.5
  const magnifierHeight = magnifierWidth / 2

  // Convert cursor position to SVG coordinates
  const scaleX = viewBoxWidth / svgRect.width
  const scaleY = viewBoxHeight / svgRect.height
  const cursorSvgX = (cursorX - (svgRect.left - containerRect.left)) * scaleX + viewBoxX
  const cursorSvgY = (cursorY - (svgRect.top - containerRect.top)) * scaleY + viewBoxY

  // Map bounds for viewport clamping
  const mapBounds = {
    left: viewBoxX,
    right: viewBoxX + viewBoxWidth,
    top: viewBoxY,
    bottom: viewBoxY + viewBoxHeight,
  }

  // Track bounding boxes for debug visualization
  const boundingBoxes: BoundingBox[] = []

  // Search for optimal zoom
  let optimalZoom = maxZoom
  let foundGoodZoom = false

  for (let testZoom = maxZoom; testZoom >= minZoom; testZoom *= zoomStep) {
    // Calculate the SVG viewport that will be shown in the magnifier at this zoom
    const magnifiedViewBoxWidth = viewBoxWidth / testZoom
    const magnifiedViewBoxHeight = viewBoxHeight / testZoom

    // The viewport is centered on cursor position
    const initialViewport = {
      left: cursorSvgX - magnifiedViewBoxWidth / 2,
      right: cursorSvgX + magnifiedViewBoxWidth / 2,
      top: cursorSvgY - magnifiedViewBoxHeight / 2,
      bottom: cursorSvgY + magnifiedViewBoxHeight / 2,
    }

    // Clamp viewport to stay within map bounds
    const viewport = clampViewportToMapBounds(initialViewport, mapBounds)

    // Check all detected regions to see if any are inside this viewport and fit nicely
    let foundFit = false

    for (const regionId of detectedRegions) {
      const region = mapData.regions.find((r) => r.id === regionId)
      if (!region) continue

      const regionPath = svgElement.querySelector(`path[data-region-id="${regionId}"]`)
      if (!regionPath) continue

      // Use pre-computed largest piece size for multi-piece regions
      let currentWidth: number
      let currentHeight: number

      const cachedSize = largestPieceSizesCache.get(regionId)
      if (cachedSize) {
        // Multi-piece region: use pre-computed largest piece
        currentWidth = cachedSize.width
        currentHeight = cachedSize.height
      } else {
        // Single-piece region: use normal bounding box
        const pathRect = regionPath.getBoundingClientRect()
        currentWidth = pathRect.width
        currentHeight = pathRect.height
      }

      const pathRect = regionPath.getBoundingClientRect()

      // Convert region bounding box to SVG coordinates
      const regionSvgLeft = (pathRect.left - svgRect.left) * scaleX + viewBoxX
      const regionSvgRight = regionSvgLeft + pathRect.width * scaleX
      const regionSvgTop = (pathRect.top - svgRect.top) * scaleY + viewBoxY
      const regionSvgBottom = regionSvgTop + pathRect.height * scaleY

      // Check if region is inside the magnified viewport
      const regionBounds = {
        left: regionSvgLeft,
        right: regionSvgRight,
        top: regionSvgTop,
        bottom: regionSvgBottom,
      }

      if (!isRegionInViewport(regionBounds, viewport)) {
        continue // Skip regions not in viewport
      }

      // Region is in viewport - check if it's a good size
      const magnifiedWidth = currentWidth * testZoom
      const magnifiedHeight = currentHeight * testZoom

      const widthRatio = magnifiedWidth / magnifierWidth
      const heightRatio = magnifiedHeight / magnifierHeight

      // If either dimension is within our adaptive acceptance range, we found a good zoom
      if (
        (widthRatio >= minAcceptableRatio && widthRatio <= maxAcceptableRatio) ||
        (heightRatio >= minAcceptableRatio && heightRatio <= maxAcceptableRatio)
      ) {
        optimalZoom = testZoom
        foundFit = true
        foundGoodZoom = true

        // Log when we accept a zoom
        console.log(
          `[Zoom] ✅ Accepted ${testZoom.toFixed(1)}x for ${regionId} (${currentWidth.toFixed(1)}px × ${currentHeight.toFixed(1)}px)`
        )

        // Save bounding box for this region
        boundingBoxes.push({
          regionId,
          x: regionSvgLeft,
          y: regionSvgTop,
          width: pathRect.width * scaleX,
          height: pathRect.height * scaleY,
        })

        break // Found a good zoom, stop checking regions
      }
    }

    if (foundFit) break // Found a good zoom level, stop searching
  }

  if (!foundGoodZoom) {
    // Didn't find a good zoom - use minimum
    optimalZoom = minZoom
    if (pointerLocked) {
      console.log(`[Zoom Search] ⚠️ No good zoom found, using minimum: ${minZoom}x`)
    }
  }

  return {
    zoom: optimalZoom,
    foundGoodZoom,
    boundingBoxes,
  }
}
