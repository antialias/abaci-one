import type { GuideSlope, SlopeGuideState } from './types'

// ── Guide slope definitions ──────────────────────────────────────────
// Integers 1–11, their inverses 1/2–1/11, zero, and vertical.

const FRAC_LABELS: Record<number, string> = {
  2: '\u00BD', // ½
  3: '\u2153', // ⅓
  4: '\u00BC', // ¼
  5: '\u2155', // ⅕
  6: '\u2159', // ⅙
  7: '\u2150', // ⅐
  8: '\u215B', // ⅛
  9: '\u2151', // ⅑
  10: '\u2152', // ⅒
}

function buildGuideSlopes(): GuideSlope[] {
  const slopes: GuideSlope[] = [{ num: 0, den: 1, label: '0' }]
  for (let n = 1; n <= 11; n++) {
    // Integer slopes: n/1 and -n/1
    slopes.push({ num: n, den: 1, label: String(n) })
    slopes.push({ num: -n, den: 1, label: `\u2212${n}` })
    // Inverse slopes: 1/n and -1/n (skip 1/1, already covered)
    if (n >= 2) {
      const fracLabel = FRAC_LABELS[n] ?? `1/${n}`
      slopes.push({ num: 1, den: n, label: fracLabel })
      slopes.push({ num: -1, den: n, label: `\u2212${fracLabel}` })
    }
  }
  // Vertical
  slopes.push({ num: 1, den: 0, label: '\u221E' })
  return slopes
}

const GUIDE_SLOPES = buildGuideSlopes()

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
  handleY: number
): SlopeGuideState {
  return {
    anchorX,
    anchorY,
    handleX,
    handleY,
    guides: GUIDE_SLOPES.map((slope) => ({ slope })),
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
  maxWorldY: number
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
  const remainder = (((xLo - anchorX) % den) + den) % den
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
