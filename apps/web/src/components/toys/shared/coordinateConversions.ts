/**
 * Coordinate conversion utilities (world <-> screen) for 1D and 2D.
 *
 * The 1D functions match the existing numberToScreenX / screenXToNumber
 * from numberLineTicks.ts. The 2D wrappers extend them for the coordinate plane.
 */

// ── 1D conversions ──────────────────────────────────────────────────

/** Convert a world value to a screen coordinate along one axis */
export function worldToScreen(
  value: number,
  center: number,
  pixelsPerUnit: number,
  extent: number
): number {
  return (value - center) * pixelsPerUnit + extent / 2
}

/** Convert a screen coordinate to a world value along one axis */
export function screenToWorld(
  screenPos: number,
  center: number,
  pixelsPerUnit: number,
  extent: number
): number {
  return (screenPos - extent / 2) / pixelsPerUnit + center
}

// ── 2D conversions ──────────────────────────────────────────────────

export interface Point2D {
  x: number
  y: number
}

/**
 * Convert a world (x,y) to screen coordinates.
 * Note: Y is inverted so positive Y goes up on screen.
 */
export function worldToScreen2D(
  worldX: number,
  worldY: number,
  centerX: number,
  centerY: number,
  ppuX: number,
  ppuY: number,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  return {
    x: (worldX - centerX) * ppuX + canvasWidth / 2,
    y: canvasHeight / 2 - (worldY - centerY) * ppuY,
  }
}

/**
 * Convert screen (x,y) to world coordinates.
 * Note: Y is inverted so positive screen Y maps to negative world Y offset.
 */
export function screenToWorld2D(
  screenX: number,
  screenY: number,
  centerX: number,
  centerY: number,
  ppuX: number,
  ppuY: number,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  return {
    x: (screenX - canvasWidth / 2) / ppuX + centerX,
    y: (canvasHeight / 2 - screenY) / ppuY + centerY,
  }
}
