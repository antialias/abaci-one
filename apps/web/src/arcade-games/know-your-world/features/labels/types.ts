/**
 * Types for the Labels feature module
 *
 * This module handles:
 * - Label positioning using D3 force simulation
 * - Opacity calculations for cursor proximity
 * - Both regular and small region labels (with arrows)
 */

/**
 * Position data for a region label (regular/large regions)
 */
export interface RegionLabelPosition {
  regionId: string
  regionName: string
  x: number // pixel position
  y: number // pixel position
  players: string[]
}

/**
 * Position data for a small region label with arrow pointing to region
 */
export interface SmallRegionLabelPosition {
  regionId: string
  regionName: string
  isFound: boolean
  labelX: number // pixel position for label
  labelY: number // pixel position for label
  lineStartX: number // pixel position for line start (label edge)
  lineStartY: number // pixel position for line start
  lineEndX: number // pixel position for line end (region center)
  lineEndY: number // pixel position for line end
}

/**
 * Player metadata for displaying who found a region
 */
export interface PlayerMetadata {
  emoji?: string
  color?: string
}

/**
 * Configuration for the D3 force simulation
 */
export interface ForceTuningConfig {
  showArrows?: boolean
  centeringStrength?: number
  collisionPadding?: number
  simulationIterations?: number
  useObstacles?: boolean
  obstaclePadding?: number
}

/**
 * Rendered viewport information for SVG coordinate conversion
 */
export interface RenderedViewport {
  renderedWidth: number
  renderedHeight: number
  letterboxX: number // Offset from SVG element left edge to rendered content
  letterboxY: number // Offset from SVG element top edge to rendered content
  scale: number // Pixels per viewBox unit
  viewBoxX: number
  viewBoxY: number
}
