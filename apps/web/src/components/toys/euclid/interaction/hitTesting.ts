import type { ConstructionState, ConstructionPoint, EuclidViewportState, IntersectionCandidate } from '../types'
import { getAllPoints } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'
import { STRAIGHTEDGE_MIN_LENGTH, STRAIGHTEDGE_OVERHANG } from '../render/renderToolOverlay'

/** Hit radius in screen pixels (44px for touch targets per Apple HIG, 30px for mouse) */
const HIT_RADIUS_MOUSE = 30
const HIT_RADIUS_TOUCH = 44

function getHitRadius(isTouch: boolean): number {
  return isTouch ? HIT_RADIUS_TOUCH : HIT_RADIUS_MOUSE
}

function toScreen(
  wx: number,
  wy: number,
  viewport: EuclidViewportState,
  canvasW: number,
  canvasH: number,
) {
  return worldToScreen2D(
    wx, wy,
    viewport.center.x, viewport.center.y,
    viewport.pixelsPerUnit, viewport.pixelsPerUnit,
    canvasW, canvasH,
  )
}

/**
 * Find the nearest construction point within hit radius.
 * Returns the point, or null if none is close enough.
 */
export function hitTestPoints(
  screenX: number,
  screenY: number,
  state: ConstructionState,
  viewport: EuclidViewportState,
  canvasW: number,
  canvasH: number,
  isTouch = false,
): ConstructionPoint | null {
  const threshold = getHitRadius(isTouch)
  let best: ConstructionPoint | null = null
  let bestDist = Infinity

  for (const pt of getAllPoints(state)) {
    const s = toScreen(pt.x, pt.y, viewport, canvasW, canvasH)
    const dx = screenX - s.x
    const dy = screenY - s.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < threshold && dist < bestDist) {
      best = pt
      bestDist = dist
    }
  }

  return best
}

/** Perpendicular distance threshold from the ruler's working edge (screen px). */
const RULER_EDGE_THRESHOLD_MOUSE = 14
const RULER_EDGE_THRESHOLD_TOUCH = 22

/**
 * Find the construction point closest to the line extending from `fromScreen`
 * through `cursorScreen` (the ruler's working edge), within a perpendicular
 * distance threshold. Among qualifying points, returns the one with the
 * smallest perpendicular distance to the edge — like aligning a real ruler.
 *
 * Points must be:
 * - Within perpendicular threshold of the line
 * - Projected forward from the from-point (not behind it)
 * - Not the from-point itself (excluded via `excludeId`)
 */
export function hitTestAlongRulerEdge(
  fromScreenX: number,
  fromScreenY: number,
  cursorScreenX: number,
  cursorScreenY: number,
  excludeId: string,
  state: ConstructionState,
  viewport: EuclidViewportState,
  canvasW: number,
  canvasH: number,
  isTouch = false,
): ConstructionPoint | null {
  const threshold = isTouch ? RULER_EDGE_THRESHOLD_TOUCH : RULER_EDGE_THRESHOLD_MOUSE

  // Line direction from→cursor
  const ldx = cursorScreenX - fromScreenX
  const ldy = cursorScreenY - fromScreenY
  const lineLen = Math.sqrt(ldx * ldx + ldy * ldy)
  if (lineLen < 1) return null // from and cursor coincide, can't define a line

  // Unit direction along the ruler
  const nx = ldx / lineLen
  const ny = ldy / lineLen

  // Max projection: point must be within the visible ruler bar.
  // The bar is centered on the from→cursor midpoint with length
  // max(lineLen, MIN_LENGTH) + 2*OVERHANG, so its forward end is at:
  const barLength = Math.max(lineLen, STRAIGHTEDGE_MIN_LENGTH) + STRAIGHTEDGE_OVERHANG * 2
  const maxProj = lineLen / 2 + barLength / 2

  let best: ConstructionPoint | null = null
  let bestDist = Infinity

  for (const pt of getAllPoints(state)) {
    if (pt.id === excludeId) continue

    const s = toScreen(pt.x, pt.y, viewport, canvasW, canvasH)
    // Vector from the from-point to this point (screen space)
    const vx = s.x - fromScreenX
    const vy = s.y - fromScreenY

    // Projection along the ruler direction (must be forward and within the ruler bar)
    const proj = vx * nx + vy * ny
    if (proj < 0 || proj > maxProj) continue

    // Perpendicular distance to the ruler edge
    const perpDist = Math.abs(vx * ny - vy * nx) // |v × n̂|
    if (perpDist >= threshold) continue

    // Among qualifying points, pick the one closest to the cursor along the
    // ruler — like sliding a real straightedge up to the nearest point.
    const alongDist = Math.abs(proj - lineLen)
    if (alongDist < bestDist) {
      best = pt
      bestDist = alongDist
    }
  }

  return best
}

/**
 * Find the nearest intersection candidate within hit radius.
 * Returns the candidate, or null if none is close enough.
 */
export function hitTestIntersectionCandidates(
  screenX: number,
  screenY: number,
  candidates: IntersectionCandidate[],
  viewport: EuclidViewportState,
  canvasW: number,
  canvasH: number,
  isTouch = false,
): IntersectionCandidate | null {
  const threshold = getHitRadius(isTouch)
  let best: IntersectionCandidate | null = null
  let bestDist = Infinity

  for (const c of candidates) {
    const s = toScreen(c.x, c.y, viewport, canvasW, canvasH)
    const dx = screenX - s.x
    const dy = screenY - s.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < threshold && dist < bestDist) {
      best = c
      bestDist = dist
    }
  }

  return best
}
