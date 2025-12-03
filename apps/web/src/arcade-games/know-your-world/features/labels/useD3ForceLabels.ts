/**
 * useD3ForceLabels - D3 force simulation for label positioning
 *
 * This hook handles the positioning of labels for found regions using D3's
 * force simulation to avoid overlaps. It supports:
 * - Regular labels for large regions (positioned at centroid)
 * - Small region labels with arrows (positioned via force simulation)
 * - Obstacle avoidance (labels pushed away from other regions)
 */

import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force'
import { RefObject, useEffect, useState } from 'react'

import type { MapData, MapRegion } from '../../types'
import { getArrowStartPoint, getRenderedViewport } from './labelUtils'
import type { ForceTuningConfig, RegionLabelPosition, SmallRegionLabelPosition } from './types'

export interface GuessHistoryItem {
  regionId: string
  playerId: string
  correct: boolean
}

export interface UseD3ForceLabelsParams {
  /** Map data containing regions */
  mapData: MapData
  /** Regions excluded from the game (filtered by size/continent) */
  excludedRegions: MapRegion[]
  /** Set of excluded region IDs for quick lookup */
  excludedRegionIds: Set<string>
  /** Array of found region IDs */
  regionsFound: string[]
  /** History of guesses to track who found what */
  guessHistory: GuessHistoryItem[]
  /** Current SVG viewBox string */
  displayViewBox: string
  /** SVG container dimensions */
  svgDimensions: { width: number; height: number }
  /** Reference to the SVG element */
  svgRef: RefObject<SVGSVGElement | null>
  /** Reference to the container element */
  containerRef: RefObject<HTMLDivElement | null>
  /** Force simulation tuning parameters */
  forceTuning?: ForceTuningConfig
}

export interface UseD3ForceLabelsReturn {
  /** Positions for regular (large) region labels */
  labelPositions: RegionLabelPosition[]
  /** Positions for small region labels with arrows */
  smallRegionLabelPositions: SmallRegionLabelPosition[]
}

/**
 * Hook for calculating label positions using D3 force simulation
 *
 * Labels for large regions are positioned directly at the region centroid.
 * Labels for small regions use D3 force simulation to avoid overlaps and
 * are connected to their regions with arrows.
 */
export function useD3ForceLabels({
  mapData,
  excludedRegions,
  excludedRegionIds,
  regionsFound,
  guessHistory,
  displayViewBox,
  svgDimensions,
  svgRef,
  containerRef,
  forceTuning = {},
}: UseD3ForceLabelsParams): UseD3ForceLabelsReturn {
  const [labelPositions, setLabelPositions] = useState<RegionLabelPosition[]>([])
  const [smallRegionLabelPositions, setSmallRegionLabelPositions] = useState<
    SmallRegionLabelPosition[]
  >([])

  // Extract force tuning parameters with defaults
  const {
    showArrows = false,
    centeringStrength = 2.0,
    collisionPadding = 5,
    simulationIterations = 200,
    useObstacles = true,
    obstaclePadding = 10,
  } = forceTuning

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const updateLabelPositions = () => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const positions: RegionLabelPosition[] = []
      const smallPositions: SmallRegionLabelPosition[] = []

      // Parse viewBox for scale calculations
      const viewBoxParts = displayViewBox.split(' ').map(Number)
      const viewBoxX = viewBoxParts[0] || 0
      const viewBoxY = viewBoxParts[1] || 0
      const viewBoxWidth = viewBoxParts[2] || 1000
      const viewBoxHeight = viewBoxParts[3] || 1000

      const svgRect = svgRef.current?.getBoundingClientRect()
      if (!svgRect) return

      // Get the actual rendered viewport accounting for preserveAspectRatio letterboxing
      const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight)
      const scaleX = viewport.scale
      const scaleY = viewport.scale // Same as scaleX due to uniform scaling

      // Calculate SVG offset within container (accounts for padding + letterboxing)
      const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
      const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

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

        // Collect label nodes for regions that need labels
        // Only show arrow labels for small regions if showArrows flag is enabled
        // Exception: Washington DC always gets arrow label (too small on USA map)
        const isDC = region.id === 'dc'
        const isExcluded = excludedRegionIds.has(region.id)
        // Show label if: region is found, OR it's small and arrows enabled
        // Note: Excluded regions do NOT get labels - they're just grayed out
        const shouldShowLabel =
          regionsFound.includes(region.id) || (isSmall && (showArrows || isDC))

        if (shouldShowLabel && !isExcluded) {
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
    }

    // Small delay to ensure ghost elements are rendered
    const timeoutId = setTimeout(updateLabelPositions, 0)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    mapData,
    regionsFound,
    guessHistory,
    svgDimensions,
    excludedRegions,
    excludedRegionIds,
    displayViewBox,
    showArrows,
    centeringStrength,
    collisionPadding,
    simulationIterations,
    useObstacles,
    obstaclePadding,
    svgRef,
    containerRef,
  ])

  return {
    labelPositions,
    smallRegionLabelPositions,
  }
}
