'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useSpring, useSpringRef, animated } from '@react-spring/web'
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
import { WORLD_MAP, USA_MAP, filterRegionsByContinent } from '../maps'
import type { ContinentId } from '../continents'

// Debug flag: show technical info in magnifier (dev only)
const SHOW_MAGNIFIER_DEBUG_INFO = process.env.NODE_ENV === 'development'

// Precision mode threshold: screen pixel ratio that triggers pointer lock recommendation
const PRECISION_MODE_THRESHOLD = 20

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
  // Force simulation tuning parameters
  forceTuning?: {
    showArrows?: boolean
    centeringStrength?: number
    collisionPadding?: number
    simulationIterations?: number
    useObstacles?: boolean
    obstaclePadding?: number
  }
  // Debug flags
  showDebugBoundingBoxes?: boolean
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
  forceTuning = {},
  showDebugBoundingBoxes = false,
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
    const fullMapData = selectedMap === 'world' ? WORLD_MAP : USA_MAP
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

    // Debug: Check if Gibraltar is included or excluded
    const gibraltar = allRegions.find((r) => r.id === 'gi')
    const gibraltarIncluded = includedRegionIds.has('gi')
    if (gibraltar) {
      console.log('[Gibraltar Debug]', gibraltarIncluded ? '✅ INCLUDED' : '❌ EXCLUDED', {
        inFilteredMap: gibraltarIncluded,
        difficulty,
        continent: selectedContinent,
      })
    }

    return excluded
  }, [mapData, selectedMap, selectedContinent, difficulty])

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

  // Pointer lock management
  const [pointerLocked, setPointerLocked] = useState(false)

  // Cursor position tracking (container-relative coordinates)
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null)
  const initialCapturePositionRef = useRef<{ x: number; y: number } | null>(null)
  const [smallestRegionSize, setSmallestRegionSize] = useState<number>(Infinity)

  // Cursor distortion at boundaries (for squish effect)
  const [cursorSquish, setCursorSquish] = useState({ x: 1, y: 1 }) // Scale factors

  // Track if we're animating back to release position
  const [isReleasingPointerLock, setIsReleasingPointerLock] = useState(false)

  // Debug: Track bounding boxes for visualization
  const [debugBoundingBoxes, setDebugBoundingBoxes] = useState<
    Array<{ regionId: string; x: number; y: number; width: number; height: number }>
  >([])

  // Pre-computed largest piece sizes for multi-piece regions
  // Maps regionId -> {width, height} of the largest piece
  const largestPieceSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map())

  // Configuration
  const MAX_ZOOM = 1000 // Maximum zoom level (for Gibraltar at 0.08px!)
  const HIGH_ZOOM_THRESHOLD = 100 // Show gold border above this zoom level

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

  // Set up pointer lock event listeners
  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === containerRef.current
      console.log('[MapRenderer] Pointer lock change event:', {
        isLocked,
        pointerLockElement: document.pointerLockElement,
        containerElement: containerRef.current,
        elementsMatch: document.pointerLockElement === containerRef.current,
      })
      setPointerLocked(isLocked)

      // When acquiring pointer lock, save the initial cursor position
      if (isLocked && cursorPositionRef.current) {
        initialCapturePositionRef.current = { ...cursorPositionRef.current }
        console.log(
          '[Pointer Lock] 📍 Saved initial capture position:',
          initialCapturePositionRef.current
        )
      }

      // Reset cursor squish when lock state changes
      if (!isLocked) {
        setCursorSquish({ x: 1, y: 1 })
        setIsReleasingPointerLock(false)
        initialCapturePositionRef.current = null
      }
    }

    const handlePointerLockError = () => {
      console.error('[Pointer Lock] ❌ Failed to acquire pointer lock')
      setPointerLocked(false)
    }

    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('pointerlockerror', handlePointerLockError)

    console.log('[MapRenderer] Pointer lock listeners attached')

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('pointerlockerror', handlePointerLockError)
      console.log('[MapRenderer] Pointer lock listeners removed')
    }
  }, [])

  // Release pointer lock when component unmounts
  useEffect(() => {
    return () => {
      if (document.pointerLockElement) {
        console.log('[Pointer Lock] 🔓 RELEASING (MapRenderer unmount)')
        document.exitPointerLock()
      }
    }
  }, [])

  // Pre-compute largest piece sizes for multi-piece regions
  useEffect(() => {
    if (!svgRef.current) return

    const largestPieceSizes = new Map<string, { width: number; height: number }>()

    mapData.regions.forEach((region) => {
      const pathData = region.path
      const pieceSeparatorRegex = /(?<=z)\s*m\s*/i
      const rawPieces = pathData.split(pieceSeparatorRegex)

      if (rawPieces.length > 1) {
        // Multi-piece region: use the FIRST piece (mainland), not largest
        // The first piece is typically the mainland, with islands as subsequent pieces
        const svg = svgRef.current
        if (!svg) return

        // Just measure the first piece
        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        tempPath.setAttribute('d', rawPieces[0]) // First piece already has 'm' command
        tempPath.style.visibility = 'hidden'
        svg.appendChild(tempPath)

        const bbox = tempPath.getBoundingClientRect()
        const firstPieceSize = { width: bbox.width, height: bbox.height }

        svg.removeChild(tempPath)

        largestPieceSizes.set(region.id, firstPieceSize)

        // Only log Portugal for debugging
        if (region.id === 'pt') {
          console.log(
            `[Pre-compute] ${region.id}: Using first piece (mainland): ${firstPieceSize.width.toFixed(2)}px × ${firstPieceSize.height.toFixed(2)}px`
          )
        }
      }
    })

    largestPieceSizesRef.current = largestPieceSizes
  }, [mapData])

  // Request pointer lock on first click
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Silently request pointer lock if not already locked
    // This makes the first gameplay click also enable precision mode
    if (!pointerLocked && containerRef.current) {
      try {
        containerRef.current.requestPointerLock()
        console.log('[Pointer Lock] 🔒 Silently requested (user clicked map)')
      } catch (error) {
        console.error('[Pointer Lock] Request failed:', error)
      }
    }

    // Let region clicks still work (they have their own onClick handlers)
  }

  // Animated spring values for smooth transitions
  // Different fade speeds: fast fade-in (100ms), slow fade-out (1000ms)
  // Zoom: smooth, slower animation with gentle easing
  // Position: medium speed (300ms)
  // Movement multiplier: gradual transitions for smooth cursor dampening
  const springRef = useSpringRef()
  const [magnifierSpring, magnifierApi] = useSpring(
    () => ({
      ref: springRef,
      zoom: targetZoom,
      opacity: targetOpacity,
      top: targetTop,
      left: targetLeft,
      movementMultiplier: getMovementMultiplier(smallestRegionSize),
      config: (key) => {
        if (key === 'opacity') {
          return targetOpacity === 1
            ? { duration: 100 } // Fade in: 0.1 seconds
            : { duration: 1000 } // Fade out: 1 second
        }
        if (key === 'zoom') {
          // Zoom: very slow, smooth animation (4x longer than before)
          // Lower tension + higher mass = longer, more gradual transitions
          return { tension: 30, friction: 30, mass: 4 }
        }
        if (key === 'movementMultiplier') {
          // Movement multiplier: smooth but responsive transitions
          // Faster than zoom so cursor responsiveness changes quickly but not jarring
          return { tension: 180, friction: 26 }
        }
        // Position: medium speed
        return { tension: 200, friction: 25 }
      },
      // onChange removed - was flooding console with animation frames
    }),
    []
  )

  // Update spring values when targets change
  // Handle pausing zoom animation when hitting threshold
  useEffect(() => {
    const currentZoom = magnifierSpring.zoom.get()
    const zoomIsAnimating = Math.abs(currentZoom - targetZoom) > 0.01

    // Check if CURRENT zoom is at/above the threshold (zoom is capped)
    const currentIsAtThreshold =
      !pointerLocked &&
      containerRef.current &&
      svgRef.current &&
      (() => {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        const magnifierWidth = containerRect.width * 0.5
        const viewBoxParts = mapData.viewBox.split(' ').map(Number)
        const viewBoxWidth = viewBoxParts[2]

        if (!viewBoxWidth || isNaN(viewBoxWidth)) return false

        const magnifiedViewBoxWidth = viewBoxWidth / currentZoom
        const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
        const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width
        const screenPixelRatio = mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

        return screenPixelRatio >= PRECISION_MODE_THRESHOLD
      })()

    // Check if TARGET zoom would be at/above the threshold
    const targetIsAtThreshold =
      !pointerLocked &&
      containerRef.current &&
      svgRef.current &&
      (() => {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        const magnifierWidth = containerRect.width * 0.5
        const viewBoxParts = mapData.viewBox.split(' ').map(Number)
        const viewBoxWidth = viewBoxParts[2]

        if (!viewBoxWidth || isNaN(viewBoxWidth)) return false

        const magnifiedViewBoxWidth = viewBoxWidth / targetZoom
        const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
        const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width
        const screenPixelRatio = mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

        return screenPixelRatio >= PRECISION_MODE_THRESHOLD
      })()

    // Pause conditions:
    // 1. Currently at threshold AND animating toward even higher zoom (would exceed threshold more)
    // 2. OR: Currently at threshold and target is also at threshold (should stay paused)
    const shouldPause = currentIsAtThreshold && zoomIsAnimating && targetIsAtThreshold

    if (shouldPause) {
      // Pause the zoom animation - we're waiting for precision mode
      console.log('[Zoom] Pausing at threshold - waiting for precision mode')
      magnifierApi.pause()
    } else {
      // Update spring values and ensure it's not paused
      // This will resume if we were paused and now target is below threshold (zooming out)
      if (currentIsAtThreshold && !targetIsAtThreshold) {
        console.log('[Zoom] Resuming - target zoom is below threshold (zooming out)')
      }
      magnifierApi.start({
        zoom: targetZoom,
        opacity: targetOpacity,
        top: targetTop,
        left: targetLeft,
        movementMultiplier: getMovementMultiplier(smallestRegionSize),
      })
    }
  }, [
    targetZoom,
    targetOpacity,
    targetTop,
    targetLeft,
    smallestRegionSize,
    pointerLocked,
    mapData.viewBox,
    magnifierApi,
    magnifierSpring.zoom,
  ])

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

  // Measure SVG element to get actual pixel dimensions using ResizeObserver
  useEffect(() => {
    if (!svgRef.current) return

    const updateDimensions = () => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        setSvgDimensions({ width: rect.width, height: rect.height })
      }
    }

    // Use ResizeObserver to detect panel resizing (not just window resize)
    const observer = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        updateDimensions()
      })
    })

    observer.observe(svgRef.current)

    // Initial measurement
    updateDimensions()

    return () => observer.disconnect()
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

        // Debug logging ONLY for Gibraltar and ultra-tiny regions (< 1px)
        if (region.id === 'gi' || pixelWidth < 1 || pixelHeight < 1) {
          console.log(
            `[MapRenderer] ${region.id === 'gi' ? '🎯 GIBRALTAR' : '🔍 TINY'}: ${region.name} - ` +
              `W:${pixelWidth.toFixed(2)}px H:${pixelHeight.toFixed(2)}px ` +
              `Area:${pixelArea.toFixed(2)}px²`
          )
        }

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

    return () => {
      clearTimeout(timeoutId)
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

    // Don't process mouse movement during pointer lock release animation
    if (isReleasingPointerLock) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()

    // Get cursor position relative to container
    let cursorX: number
    let cursorY: number

    if (pointerLocked) {
      // When pointer is locked, use movement deltas with precision multiplier
      const lastX = cursorPositionRef.current?.x ?? containerRect.width / 2
      const lastY = cursorPositionRef.current?.y ?? containerRect.height / 2

      // Apply smoothly animated movement multiplier for gradual cursor dampening transitions
      // This prevents jarring changes when moving between regions of different sizes
      const currentMultiplier = magnifierSpring.movementMultiplier.get()

      // Boundary dampening and squish effect
      // As cursor approaches edge, dampen movement and visually squish the cursor
      // When squished enough, the cursor "escapes" through the boundary and releases pointer lock
      const dampenZone = 40 // Distance from edge where dampening starts (px)
      const squishZone = 20 // Distance from edge where squish becomes visible (px)
      const escapeThreshold = 2 // When within this distance, escape! (px)

      // Calculate SVG offset within container (SVG may be smaller due to aspect ratio)
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top

      // First, calculate undampened position to check how close we are to edges
      const undampenedX = lastX + e.movementX * currentMultiplier
      const undampenedY = lastY + e.movementY * currentMultiplier

      // Calculate distance from SVG edges (not container edges!)
      // This is critical - the interactive area is the SVG, not the container
      const distLeft = undampenedX - svgOffsetX
      const distRight = svgOffsetX + svgRect.width - undampenedX
      const distTop = undampenedY - svgOffsetY
      const distBottom = svgOffsetY + svgRect.height - undampenedY

      // Find closest edge distance
      const minDist = Math.min(distLeft, distRight, distTop, distBottom)

      // Calculate dampening factor based on proximity to edge
      let dampenFactor = 1.0
      if (minDist < dampenZone) {
        // Quadratic easing for smooth dampening
        const t = minDist / dampenZone
        dampenFactor = t * t // Squared for stronger dampening near edge
      }

      // Apply dampening to movement - this is the actual cursor position we'll use
      const dampenedDeltaX = e.movementX * currentMultiplier * dampenFactor
      const dampenedDeltaY = e.movementY * currentMultiplier * dampenFactor
      cursorX = lastX + dampenedDeltaX
      cursorY = lastY + dampenedDeltaY

      // Now check escape threshold using the DAMPENED position (not undampened!)
      // This is critical - we need to check where the cursor actually is, not where it would be without dampening
      // And we must use SVG bounds, not container bounds!
      const dampenedDistLeft = cursorX - svgOffsetX
      const dampenedDistRight = svgOffsetX + svgRect.width - cursorX
      const dampenedDistTop = cursorY - svgOffsetY
      const dampenedDistBottom = svgOffsetY + svgRect.height - cursorY
      const dampenedMinDist = Math.min(
        dampenedDistLeft,
        dampenedDistRight,
        dampenedDistTop,
        dampenedDistBottom
      )

      // Debug logging for boundary proximity
      if (dampenedMinDist < squishZone) {
        console.log('[Squish Debug]', {
          cursorPos: { x: cursorX.toFixed(1), y: cursorY.toFixed(1) },
          containerSize: {
            width: containerRect.width.toFixed(1),
            height: containerRect.height.toFixed(1),
          },
          svgSize: { width: svgRect.width.toFixed(1), height: svgRect.height.toFixed(1) },
          svgOffset: { x: svgOffsetX.toFixed(1), y: svgOffsetY.toFixed(1) },
          distances: {
            left: dampenedDistLeft.toFixed(1),
            right: dampenedDistRight.toFixed(1),
            top: dampenedDistTop.toFixed(1),
            bottom: dampenedDistBottom.toFixed(1),
            min: dampenedMinDist.toFixed(1),
          },
          dampenFactor: dampenFactor.toFixed(3),
          thresholds: {
            squishZone,
            escapeThreshold,
          },
          willEscape: dampenedMinDist < escapeThreshold,
        })
      }

      // Check if cursor has squished through and should escape (using dampened position!)
      if (dampenedMinDist < escapeThreshold && !isReleasingPointerLock) {
        console.log('[Pointer Lock] 🔓 ESCAPING (squished through boundary):', {
          dampenedMinDist,
          escapeThreshold,
          cursorX,
          cursorY,
          whichEdge: {
            left: dampenedDistLeft === dampenedMinDist,
            right: dampenedDistRight === dampenedMinDist,
            top: dampenedDistTop === dampenedMinDist,
            bottom: dampenedDistBottom === dampenedMinDist,
          },
        })

        // Start animation back to initial capture position
        setIsReleasingPointerLock(true)

        // Animate cursor back to initial position before releasing
        if (initialCapturePositionRef.current) {
          const startPos = { x: cursorX, y: cursorY }
          const endPos = initialCapturePositionRef.current
          const duration = 200 // ms
          const startTime = performance.now()

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Ease out cubic for smooth deceleration
            const eased = 1 - (1 - progress) ** 3

            const interpolatedX = startPos.x + (endPos.x - startPos.x) * eased
            const interpolatedY = startPos.y + (endPos.y - startPos.y) * eased

            // Update cursor position
            cursorPositionRef.current = { x: interpolatedX, y: interpolatedY }
            setCursorPosition({ x: interpolatedX, y: interpolatedY })

            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              // Animation complete - now release pointer lock
              console.log('[Pointer Lock] 🔓 Animation complete, releasing pointer lock')
              document.exitPointerLock()
            }
          }

          requestAnimationFrame(animate)
        } else {
          // No initial position saved, release immediately
          document.exitPointerLock()
        }

        // Don't update cursor position in this frame - animation will handle it
        return
      }

      // Calculate squish effect based on proximity to edges (using dampened position!)
      // Handle horizontal and vertical squishing independently to support corners
      let squishX = 1.0
      let squishY = 1.0

      // Horizontal squishing (left/right edges)
      if (dampenedDistLeft < squishZone) {
        // Squishing against left edge - compress horizontally
        const t = 1 - dampenedDistLeft / squishZone
        squishX = Math.min(squishX, 1.0 - t * 0.5) // Compress to 50% width
      } else if (dampenedDistRight < squishZone) {
        // Squishing against right edge - compress horizontally
        const t = 1 - dampenedDistRight / squishZone
        squishX = Math.min(squishX, 1.0 - t * 0.5)
      }

      // Vertical squishing (top/bottom edges)
      if (dampenedDistTop < squishZone) {
        // Squishing against top edge - compress vertically
        const t = 1 - dampenedDistTop / squishZone
        squishY = Math.min(squishY, 1.0 - t * 0.5)
      } else if (dampenedDistBottom < squishZone) {
        // Squishing against bottom edge - compress vertically
        const t = 1 - dampenedDistBottom / squishZone
        squishY = Math.min(squishY, 1.0 - t * 0.5)
      }

      // Update squish state
      setCursorSquish({ x: squishX, y: squishY })

      // Clamp to SVG bounds (not container bounds!)
      // Allow cursor to reach escape threshold at SVG edges
      cursorX = Math.max(svgOffsetX, Math.min(svgOffsetX + svgRect.width, cursorX))
      cursorY = Math.max(svgOffsetY, Math.min(svgOffsetY + svgRect.height, cursorY))
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

    // No velocity tracking needed - zoom adapts immediately to region size

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
    let detectedSmallestSize = Infinity // For dampening (smallest in detection box)
    const detectedRegions: string[] = []
    let regionUnderCursor: string | null = null
    let regionUnderCursorArea = 0 // For zoom calculation (area of hovered region)
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
          regionUnderCursorArea = pathRect.width * pathRect.height
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
        }

        // Track smallest region size for cursor dampening (use smallest in detection box)
        const screenSize = Math.min(pixelWidth, pixelHeight)
        totalRegionArea += pixelArea
        detectedSmallestSize = Math.min(detectedSmallestSize, screenSize)
      }
    })

    // Sort detected regions by size (smallest first) to prioritize tiny regions in zoom calculation
    // This ensures Gibraltar (0.08px) is checked before Spain (81px) when finding optimal zoom
    detectedRegions.sort((a, b) => {
      const pathA = svgRef.current?.querySelector(`path[data-region-id="${a}"]`)
      const pathB = svgRef.current?.querySelector(`path[data-region-id="${b}"]`)
      if (!pathA || !pathB) return 0

      const rectA = pathA.getBoundingClientRect()
      const rectB = pathB.getBoundingClientRect()

      // Use smallest dimension (width or height) for comparison
      const sizeA = Math.min(rectA.width, rectA.height)
      const sizeB = Math.min(rectB.width, rectB.height)

      return sizeA - sizeB // Smallest first
    })

    if (pointerLocked && detectedRegions.length > 0) {
      const sortedSizes = detectedRegions.map((id) => {
        const path = svgRef.current?.querySelector(`path[data-region-id="${id}"]`)
        if (!path) return `${id}: ?`
        const rect = path.getBoundingClientRect()
        const size = Math.min(rect.width, rect.height)
        return `${id}: ${size.toFixed(2)}px`
      })
      console.log('[Zoom Search] Sorted regions (smallest first):', sortedSizes)
    }

    // Calculate adaptive zoom level based on region density and size
    // Base zoom: 8x
    // More regions = more zoom (up to +8x for 10+ regions)
    // Show magnifier only when there are small regions (< 15px)
    const shouldShow = hasSmallRegion

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

    // Magnifier detection logging removed for performance

    if (shouldShow) {
      // Adaptive threshold based on smallest detected region
      // For ultra-small regions (< 1px), we need a lower acceptance threshold
      // Otherwise Gibraltar (0.08px) will never fit the 10-25% range even at 1000x zoom
      let minAcceptableRatio = 0.1 // Default: 10% minimum
      let maxAcceptableRatio = 0.25 // Default: 25% maximum

      if (detectedSmallestSize < 1) {
        // Sub-pixel regions: accept 2-8% of magnifier
        minAcceptableRatio = 0.02
        maxAcceptableRatio = 0.08
      } else if (detectedSmallestSize < 5) {
        // Tiny regions (1-5px): accept 5-15% of magnifier
        minAcceptableRatio = 0.05
        maxAcceptableRatio = 0.15
      }

      if (pointerLocked) {
        console.log('[Zoom Search] Adaptive thresholds:', {
          detectedSmallestSize: detectedSmallestSize.toFixed(4) + 'px',
          minAcceptableRatio: (minAcceptableRatio * 100).toFixed(1) + '%',
          maxAcceptableRatio: (maxAcceptableRatio * 100).toFixed(1) + '%',
        })
      }

      // Zoom-out approach: Start from max zoom and reduce until a region fits nicely
      // Goal: Find zoom where any region occupies ~15% of magnifier width or height
      const TARGET_RATIO = 0.15 // Region should occupy 15% of magnifier dimension

      // Get SVG viewBox for bounding box conversion
      const viewBoxParts = mapData.viewBox.split(' ').map(Number)
      const viewBoxWidth = viewBoxParts[2] || 1000
      const viewBoxHeight = viewBoxParts[3] || 1000

      // Magnifier dimensions
      const magnifierWidth = containerRect.width * 0.5
      const magnifierHeight = magnifierWidth / 2

      // Calculate target sizes: region should be this big in magnifier
      const targetWidthPx = magnifierWidth * TARGET_RATIO
      const targetHeightPx = magnifierHeight * TARGET_RATIO

      // Track bounding boxes for debug visualization
      const boundingBoxes: Array<{
        regionId: string
        x: number
        y: number
        width: number
        height: number
      }> = []

      // Start from max zoom and work down until we find a good fit
      let adaptiveZoom = MAX_ZOOM
      let foundGoodZoom = false

      // We'll test zoom levels by halving each time to find a good range quickly
      const MIN_ZOOM = 1
      const ZOOM_STEP = 0.9 // Reduce by 10% each iteration

      // Convert cursor position to SVG coordinates
      const scaleX = viewBoxWidth / svgRect.width
      const scaleY = viewBoxHeight / svgRect.height
      const viewBoxX = viewBoxParts[0] || 0
      const viewBoxY = viewBoxParts[1] || 0
      const cursorSvgX = (cursorX - (svgRect.left - containerRect.left)) * scaleX + viewBoxX
      const cursorSvgY = (cursorY - (svgRect.top - containerRect.top)) * scaleY + viewBoxY

      // Zoom search logging disabled for performance

      for (let testZoom = MAX_ZOOM; testZoom >= MIN_ZOOM; testZoom *= ZOOM_STEP) {
        // Calculate the SVG viewport that will be shown in the magnifier at this zoom
        const magnifiedViewBoxWidth = viewBoxWidth / testZoom
        const magnifiedViewBoxHeight = viewBoxHeight / testZoom

        // The viewport is centered on cursor position, but clamped to map bounds
        let viewportLeft = cursorSvgX - magnifiedViewBoxWidth / 2
        let viewportRight = cursorSvgX + magnifiedViewBoxWidth / 2
        let viewportTop = cursorSvgY - magnifiedViewBoxHeight / 2
        let viewportBottom = cursorSvgY + magnifiedViewBoxHeight / 2

        // Clamp viewport to stay within map bounds
        const mapLeft = viewBoxX
        const mapRight = viewBoxX + viewBoxWidth
        const mapTop = viewBoxY
        const mapBottom = viewBoxY + viewBoxHeight

        let wasClamped = false
        const originalViewport = {
          left: viewportLeft,
          right: viewportRight,
          top: viewportTop,
          bottom: viewportBottom,
        }

        // If viewport extends beyond left edge, shift it right
        if (viewportLeft < mapLeft) {
          const shift = mapLeft - viewportLeft
          viewportLeft += shift
          viewportRight += shift
          wasClamped = true
        }
        // If viewport extends beyond right edge, shift it left
        if (viewportRight > mapRight) {
          const shift = viewportRight - mapRight
          viewportLeft -= shift
          viewportRight -= shift
          wasClamped = true
        }
        // If viewport extends beyond top edge, shift it down
        if (viewportTop < mapTop) {
          const shift = mapTop - viewportTop
          viewportTop += shift
          viewportBottom += shift
          wasClamped = true
        }
        // If viewport extends beyond bottom edge, shift it up
        if (viewportBottom > mapBottom) {
          const shift = viewportBottom - mapBottom
          viewportTop -= shift
          viewportBottom -= shift
          wasClamped = true
        }

        // Viewport logging disabled for performance

        // Check all detected regions to see if any are inside this viewport and fit nicely
        let foundFit = false
        const regionsChecked: Array<{ id: string; inside: boolean; ratio?: number }> = []

        for (const regionId of detectedRegions) {
          const region = mapData.regions.find((r) => r.id === regionId)
          if (!region) continue

          const regionPath = svgRef.current?.querySelector(`path[data-region-id="${regionId}"]`)
          if (!regionPath) continue

          // Use pre-computed largest piece size for multi-piece regions
          let currentWidth: number
          let currentHeight: number

          const cachedSize = largestPieceSizesRef.current.get(regionId)
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
          const isInsideViewport =
            regionSvgLeft < viewportRight &&
            regionSvgRight > viewportLeft &&
            regionSvgTop < viewportBottom &&
            regionSvgBottom > viewportTop

          regionsChecked.push({ id: regionId, inside: isInsideViewport })

          if (!isInsideViewport) continue // Skip regions not in viewport

          // Region is in viewport - check if it's a good size
          const magnifiedWidth = currentWidth * testZoom
          const magnifiedHeight = currentHeight * testZoom

          const widthRatio = magnifiedWidth / magnifierWidth
          const heightRatio = magnifiedHeight / magnifierHeight

          // Update the checked region data with ratio
          regionsChecked[regionsChecked.length - 1].ratio = Math.max(widthRatio, heightRatio)

          // If either dimension is within our adaptive acceptance range, we found a good zoom
          if (
            (widthRatio >= minAcceptableRatio && widthRatio <= maxAcceptableRatio) ||
            (heightRatio >= minAcceptableRatio && heightRatio <= maxAcceptableRatio)
          ) {
            adaptiveZoom = testZoom
            foundFit = true
            foundGoodZoom = true

            // Only log when we actually accept a zoom
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
        adaptiveZoom = MIN_ZOOM
        if (pointerLocked) {
          console.log(`[Zoom Search] ⚠️ No good zoom found, using minimum: ${MIN_ZOOM}x`)
        }
      }

      // Save bounding boxes for rendering
      setDebugBoundingBoxes(boundingBoxes)

      // Calculate magnifier position (opposite corner from cursor)
      // magnifierWidth and magnifierHeight already declared above
      const isLeftHalf = cursorX < containerRect.width / 2
      const isTopHalf = cursorY < containerRect.height / 2

      const newTop = isTopHalf ? containerRect.height - magnifierHeight - 20 : 20
      const newLeft = isLeftHalf ? containerRect.width - magnifierWidth - 20 : 20

      if (pointerLocked) {
        console.log(
          '[Magnifier] SHOWING with zoom:',
          adaptiveZoom,
          '| Setting opacity to 1, position:',
          { top: newTop, left: newLeft }
        )
      }

      // Cap zoom if not in pointer lock mode to prevent excessive screen pixel ratios
      if (!pointerLocked && containerRef.current && svgRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        const magnifierWidth = containerRect.width * 0.5
        const viewBoxParts = mapData.viewBox.split(' ').map(Number)
        const viewBoxWidth = viewBoxParts[2]

        if (viewBoxWidth && !isNaN(viewBoxWidth)) {
          // Calculate what the screen pixel ratio would be at this zoom
          const magnifiedViewBoxWidth = viewBoxWidth / adaptiveZoom
          const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
          const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width
          const screenPixelRatio = mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

          // If it exceeds threshold, cap the zoom to stay at threshold
          if (screenPixelRatio > PRECISION_MODE_THRESHOLD) {
            // Solve for max zoom: ratio = zoom * (magnifierWidth / mainMapWidth)
            const maxZoom = PRECISION_MODE_THRESHOLD / (magnifierWidth / svgRect.width)
            adaptiveZoom = Math.min(adaptiveZoom, maxZoom)
            console.log(
              `[Magnifier] Capping zoom at ${adaptiveZoom.toFixed(1)}× (threshold: ${PRECISION_MODE_THRESHOLD} px/px, would have been ${screenPixelRatio.toFixed(1)} px/px)`
            )
          }
        }
      }

      setTargetZoom(adaptiveZoom)
      setShowMagnifier(true)
      setTargetOpacity(1)
      setTargetTop(newTop)
      setTargetLeft(newLeft)
    } else {
      if (pointerLocked) {
        console.log('[Magnifier] HIDING - not enough regions or too large | Setting opacity to 0')
      }
      setShowMagnifier(false)
      setTargetOpacity(0)
      setDebugBoundingBoxes([]) // Clear bounding boxes when hiding
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
    setDebugBoundingBoxes([]) // Clear bounding boxes when leaving
    cursorPositionRef.current = null
  }

  return (
    <div
      ref={containerRef}
      data-component="map-renderer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
      className={css({
        position: 'relative',
        width: '100%',
        height: '100%',
        bg: isDark ? 'gray.900' : 'gray.50',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <svg
        ref={svgRef}
        viewBox={mapData.viewBox}
        className={css({
          maxWidth: '100%',
          maxHeight: '100%',
          cursor: pointerLocked ? 'crosshair' : 'pointer',
        })}
        style={{
          aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}`,
        }}
      >
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

        {/* Debug: Render bounding boxes (only if enabled) */}
        {showDebugBoundingBoxes &&
          debugBoundingBoxes.map((bbox) => (
            <g key={`bbox-${bbox.regionId}`}>
              <rect
                x={bbox.x}
                y={bbox.y}
                width={bbox.width}
                height={bbox.height}
                fill="none"
                stroke="#ff0000"
                strokeWidth={viewBoxWidth / 500}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="3,3"
                pointerEvents="none"
                opacity={0.8}
              />
              {/* Label showing region ID */}
              <text
                x={bbox.x + bbox.width / 2}
                y={bbox.y + bbox.height / 2}
                fill="#ff0000"
                fontSize={viewBoxWidth / 80}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                style={{ fontWeight: 'bold' }}
              >
                {bbox.regionId}
              </text>
            </g>
          ))}

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
      {(() => {
        // Debug logging removed - was flooding console
        return pointerLocked && cursorPosition ? (
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
              transform: `translate(-50%, -50%) scale(${cursorSquish.x}, ${cursorSquish.y})`,
              backgroundColor: 'transparent',
              boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.1s ease-out', // Smooth squish animation
            }}
          >
            {/* Crosshair - Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '0',
                width: '2px',
                height: '100%',
                backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                transform: 'translateX(-50%)',
              }}
            />
            {/* Crosshair - Horizontal line */}
            <div
              style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                width: '100%',
                height: '2px',
                backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        ) : null
      })()}

      {/* Magnifier Window - Always rendered when cursor exists, opacity controlled by spring */}
      {cursorPosition && svgRef.current && containerRef.current && (
        <animated.div
          data-element="magnifier"
          style={{
            position: 'absolute',
            // Animated positioning - smoothly moves to opposite corner from cursor
            top: magnifierSpring.top,
            left: magnifierSpring.left,
            width: '50%',
            aspectRatio: '2/1',
            // High zoom (>60x) gets gold border, normal zoom gets blue border
            border: magnifierSpring.zoom.to(
              (zoom) =>
                zoom > HIGH_ZOOM_THRESHOLD
                  ? `4px solid ${isDark ? '#fbbf24' : '#f59e0b'}` // gold-400/gold-500
                  : `3px solid ${isDark ? '#60a5fa' : '#3b82f6'}` // blue-400/blue-600
            ),
            borderRadius: '12px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: magnifierSpring.zoom.to((zoom) =>
              zoom > HIGH_ZOOM_THRESHOLD
                ? '0 10px 40px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.2)' // Gold glow
                : '0 10px 40px rgba(0, 0, 0, 0.5)'
            ),
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
              filter: (() => {
                // Apply "disabled" visual effect when at threshold but not in precision mode
                if (pointerLocked) return 'none'

                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect) return 'none'

                const magnifierWidth = containerRect.width * 0.5
                const viewBoxParts = mapData.viewBox.split(' ').map(Number)
                const viewBoxWidth = viewBoxParts[2]
                if (!viewBoxWidth || isNaN(viewBoxWidth)) return 'none'

                const currentZoom = magnifierSpring.zoom.get()
                const magnifiedViewBoxWidth = viewBoxWidth / currentZoom
                const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
                const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width
                const screenPixelRatio =
                  mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

                // When at or above threshold (but not in precision mode), add disabled effect
                if (screenPixelRatio >= PRECISION_MODE_THRESHOLD) {
                  return 'brightness(0.6) saturate(0.5)'
                }

                return 'none'
              })(),
            }}
          >
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

            {/* Pixel grid overlay - shows when approaching/at/above precision mode threshold */}
            {(() => {
              const containerRect = containerRef.current?.getBoundingClientRect()
              const svgRect = svgRef.current?.getBoundingClientRect()
              if (!containerRect || !svgRect) return null

              const magnifierWidth = containerRect.width * 0.5
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2]
              const viewBoxHeight = viewBoxParts[3]
              const viewBoxX = viewBoxParts[0] || 0
              const viewBoxY = viewBoxParts[1] || 0

              if (!viewBoxWidth || isNaN(viewBoxWidth)) return null

              const currentZoom = magnifierSpring.zoom.get()
              const magnifiedViewBoxWidth = viewBoxWidth / currentZoom
              const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
              const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width
              const screenPixelRatio =
                mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

              // Fade grid in/out within 30% range on both sides of threshold
              // Visible from 70% to 130% of threshold (14 to 26 px/px at threshold=20)
              const fadeStartRatio = PRECISION_MODE_THRESHOLD * 0.7
              const fadeEndRatio = PRECISION_MODE_THRESHOLD * 1.3

              if (screenPixelRatio < fadeStartRatio || screenPixelRatio > fadeEndRatio) return null

              // Calculate opacity: 0 at edges (70% and 130%), 1 at threshold (100%)
              let gridOpacity: number
              if (screenPixelRatio <= PRECISION_MODE_THRESHOLD) {
                // Fading in: 0 at 70%, 1 at 100%
                gridOpacity =
                  (screenPixelRatio - fadeStartRatio) / (PRECISION_MODE_THRESHOLD - fadeStartRatio)
              } else {
                // Fading out: 1 at 100%, 0 at 130%
                gridOpacity =
                  (fadeEndRatio - screenPixelRatio) / (fadeEndRatio - PRECISION_MODE_THRESHOLD)
              }

              // Calculate grid spacing in SVG units
              // Each grid cell represents one screen pixel of mouse movement on the main map
              const gridSpacingSvgUnits = mainMapSvgUnitsPerScreenPixel

              // Get cursor position in SVG coordinates
              const scaleX = viewBoxWidth / svgRect.width
              const scaleY = viewBoxHeight / svgRect.height
              const svgOffsetX = svgRect.left - containerRect.left
              const svgOffsetY = svgRect.top - containerRect.top
              const cursorSvgX = (cursorPosition.x - svgOffsetX) * scaleX + viewBoxX
              const cursorSvgY = (cursorPosition.y - svgOffsetY) * scaleY + viewBoxY

              // Calculate grid bounds (magnifier viewport)
              const magnifiedHeight = viewBoxHeight / currentZoom
              const gridLeft = cursorSvgX - magnifiedViewBoxWidth / 2
              const gridRight = cursorSvgX + magnifiedViewBoxWidth / 2
              const gridTop = cursorSvgY - magnifiedHeight / 2
              const gridBottom = cursorSvgY + magnifiedHeight / 2

              // Calculate grid line positions aligned with cursor (crosshair center)
              const lines: Array<{ type: 'h' | 'v'; pos: number }> = []

              // Vertical lines (aligned with cursor X)
              const firstVerticalLine =
                Math.floor((gridLeft - cursorSvgX) / gridSpacingSvgUnits) * gridSpacingSvgUnits +
                cursorSvgX
              for (let x = firstVerticalLine; x <= gridRight; x += gridSpacingSvgUnits) {
                lines.push({ type: 'v', pos: x })
              }

              // Horizontal lines (aligned with cursor Y)
              const firstHorizontalLine =
                Math.floor((gridTop - cursorSvgY) / gridSpacingSvgUnits) * gridSpacingSvgUnits +
                cursorSvgY
              for (let y = firstHorizontalLine; y <= gridBottom; y += gridSpacingSvgUnits) {
                lines.push({ type: 'h', pos: y })
              }

              // Apply opacity to grid color
              const baseOpacity = isDark ? 0.5 : 0.6
              const finalOpacity = baseOpacity * gridOpacity
              const gridColor = `rgba(251, 191, 36, ${finalOpacity})`

              return (
                <g data-element="pixel-grid-overlay">
                  {lines.map((line, i) =>
                    line.type === 'v' ? (
                      <line
                        key={`vgrid-${i}`}
                        x1={line.pos}
                        y1={gridTop}
                        x2={line.pos}
                        y2={gridBottom}
                        stroke={gridColor}
                        strokeWidth={viewBoxWidth / 2000}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <line
                        key={`hgrid-${i}`}
                        x1={gridLeft}
                        y1={line.pos}
                        x2={gridRight}
                        y2={line.pos}
                        stroke={gridColor}
                        strokeWidth={viewBoxWidth / 2000}
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  )}
                </g>
              )
            })()}
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
              pointerEvents: pointerLocked ? 'none' : 'auto',
              cursor: pointerLocked ? 'default' : 'pointer',
            }}
            onClick={(e) => {
              // Request pointer lock when user clicks on notice
              if (!pointerLocked && containerRef.current) {
                e.stopPropagation() // Prevent click from bubbling to map
                containerRef.current.requestPointerLock()
              }
            }}
            data-element="magnifier-label"
          >
            {magnifierSpring.zoom.to((z) => {
              const multiplier = magnifierSpring.movementMultiplier.get()

              // When in pointer lock mode, show "Precision mode active" notice
              if (pointerLocked) {
                return 'Precision mode active'
              }

              // When NOT in pointer lock, calculate screen pixel ratio
              const containerRect = containerRef.current?.getBoundingClientRect()
              const svgRect = svgRef.current?.getBoundingClientRect()
              if (!containerRect || !svgRect) {
                return `${z.toFixed(1)}×`
              }

              const magnifierWidth = containerRect.width * 0.5
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2]

              if (!viewBoxWidth || isNaN(viewBoxWidth)) {
                return `${z.toFixed(1)}×`
              }

              // SVG units visible in magnifier
              const magnifiedViewBoxWidth = viewBoxWidth / z

              // Screen pixels per SVG unit in magnifier window
              const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth

              // SVG units per screen pixel on main map
              const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width

              // Screen pixel movement in magnifier =
              // (SVG units moved on main map) × (screen pixels per SVG unit in magnifier)
              const screenPixelRatio =
                mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

              // If at or above threshold, show notice about activating precision controls
              if (screenPixelRatio >= PRECISION_MODE_THRESHOLD) {
                return 'Click to activate precision mode'
              }

              // Below threshold - show debug info in dev, simple zoom in prod
              if (SHOW_MAGNIFIER_DEBUG_INFO) {
                return `${z.toFixed(1)}× | ${screenPixelRatio.toFixed(1)} px/px`
              }

              return `${z.toFixed(1)}×`
            })}
          </animated.div>

          {/* Scrim overlay - shows when at threshold to indicate barrier */}
          {!pointerLocked &&
            (() => {
              const containerRect = containerRef.current?.getBoundingClientRect()
              const svgRect = svgRef.current?.getBoundingClientRect()
              if (!containerRect || !svgRect) return null

              const magnifierWidth = containerRect.width * 0.5
              const viewBoxParts = mapData.viewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2]
              if (!viewBoxWidth || isNaN(viewBoxWidth)) return null

              const currentZoom = magnifierSpring.zoom.get()
              const magnifiedViewBoxWidth = viewBoxWidth / currentZoom
              const magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
              const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgRect.width
              const screenPixelRatio =
                mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit

              // Only show scrim when at or above threshold
              if (screenPixelRatio < PRECISION_MODE_THRESHOLD) return null

              return (
                <div
                  data-element="precision-mode-scrim"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(251, 191, 36, 0.15)', // Gold scrim
                    pointerEvents: 'none',
                    borderRadius: '12px',
                  }}
                />
              )
            })()}
        </animated.div>
      )}
    </div>
  )
}
