'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import type { MapData, MapRegion } from '../types'
import {
  getRegionColor,
  getRegionStroke,
  getRegionStrokeWidth,
  getLabelTextColor,
  getLabelTextShadow,
} from '../mapColors'
import { forceSimulation, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force'
import { getMapData, getFilteredMapData, filterRegionsByContinent } from '../maps'
import type { ContinentId } from '../continents'

interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  area: number
}

interface MapRendererProps {
  mapData: MapData
  regionsFound: string[]
  currentPrompt: string | null
  difficulty: string // Difficulty level ID
  selectedMap: 'world' | 'usa' // Map ID for calculating excluded regions
  selectedContinent: string // Continent ID for calculating excluded regions
  onRegionClick: (regionId: string, regionName: string) => void
  guessHistory: Array<{
    playerId: string
    regionId: string
    correct: boolean
  }>
  playerMetadata: Record<
    string,
    {
      id: string
      name: string
      emoji: string
      color: string
    }
  >
  pointerLocked: boolean // Whether pointer lock is currently active
  // Force simulation tuning parameters
  forceTuning?: {
    showArrows?: boolean
    centeringStrength?: number
    collisionPadding?: number
    simulationIterations?: number
    useObstacles?: boolean
    obstaclePadding?: number
  }
}

/**
 * Calculate bounding box from SVG path string
 */
function calculateBoundingBox(pathString: string): BoundingBox {
  const numbers = pathString.match(/-?\d+\.?\d*/g)?.map(Number) || []

  if (numbers.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, area: 0 }
  }

  const xCoords: number[] = []
  const yCoords: number[] = []

  for (let i = 0; i < numbers.length; i += 2) {
    xCoords.push(numbers[i])
    if (i + 1 < numbers.length) {
      yCoords.push(numbers[i + 1])
    }
  }

  const minX = Math.min(...xCoords)
  const maxX = Math.max(...xCoords)
  const minY = Math.min(...yCoords)
  const maxY = Math.max(...yCoords)
  const width = maxX - minX
  const height = maxY - minY
  const area = width * height

  return { minX, maxX, minY, maxY, width, height, area }
}

interface RegionLabelPosition {
  regionId: string
  regionName: string
  x: number // pixel position
  y: number // pixel position
  players: string[]
}

export function MapRenderer({
  mapData,
  regionsFound,
  currentPrompt,
  difficulty,
  selectedMap,
  selectedContinent,
  onRegionClick,
  guessHistory,
  playerMetadata,
  pointerLocked,
  forceTuning = {},
}: MapRendererProps) {
  // Extract force tuning parameters with defaults
  const {
    showArrows = false,
    centeringStrength = 2.0,
    collisionPadding = 5,
    simulationIterations = 200,
    useObstacles = true,
    obstaclePadding = 10,
  } = forceTuning
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Calculate excluded regions (regions filtered out by difficulty/continent)
  const excludedRegions = useMemo(() => {
    // Get full unfiltered map data
    const fullMapData = getMapData(selectedMap)
    let allRegions = fullMapData.regions

    // Apply continent filter if world map
    if (selectedMap === 'world' && selectedContinent !== 'all') {
      allRegions = filterRegionsByContinent(allRegions, selectedContinent as ContinentId)
    }

    // Find regions in full data that aren't in filtered data
    const includedRegionIds = new Set(mapData.regions.map((r) => r.id))
    const excluded = allRegions.filter((r) => !includedRegionIds.has(r.id))

    console.log('[MapRenderer] Excluded regions by difficulty:', {
      total: allRegions.length,
      included: includedRegionIds.size,
      excluded: excluded.length,
      excludedNames: excluded.map((r) => r.name),
    })

    return excluded
  }, [mapData, selectedMap, selectedContinent])

  // Create a set of excluded region IDs for quick lookup
  const excludedRegionIds = useMemo(
    () => new Set(excludedRegions.map((r) => r.id)),
    [excludedRegions]
  )
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgDimensions, setSvgDimensions] = useState({ width: 1000, height: 500 })
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [showMagnifier, setShowMagnifier] = useState(false)
  const [targetZoom, setTargetZoom] = useState(10)
  const [targetOpacity, setTargetOpacity] = useState(0)
  const [targetTop, setTargetTop] = useState(20)
  const [targetLeft, setTargetLeft] = useState(20)

  // Cursor position tracking (container-relative coordinates)
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null)
  const lastMoveTimeRef = useRef<number>(Date.now())
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [superZoomActive, setSuperZoomActive] = useState(false)
  const [smallestRegionSize, setSmallestRegionSize] = useState<number>(Infinity)

  // Configuration
  const HOVER_DELAY_MS = 500 // Time to hover before super zoom activates
  const QUICK_MOVE_THRESHOLD = 50 // Pixels per frame - exceeding this cancels super zoom
  const SUPER_ZOOM_MULTIPLIER = 2.5 // Super zoom is 2.5x the normal adaptive zoom

  // Movement speed multiplier based on smallest region size
  // When pointer lock is active, apply this multiplier to movementX/movementY
  // For sub-pixel regions (< 1px): 3% speed (ultra precision)
  // For tiny regions (1-5px): 10% speed (high precision)
  // For small regions (5-15px): 25% speed (moderate precision)
  const getMovementMultiplier = (size: number): number => {
    if (size < 1) return 0.03 // Ultra precision for sub-pixel regions like Gibraltar (0.08px)
    if (size < 5) return 0.1 // High precision for regions like Jersey (0.82px)
    if (size < 15) return 0.25 // Moderate precision for regions like Rhode Island (11px)
    return 1.0 // Normal speed for larger regions
  }

  // Animated spring values for smooth transitions
  // Different fade speeds: fast fade-in (100ms), slow fade-out (1000ms)
  // Position animates with medium speed (300ms)
  const magnifierSpring = useSpring({
    zoom: targetZoom,
    opacity: targetOpacity,
    top: targetTop,
    left: targetLeft,
    config: (key) => {
      if (key === 'opacity') {
        return targetOpacity === 1
          ? { duration: 100 } // Fade in: 0.1 seconds
          : { duration: 1000 } // Fade out: 1 second
      }
      // Position and zoom: medium speed
      return { tension: 200, friction: 25 }
    },
    onChange: (result) => {
      console.log('[Magnifier Spring] Animating:', {
        opacity: result.value.opacity?.toFixed(2),
        top: result.value.top?.toFixed(0),
        left: result.value.left?.toFixed(0),
      })
    },
  })

  const [labelPositions, setLabelPositions] = useState<RegionLabelPosition[]>([])
  const [smallRegionLabelPositions, setSmallRegionLabelPositions] = useState<
    Array<{
      regionId: string
      regionName: string
      isFound: boolean
      labelX: number // pixel position for label
      labelY: number // pixel position for label
      lineStartX: number // pixel position for line start
      lineStartY: number // pixel position for line start
      lineEndX: number // pixel position for line end (region center)
      lineEndY: number // pixel position for line end
    }>
  >([])

  // Measure SVG element to get actual pixel dimensions
  useEffect(() => {
    if (!svgRef.current) return

    const updateDimensions = () => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        setSvgDimensions({ width: rect.width, height: rect.height })
      }
    }

    // Initial measurement
    updateDimensions()

    // Update on window resize
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [mapData.viewBox]) // Re-measure when viewBox changes (continent/map selection)

  // Calculate label positions using ghost elements
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const updateLabelPositions = () => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const positions: RegionLabelPosition[] = []
      const smallPositions: typeof smallRegionLabelPositions = []

      // Parse viewBox for scale calculations
      const viewBoxParts = mapData.viewBox.split(' ').map(Number)
      const viewBoxX = viewBoxParts[0] || 0
      const viewBoxY = viewBoxParts[1] || 0
      const viewBoxWidth = viewBoxParts[2] || 1000
      const viewBoxHeight = viewBoxParts[3] || 1000

      const svgRect = svgRef.current?.getBoundingClientRect()
      if (!svgRect) return

      const scaleX = svgRect.width / viewBoxWidth
      const scaleY = svgRect.height / viewBoxHeight

      // Calculate SVG offset within container (accounts for padding)
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top

      // Collect all regions with their info for force simulation
      interface LabelNode extends SimulationNodeDatum {
        id: string
        name: string
        x: number
        y: number
        targetX: number
        targetY: number
        width: number
        height: number
        isFound: boolean
        isSmall: boolean
        players?: string[]
      }

      const allLabelNodes: LabelNode[] = []

      // Process both included regions and excluded regions for labeling
      ;[...mapData.regions, ...excludedRegions].forEach((region) => {
        // Calculate centroid pixel position directly from SVG coordinates
        // Account for SVG offset within container (padding, etc.)
        const centroidPixelX = (region.center[0] - viewBoxX) * scaleX + svgOffsetX
        const centroidPixelY = (region.center[1] - viewBoxY) * scaleY + svgOffsetY

        const pixelX = centroidPixelX
        const pixelY = centroidPixelY

        // Get the actual region path element to measure its TRUE screen dimensions
        const regionPath = svgRef.current?.querySelector(`path[data-region-id="${region.id}"]`)
        if (!regionPath) return

        const pathRect = regionPath.getBoundingClientRect()
        const pixelWidth = pathRect.width
        const pixelHeight = pathRect.height
        const pixelArea = pathRect.width * pathRect.height

        // Check if this is a small region using ACTUAL screen pixels
        const isSmall = pixelWidth < 10 || pixelHeight < 10 || pixelArea < 100

        // Debug logging for ALL regions to diagnose threshold issues
        console.log(
          `[MapRenderer] ${isSmall ? '🔍 SMALL' : '📍 Regular'}: ${region.name} - ` +
            `W:${pixelWidth.toFixed(1)}px H:${pixelHeight.toFixed(1)}px ` +
            `Area:${pixelArea.toFixed(0)}px² (threshold: 10px)`
        )

        // Collect label nodes for regions that need labels
        // Only show arrow labels for small regions if showArrows flag is enabled
        // Exception: Washington DC always gets arrow label (too small on USA map)
        const isDC = region.id === 'dc'
        const isExcluded = excludedRegionIds.has(region.id)
        // Show label if: region is found, OR region is excluded (pre-found), OR it's small and arrows enabled
        const shouldShowLabel =
          regionsFound.includes(region.id) || isExcluded || (isSmall && (showArrows || isDC))

        if (shouldShowLabel) {
          const players = regionsFound.includes(region.id)
            ? guessHistory
                .filter((guess) => guess.regionId === region.id && guess.correct)
                .map((guess) => guess.playerId)
                .filter((playerId, index, self) => self.indexOf(playerId) === index)
            : undefined

          const labelWidth = region.name.length * 7 + 15
          const labelHeight = isSmall ? 25 : 30

          // Regular found states (non-small) get positioned exactly at centroid
          // Only small regions go through force simulation
          if (isSmall) {
            allLabelNodes.push({
              id: region.id,
              name: region.name,
              x: pixelX, // Start directly on region - will spread out to avoid collisions
              y: pixelY,
              targetX: pixelX, // Anchor point to pull back toward
              targetY: pixelY,
              width: labelWidth,
              height: labelHeight,
              isFound: regionsFound.includes(region.id),
              isSmall,
              players,
            })
          } else {
            // Add directly to positions array - no force simulation
            positions.push({
              regionId: region.id,
              regionName: region.name,
              x: pixelX,
              y: pixelY,
              players: players || [],
            })
          }
        }
      })

      // Add region obstacles to repel labels away from the map itself
      interface ObstacleNode extends SimulationNodeDatum {
        id: string
        x: number
        y: number
        isObstacle: true
        radius: number
      }

      const obstacleNodes: ObstacleNode[] = []

      // Add all regions (including unlabeled ones) as obstacles (if enabled)
      if (useObstacles) {
        mapData.regions.forEach((region) => {
          const ghostElement = svgRef.current?.querySelector(`[data-ghost-region="${region.id}"]`)
          if (!ghostElement) return

          const ghostRect = ghostElement.getBoundingClientRect()
          const pixelX = ghostRect.left - containerRect.left + ghostRect.width / 2
          const pixelY = ghostRect.top - containerRect.top + ghostRect.height / 2

          const regionPath = svgRef.current?.querySelector(`path[data-region-id="${region.id}"]`)
          if (!regionPath) return

          const pathRect = regionPath.getBoundingClientRect()
          const regionRadius = Math.max(pathRect.width, pathRect.height) / 2

          obstacleNodes.push({
            id: `obstacle-${region.id}`,
            isObstacle: true,
            x: pixelX,
            y: pixelY,
            radius: regionRadius + obstaclePadding,
          })
        })
      }

      // Combine labels and obstacles for simulation
      const allNodes = [...allLabelNodes, ...obstacleNodes]

      // Run force simulation to position labels without overlaps
      if (allLabelNodes.length > 0) {
        const simulation = forceSimulation(allNodes)
          .force(
            'collide',
            forceCollide<LabelNode | ObstacleNode>().radius((d) => {
              if ('isObstacle' in d && d.isObstacle) {
                return (d as ObstacleNode).radius
              }
              const label = d as LabelNode
              return Math.max(label.width, label.height) / 2 + collisionPadding
            })
          )
          .force(
            'x',
            forceX<LabelNode | ObstacleNode>((d) => {
              if ('isObstacle' in d && d.isObstacle) return d.x
              return (d as LabelNode).targetX
            }).strength(centeringStrength)
          )
          .force(
            'y',
            forceY<LabelNode | ObstacleNode>((d) => {
              if ('isObstacle' in d && d.isObstacle) return d.y
              return (d as LabelNode).targetY
            }).strength(centeringStrength)
          )
          .stop()

        // Run simulation - labels start on regions and only move as needed
        for (let i = 0; i < simulationIterations; i++) {
          simulation.tick()
        }

        // Helper: Calculate arrow start point on label edge closest to region
        const getArrowStartPoint = (
          labelX: number,
          labelY: number,
          labelWidth: number,
          labelHeight: number,
          targetX: number,
          targetY: number
        ): { x: number; y: number } => {
          // Direction from label to region
          const dx = targetX - labelX
          const dy = targetY - labelY

          // Label edges
          const halfWidth = labelWidth / 2
          const halfHeight = labelHeight / 2

          // Calculate intersection with label box
          // Use parametric line equation: point = (labelX, labelY) + t * (dx, dy)
          // Find t where line intersects rectangle edges

          let bestT = 0
          const epsilon = 1e-10

          // Check each edge
          if (Math.abs(dx) > epsilon) {
            // Right edge: x = labelX + halfWidth
            const tRight = halfWidth / dx
            if (tRight > 0 && tRight <= 1) {
              const y = labelY + tRight * dy
              if (Math.abs(y - labelY) <= halfHeight) {
                bestT = tRight
              }
            }
            // Left edge: x = labelX - halfWidth
            const tLeft = -halfWidth / dx
            if (tLeft > 0 && tLeft <= 1) {
              const y = labelY + tLeft * dy
              if (Math.abs(y - labelY) <= halfHeight) {
                if (bestT === 0 || tLeft < bestT) bestT = tLeft
              }
            }
          }

          if (Math.abs(dy) > epsilon) {
            // Bottom edge: y = labelY + halfHeight
            const tBottom = halfHeight / dy
            if (tBottom > 0 && tBottom <= 1) {
              const x = labelX + tBottom * dx
              if (Math.abs(x - labelX) <= halfWidth) {
                if (bestT === 0 || tBottom < bestT) bestT = tBottom
              }
            }
            // Top edge: y = labelY - halfHeight
            const tTop = -halfHeight / dy
            if (tTop > 0 && tTop <= 1) {
              const x = labelX + tTop * dx
              if (Math.abs(x - labelX) <= halfWidth) {
                if (bestT === 0 || tTop < bestT) bestT = tTop
              }
            }
          }

          return {
            x: labelX + bestT * dx,
            y: labelY + bestT * dy,
          }
        }

        // Extract positions from simulation results (only small regions now)
        for (const node of allLabelNodes) {
          // Special handling for Washington DC - position off the map to avoid blocking other states
          if (node.id === 'dc') {
            // Position DC label to the right of the map, outside the main map area
            const containerWidth = containerRect.width
            const labelX = containerWidth - 80 // 80px from right edge
            const labelY = svgOffsetY + svgRect.height * 0.35 // Upper-middle area

            const arrowStart = getArrowStartPoint(
              labelX,
              labelY,
              node.width,
              node.height,
              node.targetX,
              node.targetY
            )

            smallPositions.push({
              regionId: node.id,
              regionName: node.name,
              isFound: node.isFound,
              labelX: labelX,
              labelY: labelY,
              lineStartX: arrowStart.x,
              lineStartY: arrowStart.y,
              lineEndX: node.targetX,
              lineEndY: node.targetY,
            })
            continue // Skip normal processing
          }

          // All remaining nodes are small regions (non-small are added directly to positions)
          const arrowStart = getArrowStartPoint(
            node.x!,
            node.y!,
            node.width,
            node.height,
            node.targetX,
            node.targetY
          )

          smallPositions.push({
            regionId: node.id,
            regionName: node.name,
            isFound: node.isFound,
            labelX: node.x!,
            labelY: node.y!,
            lineStartX: arrowStart.x,
            lineStartY: arrowStart.y,
            lineEndX: node.targetX,
            lineEndY: node.targetY,
          })
        }
      }

      setLabelPositions(positions)
      setSmallRegionLabelPositions(smallPositions)

      // Debug: Log summary
      console.log('[MapRenderer] Label positions updated:', {
        mapId: mapData.id,
        totalRegions: mapData.regions.length,
        regularLabels: positions.length,
        smallRegionLabels: smallPositions.length,
        viewBox: mapData.viewBox,
        svgDimensions,
      })
    }

    // Small delay to ensure ghost elements are rendered
    const timeoutId = setTimeout(updateLabelPositions, 0)

    // Update on resize
    window.addEventListener('resize', updateLabelPositions)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateLabelPositions)
    }
  }, [mapData, regionsFound, guessHistory, svgDimensions, excludedRegions, excludedRegionIds])

  // Calculate viewBox dimensions for label offset calculations
  const viewBoxParts = mapData.viewBox.split(' ').map(Number)
  const viewBoxWidth = viewBoxParts[2] || 1000
  const viewBoxHeight = viewBoxParts[3] || 1000

  const showOutline = (region: MapRegion): boolean => {
    // Easy mode: always show outlines
    if (difficulty === 'easy') return true

    // Medium/Hard mode: only show outline on hover or if found
    return hoveredRegion === region.id || regionsFound.includes(region.id)
  }

  // Helper: Get the player who found a specific region
  const getPlayerWhoFoundRegion = (regionId: string): string | null => {
    const guess = guessHistory.find((g) => g.regionId === regionId && g.correct)
    return guess?.playerId || null
  }

  // Handle mouse movement to track cursor and show magnifier when needed
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!svgRef.current || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()

    // Get cursor position relative to container
    let cursorX: number
    let cursorY: number

    if (pointerLocked) {
      // When pointer is locked, use movement deltas with precision multiplier
      const lastX = cursorPositionRef.current?.x ?? containerRect.width / 2
      const lastY = cursorPositionRef.current?.y ?? containerRect.height / 2

      // Apply movement multiplier based on smallest region size for precision control
      const movementMultiplier = getMovementMultiplier(smallestRegionSize)
      cursorX = lastX + e.movementX * movementMultiplier
      cursorY = lastY + e.movementY * movementMultiplier

      // Clamp to container bounds
      cursorX = Math.max(0, Math.min(containerRect.width, cursorX))
      cursorY = Math.max(0, Math.min(containerRect.height, cursorY))
    } else {
      // Normal mode: use absolute position
      cursorX = e.clientX - containerRect.left
      cursorY = e.clientY - containerRect.top
    }

    // Check if cursor is over the SVG
    const isOverSvg =
      cursorX >= svgRect.left - containerRect.left &&
      cursorX <= svgRect.right - containerRect.left &&
      cursorY >= svgRect.top - containerRect.top &&
      cursorY <= svgRect.bottom - containerRect.top

    // Don't hide magnifier if mouse is still in container (just moved to padding/magnifier area)
    // Only update cursor position and check for regions if over SVG
    if (!isOverSvg) {
      // Keep magnifier visible but frozen at last position
      // It will be hidden by handleMouseLeave when mouse exits container
      return
    }

    // Calculate mouse velocity for quick-escape detection (cancel super zoom on fast movement)
    const now = Date.now()
    const timeDelta = now - lastMoveTimeRef.current
    let velocity = 0

    if (cursorPositionRef.current && timeDelta > 0) {
      const deltaX = cursorX - cursorPositionRef.current.x
      const deltaY = cursorY - cursorPositionRef.current.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      velocity = distance // Distance in pixels (effectively pixels per frame)
    }

    // Quick escape: If moving fast, cancel super zoom
    if (velocity > QUICK_MOVE_THRESHOLD) {
      console.log(
        `[Quick Escape] 💨 Fast movement detected (${velocity.toFixed(0)}px > ${QUICK_MOVE_THRESHOLD}px) - canceling super zoom`
      )
      setSuperZoomActive(false)
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
    }

    lastMoveTimeRef.current = now

    // Update cursor position ref for next frame
    cursorPositionRef.current = { x: cursorX, y: cursorY }
    setCursorPosition({ x: cursorX, y: cursorY })

    // Define 50px × 50px detection box around cursor
    const detectionBoxSize = 50
    const halfBox = detectionBoxSize / 2

    // Convert cursor position to client coordinates for region detection
    const cursorClientX = containerRect.left + cursorX
    const cursorClientY = containerRect.top + cursorY

    // Count regions in the detection box and track their sizes
    let regionsInBox = 0
    let hasSmallRegion = false
    let totalRegionArea = 0
    let detectedSmallestSize = Infinity
    const detectedRegions: string[] = []
    let regionUnderCursor: string | null = null
    let smallestDistanceToCenter = Infinity

    mapData.regions.forEach((region) => {
      const regionPath = svgRef.current?.querySelector(`path[data-region-id="${region.id}"]`)
      if (!regionPath) return

      const pathRect = regionPath.getBoundingClientRect()

      // Check if region overlaps with detection box
      const boxLeft = cursorClientX - halfBox
      const boxRight = cursorClientX + halfBox
      const boxTop = cursorClientY - halfBox
      const boxBottom = cursorClientY + halfBox

      const regionLeft = pathRect.left
      const regionRight = pathRect.right
      const regionTop = pathRect.top
      const regionBottom = pathRect.bottom

      const overlaps =
        regionLeft < boxRight &&
        regionRight > boxLeft &&
        regionTop < boxBottom &&
        regionBottom > boxTop

      // Also check if cursor is directly over this region
      const cursorInRegion =
        cursorClientX >= regionLeft &&
        cursorClientX <= regionRight &&
        cursorClientY >= regionTop &&
        cursorClientY <= regionBottom

      if (cursorInRegion) {
        // Calculate distance from cursor to region center to find the "best" match
        const regionCenterX = (regionLeft + regionRight) / 2
        const regionCenterY = (regionTop + regionBottom) / 2
        const distanceToCenter = Math.sqrt(
          (cursorClientX - regionCenterX) ** 2 + (cursorClientY - regionCenterY) ** 2
        )

        if (distanceToCenter < smallestDistanceToCenter) {
          smallestDistanceToCenter = distanceToCenter
          regionUnderCursor = region.id
        }
      }

      if (overlaps) {
        regionsInBox++
        detectedRegions.push(region.id)

        // Check if this region is very small (threshold tuned for Rhode Island ~11px)
        const pixelWidth = pathRect.width
        const pixelHeight = pathRect.height
        const pixelArea = pathRect.width * pathRect.height
        const isVerySmall = pixelWidth < 15 || pixelHeight < 15 || pixelArea < 200

        if (isVerySmall) {
          hasSmallRegion = true
          console.log('[Magnifier] Small region detected:', region.id, {
            width: pixelWidth,
            height: pixelHeight,
            area: pixelArea,
          })
        }

        // Track region sizes for adaptive zoom and dampening
        totalRegionArea += pixelArea
        const regionSize = Math.min(pixelWidth, pixelHeight)
        detectedSmallestSize = Math.min(detectedSmallestSize, regionSize)
      }
    })

    // Calculate adaptive zoom level based on region density and size
    // Base zoom: 8x
    // More regions = more zoom (up to +8x for 10+ regions)
    // Smaller regions = more zoom (up to +8x for very tiny regions)
    // Show magnifier if: 7+ regions in detection box OR any region smaller than 15px
    const shouldShow = regionsInBox >= 7 || hasSmallRegion

    // Update smallest region size for adaptive cursor dampening
    if (shouldShow && detectedSmallestSize !== Infinity) {
      setSmallestRegionSize(detectedSmallestSize)
    } else {
      setSmallestRegionSize(Infinity)
    }

    // Set hover highlighting based on cursor position
    // This ensures the crosshairs match what's highlighted
    if (regionUnderCursor !== hoveredRegion) {
      setHoveredRegion(regionUnderCursor)
    }

    // Auto super-zoom on hover: If hovering over sub-pixel regions (< 1px), start timer
    const shouldEnableSuperZoom = detectedSmallestSize < 1 && shouldShow
    if (shouldEnableSuperZoom && !hoverTimerRef.current && !superZoomActive) {
      console.log(
        `[Super Zoom] ⏱️ Starting hover timer (${HOVER_DELAY_MS}ms) for sub-pixel region: ${detectedSmallestSize.toFixed(2)}px`
      )
      hoverTimerRef.current = setTimeout(() => {
        console.log('[Super Zoom] 🔍 ACTIVATING super zoom!')
        setSuperZoomActive(true)
        hoverTimerRef.current = null
      }, HOVER_DELAY_MS)
    } else if (!shouldEnableSuperZoom && hoverTimerRef.current) {
      // Cancel timer if we move away from sub-pixel regions
      console.log('[Super Zoom] ❌ Canceling hover timer (moved away from sub-pixel region)')
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    } else if (!shouldShow && superZoomActive) {
      // Deactivate super zoom if we move away entirely
      console.log('[Super Zoom] ❌ Deactivating super zoom (moved away from small regions)')
      setSuperZoomActive(false)
    }

    // Debug logging
    console.log('[Magnifier] Detection:', {
      detectedRegions,
      regionsInBox,
      hasSmallRegion,
      smallestRegionSize: detectedSmallestSize.toFixed(2) + 'px',
      shouldShow,
      pointerLocked,
      movementMultiplier: getMovementMultiplier(detectedSmallestSize).toFixed(2),
      cursorPos: { x: cursorX.toFixed(1), y: cursorY.toFixed(1) },
    })

    if (shouldShow) {
      let adaptiveZoom = 8 // Base zoom

      // Add zoom based on region count (crowded areas need more zoom)
      const countFactor = Math.min(regionsInBox / 10, 1) // 0 to 1
      adaptiveZoom += countFactor * 8

      // Add zoom based on smallest region size (tiny regions need more zoom)
      if (detectedSmallestSize !== Infinity) {
        const sizeFactor = Math.max(0, 1 - detectedSmallestSize / 20) // 0 to 1 (1 = very small)
        adaptiveZoom += sizeFactor * 8
      }

      // Clamp zoom between 8x and 24x (or higher if super zoom active)
      const maxZoom = superZoomActive ? 60 : 24 // Super zoom can go up to 60x
      adaptiveZoom = Math.max(8, Math.min(maxZoom, adaptiveZoom))

      // Apply super zoom multiplier if active
      if (superZoomActive) {
        adaptiveZoom = Math.min(maxZoom, adaptiveZoom * SUPER_ZOOM_MULTIPLIER)
        console.log(
          `[Super Zoom] 🔍 Applied ${SUPER_ZOOM_MULTIPLIER}x multiplier: ${adaptiveZoom.toFixed(1)}x zoom`
        )
      }

      // Calculate magnifier position (opposite corner from cursor)
      const containerRect = containerRef.current.getBoundingClientRect()
      const magnifierWidth = containerRect.width * 0.5
      const magnifierHeight = magnifierWidth / 2
      const isLeftHalf = cursorX < containerRect.width / 2
      const isTopHalf = cursorY < containerRect.height / 2

      const newTop = isTopHalf ? containerRect.height - magnifierHeight - 20 : 20
      const newLeft = isLeftHalf ? containerRect.width - magnifierWidth - 20 : 20

      console.log(
        '[Magnifier] SHOWING with zoom:',
        adaptiveZoom,
        '| Setting opacity to 1, position:',
        { top: newTop, left: newLeft }
      )
      setTargetZoom(adaptiveZoom)
      setShowMagnifier(true)
      setTargetOpacity(1)
      setTargetTop(newTop)
      setTargetLeft(newLeft)
    } else {
      console.log('[Magnifier] HIDING - not enough regions or too large | Setting opacity to 0')
      setShowMagnifier(false)
      setTargetOpacity(0)
    }
  }

  const handleMouseLeave = () => {
    // Don't hide magnifier when pointer is locked
    // The cursor is locked to the container, so mouse leave events are not meaningful
    if (pointerLocked) {
      console.log('[Mouse Leave] Ignoring - pointer is locked')
      return
    }

    setShowMagnifier(false)
    setTargetOpacity(0)
    setCursorPosition(null)
    setSuperZoomActive(false)
    cursorPositionRef.current = null

    // Clear hover timer if active
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  return (
    <div
      ref={containerRef}
      data-component="map-renderer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={css({
        position: 'relative',
        width: '100%',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '4',
        bg: isDark ? 'gray.900' : 'gray.50',
        rounded: 'xl',
        shadow: 'lg',
      })}
    >
      <svg
        ref={svgRef}
        viewBox={mapData.viewBox}
        className={css({
          width: '100%',
          height: 'auto',
          cursor: pointerLocked ? 'crosshair' : 'pointer',
        })}
      >
        {/* Background */}
        <rect x="0" y="0" width="100%" height="100%" fill={isDark ? '#111827' : '#f3f4f6'} />

        {/* Render all regions (included + excluded) */}
        {[...mapData.regions, ...excludedRegions].map((region) => {
          const isExcluded = excludedRegionIds.has(region.id)
          const isFound = regionsFound.includes(region.id) || isExcluded // Treat excluded as pre-found
          const playerId = !isExcluded && isFound ? getPlayerWhoFoundRegion(region.id) : null

          // Special styling for excluded regions (grayed out, pre-labeled)
          const fill = isExcluded
            ? isDark
              ? '#374151' // gray-700
              : '#d1d5db' // gray-300
            : isFound && playerId
              ? `url(#player-pattern-${playerId})`
              : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

          return (
            <g key={region.id}>
              {/* Region path */}
              <path
                data-region-id={region.id}
                d={region.path}
                fill={fill}
                stroke={getRegionStroke(isFound, isDark)}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                opacity={showOutline(region) ? 1 : 0.7} // Increased from 0.3 to 0.7 for better visibility
                // When pointer lock is active, hover is controlled by cursor position tracking
                // Otherwise, use native mouse events
                onMouseEnter={() => !isExcluded && !pointerLocked && setHoveredRegion(region.id)}
                onMouseLeave={() => !pointerLocked && setHoveredRegion(null)}
                onClick={() => !isExcluded && onRegionClick(region.id, region.name)} // Disable clicks on excluded regions
                style={{
                  cursor: isExcluded ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              />

              {/* Ghost element for region center position tracking */}
              <circle
                cx={region.center[0]}
                cy={region.center[1]}
                r={0.1}
                fill="none"
                pointerEvents="none"
                data-ghost-region={region.id}
              />
            </g>
          )
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill={isDark ? '#60a5fa' : '#3b82f6'} />
          </marker>
          <marker
            id="arrowhead-found"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#16a34a" />
          </marker>

          {/* Player emoji patterns for region backgrounds */}
          {Object.values(playerMetadata).map((player) => (
            <pattern
              key={`pattern-${player.id}`}
              id={`player-pattern-${player.id}`}
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <rect width="60" height="60" fill={player.color} opacity="0.2" />
              <text
                x="30"
                y="30"
                fontSize="50"
                textAnchor="middle"
                dominantBaseline="middle"
                opacity="0.5"
              >
                {player.emoji}
              </text>
            </pattern>
          ))}
        </defs>

        {/* Magnifier region indicator on main map */}
        {showMagnifier && cursorPosition && svgRef.current && containerRef.current && (
          <animated.rect
            x={magnifierSpring.zoom.to((zoom) => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const svgRect = svgRef.current!.getBoundingClientRect()
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxX = viewBoxParts[0] || 0
              const viewBoxY = viewBoxParts[1] || 0
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000
              const scaleX = viewBoxWidth / svgRect.width
              const scaleY = viewBoxHeight / svgRect.height
              const svgOffsetX = svgRect.left - containerRect.left
              const svgOffsetY = svgRect.top - containerRect.top
              const cursorSvgX = (cursorPosition.x - svgOffsetX) * scaleX + viewBoxX
              const magnifiedWidth = viewBoxWidth / zoom
              return cursorSvgX - magnifiedWidth / 2
            })}
            y={magnifierSpring.zoom.to((zoom) => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const svgRect = svgRef.current!.getBoundingClientRect()
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxX = viewBoxParts[0] || 0
              const viewBoxY = viewBoxParts[1] || 0
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000
              const scaleX = viewBoxWidth / svgRect.width
              const scaleY = viewBoxHeight / svgRect.height
              const svgOffsetX = svgRect.left - containerRect.left
              const svgOffsetY = svgRect.top - containerRect.top
              const cursorSvgY = (cursorPosition.y - svgOffsetY) * scaleY + viewBoxY
              const magnifiedHeight = viewBoxHeight / zoom
              return cursorSvgY - magnifiedHeight / 2
            })}
            width={magnifierSpring.zoom.to((zoom) => {
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2] || 1000
              return viewBoxWidth / zoom
            })}
            height={magnifierSpring.zoom.to((zoom) => {
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxHeight = viewBoxParts[3] || 1000
              return viewBoxHeight / zoom
            })}
            fill="none"
            stroke={isDark ? '#60a5fa' : '#3b82f6'}
            strokeWidth={viewBoxWidth / 500}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="5,5"
            pointerEvents="none"
            opacity={0.8}
          />
        )}
      </svg>

      {/* HTML labels positioned absolutely over the SVG */}
      {labelPositions.map((label) => (
        <div
          key={label.regionId}
          style={{
            position: 'absolute',
            left: `${label.x}px`,
            top: `${label.y}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* Region name */}
          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: getLabelTextColor(isDark, true),
              textShadow: getLabelTextShadow(isDark, true),
              whiteSpace: 'nowrap',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {label.regionName}
          </div>

          {/* Player avatars */}
          {label.players.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '2px',
                marginTop: '2px',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              {label.players.map((playerId) => {
                const player = playerMetadata[playerId]
                if (!player) return null

                return (
                  <div
                    key={playerId}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: player.color || '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      opacity: 0.9,
                      pointerEvents: 'none',
                    }}
                  >
                    {player.emoji}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Small region labels with arrows positioned absolutely over the SVG */}
      {smallRegionLabelPositions.map((label) => (
        <div key={`small-${label.regionId}`}>
          {/* Arrow line - use SVG positioned absolutely */}
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <line
              x1={label.lineStartX}
              y1={label.lineStartY}
              x2={label.lineEndX}
              y2={label.lineEndY}
              stroke={label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}
              strokeWidth={1.5}
              markerEnd={label.isFound ? 'url(#arrowhead-found)' : 'url(#arrowhead)'}
            />
            {/* Debug: Show arrow endpoint (region centroid) */}
            <circle cx={label.lineEndX} cy={label.lineEndY} r={3} fill="red" opacity={0.8} />
          </svg>

          {/* Label box and text */}
          <div
            style={{
              position: 'absolute',
              left: `${label.labelX}px`,
              top: `${label.labelY}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'all',
              cursor: 'pointer',
              zIndex: 20,
            }}
            onClick={() => onRegionClick(label.regionId, label.regionName)}
            onMouseEnter={() => setHoveredRegion(label.regionId)}
            onMouseLeave={() => setHoveredRegion(null)}
          >
            {/* Background box */}
            <div
              style={{
                padding: '2px 5px',
                backgroundColor: label.isFound
                  ? isDark
                    ? '#22c55e'
                    : '#86efac'
                  : isDark
                    ? '#1f2937'
                    : '#ffffff',
                border: `1px solid ${label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}`,
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: getLabelTextColor(isDark, label.isFound),
                textShadow: label.isFound
                  ? getLabelTextShadow(isDark, true)
                  : '0 0 2px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {label.regionName}
            </div>
          </div>
        </div>
      ))}

      {/* Custom Cursor - Visible when pointer lock is active */}
      {pointerLocked && cursorPosition && (
        <div
          data-element="custom-cursor"
          style={{
            position: 'absolute',
            left: `${cursorPosition.x}px`,
            top: `${cursorPosition.y}px`,
            width: '20px',
            height: '20px',
            border: `2px solid ${isDark ? '#60a5fa' : '#3b82f6'}`,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 200,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'transparent',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Crosshair */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '2px',
              height: '100%',
              backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '100%',
              height: '2px',
              backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
              transform: 'translateY(-50%)',
            }}
          />
        </div>
      )}

      {/* Magnifier Window - Always rendered when cursor exists, opacity controlled by spring */}
      {cursorPosition && svgRef.current && containerRef.current && (
        <animated.div
          data-element="magnifier"
          data-super-zoom={superZoomActive}
          style={{
            position: 'absolute',
            // Animated positioning - smoothly moves to opposite corner from cursor
            top: magnifierSpring.top,
            left: magnifierSpring.left,
            width: '50%',
            aspectRatio: '2/1',
            // Super zoom gets gold border, normal mode gets blue border
            border: superZoomActive
              ? `4px solid ${isDark ? '#fbbf24' : '#f59e0b'}` // gold-400/gold-500
              : `3px solid ${isDark ? '#60a5fa' : '#3b82f6'}`, // blue-400/blue-600
            borderRadius: '12px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: superZoomActive
              ? '0 10px 40px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.2)' // Gold glow
              : '0 10px 40px rgba(0, 0, 0, 0.5)',
            background: isDark ? '#111827' : '#f3f4f6',
            opacity: magnifierSpring.opacity,
          }}
        >
          <animated.svg
            viewBox={magnifierSpring.zoom.to((zoom) => {
              // Calculate magnified viewBox centered on cursor
              const containerRect = containerRef.current!.getBoundingClientRect()
              const svgRect = svgRef.current!.getBoundingClientRect()

              // Convert cursor position to SVG coordinates
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxX = viewBoxParts[0] || 0
              const viewBoxY = viewBoxParts[1] || 0
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000

              const scaleX = viewBoxWidth / svgRect.width
              const scaleY = viewBoxHeight / svgRect.height

              // Cursor position relative to SVG
              const svgOffsetX = svgRect.left - containerRect.left
              const svgOffsetY = svgRect.top - containerRect.top
              const cursorSvgX = (cursorPosition.x - svgOffsetX) * scaleX + viewBoxX
              const cursorSvgY = (cursorPosition.y - svgOffsetY) * scaleY + viewBoxY

              // Magnified view: adaptive zoom (using animated value)
              const magnifiedWidth = viewBoxWidth / zoom
              const magnifiedHeight = viewBoxHeight / zoom

              // Center the magnified viewBox on the cursor
              const magnifiedViewBoxX = cursorSvgX - magnifiedWidth / 2
              const magnifiedViewBoxY = cursorSvgY - magnifiedHeight / 2

              return `${magnifiedViewBoxX} ${magnifiedViewBoxY} ${magnifiedWidth} ${magnifiedHeight}`
            })}
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            {/* Background */}
            <rect x="0" y="0" width="100%" height="100%" fill={isDark ? '#111827' : '#f3f4f6'} />

            {/* Render all regions in magnified view */}
            {mapData.regions.map((region) => {
              const isFound = regionsFound.includes(region.id)
              const playerId = isFound ? getPlayerWhoFoundRegion(region.id) : null
              const fill =
                isFound && playerId
                  ? `url(#player-pattern-${playerId})`
                  : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

              return (
                <path
                  key={`mag-${region.id}`}
                  d={region.path}
                  fill={fill}
                  stroke={getRegionStroke(isFound, isDark)}
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                  opacity={showOutline(region) ? 1 : 0.3}
                />
              )
            })}

            {/* Crosshair at cursor position */}
            <g>
              {(() => {
                const containerRect = containerRef.current!.getBoundingClientRect()
                const svgRect = svgRef.current!.getBoundingClientRect()
                const viewBoxParts = mapData.viewBox.split(' ').map(Number)
                const viewBoxX = viewBoxParts[0] || 0
                const viewBoxY = viewBoxParts[1] || 0
                const viewBoxWidth = viewBoxParts[2] || 1000
                const viewBoxHeight = viewBoxParts[3] || 1000
                const scaleX = viewBoxWidth / svgRect.width
                const scaleY = viewBoxHeight / svgRect.height
                const svgOffsetX = svgRect.left - containerRect.left
                const svgOffsetY = svgRect.top - containerRect.top
                const cursorSvgX = (cursorPosition.x - svgOffsetX) * scaleX + viewBoxX
                const cursorSvgY = (cursorPosition.y - svgOffsetY) * scaleY + viewBoxY

                return (
                  <>
                    <circle
                      cx={cursorSvgX}
                      cy={cursorSvgY}
                      r={viewBoxWidth / 100}
                      fill="none"
                      stroke={isDark ? '#60a5fa' : '#3b82f6'}
                      strokeWidth={viewBoxWidth / 500}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={cursorSvgX - viewBoxWidth / 50}
                      y1={cursorSvgY}
                      x2={cursorSvgX + viewBoxWidth / 50}
                      y2={cursorSvgY}
                      stroke={isDark ? '#60a5fa' : '#3b82f6'}
                      strokeWidth={viewBoxWidth / 1000}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={cursorSvgX}
                      y1={cursorSvgY - viewBoxHeight / 50}
                      x2={cursorSvgX}
                      y2={cursorSvgY + viewBoxHeight / 50}
                      stroke={isDark ? '#60a5fa' : '#3b82f6'}
                      strokeWidth={viewBoxWidth / 1000}
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                )
              })()}
            </g>
          </animated.svg>

          {/* Magnifier label */}
          <animated.div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              padding: '4px 8px',
              background: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: isDark ? '#60a5fa' : '#3b82f6',
              pointerEvents: 'none',
            }}
          >
            {magnifierSpring.zoom.to((z) => `${z.toFixed(1)}× Zoom`)}
          </animated.div>
        </animated.div>
      )}
    </div>
  )
}
