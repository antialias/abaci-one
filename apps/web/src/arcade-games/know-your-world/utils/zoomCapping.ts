/**
 * Zoom Capping Logic
 *
 * This module contains functions for capping zoom levels at the precision
 * mode threshold. When not in pointer lock mode, zoom is capped to prevent
 * excessive screen pixel ratios that make the magnifier too sensitive.
 */

import {
  calculateScreenPixelRatio,
  calculateMaxZoomAtThreshold,
  isAboveThreshold,
  type ZoomContext,
} from './screenPixelRatio'

export interface ZoomCappingContext {
  /** The zoom level to potentially cap */
  zoom: number
  /** Width of the magnifier in screen pixels */
  magnifierWidth: number
  /** Width of the SVG viewBox */
  viewBoxWidth: number
  /** Width of the SVG element in screen pixels */
  svgWidth: number
  /** Precision mode threshold (e.g., 20 px/px) */
  threshold: number
  /** Whether pointer lock is active (no capping if true) */
  pointerLocked: boolean
}

export interface ZoomCappingResult {
  /** The (possibly capped) zoom level */
  cappedZoom: number
  /** Whether the zoom was capped */
  wasCapped: boolean
  /** The original uncapped zoom */
  originalZoom: number
  /** The screen pixel ratio at the original zoom */
  screenPixelRatio: number
}

/**
 * Cap zoom at the precision mode threshold if not in pointer lock mode.
 *
 * When not in pointer lock mode, zoom is capped to prevent excessive
 * screen pixel ratios. This ensures the magnifier doesn't become too
 * sensitive before the user activates precision controls.
 *
 * @param context - The zoom capping context
 * @returns The capping result with capped zoom and metadata
 */
export function capZoomAtThreshold(context: ZoomCappingContext): ZoomCappingResult {
  const { zoom, magnifierWidth, viewBoxWidth, svgWidth, threshold, pointerLocked } = context

  // No capping when pointer lock is active
  if (pointerLocked) {
    return {
      cappedZoom: zoom,
      wasCapped: false,
      originalZoom: zoom,
      screenPixelRatio: calculateScreenPixelRatio({
        magnifierWidth,
        viewBoxWidth,
        svgWidth,
        zoom,
      }),
    }
  }

  // Calculate screen pixel ratio at this zoom
  const screenPixelRatio = calculateScreenPixelRatio({
    magnifierWidth,
    viewBoxWidth,
    svgWidth,
    zoom,
  })

  // If below threshold, no capping needed
  if (!isAboveThreshold(screenPixelRatio, threshold)) {
    return {
      cappedZoom: zoom,
      wasCapped: false,
      originalZoom: zoom,
      screenPixelRatio,
    }
  }

  // Calculate the maximum zoom at the threshold
  const maxZoom = calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgWidth)
  const cappedZoom = Math.min(zoom, maxZoom)

  return {
    cappedZoom,
    wasCapped: true,
    originalZoom: zoom,
    screenPixelRatio,
  }
}

/**
 * Check if zoom would be capped at the threshold.
 *
 * This is a simpler check that doesn't return the capped value,
 * useful for determining if precision mode should be recommended.
 *
 * @param context - The zoom capping context
 * @returns True if zoom would be capped
 */
export function wouldZoomBeCapped(context: ZoomCappingContext): boolean {
  if (context.pointerLocked) {
    return false
  }

  const screenPixelRatio = calculateScreenPixelRatio({
    magnifierWidth: context.magnifierWidth,
    viewBoxWidth: context.viewBoxWidth,
    svgWidth: context.svgWidth,
    zoom: context.zoom,
  })

  return isAboveThreshold(screenPixelRatio, context.threshold)
}
