/**
 * Inverse kinematics solver for Euclidean constructions.
 *
 * Given a construction recipe and a target position for any derived point,
 * solves for the input (given) point positions that place the derived point
 * at the target. Uses Levenberg-Marquardt with finite-difference Jacobian.
 *
 * Key properties:
 * - Warm-starting: each frame starts from the previous solution, so convergence
 *   is typically 1-3 iterations during smooth drag.
 * - Minimum displacement: the underdetermined system (2 equations, 4+ unknowns)
 *   naturally produces the solution closest to the current positions.
 * - Graceful degradation: returns the best solution found even if not fully converged.
 * - Branch tracking: warm-starting naturally follows the current geometric branch.
 */

import type { Pt, Ref, ConstructionRecipe, RecipeRegistry } from './recipe/types'
import { evaluateRecipe } from './recipe/evaluate'

// ── Public API ─────────────────────────────────────────────────────

/**
 * A forward function that maps input positions to the target point's position.
 * Returns null if the construction is invalid at the given inputs.
 */
export type ForwardFn = (inputPositions: Pt[]) => Pt | null

export interface InverseSolverOptions {
  /** Max LM iterations per frame (default: 5) */
  maxIterations?: number
  /** Convergence tolerance in world units (default: 1e-4) */
  tolerance?: number
  /** Initial LM damping parameter (default: 1e-3) */
  lambda?: number
  /** Finite difference step size (default: 1e-6) */
  epsilon?: number
  /**
   * When true, pre-compute parameter dependencies and skip finite-difference
   * evaluations for parameters that don't affect the target point.
   * Disabled by default — the Jacobian naturally produces near-zero columns
   * for unrelated parameters, and LM leaves them unchanged.
   */
  precomputeDependencies?: boolean
}

export interface InverseSolverResult {
  /** Solved input positions (same length as recipe.inputSlots) */
  inputPositions: Pt[]
  /** Whether the solver converged within tolerance */
  converged: boolean
  /** Number of iterations used */
  iterations: number
  /** Final residual norm (distance from target) */
  residualNorm: number
  /** The LM lambda value — pass back as options.lambda for warm-starting */
  lambda: number
}

/**
 * Persistent solver state for warm-starting across frames.
 * Create once per drag gesture, pass to each call.
 */
export interface InverseSolverState {
  lambda: number
}

export function createSolverState(): InverseSolverState {
  return { lambda: 1e-3 }
}

/**
 * Generic inverse solver: given a forward function that maps input positions
 * to a target point's position, solve for the input positions that place
 * the target point at the desired position.
 *
 * @param forward - Maps input positions → target point position (null if invalid)
 * @param currentInputPositions - Current positions of input (given) points
 * @param targetPosition - Where the user wants the target point
 * @param solverState - Persistent state for warm-starting lambda across frames
 * @param options - Solver tuning parameters
 */
export function solveInverse(
  forward: ForwardFn,
  currentInputPositions: Pt[],
  targetPosition: Pt,
  solverState?: InverseSolverState,
  options?: InverseSolverOptions
): InverseSolverResult {
  const {
    maxIterations = 5,
    tolerance = 1e-4,
    epsilon = 1e-6,
    precomputeDependencies = false,
  } = options ?? {}

  let lambda = solverState?.lambda ?? options?.lambda ?? 1e-3
  const n = currentInputPositions.length * 2 // Total parameters (x,y per input point)

  // Flatten input positions to parameter vector [x0, y0, x1, y1, ...]
  let params = flattenPositions(currentInputPositions)

  // Optional: determine which parameters affect the target point
  let activeParams: number[] | null = null
  if (precomputeDependencies) {
    activeParams = findActiveParametersGeneric(forward, currentInputPositions, epsilon)
    if (activeParams.length === 0) {
      return {
        inputPositions: currentInputPositions,
        converged: false,
        iterations: 0,
        residualNorm: Infinity,
        lambda,
      }
    }
  }

  let bestParams = params
  let bestResidualNorm = Infinity

  for (let iter = 0; iter < maxIterations; iter++) {
    const positions = unflattenPositions(params)
    const currentPos = forward(positions)
    if (!currentPos) break

    const r: [number, number] = [currentPos.x - targetPosition.x, currentPos.y - targetPosition.y]
    const residualNorm = Math.sqrt(r[0] * r[0] + r[1] * r[1])

    if (residualNorm < bestResidualNorm) {
      bestResidualNorm = residualNorm
      bestParams = [...params]
    }

    if (residualNorm < tolerance) {
      if (solverState) solverState.lambda = lambda
      return {
        inputPositions: unflattenPositions(params),
        converged: true,
        iterations: iter,
        residualNorm,
        lambda,
      }
    }

    // Compute Jacobian via central finite differences
    const paramIndices = activeParams ?? Array.from({ length: n }, (_, i) => i)
    const J: [number[], number[]] = [new Array(n).fill(0), new Array(n).fill(0)]

    for (const j of paramIndices) {
      const paramsPlus = [...params]
      const paramsMinus = [...params]
      paramsPlus[j] += epsilon
      paramsMinus[j] -= epsilon

      const posPlus = forward(unflattenPositions(paramsPlus))
      const posMinus = forward(unflattenPositions(paramsMinus))

      // At a topology boundary one side of the central difference can fall
      // off the feasibility manifold (forward returns null). Falling back to
      // a one-sided difference preserves the gradient information from the
      // valid side, which is what tells LM the direction *into* the
      // feasible region. Zeroing the column instead (the previous behavior)
      // discarded that signal — the resulting step would then point across
      // the boundary, every backtracking alpha would land in null space,
      // lambda would saturate, and the dragged point would freeze.
      if (posPlus && posMinus) {
        J[0][j] = (posPlus.x - posMinus.x) / (2 * epsilon)
        J[1][j] = (posPlus.y - posMinus.y) / (2 * epsilon)
      } else if (posPlus) {
        J[0][j] = (posPlus.x - currentPos.x) / epsilon
        J[1][j] = (posPlus.y - currentPos.y) / epsilon
      } else if (posMinus) {
        J[0][j] = (currentPos.x - posMinus.x) / epsilon
        J[1][j] = (currentPos.y - posMinus.y) / epsilon
      }
      // else both sides null — column stays 0; this parameter is bracketed
      // by infeasibility and can't safely move at the current epsilon.
    }

    // LM update: δ = Jᵀ (J Jᵀ + λI)⁻¹ (-r) — only a 2×2 invert
    let jjt00 = 0,
      jjt01 = 0,
      jjt11 = 0
    for (let j = 0; j < n; j++) {
      jjt00 += J[0][j] * J[0][j]
      jjt01 += J[0][j] * J[1][j]
      jjt11 += J[1][j] * J[1][j]
    }

    jjt00 += lambda
    jjt11 += lambda
    const jjt10 = jjt01

    const det = jjt00 * jjt11 - jjt01 * jjt10
    if (Math.abs(det) < 1e-15) {
      lambda *= 4
      continue
    }

    const inv00 = jjt11 / det
    const inv01 = -jjt01 / det
    const inv10 = -jjt10 / det
    const inv11 = jjt00 / det

    const v0 = inv00 * -r[0] + inv01 * -r[1]
    const v1 = inv10 * -r[0] + inv11 * -r[1]

    const delta = new Array(n).fill(0)
    for (let j = 0; j < n; j++) {
      delta[j] = J[0][j] * v0 + J[1][j] * v1
    }

    // Backtracking line search: try the full LM step first, then shrink
    // the step (alpha = 1, 1/2, 1/4, …) if the forward model returns null
    // (topology boundary crossed) or the residual fails to decrease. This
    // finds the largest feasible step in the LM-prescribed direction —
    // crucial when the cursor is pulled into an infeasible region: instead
    // of stalling at the previous params, the solver creeps to the boundary
    // and lets subsequent frames slide along it.
    let alpha = 1
    let acceptedParams: number[] | null = null
    let acceptedResidualNorm = Infinity
    for (let bt = 0; bt < 8; bt++) {
      const trialParams = params.map((p, i) => p + alpha * delta[i])
      const trialPos = forward(unflattenPositions(trialParams))
      if (trialPos) {
        const dr0 = trialPos.x - targetPosition.x
        const dr1 = trialPos.y - targetPosition.y
        const trialResidualNorm = Math.sqrt(dr0 * dr0 + dr1 * dr1)
        if (trialResidualNorm < residualNorm) {
          acceptedParams = trialParams
          acceptedResidualNorm = trialResidualNorm
          break
        }
      }
      alpha *= 0.5
    }

    if (acceptedParams) {
      params = acceptedParams
      // Smaller alpha means we had to back off — keep lambda where it is or
      // increase it slightly so the next iteration proposes a more cautious
      // direction. Full step (alpha = 1) lets us decay lambda as before.
      if (alpha >= 1) {
        lambda = Math.max(lambda * 0.5, 1e-8)
      } else if (alpha < 0.25) {
        lambda *= 2
      }
      // Track the accepted residual against bestResidualNorm immediately so
      // the boundary-creeping pose is preserved if subsequent iters fail.
      if (acceptedResidualNorm < bestResidualNorm) {
        bestResidualNorm = acceptedResidualNorm
        bestParams = [...params]
      }
    } else {
      lambda *= 4
    }
  }

  if (solverState) solverState.lambda = lambda
  return {
    inputPositions: unflattenPositions(bestParams),
    converged: bestResidualNorm < tolerance,
    iterations: maxIterations,
    residualNorm: bestResidualNorm,
    lambda,
  }
}

/**
 * Convenience wrapper: solve for input positions using a recipe as the forward model.
 *
 * @param recipe - The construction recipe (pure geometric definition)
 * @param currentInputPositions - Current positions of input (given) points
 * @param targetRef - Recipe ref of the point being dragged (e.g. 'C')
 * @param targetPosition - Where the user wants that point
 * @param registry - Recipe registry for resolving `apply` ops
 * @param solverState - Persistent state for warm-starting lambda across frames
 * @param options - Solver tuning parameters
 */
export function solveInverseKinematics(
  recipe: ConstructionRecipe,
  currentInputPositions: Pt[],
  targetRef: Ref,
  targetPosition: Pt,
  registry: RecipeRegistry,
  solverState?: InverseSolverState,
  options?: InverseSolverOptions
): InverseSolverResult {
  const forward: ForwardFn = (positions) => {
    const trace = evaluateRecipe(recipe, positions, registry)
    return trace?.pointMap.get(targetRef) ?? null
  }
  return solveInverse(forward, currentInputPositions, targetPosition, solverState, options)
}

// ── Helpers ────────────────────────────────────────────────────────

export function flattenPositions(positions: Pt[]): number[] {
  const out: number[] = []
  for (const p of positions) {
    out.push(p.x, p.y)
  }
  return out
}

export function unflattenPositions(params: number[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < params.length; i += 2) {
    out.push({ x: params[i], y: params[i + 1] })
  }
  return out
}

/**
 * Generic version: determine which parameter indices affect the target point.
 */
function findActiveParametersGeneric(
  forward: ForwardFn,
  inputPositions: Pt[],
  epsilon: number
): number[] {
  const n = inputPositions.length * 2
  const params = flattenPositions(inputPositions)
  const active: number[] = []

  const basePos = forward(inputPositions)
  if (!basePos) return []

  for (let j = 0; j < n; j++) {
    const perturbed = [...params]
    perturbed[j] += epsilon * 100

    const pos = forward(unflattenPositions(perturbed))
    if (!pos) {
      active.push(j)
      continue
    }

    const dx = pos.x - basePos.x
    const dy = pos.y - basePos.y
    if (Math.sqrt(dx * dx + dy * dy) > epsilon * 10) {
      active.push(j)
    }
  }

  return active
}
