import type { GuideSlope, SlopeGuideState } from './types'

// ── Guide slope definitions ──────────────────────────────────────────
// All common slopes shown at once during handle drag.

const GUIDE_SLOPES: GuideSlope[] = [
  { num: 0, den: 1, label: '0' },
  { num: 1, den: 1, label: '1' },
  { num: -1, den: 1, label: '\u22121' },
  { num: 2, den: 1, label: '2' },
  { num: -2, den: 1, label: '\u22122' },
  { num: 3, den: 1, label: '3' },
  { num: -3, den: 1, label: '\u22123' },
  { num: 1, den: 2, label: '\u00BD' },
  { num: -1, den: 2, label: '\u2212\u00BD' },
  { num: 1, den: 3, label: '\u2153' },
  { num: -1, den: 3, label: '\u2212\u2153' },
  { num: 1, den: 0, label: '\u221E' },  // vertical
]

// ── Main computation ─────────────────────────────────────────────────

/**
 * Build slope guide state for all common slopes during a handle drag.
 *
 * @param anchorX  Stationary handle world X (integer)
 * @param anchorY  Stationary handle world Y (integer)
 * @param handleX  Grid-snapped dragging handle X
 * @param handleY  Grid-snapped dragging handle Y
 */
export function computeSlopeGuides(
  anchorX: number,
  anchorY: number,
  handleX: number,
  handleY: number,
): SlopeGuideState {
  return {
    anchorX,
    anchorY,
    handleX,
    handleY,
    guides: GUIDE_SLOPES.map(slope => ({ slope })),
  }
}

// ── Integer intersection computation ─────────────────────────────────

/**
 * Compute integer grid points along a guide line through (anchorX, anchorY)
 * with slope num/den, within the visible world-coordinate range.
 *
 * Returns array of { x, y } integer pairs.
 */
export function guideIntegerIntersections(
  anchorX: number,
  anchorY: number,
  slope: GuideSlope,
  minWorldX: number,
  maxWorldX: number,
  minWorldY: number,
  maxWorldY: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []

  if (slope.den === 0) {
    // Vertical line at x = anchorX
    const yLo = Math.ceil(minWorldY)
    const yHi = Math.floor(maxWorldY)
    for (let y = yLo; y <= yHi; y++) {
      points.push({ x: anchorX, y })
    }
    return points
  }

  if (slope.num === 0) {
    // Horizontal line at y = anchorY
    const xLo = Math.ceil(minWorldX)
    const xHi = Math.floor(maxWorldX)
    for (let x = xLo; x <= xHi; x++) {
      points.push({ x, y: anchorY })
    }
    return points
  }

  // General case: line is y = anchorY + (num/den) * (x - anchorX)
  // Integer intersections occur where (x - anchorX) is a multiple of den
  const den = Math.abs(slope.den)
  const xLo = Math.ceil(minWorldX)
  const xHi = Math.floor(maxWorldX)

  // Find the first x >= xLo where (x - anchorX) % den === 0
  const remainder = ((xLo - anchorX) % den + den) % den
  const startX = remainder === 0 ? xLo : xLo + (den - remainder)

  for (let x = startX; x <= xHi; x += den) {
    const y = anchorY + slope.num * ((x - anchorX) / slope.den)
    // y should be integer by construction, but round to avoid float drift
    const ry = Math.round(y)
    if (ry >= minWorldY && ry <= maxWorldY) {
      points.push({ x, y: ry })
    }
  }

  return points
}
