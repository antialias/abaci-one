import { describe, it, expect } from 'vitest'
import { computeInfluence, constrainedDragStep } from './jacobianInfluence'
import { evaluateRecipe } from './recipe/evaluate'
import { RECIPE_PROP_1 } from './recipe/definitions/prop1'
import { RECIPE_REGISTRY } from './recipe/definitions/registry'
import type { Pt } from './recipe/types'
import type { ForwardFn } from './inverseSolver'

describe('jacobianInfluence', () => {
  const recipe = RECIPE_PROP_1
  const registry = RECIPE_REGISTRY

  function makeForward(targetRef: string): ForwardFn {
    return (positions: Pt[]) => {
      const trace = evaluateRecipe(recipe, positions, registry)
      return trace?.pointMap.get(targetRef) ?? null
    }
  }

  describe('computeInfluence', () => {
    it('identifies which given point most influences a derived point', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 }, // A
        { x: 2, y: 0 }, // B
      ]
      const pointIds = ['pt-A', 'pt-B']
      const forward = makeForward('C')

      const result = computeInfluence(forward, inputPositions, pointIds)
      expect(result).not.toBeNull()
      expect(result!.magnitudes.length).toBe(2)
      // Both A and B should have influence on C (equilateral triangle)
      expect(result!.magnitudes[0]).toBeGreaterThan(0)
      expect(result!.magnitudes[1]).toBeGreaterThan(0)
      expect(result!.bestPointId).toBeDefined()
    })

    it('returns non-zero sub-Jacobian for the best point', () => {
      const inputPositions: Pt[] = [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ]
      const forward = makeForward('C')

      const result = computeInfluence(forward, inputPositions, ['pt-A', 'pt-B'])
      expect(result).not.toBeNull()
      const [a, b, c, d] = result!.subJacobian
      // Sub-Jacobian should not be all zeros
      expect(Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d)).toBeGreaterThan(0)
    })

    it('returns null for invalid forward function', () => {
      const badForward: ForwardFn = () => null
      const result = computeInfluence(badForward, [{ x: 0, y: 0 }], ['pt-A'])
      expect(result).toBeNull()
    })
  })

  describe('constrainedDragStep', () => {
    it('computes given-point movement from target delta', () => {
      // Identity sub-Jacobian: target moves same as given
      const result = constrainedDragStep({ x: 0, y: 0 }, { x: 1, y: 0 }, [1, 0, 0, 1])
      expect(result).not.toBeNull()
      expect(result!.x).toBeCloseTo(1)
      expect(result!.y).toBeCloseTo(0)
    })

    it('returns null for degenerate sub-Jacobian', () => {
      const result = constrainedDragStep({ x: 0, y: 0 }, { x: 1, y: 0 }, [0, 0, 0, 0])
      expect(result).toBeNull()
    })

    it('handles non-trivial sub-Jacobian', () => {
      // If target.x depends only on given.y, and target.y depends only on given.x:
      // J = [0, 2; 3, 0]  => J^-1 = [0, 1/3; 1/2, 0]
      const result = constrainedDragStep({ x: 1, y: 1 }, { x: 1, y: 1 }, [0, 2, 3, 0])
      expect(result).not.toBeNull()
      // dgx = (1/det)(d*dx - b*dy) = (1/-6)(0*1 - 2*1) = 1/3
      // dgy = (1/det)(-c*dx + a*dy) = (1/-6)(-3*1 + 0*1) = 1/2
      expect(result!.x).toBeCloseTo(1 + 1 / 3)
      expect(result!.y).toBeCloseTo(1 + 0.5)
    })
  })
})
