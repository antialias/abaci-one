/**
 * 1:1 Panning Math Utilities
 *
 * Functions for calculating touch multipliers that enable "1:1 panning" -
 * where moving your finger N pixels moves the content N pixels visually
 * in the magnifier view.
 *
 * The math accounts for:
 * 1. How the SVG is scaled to fit the container (viewport scale)
 * 2. How the magnifier zooms the content (currentZoom)
 * 3. The actual magnifier dimensions (which may be expanded)
 */

// ============================================================================
// Types
// ============================================================================

export interface ViewportInfo {
  /** Width of SVG viewBox */
  viewBoxWidth: number;
  /** Height of SVG viewBox */
  viewBoxHeight: number;
  /** Rendered width of SVG element */
  svgWidth: number;
  /** Rendered height of SVG element */
  svgHeight: number;
}

export interface MagnifierInfo {
  /** Actual width of magnifier (accounting for expansion) */
  width: number;
  /** Actual height of magnifier (accounting for expansion) */
  height: number;
  /** Current zoom level */
  zoom: number;
}

export interface TouchMultiplierResult {
  /** Multiplier to apply to touch delta for cursor movement */
  multiplier: number;
  /** Viewport scale (SVG rendering scale) */
  viewportScale: number;
  /** Magnifier scale (content scale within magnifier) */
  magnifierScale: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate the viewport scale - how the SVG is scaled to fit its container.
 *
 * When the SVG aspect ratio differs from the container, one dimension
 * is constrained and the other has letterboxing.
 */
export function calculateViewportScale(viewport: ViewportInfo): number {
  const { viewBoxWidth, viewBoxHeight, svgWidth, svgHeight } = viewport;

  const svgAspect = viewBoxWidth / viewBoxHeight;
  const containerAspect = svgWidth / svgHeight;

  // Use the constrained dimension's scale
  return containerAspect > svgAspect
    ? svgHeight / viewBoxHeight // Height-constrained
    : svgWidth / viewBoxWidth; // Width-constrained
}

/**
 * Calculate the magnifier scale - how content is scaled within the magnifier.
 *
 * Uses the smaller scale factor to ensure 1:1 feel in the constrained direction.
 */
export function calculateMagnifierScale(
  viewport: ViewportInfo,
  magnifier: MagnifierInfo,
): number {
  const { viewBoxWidth, viewBoxHeight } = viewport;
  const { width, height, zoom } = magnifier;

  const magnifierScaleX = (width * zoom) / viewBoxWidth;
  const magnifierScaleY = (height * zoom) / viewBoxHeight;

  // Use smaller scale to ensure consistency (magnifier may not be square)
  return Math.min(magnifierScaleX, magnifierScaleY);
}

/**
 * Calculate the touch multiplier for 1:1 panning.
 *
 * When this multiplier is applied to touch delta, moving your finger
 * N pixels will move the content N pixels visually in the magnifier.
 *
 * The formula:
 * - Magnifier shows (viewBoxW / zoom) SVG units across magnifierWidth pixels
 * - SVG renders at viewportScale (container px per SVG unit)
 * - touchMultiplier = viewportScale / magnifierScale
 *
 * @example
 * ```ts
 * const { multiplier } = calculateTouchMultiplier(viewport, magnifier)
 *
 * // Apply to touch delta (inverted because we're moving the "paper")
 * const newCursorX = cursorX - deltaX * multiplier
 * const newCursorY = cursorY - deltaY * multiplier
 * ```
 */
export function calculateTouchMultiplier(
  viewport: ViewportInfo,
  magnifier: MagnifierInfo,
): TouchMultiplierResult {
  const viewportScale = calculateViewportScale(viewport);
  const magnifierScale = calculateMagnifierScale(viewport, magnifier);

  return {
    multiplier: viewportScale / magnifierScale,
    viewportScale,
    magnifierScale,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Parse viewBox string into dimensions.
 *
 * @param viewBox - SVG viewBox string (e.g., "0 0 1000 500")
 * @returns Object with x, y, width, height (defaults if parsing fails)
 */
export function parseViewBoxDimensions(viewBox: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const parts = viewBox.split(" ").map(Number);
  return {
    x: parts[0] || 0,
    y: parts[1] || 0,
    width: parts[2] || 1000,
    height: parts[3] || 500,
  };
}

/**
 * Apply touch delta to cursor position with 1:1 panning.
 *
 * @param currentCursor - Current cursor position
 * @param delta - Touch movement delta
 * @param multiplier - Touch multiplier from calculateTouchMultiplier
 * @returns New cursor position (inverted for "paper dragging" feel)
 */
export function applyPanDelta(
  currentCursor: { x: number; y: number },
  delta: { x: number; y: number },
  multiplier: number,
): { x: number; y: number } {
  // Invert delta - dragging the "paper" under the magnifier means:
  // - Drag finger right = paper moves right = magnifier shows what was to the LEFT
  return {
    x: currentCursor.x - delta.x * multiplier,
    y: currentCursor.y - delta.y * multiplier,
  };
}

/**
 * Clamp cursor position to SVG bounds.
 *
 * @param cursor - Cursor position to clamp
 * @param svgBounds - SVG element bounds relative to container
 * @returns Clamped cursor position
 */
export function clampToSvgBounds(
  cursor: { x: number; y: number },
  svgBounds: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  return {
    x: Math.max(
      svgBounds.left,
      Math.min(svgBounds.left + svgBounds.width, cursor.x),
    ),
    y: Math.max(
      svgBounds.top,
      Math.min(svgBounds.top + svgBounds.height, cursor.y),
    ),
  };
}

/**
 * Information about the SVG viewport including letterboxing
 */
export interface RenderedViewport {
  /** Scale factor for converting pixels to SVG units */
  scale: number;
  /** Horizontal letterbox offset in pixels */
  letterboxX: number;
  /** Vertical letterbox offset in pixels */
  letterboxY: number;
}

/**
 * Convert cursor position (in container coordinates) to SVG coordinates.
 *
 * Accounts for:
 * - Container offset from viewport
 * - SVG letterboxing due to preserveAspectRatio
 * - SVG scale factor
 * - ViewBox origin
 *
 * @param cursorPosition - Cursor position relative to container
 * @param containerRect - Container element bounding rect
 * @param svgRect - SVG element bounding rect
 * @param viewport - Viewport info from getRenderedViewport
 * @param viewBox - Parsed viewBox dimensions
 * @returns Cursor position in SVG coordinate space
 */
export function cursorToSvgCoordinates(
  cursorPosition: { x: number; y: number },
  containerRect: DOMRect,
  svgRect: DOMRect,
  viewport: RenderedViewport,
  viewBox: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX;
  const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY;

  return {
    x: (cursorPosition.x - svgOffsetX) / viewport.scale + viewBox.x,
    y: (cursorPosition.y - svgOffsetY) / viewport.scale + viewBox.y,
  };
}
