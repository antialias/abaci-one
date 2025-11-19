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
  difficulty: 'easy' | 'hard'
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
  onRegionClick,
  guessHistory,
  playerMetadata,
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
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgDimensions, setSvgDimensions] = useState({ width: 1000, height: 500 })
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [showMagnifier, setShowMagnifier] = useState(false)
  const [targetZoom, setTargetZoom] = useState(10)
  const [targetOpacity, setTargetOpacity] = useState(0)

  // Animated spring values for smooth transitions
  const magnifierSpring = useSpring({
    zoom: targetZoom,
    opacity: targetOpacity,
    config: {
      tension: 200,
      friction: 25,
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

      mapData.regions.forEach((region) => {
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
        const shouldShowLabel = regionsFound.includes(region.id) || (isSmall && showArrows)

        if (shouldShowLabel) {
          const players = regionsFound.includes(region.id)
            ? guessHistory
                .filter((guess) => guess.regionId === region.id && guess.correct)
                .map((guess) => guess.playerId)
                .filter((playerId, index, self) => self.indexOf(playerId) === index)
            : undefined

          const labelWidth = region.name.length * 7 + 15
          const labelHeight = isSmall ? 25 : 30

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

        // Extract positions from simulation results
        for (const node of allLabelNodes) {
          if (node.isSmall) {
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
          } else {
            positions.push({
              regionId: node.id,
              regionName: node.name,
              x: node.x!,
              y: node.y!,
              players: node.players || [],
            })
          }
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
  }, [mapData, regionsFound, guessHistory, svgDimensions])

  // Calculate viewBox dimensions for label offset calculations
  const viewBoxParts = mapData.viewBox.split(' ').map(Number)
  const viewBoxWidth = viewBoxParts[2] || 1000
  const viewBoxHeight = viewBoxParts[3] || 1000

  const showOutline = (region: MapRegion): boolean => {
    // Easy mode: always show outlines
    if (difficulty === 'easy') return true

    // Hard mode: only show outline on hover or if found
    return hoveredRegion === region.id || regionsFound.includes(region.id)
  }

  // Handle mouse movement to track cursor and show magnifier when needed
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!svgRef.current || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()

    // Get cursor position relative to container
    const cursorX = e.clientX - containerRect.left
    const cursorY = e.clientY - containerRect.top

    // Check if cursor is over the SVG
    const isOverSvg =
      e.clientX >= svgRect.left &&
      e.clientX <= svgRect.right &&
      e.clientY >= svgRect.top &&
      e.clientY <= svgRect.bottom

    if (!isOverSvg) {
      setShowMagnifier(false)
      setTargetOpacity(0)
      setCursorPosition(null)
      return
    }

    setCursorPosition({ x: cursorX, y: cursorY })

    // Define 50px × 50px detection box around cursor
    const detectionBoxSize = 50
    const halfBox = detectionBoxSize / 2

    // Count regions in the detection box and track their sizes
    let regionsInBox = 0
    let hasSmallRegion = false
    let totalRegionArea = 0
    let smallestRegionSize = Infinity

    mapData.regions.forEach((region) => {
      const regionPath = svgRef.current?.querySelector(`path[data-region-id="${region.id}"]`)
      if (!regionPath) return

      const pathRect = regionPath.getBoundingClientRect()

      // Check if region overlaps with detection box
      const boxLeft = e.clientX - halfBox
      const boxRight = e.clientX + halfBox
      const boxTop = e.clientY - halfBox
      const boxBottom = e.clientY + halfBox

      const regionLeft = pathRect.left
      const regionRight = pathRect.right
      const regionTop = pathRect.top
      const regionBottom = pathRect.bottom

      const overlaps =
        regionLeft < boxRight &&
        regionRight > boxLeft &&
        regionTop < boxBottom &&
        regionBottom > boxTop

      if (overlaps) {
        regionsInBox++

        // Check if this region is very small (stricter threshold)
        const pixelWidth = pathRect.width
        const pixelHeight = pathRect.height
        const pixelArea = pathRect.width * pathRect.height
        const isVerySmall = pixelWidth < 8 || pixelHeight < 8 || pixelArea < 64

        if (isVerySmall) {
          hasSmallRegion = true
        }

        // Track region sizes for adaptive zoom
        totalRegionArea += pixelArea
        const regionSize = Math.min(pixelWidth, pixelHeight)
        smallestRegionSize = Math.min(smallestRegionSize, regionSize)
      }
    })

    // Calculate adaptive zoom level based on region density and size
    // Base zoom: 8x
    // More regions = more zoom (up to +8x for 10+ regions)
    // Smaller regions = more zoom (up to +8x for very tiny regions)
    // Stricter threshold: 7+ regions OR very small regions (< 8px)
    const shouldShow = regionsInBox >= 7 || hasSmallRegion

    if (shouldShow) {
      let adaptiveZoom = 8 // Base zoom

      // Add zoom based on region count (crowded areas need more zoom)
      const countFactor = Math.min(regionsInBox / 10, 1) // 0 to 1
      adaptiveZoom += countFactor * 8

      // Add zoom based on smallest region size (tiny regions need more zoom)
      if (smallestRegionSize !== Infinity) {
        const sizeFactor = Math.max(0, 1 - smallestRegionSize / 20) // 0 to 1 (1 = very small)
        adaptiveZoom += sizeFactor * 8
      }

      // Clamp zoom between 8x and 24x
      adaptiveZoom = Math.max(8, Math.min(24, adaptiveZoom))

      setTargetZoom(adaptiveZoom)
      setShowMagnifier(true)
      setTargetOpacity(1)
    } else {
      setShowMagnifier(false)
      setTargetOpacity(0)
    }
  }

  const handleMouseLeave = () => {
    setShowMagnifier(false)
    setTargetOpacity(0)
    setCursorPosition(null)
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
          cursor: 'pointer',
        })}
      >
        {/* Background */}
        <rect x="0" y="0" width="100%" height="100%" fill={isDark ? '#111827' : '#f3f4f6'} />

        {/* Render all regions */}
        {mapData.regions.map((region) => (
          <g key={region.id}>
            {/* Region path */}
            <path
              data-region-id={region.id}
              d={region.path}
              fill={getRegionColor(
                region.id,
                regionsFound.includes(region.id),
                hoveredRegion === region.id,
                isDark
              )}
              stroke={getRegionStroke(regionsFound.includes(region.id), isDark)}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={showOutline(region) ? 1 : 0.3}
              onMouseEnter={() => setHoveredRegion(region.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              onClick={() => onRegionClick(region.id, region.name)}
              style={{
                cursor: 'pointer',
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
              fontSize: '11px',
              fontWeight: 'bold',
              color: getLabelTextColor(isDark, true),
              textShadow: getLabelTextShadow(isDark, true),
              whiteSpace: 'nowrap',
              textAlign: 'center',
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

      {/* Magnifier Window */}
      {showMagnifier && cursorPosition && svgRef.current && containerRef.current && (
        <animated.div
          data-element="magnifier"
          style={{
            position: 'absolute',
            // Dynamic positioning to avoid cursor
            ...(() => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const magnifierWidth = containerRect.width * 0.5
              const magnifierHeight = magnifierWidth / 2

              // Determine which quadrant cursor is in
              const isLeftHalf = cursorPosition.x < containerRect.width / 2
              const isTopHalf = cursorPosition.y < containerRect.height / 2

              // Position in opposite corner from cursor
              return {
                top: isTopHalf ? 'auto' : '20px',
                bottom: isTopHalf ? '20px' : 'auto',
                left: isLeftHalf ? 'auto' : '20px',
                right: isLeftHalf ? '20px' : 'auto',
              }
            })(),
            width: '50%',
            aspectRatio: '2/1',
            border: `3px solid ${isDark ? '#60a5fa' : '#3b82f6'}`,
            borderRadius: '12px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
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
            {mapData.regions.map((region) => (
              <path
                key={`mag-${region.id}`}
                d={region.path}
                fill={getRegionColor(
                  region.id,
                  regionsFound.includes(region.id),
                  hoveredRegion === region.id,
                  isDark
                )}
                stroke={getRegionStroke(regionsFound.includes(region.id), isDark)}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                opacity={showOutline(region) ? 1 : 0.3}
              />
            ))}

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
