/**
 * Pointer Lock Movement Calculation
 *
 * Pure functions for calculating cursor position, dampening, and squish effects
 * when pointer lock is active. These functions are extracted from handleMouseMove
 * for better testability and reuse.
 */

// ============================================================================
// Types
// ============================================================================

export interface PointerLockBounds {
  /** SVG offset X within container */
  svgOffsetX: number;
  /** SVG offset Y within container */
  svgOffsetY: number;
  /** SVG width */
  svgWidth: number;
  /** SVG height */
  svgHeight: number;
}

export interface PointerLockMovementInput {
  /** Previous cursor X position */
  lastX: number;
  /** Previous cursor Y position */
  lastY: number;
  /** Mouse movement X delta */
  movementX: number;
  /** Mouse movement Y delta */
  movementY: number;
  /** Current movement multiplier from spring animation */
  currentMultiplier: number;
  /** Bounds for dampening calculations */
  bounds: PointerLockBounds;
}

export interface PointerLockMovementResult {
  /** New cursor X position (clamped and dampened) */
  cursorX: number;
  /** New cursor Y position (clamped and dampened) */
  cursorY: number;
  /** X squish factor (1.0 = normal, <1.0 = compressed) */
  squishX: number;
  /** Y squish factor (1.0 = normal, <1.0 = compressed) */
  squishY: number;
  /** Whether cursor has reached escape threshold */
  shouldEscape: boolean;
  /** Distance from nearest edge */
  minDistance: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Distance from edge where dampening starts (px) */
export const DAMPEN_ZONE = 40;

/** Distance from edge where squish becomes visible (px) */
export const SQUISH_ZONE = 20;

/** When within this distance, escape! (px) */
export const ESCAPE_THRESHOLD = 2;

// ============================================================================
// Functions
// ============================================================================

/**
 * Calculate dampened cursor position and squish effect for pointer lock mode.
 *
 * As the cursor approaches the edge of the SVG:
 * 1. Movement is gradually dampened (slowed down)
 * 2. The cursor visually "squishes" against the boundary
 * 3. If it reaches the escape threshold, pointer lock should be released
 *
 * @param input - Current position and movement data
 * @returns New position, squish factors, and escape status
 */
export function calculatePointerLockMovement(
  input: PointerLockMovementInput,
): PointerLockMovementResult {
  const { lastX, lastY, movementX, movementY, currentMultiplier, bounds } =
    input;
  const { svgOffsetX, svgOffsetY, svgWidth, svgHeight } = bounds;

  // First, calculate undampened position to check how close we are to edges
  const undampenedX = lastX + movementX * currentMultiplier;
  const undampenedY = lastY + movementY * currentMultiplier;

  // Calculate distance from SVG edges (not container edges!)
  const distLeft = undampenedX - svgOffsetX;
  const distRight = svgOffsetX + svgWidth - undampenedX;
  const distTop = undampenedY - svgOffsetY;
  const distBottom = svgOffsetY + svgHeight - undampenedY;

  // Find closest edge distance
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  // Calculate dampening factor based on proximity to edge
  let dampenFactor = 1.0;
  if (minDist < DAMPEN_ZONE) {
    // Quadratic easing for smooth dampening
    const t = minDist / DAMPEN_ZONE;
    dampenFactor = t * t; // Squared for stronger dampening near edge
  }

  // Apply dampening to movement
  const dampenedDeltaX = movementX * currentMultiplier * dampenFactor;
  const dampenedDeltaY = movementY * currentMultiplier * dampenFactor;
  let cursorX = lastX + dampenedDeltaX;
  let cursorY = lastY + dampenedDeltaY;

  // Calculate distances using dampened position for escape check
  const dampenedDistLeft = cursorX - svgOffsetX;
  const dampenedDistRight = svgOffsetX + svgWidth - cursorX;
  const dampenedDistTop = cursorY - svgOffsetY;
  const dampenedDistBottom = svgOffsetY + svgHeight - cursorY;
  const dampenedMinDist = Math.min(
    dampenedDistLeft,
    dampenedDistRight,
    dampenedDistTop,
    dampenedDistBottom,
  );

  // Check if cursor should escape
  const shouldEscape = dampenedMinDist < ESCAPE_THRESHOLD;

  // Calculate squish effect based on proximity to edges (using dampened position)
  let squishX = 1.0;
  let squishY = 1.0;

  // Horizontal squishing (left/right edges)
  if (dampenedDistLeft < SQUISH_ZONE) {
    const t = 1 - dampenedDistLeft / SQUISH_ZONE;
    squishX = Math.min(squishX, 1.0 - t * 0.5); // Compress to 50% width
  } else if (dampenedDistRight < SQUISH_ZONE) {
    const t = 1 - dampenedDistRight / SQUISH_ZONE;
    squishX = Math.min(squishX, 1.0 - t * 0.5);
  }

  // Vertical squishing (top/bottom edges)
  if (dampenedDistTop < SQUISH_ZONE) {
    const t = 1 - dampenedDistTop / SQUISH_ZONE;
    squishY = Math.min(squishY, 1.0 - t * 0.5);
  } else if (dampenedDistBottom < SQUISH_ZONE) {
    const t = 1 - dampenedDistBottom / SQUISH_ZONE;
    squishY = Math.min(squishY, 1.0 - t * 0.5);
  }

  // Clamp to SVG bounds
  cursorX = Math.max(svgOffsetX, Math.min(svgOffsetX + svgWidth, cursorX));
  cursorY = Math.max(svgOffsetY, Math.min(svgOffsetY + svgHeight, cursorY));

  return {
    cursorX,
    cursorY,
    squishX,
    squishY,
    shouldEscape,
    minDistance: dampenedMinDist,
  };
}

/**
 * Calculate drag detection based on movement from start position.
 *
 * @param cursorX - Current cursor X
 * @param cursorY - Current cursor Y
 * @param dragStartX - Drag start X
 * @param dragStartY - Drag start Y
 * @param threshold - Distance threshold to consider as drag
 * @returns Whether threshold has been exceeded
 */
export function checkDragThreshold(
  cursorX: number,
  cursorY: number,
  dragStartX: number,
  dragStartY: number,
  threshold: number,
): boolean {
  const deltaX = cursorX - dragStartX;
  const deltaY = cursorY - dragStartY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  return distance >= threshold;
}
