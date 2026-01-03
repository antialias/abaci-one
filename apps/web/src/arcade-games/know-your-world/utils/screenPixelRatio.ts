/**
 * Screen Pixel Ratio Calculations
 *
 * This module contains pure functions for calculating the screen pixel ratio
 * in the magnifier. The screen pixel ratio represents how many screen pixels
 * the magnifier "jumps" when the mouse moves one pixel on the main map.
 *
 * A high ratio (e.g., 50) means precision mode is recommended.
 */

export interface ZoomContext {
  /** Width of the magnifier in screen pixels */
  magnifierWidth: number;
  /** Width of the SVG viewBox */
  viewBoxWidth: number;
  /** Width of the SVG element in screen pixels */
  svgWidth: number;
  /** Current zoom level */
  zoom: number;
}

/**
 * Calculate the screen pixel ratio for the magnifier.
 *
 * This ratio represents how many screen pixels the magnifier "jumps over"
 * when the mouse moves one pixel on the main map.
 *
 * Formula:
 * 1. magnifiedViewBoxWidth = viewBoxWidth / zoom
 *    (How much of the viewBox is visible in the magnifier)
 *
 * 2. magnifierScreenPixelsPerSvgUnit = magnifierWidth / magnifiedViewBoxWidth
 *    (How many screen pixels per SVG unit in the magnifier)
 *
 * 3. mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgWidth
 *    (How many SVG units the mouse moves per screen pixel on main map)
 *
 * 4. screenPixelRatio = mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit
 *    (How many screen pixels the magnifier jumps per main map screen pixel)
 *
 * @param context - The zoom context containing dimensions and zoom level
 * @returns The screen pixel ratio
 */
export function calculateScreenPixelRatio(context: ZoomContext): number {
  const { magnifierWidth, viewBoxWidth, svgWidth, zoom } = context;

  // Step 1: How much of the viewBox is visible in the magnifier at this zoom
  const magnifiedViewBoxWidth = viewBoxWidth / zoom;

  // Step 2: Screen pixels per SVG unit in the magnifier
  const magnifierScreenPixelsPerSvgUnit =
    magnifierWidth / magnifiedViewBoxWidth;

  // Step 3: SVG units per screen pixel on the main map
  const mainMapSvgUnitsPerScreenPixel = viewBoxWidth / svgWidth;

  // Step 4: Screen pixels the magnifier jumps per main map screen pixel
  return mainMapSvgUnitsPerScreenPixel * magnifierScreenPixelsPerSvgUnit;
}

/**
 * Check if the screen pixel ratio is at or above a threshold.
 *
 * @param ratio - The screen pixel ratio to check
 * @param threshold - The threshold value
 * @returns True if ratio >= threshold
 */
export function isAboveThreshold(ratio: number, threshold: number): boolean {
  return ratio >= threshold;
}

/**
 * Calculate the maximum zoom level that keeps the screen pixel ratio at the threshold.
 *
 * This is used for capping zoom when not in precision mode.
 *
 * Formula:
 * screenPixelRatio = zoom × (magnifierWidth / svgWidth)
 * Therefore:
 * maxZoom = threshold / (magnifierWidth / svgWidth)
 *
 * @param threshold - The precision mode threshold
 * @param magnifierWidth - Width of the magnifier in screen pixels
 * @param svgWidth - Width of the SVG element in screen pixels
 * @returns The maximum zoom level at the threshold
 */
export function calculateMaxZoomAtThreshold(
  threshold: number,
  magnifierWidth: number,
  svgWidth: number,
): number {
  return threshold / (magnifierWidth / svgWidth);
}

/**
 * Create a ZoomContext from DOM elements.
 *
 * @param containerElement - The container element
 * @param svgElement - The SVG element
 * @param viewBoxWidth - The SVG viewBox width
 * @param zoom - The zoom level
 * @returns A ZoomContext object, or null if elements are missing
 */
export function createZoomContext(
  containerElement: HTMLElement | null,
  svgElement: SVGSVGElement | null,
  viewBoxWidth: number,
  zoom: number,
): ZoomContext | null {
  if (!containerElement || !svgElement) {
    return null;
  }

  const containerRect = containerElement.getBoundingClientRect();
  const svgRect = svgElement.getBoundingClientRect();
  const magnifierWidth = containerRect.width * 0.5;

  return {
    magnifierWidth,
    viewBoxWidth,
    svgWidth: svgRect.width,
    zoom,
  };
}
