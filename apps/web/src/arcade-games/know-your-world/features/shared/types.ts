/**
 * Shared types for Know Your World feature modules
 *
 * These types are used across multiple features and provide
 * a common vocabulary for the game's coordinate systems,
 * state management, and component interfaces.
 */

import type { RefObject } from 'react'

// ============================================================================
// Coordinate & Position Types
// ============================================================================

/**
 * Screen/container-relative cursor position in pixels
 */
export interface CursorPosition {
  x: number
  y: number
}

/**
 * Position in SVG coordinate space (viewBox units)
 */
export interface SVGPosition {
  svgX: number
  svgY: number
}

/**
 * Bounding box in SVG coordinate space
 */
export interface SVGBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

// ============================================================================
// Viewport & Rendering Types
// ============================================================================

/**
 * Information about how the SVG viewBox is rendered within the container.
 * Accounts for preserveAspectRatio letterboxing.
 */
export interface ViewportInfo {
  /** Offset from container left edge to rendered content */
  letterboxX: number
  /** Offset from container top edge to rendered content */
  letterboxY: number
  /** Pixels per viewBox unit */
  scale: number
  /** Actual rendered width in pixels */
  renderedWidth: number
  /** Actual rendered height in pixels */
  renderedHeight: number
  /** ViewBox X origin */
  viewBoxX: number
  /** ViewBox Y origin */
  viewBoxY: number
}

/**
 * Parsed viewBox components
 */
export interface ViewBoxComponents {
  x: number
  y: number
  width: number
  height: number
}

// ============================================================================
// Game State Types (Slices for Feature Modules)
// ============================================================================

/**
 * Minimal game state needed by visual features
 */
export interface GameStateSlice {
  /** IDs of regions that have been found */
  regionsFound: string[]
  /** Currently hovered region ID */
  hoveredRegion: string | null
  /** Current target region ID to find */
  currentPrompt: string | null
  /** Region currently celebrating (just found) */
  celebration: { regionId: string } | null
  /** Region being revealed in give-up animation */
  giveUpReveal: { regionId: string } | null
  /** Whether give-up animation is playing */
  isGiveUpAnimating: boolean
}

/**
 * Player metadata for multiplayer display
 */
export interface PlayerMetadata {
  id: string
  emoji?: string
  color?: string
}

// ============================================================================
// Region Types
// ============================================================================

/**
 * Basic region data from map
 */
export interface MapRegion {
  id: string
  name: string
  path: string
}

/**
 * Region with computed bounding box
 */
export interface RegionWithBounds extends MapRegion {
  bounds: SVGBoundingBox
}

// ============================================================================
// Ref Types
// ============================================================================

/**
 * Common refs needed by multiple features
 */
export interface SharedRefs {
  containerRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>
}

// ============================================================================
// Dimension Types
// ============================================================================

/**
 * Container dimensions
 */
export interface Dimensions {
  width: number
  height: number
}

/**
 * Safe zone margins - areas reserved for UI elements
 */
export interface SafeZoneMargins {
  top: number
  right: number
  bottom: number
  left: number
}

// ============================================================================
// Animation Types
// ============================================================================

/**
 * Flash progress for pulsing animations (0-1)
 */
export interface FlashProgress {
  giveUpFlash: number
  celebrationFlash: number
}

// ============================================================================
// Hot/Cold Feedback Types
// ============================================================================

/**
 * Hot/cold feedback type for visual indicators
 */
export type HotColdFeedbackType = 'freezing' | 'cold' | 'cool' | 'warm' | 'hot' | 'burning' | null

/**
 * Heat-based styling for borders and glows
 */
export interface HeatColors {
  border: string
  glow: string
  width: number
}

/**
 * Crosshair styling based on hot/cold feedback
 */
export interface CrosshairStyle {
  color: string
  strokeWidth: number
  opacity: number
}
