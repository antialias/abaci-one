/**
 * Pure geometric helper functions shared between macros and preview rendering.
 * No construction state, fact store, or side effects.
 */

import { circleCircleIntersections } from './intersections'

/**
 * Compute the apex of an equilateral triangle on segment A→B.
 *
 * Uses circle-circle intersection with chirality preference:
 * picks the point on the "left" side of A→B (cross product > 0),
 * then highest Y as tiebreaker.
 *
 * Returns null if A and B are coincident (degenerate).
 */
export function computeEquilateralApex(
  pA: { x: number; y: number },
  pB: { x: number; y: number }
): { x: number; y: number } | null {
  const radius = Math.sqrt((pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2)
  if (radius < 1e-9) return null

  const intersections = circleCircleIntersections(pA.x, pA.y, radius, pB.x, pB.y, radius)
  const abx = pB.x - pA.x
  const aby = pB.y - pA.y
  const preferUpper = intersections.filter((p) => abx * (p.y - pA.y) - aby * (p.x - pA.x) > 0)
  const apexPool = preferUpper.length > 0 ? preferUpper : intersections
  const apex =
    apexPool.length > 1
      ? apexPool.reduce((best, p) => (p.y > best.y ? p : best), apexPool[0])
      : apexPool[0]

  return apex ?? null
}

/**
 * Compute a normalized direction vector from `from` to `to`.
 * Falls back to (0, 1) if the points are coincident.
 */
export function computeDirectionVector(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-9) {
    return { x: 0, y: 1 }
  }
  return { x: dx / len, y: dy / len }
}
