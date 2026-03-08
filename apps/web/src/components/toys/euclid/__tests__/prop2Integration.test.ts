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
    const outputLabels =
      steps[1].expected.type === 'macro' ? steps[1].expected.outputLabels : undefined
    const macroResult = macro.execute(
      state,
      ['pt-A', 'pt-B'],
      candidates,
      factStore,
      1,
      true,
      outputLabels
    )
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

    // ── Step 3: Extend DB past B to E (circle BC ∩ line DB, beyond B) ──
    const step3 = steps[3].expected
    expect(step3.type).toBe('extend')
    if (step3.type !== 'extend') throw new Error('unreachable')
    expect(step3.baseId).toBe('pt-D')
    expect(step3.throughId).toBe('pt-B')
    expect(step3.label).toBe('E')

    // The extend places a point at the circle-line intersection beyond B
    // Find the candidate on circle BC ∩ segment DB, beyond B
    const segDB = state.elements.find(
      (e) => e.kind === 'segment' && e.fromId === 'pt-D' && e.toId === 'pt-B'
    )
    expect(segDB).toBeDefined()
    const step3Candidates = candidates.filter((c) => {
      const matches =
        (c.ofA === cirBC.circle.id && c.ofB === segDB!.id) ||
        (c.ofA === segDB!.id && c.ofB === cirBC.circle.id)
      if (!matches) return false
      return isCandidateBeyondPoint(c, 'pt-B', c.ofA, c.ofB, state)
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
      (c) => !(Math.abs(c.x - candE.x) < 0.001 && Math.abs(c.y - candE.y) < 0.001)
    )

    // ── Step 4: Circle at D through E ──
    const cirDE = addCircle(state, 'pt-D', 'pt-E')
    state = cirDE.state
    candidates = [...candidates, ...findNewIntersections(state, cirDE.circle, candidates, true)]
    expect(validateStep(steps[4].expected, state, cirDE.circle)).toBe(true)

    // ── Step 5: Extend DA past A to F (circle DE ∩ line DA, beyond A) ──
    const step5 = steps[5].expected
    expect(step5.type).toBe('extend')
    if (step5.type !== 'extend') throw new Error('unreachable')
    expect(step5.baseId).toBe('pt-D')
    expect(step5.throughId).toBe('pt-A')
    expect(step5.label).toBe('F')

    // The extend places a point at the circle-line intersection beyond A
    const segDA = state.elements.find(
      (e) => e.kind === 'segment' && e.fromId === 'pt-D' && e.toId === 'pt-A'
    )
    expect(segDA).toBeDefined()
    const step5Candidates = candidates.filter((c) => {
      const matches =
        (c.ofA === cirDE.circle.id && c.ofB === segDA!.id) ||
        (c.ofA === segDA!.id && c.ofB === cirDE.circle.id)
      if (!matches) return false
      return isCandidateBeyondPoint(c, 'pt-A', c.ofA, c.ofB, state)
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
      (c) => !(Math.abs(c.x - candF.x) < 0.001 && Math.abs(c.y - candF.y) < 0.001)
    )

    // ── Derive conclusion: AF = BC ──
    const conclusionFn = PROP_2.deriveConclusion
    expect(conclusionFn).toBeDefined()

    // Mutates factStore in place, returns new facts
    conclusionFn!(factStore, state, steps.length)

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
    const macroResult = macro.execute(state, ['pt-A', 'pt-B'], candidates, factStore, 1, true, {
      apex: 'D',
    })
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
    // extend steps reference points directly, which are already in state
    if (step3.type === 'extend') {
      expect(getPoint(state, step3.baseId)).toBeDefined()
      expect(getPoint(state, step3.throughId)).toBeDefined()
    }
  })
})
