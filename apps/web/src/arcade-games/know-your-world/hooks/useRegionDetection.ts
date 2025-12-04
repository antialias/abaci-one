/**
 * Region Detection Hook
 *
 * Detects which regions are near the cursor using bounding box overlap.
 * Uses isPointInFill() to determine which region is directly under the cursor.
 *
 * Returns information about detected regions including:
 * - Which regions overlap with the detection box (using bounding box)
 * - Which region is directly under the cursor (using isPointInFill)
 * - Size information for adaptive cursor dampening
 * - Whether there are small regions requiring magnifier zoom
 */

import { useCallback, useRef, useEffect, type RefObject } from 'react'
import type { MapData } from '../types'

export interface DetectionBox {
  left: number
  right: number
  top: number
  bottom: number
  size: number
}

export interface DetectedRegion {
  id: string
  pixelWidth: number
  pixelHeight: number
  pixelArea: number
  isVerySmall: boolean
  screenSize: number
}

export interface RegionDetectionResult {
  /** Regions detected in the detection box, sorted by size (smallest first) */
  detectedRegions: DetectedRegion[]
  /** The region directly under the cursor (closest to center) */
  regionUnderCursor: string | null
  /** Area of the region under cursor */
  regionUnderCursorArea: number
  /** Total number of regions in detection box */
  regionsInBox: number
  /** Whether at least one small region was detected */
  hasSmallRegion: boolean
  /** Smallest detected region size (for cursor dampening) */
  detectedSmallestSize: number
  /** Total area of all detected regions */
  totalRegionArea: number
}

export interface UseRegionDetectionOptions {
  /** The SVG element containing the regions */
  svgRef: RefObject<SVGSVGElement>
  /** The container element (for coordinate conversion) */
  containerRef: RefObject<HTMLDivElement>
  /** Map data containing regions */
  mapData: MapData
  /** Size of the detection box (default: 50px) */
  detectionBoxSize?: number
  /** Threshold for considering a region "very small" (default: 15px) */
  smallRegionThreshold?: number
  /** Area threshold for small regions (default: 200px²) */
  smallRegionAreaThreshold?: number
  /** Cache of pre-computed sizes for multi-piece regions (mainland only) */
  largestPieceSizesCache?: Map<string, { width: number; height: number }>
  /** Regions that have been found - excluded from zoom level calculations */
  regionsFound?: string[]
}

export interface UseRegionDetectionReturn {
  /** Detect regions at the given cursor position */
  detectRegions: (cursorX: number, cursorY: number) => RegionDetectionResult
  // Note: hoveredRegion and setHoveredRegion were removed.
  // The interaction state machine is now authoritative for hovered region state.
  // Consumers should use interaction.hoveredRegionId instead.
}

/**
 * Custom hook for detecting regions near the cursor.
 *
 * This hook provides region detection logic for the magnifier:
 * - Detects regions within a box around the cursor
 * - Identifies the region directly under the cursor
 * - Sorts regions by size (smallest first)
 * - Tracks region sizes for adaptive behaviors
 *
 * @param options - Configuration options
 * @returns Region detection methods and state
 */
export function useRegionDetection(options: UseRegionDetectionOptions): UseRegionDetectionReturn {
  const {
    svgRef,
    containerRef,
    mapData,
    detectionBoxSize = 50,
    smallRegionThreshold = 15,
    smallRegionAreaThreshold = 200,
    largestPieceSizesCache,
    regionsFound = [],
  } = options

  // Cache path elements to avoid repeated querySelector calls
  const pathElementCache = useRef<Map<string, SVGGeometryElement>>(new Map())

  // Populate path element cache when SVG is available
  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement) return

    pathElementCache.current.clear()
    for (const region of mapData.regions) {
      const path = svgElement.querySelector(`path[data-region-id="${region.id}"]`)
      if (path && path instanceof SVGGeometryElement) {
        pathElementCache.current.set(region.id, path)
      }
    }
  }, [svgRef, mapData])

  /**
   * Detect regions at the given cursor position.
   *
   * Returns information about all regions in the detection box,
   * including which region is under the cursor and size metrics.
   */
  const detectRegions = useCallback(
    (cursorX: number, cursorY: number): RegionDetectionResult => {
      const svgElement = svgRef.current
      const containerElement = containerRef.current

      if (!svgElement || !containerElement) {
        return {
          detectedRegions: [],
          regionUnderCursor: null,
          regionUnderCursorArea: 0,
          regionsInBox: 0,
          hasSmallRegion: false,
          detectedSmallestSize: Infinity,
          totalRegionArea: 0,
        }
      }

      const containerRect = containerElement.getBoundingClientRect()
      const halfBox = detectionBoxSize / 2

      // Convert cursor position to client coordinates
      const cursorClientX = containerRect.left + cursorX
      const cursorClientY = containerRect.top + cursorY

      // Detection box bounds
      const boxLeft = cursorClientX - halfBox
      const boxRight = cursorClientX + halfBox
      const boxTop = cursorClientY - halfBox
      const boxBottom = cursorClientY + halfBox

      // Track detected regions
      const detected: DetectedRegion[] = []
      let regionUnderCursor: string | null = null
      let regionUnderCursorArea = 0
      let smallestDistanceToCenter = Infinity
      let hasSmallRegion = false
      let totalRegionArea = 0
      let detectedSmallestSize = Infinity

      // Get SVG transformation for converting region centers to screen coords
      const screenCTM = svgElement.getScreenCTM()
      if (!screenCTM) {
        return {
          detectedRegions: [],
          regionUnderCursor: null,
          regionUnderCursorArea: 0,
          regionsInBox: 0,
          hasSmallRegion: false,
          detectedSmallestSize: Infinity,
          totalRegionArea: 0,
        }
      }

      mapData.regions.forEach((region) => {
        // Get cached path element (populated in useEffect)
        const regionPath = pathElementCache.current.get(region.id)
        if (!regionPath) return

        const pathRect = regionPath.getBoundingClientRect()

        // Check if bounding box overlaps with detection box
        // This is efficient and works correctly for regions of all sizes
        // (unlike center-distance checks which fail for large regions like Russia)
        const regionLeft = pathRect.left
        const regionRight = pathRect.right
        const regionTop = pathRect.top
        const regionBottom = pathRect.bottom

        const boundingBoxOverlaps =
          regionLeft < boxRight &&
          regionRight > boxLeft &&
          regionTop < boxBottom &&
          regionBottom > boxTop

        if (!boundingBoxOverlaps) {
          // Bounding box doesn't overlap, so actual path definitely doesn't
          return
        }

        // SIMPLE AND FAST: Use bounding box overlap for detection
        // If bounding box overlaps, the region is detected
        const overlaps = boundingBoxOverlaps

        // Use the screenCTM we already got at the top (guaranteed non-null)
        const inverseMatrix = screenCTM.inverse()

        // Check if cursor point is inside the actual region path (for "region under cursor")
        let svgPoint = svgElement.createSVGPoint()
        svgPoint.x = cursorClientX
        svgPoint.y = cursorClientY
        svgPoint = svgPoint.matrixTransform(inverseMatrix)
        const cursorInRegion = regionPath.isPointInFill(svgPoint)

        // If cursor is inside region, track it as region under cursor
        if (cursorInRegion) {
          // Calculate distance from cursor to region center (using bounding box center as approximation)
          const regionCenterX = (regionLeft + regionRight) / 2
          const regionCenterY = (regionTop + regionBottom) / 2
          const distanceToCenter = Math.sqrt(
            (cursorClientX - regionCenterX) ** 2 + (cursorClientY - regionCenterY) ** 2
          )

          if (distanceToCenter < smallestDistanceToCenter) {
            smallestDistanceToCenter = distanceToCenter
            regionUnderCursor = region.id
            regionUnderCursorArea = pathRect.width * pathRect.height
          }
        }

        // If detection box overlaps with actual path geometry, add to detected regions
        if (overlaps) {
          // Use cached size for multi-piece regions (mainland only, not full bounding box)
          const cachedSize = largestPieceSizesCache?.get(region.id)
          const pixelWidth = cachedSize?.width ?? pathRect.width
          const pixelHeight = cachedSize?.height ?? pathRect.height
          const pixelArea = pixelWidth * pixelHeight
          const isVerySmall =
            pixelWidth < smallRegionThreshold ||
            pixelHeight < smallRegionThreshold ||
            pixelArea < smallRegionAreaThreshold

          const screenSize = Math.min(pixelWidth, pixelHeight)

          // Only count unfound regions toward zoom calculations
          // Found regions shouldn't influence hasSmallRegion or detectedSmallestSize
          const isFound = regionsFound.includes(region.id)
          if (!isFound) {
            if (isVerySmall) {
              hasSmallRegion = true
            }
            totalRegionArea += pixelArea
            detectedSmallestSize = Math.min(detectedSmallestSize, screenSize)
          }

          detected.push({
            id: region.id,
            pixelWidth,
            pixelHeight,
            pixelArea,
            isVerySmall,
            screenSize,
          })
        }
      })

      // Sort detected regions by size (smallest first)
      detected.sort((a, b) => a.screenSize - b.screenSize)

      return {
        detectedRegions: detected,
        regionUnderCursor,
        regionUnderCursorArea,
        regionsInBox: detected.length,
        hasSmallRegion,
        detectedSmallestSize,
        totalRegionArea,
      }
    },
    [
      svgRef,
      containerRef,
      mapData,
      detectionBoxSize,
      smallRegionThreshold,
      smallRegionAreaThreshold,
      largestPieceSizesCache,
      regionsFound,
    ]
  )

  return {
    detectRegions,
  }
}
