import { describe, it, expect } from 'vitest'
import { solveInverseKinematics, createSolverState } from './inverseSolver'
import { evaluateRecipe } from './recipe/evaluate'
import { RECIPE_PROP_1 } from './recipe/definitions/prop1'
import { RECIPE_REGISTRY } from './recipe/definitions/registry'
import type { Pt } from './recipe/types'

describe('inverseSolver', () => {
  describe('Proposition I.1 (equilateral triangle)', () => {
    const recipe = RECIPE_PROP_1
    const registry = RECIPE_REGISTRY

    /** Helper: evaluate recipe and get a point position */
    function getPoint(inputs: Pt[], ref: string): Pt | undefined {
      const trace = evaluateRecipe(recipe, inputs, registry)
      return trace?.pointMap.get(ref)
    }

    it('converges when dragging apex C of equilateral triangle', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 }, // A
        { x: 2, y: 0 }, // B
      ]

      // Get the current position of C
      const currentC = getPoint(inputPositions, 'C')
      expect(currentC).toBeDefined()

      // Target: move C slightly
      const target: Pt = { x: currentC!.x + 0.5, y: currentC!.y + 0.3 }

      const solverState = createSolverState()
      const result = solveInverseKinematics(
        recipe,
        inputPositions,
        'C',
        target,
        registry,
        solverState
      )

      // Should converge or get very close
      expect(result.residualNorm).toBeLessThan(0.01)

      // Verify the solved positions actually place C near the target
      const solvedC = getPoint(result.inputPositions, 'C')
      expect(solvedC).toBeDefined()
      const dx = solvedC!.x - target.x
      const dy = solvedC!.y - target.y
      expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThan(0.01)
    })

    it('maintains equilateral triangle invariant after solve', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ]

      const target: Pt = { x: 1, y: 4 }
      const result = solveInverseKinematics(
        recipe,
        inputPositions,
        'C',
        target,
        registry,
        createSolverState()
      )

      // Verify the triangle is still equilateral
      const trace = evaluateRecipe(recipe, result.inputPositions, registry)
      expect(trace).not.toBeNull()

      const A = trace!.pointMap.get('A')!
      const B = trace!.pointMap.get('B')!
      const C = trace!.pointMap.get('C')!

      const AB = Math.sqrt((B.x - A.x) ** 2 + (B.y - A.y) ** 2)
      const AC = Math.sqrt((C.x - A.x) ** 2 + (C.y - A.y) ** 2)
      const BC = Math.sqrt((C.x - B.x) ** 2 + (C.y - B.y) ** 2)

      // All sides should be equal (equilateral triangle)
      expect(Math.abs(AB - AC)).toBeLessThan(0.01)
      expect(Math.abs(AB - BC)).toBeLessThan(0.01)
    })

    it('warm-starts across sequential calls (simulating drag)', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ]

      const solverState = createSolverState()
      let currentInputs = inputPositions

      // Simulate a smooth drag: 10 small steps
      const startC = getPoint(inputPositions, 'C')!
      for (let step = 1; step <= 10; step++) {
        const target: Pt = {
          x: startC.x + step * 0.1,
          y: startC.y + step * 0.05,
        }

        const result = solveInverseKinematics(
          recipe,
          currentInputs,
          'C',
          target,
          registry,
          solverState
        )

        // Warm-started: should converge quickly (few iterations)
        expect(result.residualNorm).toBeLessThan(0.05)
        currentInputs = result.inputPositions
      }
    })

    it('handles dragging an input point A directly through the solver', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ]

      // Dragging A is trivially solvable — A should just move to target
      const target: Pt = { x: -1, y: 1 }
      const result = solveInverseKinematics(
        recipe,
        inputPositions,
        'A',
        target,
        registry,
        createSolverState()
      )

      expect(result.converged).toBe(true)
      // A should be very close to target
      expect(Math.abs(result.inputPositions[0].x - target.x)).toBeLessThan(0.001)
      expect(Math.abs(result.inputPositions[0].y - target.y)).toBeLessThan(0.001)
    })

    it('returns best effort when target is unreachable', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ]

      // Very far target — solver should still return something reasonable
      const target: Pt = { x: 100, y: 100 }
      const result = solveInverseKinematics(
        recipe,
        inputPositions,
        'C',
        target,
        registry,
        createSolverState(),
        { maxIterations: 20 }
      )

      // Should have moved C closer to the target, even if not converged
      const originalC = getPoint(inputPositions, 'C')!
      const solvedC = getPoint(result.inputPositions, 'C')
      expect(solvedC).toBeDefined()

      const originalDist = Math.sqrt((originalC.x - target.x) ** 2 + (originalC.y - target.y) ** 2)
      const solvedDist = Math.sqrt((solvedC!.x - target.x) ** 2 + (solvedC!.y - target.y) ** 2)
      expect(solvedDist).toBeLessThan(originalDist)
    })

    it('works with precomputeDependencies flag', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ]

      const currentC = getPoint(inputPositions, 'C')!
      const target: Pt = { x: currentC.x + 0.3, y: currentC.y + 0.2 }

      const result = solveInverseKinematics(
        recipe,
        inputPositions,
        'C',
        target,
        registry,
        createSolverState(),
        { precomputeDependencies: true }
      )

      expect(result.residualNorm).toBeLessThan(0.01)
    })
  })
})
