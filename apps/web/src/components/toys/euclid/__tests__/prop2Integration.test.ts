import { describe, it, expect } from 'vitest'
import { PROP_2 } from '../propositions/prop2'
import { validateStep } from '../propositions/validation'
import { resolveSelector } from '../engine/selectors'
import { MACRO_REGISTRY } from '../engine/macros'
import {
  initializeGiven,
  addSegment,
  addCircle,
  addPoint,
  getPoint,
} from '../engine/constructionState'
import { findNewIntersections, isCandidateBeyondPoint } from '../engine/intersections'
import { createFactStore } from '../engine/factStore'
import { deriveDef15Facts } from '../engine/factDerivation'
import { PROP_CONCLUSIONS } from '../propositions/prop2Facts'
import { queryEquality } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import type { ConstructionState, IntersectionCandidate } from '../types'

/**
 * Integration test: execute all 6 steps of Proposition I.2, verifying that
 * ElementSelectors resolve correctly and the proof engine produces AF = BC.
 */
describe('Proposition I.2 full construction with selectors', () => {
  it('completes all 6 steps with correct element resolution', () => {
    let state: ConstructionState = initializeGiven(PROP_2.givenElements)
    let candidates: IntersectionCandidate[] = []
    const factStore = createFactStore()
    const steps = PROP_2.steps

    // ── Step 0: Join A to B (straightedge) ──
    const segAB = addSegment(state, 'pt-A', 'pt-B')
    state = segAB.state
    candidates = [...candidates, ...findNewIntersections(state, segAB.segment, candidates, true)]
    expect(validateStep(steps[0].expected, state, segAB.segment)).toBe(true)

    // ── Step 1: Construct equilateral triangle (macro I.1) ──
    const macro = MACRO_REGISTRY[1]
    const outputLabels = steps[1].expected.type === 'macro' ? steps[1].expected.outputLabels : undefined
    const macroResult = macro.execute(state, ['pt-A', 'pt-B'], candidates, factStore, true, outputLabels)
    state = macroResult.state
    candidates = macroResult.candidates
    // factStore is mutated in place by the macro

    // Verify apex got the explicit label 'D'
    const ptD = getPoint(state, 'pt-D')
    expect(ptD).toBeDefined()
    expect(ptD!.label).toBe('D')

    // ── Step 2: Circle at B through C ──
    const cirBC = addCircle(state, 'pt-B', 'pt-C')
    state = cirBC.state
    candidates = [...candidates, ...findNewIntersections(state, cirBC.circle, candidates, true)]
    expect(validateStep(steps[2].expected, state, cirBC.circle)).toBe(true)

    // ── Step 3: Mark intersection E (circle BC ∩ segment DB, beyond B) ──
    // Resolve selectors from step definition
    const step3 = steps[3].expected
    expect(step3.type).toBe('intersection')
    if (step3.type !== 'intersection') throw new Error('unreachable')

    const resolvedOfA = step3.ofA != null ? resolveSelector(step3.ofA, state) : null
    const resolvedOfB = step3.ofB != null ? resolveSelector(step3.ofB, state) : null
    expect(resolvedOfA).toBe(cirBC.circle.id)
    // Segment DB was created by the macro
    expect(resolvedOfB).toBeTruthy()

    // Find the candidate matching the resolved selectors, beyond B
    const step3Candidates = candidates.filter(c => {
      const matches =
        (c.ofA === resolvedOfA && c.ofB === resolvedOfB) ||
        (c.ofA === resolvedOfB && c.ofB === resolvedOfA)
      if (!matches) return false
      if (step3.beyondId) {
        return isCandidateBeyondPoint(c, step3.beyondId, c.ofA, c.ofB, state)
      }
      return true
    })
    expect(step3Candidates.length).toBeGreaterThanOrEqual(1)

    const candE = step3Candidates[0]
    const ptE = addPoint(state, candE.x, candE.y, 'intersection', step3.label)
    state = ptE.state
    expect(ptE.point.label).toBe('E')
    expect(ptE.point.id).toBe('pt-E')

    // Derive Def.15 facts (mutates factStore in place)
    deriveDef15Facts(candE, ptE.point.id, state, factStore, 3)
    candidates = candidates.filter(
      c => !(Math.abs(c.x - candE.x) < 0.001 && Math.abs(c.y - candE.y) < 0.001),
    )

    expect(validateStep(steps[3].expected, state, ptE.point, candE)).toBe(true)

    // ── Step 4: Circle at D through E ──
    const cirDE = addCircle(state, 'pt-D', 'pt-E')
    state = cirDE.state
    candidates = [...candidates, ...findNewIntersections(state, cirDE.circle, candidates, true)]
    expect(validateStep(steps[4].expected, state, cirDE.circle)).toBe(true)

    // ── Step 5: Mark intersection F (circle DE ∩ segment DA, beyond A) ──
    const step5 = steps[5].expected
    expect(step5.type).toBe('intersection')
    if (step5.type !== 'intersection') throw new Error('unreachable')

    const resolved5A = step5.ofA != null ? resolveSelector(step5.ofA, state) : null
    const resolved5B = step5.ofB != null ? resolveSelector(step5.ofB, state) : null
    expect(resolved5A).toBe(cirDE.circle.id)
    expect(resolved5B).toBeTruthy()

    const step5Candidates = candidates.filter(c => {
      const matches =
        (c.ofA === resolved5A && c.ofB === resolved5B) ||
        (c.ofA === resolved5B && c.ofB === resolved5A)
      if (!matches) return false
      if (step5.beyondId) {
        return isCandidateBeyondPoint(c, step5.beyondId, c.ofA, c.ofB, state)
      }
      return true
    })
    expect(step5Candidates.length).toBeGreaterThanOrEqual(1)

    const candF = step5Candidates[0]
    const ptF = addPoint(state, candF.x, candF.y, 'intersection', step5.label)
    state = ptF.state
    expect(ptF.point.label).toBe('F')
    expect(ptF.point.id).toBe('pt-F')

    // Derive Def.15 facts (mutates factStore in place)
    deriveDef15Facts(candF, ptF.point.id, state, factStore, 5)
    candidates = candidates.filter(
      c => !(Math.abs(c.x - candF.x) < 0.001 && Math.abs(c.y - candF.y) < 0.001),
    )

    expect(validateStep(steps[5].expected, state, ptF.point, candF)).toBe(true)

    // ── Derive conclusion: AF = BC ──
    const conclusionFn = PROP_CONCLUSIONS[2]
    expect(conclusionFn).toBeDefined()

    // Mutates factStore in place, returns new facts
    conclusionFn(factStore, state, steps.length)

    // The proof engine should establish AF = BC
    const dpAF = distancePair('pt-A', 'pt-F')
    const dpBC = distancePair('pt-B', 'pt-C')
    expect(queryEquality(factStore, dpAF, dpBC)).toBe(true)
  })

  it('all proposition step selectors resolve to non-null with correct state', () => {
    // Verify that every selector in PROP_2 steps resolves after the appropriate state is built
    let state = initializeGiven(PROP_2.givenElements)
    let candidates: IntersectionCandidate[] = []
    const factStore = createFactStore()

    // Build state through step 2 (macro)
    const segAB = addSegment(state, 'pt-A', 'pt-B')
    state = segAB.state
    candidates = [...candidates, ...findNewIntersections(state, segAB.segment, candidates, true)]

    const macro = MACRO_REGISTRY[1]
    const macroResult = macro.execute(state, ['pt-A', 'pt-B'], candidates, factStore, true, { apex: 'D' })
    state = macroResult.state
    candidates = macroResult.candidates

    // After step 2 (circle B,C), step 3's selectors should resolve
    const cirBC = addCircle(state, 'pt-B', 'pt-C')
    state = cirBC.state
    candidates = [...candidates, ...findNewIntersections(state, cirBC.circle, candidates, true)]

    const step3 = PROP_2.steps[3].expected
    if (step3.type === 'intersection' && step3.ofA != null && step3.ofB != null) {
      expect(resolveSelector(step3.ofA, state)).not.toBeNull()
      expect(resolveSelector(step3.ofB, state)).not.toBeNull()
    }
  })
})
