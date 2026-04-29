/**
 * Jacobian-based influence analysis for Euclidean constructions.
 *
 * Given a forward model and a target derived point, determines which
 * input (given) point has the most influence on the target's position.
 * Used for:
 * - Hover highlight: showing which given point "controls" a derived point
 * - Constrained drag: routing derived-point drags through a single given point
 */

import type { Pt } from './recipe/types'
import type { ForwardFn } from './inverseSolver'
import { flattenPositions, unflattenPositions } from './inverseSolver'

export interface InfluenceResult {
  /** Index into the input positions array of the most influential point */
  bestInputIndex: number
  /** The point ID of the most influential point (if provided) */
  bestPointId: string | null
  /** The 2×2 sub-Jacobian for the best point: [∂tx/∂gx, ∂tx/∂gy, ∂ty/∂gx, ∂ty/∂gy] */
  subJacobian: [number, number, number, number]
  /** Influence magnitude per input point (Frobenius norm of 2×2 sub-Jacobian) */
  magnitudes: number[]
}

/**
 * Compute which input point most influences a target derived point.
 *
 * @param forward - Forward model: maps input positions → target point position
 * @param inputPositions - Current positions of all input (given/free) points
 * @param pointIds - Optional IDs for each input position (for bestPointId)
 * @param epsilon - Finite difference step size (default 1e-6)
 */
export function computeInfluence(
  forward: ForwardFn,
  inputPositions: Pt[],
  pointIds?: string[],
  epsilon = 1e-6
): InfluenceResult | null {
  const n = inputPositions.length * 2
  const params = flattenPositions(inputPositions)

  // Baseline evaluation
  const basePos = forward(inputPositions)
  if (!basePos) return null

  // Compute full Jacobian via central finite differences
  const J0 = new Array(n).fill(0)
  const J1 = new Array(n).fill(0)

  for (let j = 0; j < n; j++) {
    const paramsPlus = [...params]
    const paramsMinus = [...params]
    paramsPlus[j] += epsilon
    paramsMinus[j] -= epsilon

    const posPlus = forward(unflattenPositions(paramsPlus))
    const posMinus = forward(unflattenPositions(paramsMinus))

    if (!posPlus || !posMinus) continue

    J0[j] = (posPlus.x - posMinus.x) / (2 * epsilon)
    J1[j] = (posPlus.y - posMinus.y) / (2 * epsilon)
  }

  // Compute per-input-point influence magnitudes (Frobenius norm of 2×2 block)
  const numPoints = inputPositions.length
  const magnitudes: number[] = []
  let bestIdx = 0
  let bestMag = -1

  for (let i = 0; i < numPoints; i++) {
    const j = i * 2
    const mag = Math.sqrt(
      J0[j] * J0[j] + J0[j + 1] * J0[j + 1] + J1[j] * J1[j] + J1[j + 1] * J1[j + 1]
    )
    magnitudes.push(mag)
    if (mag > bestMag) {
      bestMag = mag
      bestIdx = i
    }
  }

  if (bestMag <= 0) return null

  const bj = bestIdx * 2
  return {
    bestInputIndex: bestIdx,
    bestPointId: pointIds?.[bestIdx] ?? null,
    subJacobian: [J0[bj], J0[bj + 1], J1[bj], J1[bj + 1]],
    magnitudes,
  }
}

/**
 * Apply a constrained drag step: given a desired movement of the target point,
 * compute the corresponding movement of a single given point using the
 * pre-computed 2×2 sub-Jacobian.
 *
 * Returns the new position for the given point, or null if the sub-Jacobian
 * is degenerate (the given point can't move the target in the desired direction).
 */
export function constrainedDragStep(
  currentGivenPos: Pt,
  targetDelta: Pt,
  subJacobian: [number, number, number, number]
): Pt | null {
  const [a, b, c, d] = subJacobian
  const det = a * d - b * c

  if (Math.abs(det) < 1e-12) return null

  // Invert 2×2: [a b; c d]⁻¹ = (1/det) [d -b; -c a]
  const invDet = 1 / det
  const dgx = invDet * (d * targetDelta.x - b * targetDelta.y)
  const dgy = invDet * (-c * targetDelta.x + a * targetDelta.y)

  return {
    x: currentGivenPos.x + dgx,
    y: currentGivenPos.y + dgy,
  }
}

/**
 * Returns true when the 2×2 sub-Jacobian is too ill-conditioned for
 * constrained 2D dragging through a single given point.
 *
 * A rank-deficient sub-Jacobian means the chosen given point can move the
 * target along (at most) a 1-D locus, not in arbitrary 2D directions. The
 * canonical case: the target is the intersection of two lines, and the
 * chosen given is one endpoint — perturbing it only slides the intersection
 * along the *other* line. Both columns of the sub-Jacobian point along that
 * other line; det(J) is mathematically zero, numerically ~1e-12.
 *
 * If we still try to invert J (in `constrainedDragStep`) the result is a
 * given-point delta of magnitude ~1/det → effectively infinity. Detecting
 * this at drag-start lets the caller skip constrained mode entirely and
 * route the gesture to the full LM solver, which can deploy *all* input
 * DOFs together.
 *
 * Math: for 2×2 J with singular values σ₁ ≥ σ₂ ≥ 0,
 *   trace(JᵀJ) = a²+b²+c²+d² = σ₁²+σ₂²    (call this T)
 *   det(JᵀJ)   = (ad-bc)²    = σ₁²·σ₂²    (call this D')
 *   (σ₂/σ₁)² ≈ D'/T² when σ₁ ≫ σ₂.
 * We flag ill-conditioning when (σ₂/σ₁)² < 1/conditionSqThreshold,
 * i.e. when conditionSqThreshold·D' < T².
 *
 * Default conditionSqThreshold = 100 → reject when condition number κ > 10.
 */
export function isSubJacobianRankDeficient(
  subJacobian: [number, number, number, number],
  conditionSqThreshold = 100
): boolean {
  const [a, b, c, d] = subJacobian
  const traceJtJ = a * a + b * b + c * c + d * d
  if (traceJtJ < 1e-12) return true // J ≈ 0: no influence at all
  const det = a * d - b * c
  return conditionSqThreshold * det * det < traceJtJ * traceJtJ
}
