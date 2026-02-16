import type { ConstructionState, ConstructionPoint, EuclidViewportState, IntersectionCandidate } from '../types'
import { getAllPoints } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'

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
