/**
 * Region Detection Hook
 *
 * Detects which regions are near the cursor using actual SVG path geometry.
 * Uses isPointInFill() to test if sample points within the detection box
 * intersect with the actual region shapes (not just bounding boxes).
 *
 * Returns information about detected regions including:
 * - Which regions overlap with the detection box (using actual geometry)
 * - Which region is directly under the cursor (using actual geometry)
 * - Size information for adaptive cursor dampening
 * - Whether there are small regions requiring magnifier zoom
 *
 * CRITICAL: All detection uses SVG path geometry via isPointInFill(), not
 * bounding boxes. This prevents false positives from irregularly shaped regions.
 */

import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'
import type { MapData } from '../types'
import { Polygon, Box, point as Point } from '@flatten-js/core'

/**
 * Sample points along an SVG path element to create a Polygon for geometric operations.
 * Uses SVG's native getPointAtLength() to sample the actual path geometry.
 */
function pathToPolygon(pathElement: SVGGeometryElement, samplesCount = 50): Polygon {
  const pathLength = pathElement.getTotalLength()
  const points: Array<[number, number]> = []

  // Sample points evenly along the path
  for (let i = 0; i <= samplesCount; i++) {
    const distance = (pathLength * i) / samplesCount
    const pt = pathElement.getPointAtLength(distance)
    points.push([pt.x, pt.y])
  }

  // Create polygon from points
  return new Polygon(points.map(([x, y]) => Point(x, y)))
}

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

  // Cache polygons to avoid expensive recomputation on every mouse move
  const polygonCache = useRef<Map<string, Polygon>>(new Map())

  // Clear cache when map data changes
  useEffect(() => {
    polygonCache.current.clear()
  }, [mapData])

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

      const viewBoxParts = mapData.viewBox.split(' ').map(Number)
      const viewBoxX = viewBoxParts[0] || 0
      const viewBoxY = viewBoxParts[1] || 0

      mapData.regions.forEach((region) => {
        // PERFORMANCE: Quick distance check using pre-computed center
        // This avoids expensive DOM queries for regions far from cursor
        // Region center is in SVG coordinates, convert to screen coords
        const svgCenter = svgElement.createSVGPoint()
        svgCenter.x = region.center[0]
        svgCenter.y = region.center[1]
        const screenCenter = svgCenter.matrixTransform(screenCTM)

        // Calculate rough distance from cursor to region center
        const dx = screenCenter.x - cursorClientX
        const dy = screenCenter.y - cursorClientY
        const distanceSquared = dx * dx + dy * dy

        // Skip regions whose centers are far from the detection box
        // Use generous threshold to avoid false negatives (detection box is 50px, so check 150px)
        const MAX_DISTANCE = 150
        if (distanceSquared > MAX_DISTANCE * MAX_DISTANCE) {
          return // Region is definitely too far away
        }

        // Region is close enough - now do proper DOM-based checks
        const regionPath = svgElement.querySelector(`path[data-region-id="${region.id}"]`)
        if (!regionPath || !(regionPath instanceof SVGGeometryElement)) return

        const pathRect = regionPath.getBoundingClientRect()

        // CRITICAL: Use actual SVG path geometry, not bounding box
        // Sample multiple points within the detection box to check for intersection
        // This prevents false positives from irregularly shaped regions

        // Second check: does bounding box overlap? (fast rejection)
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

        // Bounding box overlaps - now check actual path geometry using flatten-js
        let overlaps = false
        let cursorInRegion = false

        // Get the transformation matrix to convert screen coordinates to SVG coordinates
        const screenCTM = svgElement.getScreenCTM()
        if (!screenCTM) {
          // Fallback to bounding box if we can't get coordinate transform
          overlaps = true
          cursorInRegion =
            cursorClientX >= regionLeft &&
            cursorClientX <= regionRight &&
            cursorClientY >= regionTop &&
            cursorClientY <= regionBottom
        } else {
          const inverseMatrix = screenCTM.inverse()

          // Check if cursor point is inside the actual region path
          let svgPoint = svgElement.createSVGPoint()
          svgPoint.x = cursorClientX
          svgPoint.y = cursorClientY
          svgPoint = svgPoint.matrixTransform(inverseMatrix)
          cursorInRegion = regionPath.isPointInFill(svgPoint)

          // For overlap detection, use flatten-js for precise geometric intersection
          try {
            // Get or create cached polygon for this region
            let regionPolygon = polygonCache.current.get(region.id)
            if (!regionPolygon) {
              regionPolygon = pathToPolygon(regionPath)
              polygonCache.current.set(region.id, regionPolygon)
            }

            // Convert detection box to SVG coordinates
            const boxTopLeft = svgElement.createSVGPoint()
            boxTopLeft.x = boxLeft
            boxTopLeft.y = boxTop
            const boxBottomRight = svgElement.createSVGPoint()
            boxBottomRight.x = boxRight
            boxBottomRight.y = boxBottom

            const svgTopLeft = boxTopLeft.matrixTransform(inverseMatrix)
            const svgBottomRight = boxBottomRight.matrixTransform(inverseMatrix)

            // Create detection box in SVG coordinates
            const detectionBox = new Box(
              Math.min(svgTopLeft.x, svgBottomRight.x),
              Math.min(svgTopLeft.y, svgBottomRight.y),
              Math.max(svgTopLeft.x, svgBottomRight.x),
              Math.max(svgTopLeft.y, svgBottomRight.y)
            )

            // Check for intersection or containment
            const intersects = regionPolygon.intersect(detectionBox).length > 0
            const boxContainsRegion = detectionBox.contains(regionPolygon.box)

            overlaps = intersects || boxContainsRegion
          } catch (error) {
            // If flatten-js fails (e.g., complex path), fall back to point sampling
            console.warn('flatten-js intersection failed, using fallback:', error)

            // Fallback: check 9 strategic points
            const testPoints = [
              { x: boxLeft, y: boxTop },
              { x: boxRight, y: boxTop },
              { x: boxLeft, y: boxBottom },
              { x: boxRight, y: boxBottom },
              { x: cursorClientX, y: cursorClientY },
              { x: (boxLeft + boxRight) / 2, y: boxTop },
              { x: (boxLeft + boxRight) / 2, y: boxBottom },
              { x: boxLeft, y: (boxTop + boxBottom) / 2 },
              { x: boxRight, y: (boxTop + boxBottom) / 2 },
            ]

            for (const point of testPoints) {
              const pt = svgElement.createSVGPoint()
              pt.x = point.x
              pt.y = point.y
              const svgPt = pt.matrixTransform(inverseMatrix)
              if (regionPath.isPointInFill(svgPt)) {
                overlaps = true
                break
              }
            }
          }
        }

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
