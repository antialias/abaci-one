/**
 * Region Detection Hook
 *
 * Detects which regions are near the cursor using a detection box.
 * Returns information about detected regions including:
 * - Which regions overlap with the detection box
 * - Which region is directly under the cursor
 * - Size information for adaptive cursor dampening
 * - Whether there are small regions requiring magnifier zoom
 */

import { useState, useCallback, type RefObject } from 'react'
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
}

export interface UseRegionDetectionReturn {
  /** Detect regions at the given cursor position */
  detectRegions: (cursorX: number, cursorY: number) => RegionDetectionResult
  /** Current hovered region */
  hoveredRegion: string | null
  /** Set the hovered region */
  setHoveredRegion: (regionId: string | null) => void
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
  } = options

  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)

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

      mapData.regions.forEach((region) => {
        const regionPath = svgElement.querySelector(`path[data-region-id="${region.id}"]`)
        if (!regionPath) return

        const pathRect = regionPath.getBoundingClientRect()

        const regionLeft = pathRect.left
        const regionRight = pathRect.right
        const regionTop = pathRect.top
        const regionBottom = pathRect.bottom

        // Check if region overlaps with detection box
        const overlaps =
          regionLeft < boxRight &&
          regionRight > boxLeft &&
          regionTop < boxBottom &&
          regionBottom > boxTop

        // Check if cursor is directly over this region
        const cursorInRegion =
          cursorClientX >= regionLeft &&
          cursorClientX <= regionRight &&
          cursorClientY >= regionTop &&
          cursorClientY <= regionBottom

        if (cursorInRegion) {
          // Calculate distance from cursor to region center
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

        if (overlaps) {
          const pixelWidth = pathRect.width
          const pixelHeight = pathRect.height
          const pixelArea = pixelWidth * pixelHeight
          const isVerySmall =
            pixelWidth < smallRegionThreshold ||
            pixelHeight < smallRegionThreshold ||
            pixelArea < smallRegionAreaThreshold

          if (isVerySmall) {
            hasSmallRegion = true
          }

          const screenSize = Math.min(pixelWidth, pixelHeight)
          totalRegionArea += pixelArea
          detectedSmallestSize = Math.min(detectedSmallestSize, screenSize)

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
    ]
  )

  return {
    detectRegions,
    hoveredRegion,
    setHoveredRegion,
  }
}
