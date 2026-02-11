import type { NumberLineState } from '../types'
import { numberToScreenX } from '../numberLineTicks'

export type ProximityZone = 'far' | 'warm' | 'hot' | 'found'

export interface ProximityResult {
  /** 0 = invisible, 1 = fully visible */
  opacity: number
  /** Target's screen X position (may be off-screen) */
  screenX: number
  /** Whether the target is within the visible viewport */
  isOnScreen: boolean
  /** Qualitative distance */
  zone: ProximityZone
  /** Whether the user needs to zoom in more for the target to be visible */
  needsMoreZoom: boolean
  /** Whether target is left, right, or on screen relative to viewport center */
  targetDirection: 'left' | 'right' | 'onscreen'
  /** Raw zoom ratio: pxPerPrecisionUnit / requiredPx. >1 means more than enough zoom. */
  zoomFactor: number
}

/**
 * Compute how close the user's viewport is to the target number.
 *
 * Visibility requires both:
 * 1. Being panned close enough (position proximity)
 * 2. Being zoomed in enough (zoom adequacy)
 *
 * The target's precision determines the required zoom level — e.g., 3.14
 * needs more zoom than 3 because the user needs to see hundredths.
 */
export function computeProximity(
  target: number,
  state: NumberLineState,
  canvasWidth: number
): ProximityResult {
  const { center, pixelsPerUnit } = state

  const screenX = numberToScreenX(target, center, pixelsPerUnit, canvasWidth)
  const isOnScreen = screenX >= 0 && screenX <= canvasWidth
  const viewportCenter = canvasWidth / 2

  // Target direction relative to viewport center
  const targetDirection: 'left' | 'right' | 'onscreen' =
    screenX < 0 ? 'left' : screenX > canvasWidth ? 'right' : 'onscreen'

  // --- Zoom adequacy ---
  // Determine precision of the target number to decide required zoom
  const precision = getTargetPrecision(target)
  // At minimum, one unit at the target's precision should be ~20px wide
  const unitAtPrecision = Math.pow(10, -precision)
  const pxPerPrecisionUnit = unitAtPrecision * pixelsPerUnit
  const requiredPx = 20
  // Raw zoom ratio (uncapped) — exposed for hint logic
  const zoomFactor = pxPerPrecisionUnit / requiredPx
  // Capped version for opacity calculation
  const zoomFactorCapped = Math.min(1, zoomFactor)
  const needsMoreZoom = zoomFactorCapped < 0.8

  // --- Position proximity ---
  // Distance from viewport center to target in pixels, normalized by canvas width
  const distPx = Math.abs(screenX - viewportCenter)
  // Position factor: 1 when target is at center, fading to 0 at 1.5x canvas width away
  const positionFactor = Math.max(0, 1 - distPx / (canvasWidth * 1.5))

  // --- Combined opacity ---
  const opacity = Math.min(zoomFactorCapped, positionFactor)

  // --- Zone classification ---
  let zone: ProximityZone
  const foundThresholdPx = 30
  if (opacity > 0.95 && distPx < foundThresholdPx) {
    zone = 'found'
  } else if (opacity > 0.6) {
    zone = 'hot'
  } else if (opacity > 0.2) {
    zone = 'warm'
  } else {
    zone = 'far'
  }

  return { opacity, screenX, isOnScreen, zone, needsMoreZoom, targetDirection, zoomFactor }
}

/**
 * Determine how many significant decimal places the target number has.
 * This controls how zoomed in the user needs to be to see the target.
 *
 * Examples: 42 -> 0, 3.1 -> 1, 3.14 -> 2, 0.005 -> 3, 1/3 -> 4 (repeating)
 */
function getTargetPrecision(target: number): number {
  if (Number.isInteger(target)) return 0

  // Convert to string and count decimal places
  const str = target.toString()
  const dotIndex = str.indexOf('.')
  if (dotIndex === -1) return 0

  // Count significant decimal digits (cap at 6 to avoid float artifacts)
  const decimals = str.slice(dotIndex + 1)
  return Math.min(decimals.length, 6)
}
