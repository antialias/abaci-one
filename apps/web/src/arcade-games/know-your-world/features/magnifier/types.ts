/**
 * Types for the Magnifier feature module
 *
 * This module handles:
 * - Magnifier overlay rendering
 * - Crosshair visualization
 * - Pixel grid for precision mode
 * - Region highlighting in magnified view
 */

import type { SpringValue } from "@react-spring/web";

/**
 * Heat-based styling for hot/cold feedback
 */
export interface HeatColors {
  border: string;
  glow: string;
  width: number;
}

/**
 * Crosshair styling based on hot/cold feedback
 */
export interface CrosshairStyle {
  color: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * Viewport information for SVG coordinate calculations
 */
export interface ViewportInfo {
  letterboxX: number;
  letterboxY: number;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  viewBoxX: number;
  viewBoxY: number;
}

/**
 * Props for the MagnifierCrosshair component
 */
export interface MagnifierCrosshairProps {
  /** Cursor X position in SVG coordinates */
  cursorSvgX: number;
  /** Cursor Y position in SVG coordinates */
  cursorSvgY: number;
  /** ViewBox width for calculating crosshair size */
  viewBoxWidth: number;
  /** Spring value for rotation animation */
  rotationAngle: SpringValue<number>;
  /** Heat-based crosshair style */
  heatStyle: CrosshairStyle;
}

/**
 * Props for the MagnifierPixelGrid component
 */
export interface MagnifierPixelGridProps {
  /** Current zoom level */
  currentZoom: number;
  /** Screen pixel ratio at current zoom */
  screenPixelRatio: number;
  /** Precision mode threshold */
  precisionModeThreshold: number;
  /** Cursor X position in SVG coordinates */
  cursorSvgX: number;
  /** Cursor Y position in SVG coordinates */
  cursorSvgY: number;
  /** ViewBox dimensions */
  viewBoxWidth: number;
  viewBoxHeight: number;
  /** Viewport scale from main map */
  viewportScale: number;
  /** Whether dark mode is active */
  isDark: boolean;
}

/**
 * Props for the MagnifierRegions component
 */
export interface MagnifierRegionsProps {
  /** All regions to render */
  regions: Array<{
    id: string;
    path: string;
  }>;
  /** IDs of regions that have been found */
  regionsFound: string[];
  /** Currently hovered region ID */
  hoveredRegion: string | null;
  /** Region being revealed in give-up animation */
  giveUpReveal: { regionId: string } | null;
  /** Region being celebrated */
  celebration: { regionId: string } | null;
  /** Flash progress for give-up animation (0-1) */
  giveUpFlashProgress: number;
  /** Flash progress for celebration animation (0-1) */
  celebrationFlashProgress: number;
  /** Whether give-up animation is playing */
  isGiveUpAnimating: boolean;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Get player who found a region */
  getPlayerWhoFoundRegion: (regionId: string) => string | null;
  /** Get region fill color */
  getRegionColor: (
    regionId: string,
    isFound: boolean,
    isHovered: boolean,
    isDark: boolean,
  ) => string;
  /** Get region stroke color */
  getRegionStroke: (isFound: boolean, isDark: boolean) => string;
  /** Whether to show outline for a region */
  showOutline: (region: { id: string }) => boolean;
}

/**
 * Debug bounding box information
 */
export interface DebugBoundingBox {
  regionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  importance?: number;
  wasAccepted?: boolean;
}
