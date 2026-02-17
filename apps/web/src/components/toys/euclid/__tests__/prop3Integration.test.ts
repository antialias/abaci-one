import { describe, it, expect } from 'vitest'
import { PROP_3 } from '../propositions/prop3'
import { validateStep } from '../propositions/validation'
import { resolveSelector } from '../engine/selectors'
import { MACRO_REGISTRY } from '../engine/macros'
import {
  initializeGiven,
  addCircle,
  addPoint,
  getPoint,
} from '../engine/constructionState'
import { findNewIntersections } from '../engine/intersections'
import { createFactStore, queryEquality } from '../engine/factStore'
import { deriveDef15Facts } from '../engine/factDerivation'
import { distancePair } from '../engine/facts'
import type { ConstructionState, IntersectionCandidate } from '../types'

/**
 * Integration test: execute all 3 steps of Proposition I.3, verifying that
 * the I.2 macro transfers CD to AE, the circle cuts off AF, and AF = CD.
 */
describe('Proposition I.3 full construction', () => {
  it('completes all 3 steps and proves AF = CD', () => {
    let state: ConstructionState = initializeGiven(PROP_3.givenElements)
    let candidates: IntersectionCandidate[] = []
    const factStore = createFactStore()
    const steps = PROP_3.steps

    // Verify given geometry
    const ptA = getPoint(state, 'pt-A')!
    const ptB = getPoint(state, 'pt-B')!
    const ptC = getPoint(state, 'pt-C')!
    const ptD = getPoint(state, 'pt-D')!
    expect(ptA).toBeDefined()
    expect(ptB).toBeDefined()
    expect(ptC).toBeDefined()
    expect(ptD).toBeDefined()

    const distAB = Math.sqrt((ptA.x - ptB.x) ** 2 + (ptA.y - ptB.y) ** 2)
    const distCD = Math.sqrt((ptC.x - ptD.x) ** 2 + (ptC.y - ptD.y) ** 2)
    expect(distAB).toBeGreaterThan(distCD) // AB is the "greater"

    // ── Step 0: Place at A a line equal to CD (I.2 macro) ──
    const macro = MACRO_REGISTRY[2]
    expect(macro).toBeDefined()

    const outputLabels = steps[0].expected.type === 'macro' ? steps[0].expected.outputLabels : undefined
    const macroResult = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], candidates, factStore, 0, false, outputLabels)
    state = macroResult.state
    candidates = macroResult.candidates

    // Verify point E was created with correct label
    const ptE = getPoint(state, 'pt-E')
    expect(ptE).toBeDefined()
    expect(ptE!.label).toBe('E')

    // Verify |AE| ≈ |CD|
    const distAE = Math.sqrt((ptA.x - ptE!.x) ** 2 + (ptA.y - ptE!.y) ** 2)
    expect(distAE).toBeCloseTo(distCD, 8)

    // Verify fact: AE = CD
    const dpAE = distancePair('pt-A', 'pt-E')
    const dpCD = distancePair('pt-C', 'pt-D')
    expect(queryEquality(factStore, dpAE, dpCD)).toBe(true)

    // Verify macro produced a segment
    expect(macroResult.addedElements.some(e => e.kind === 'segment')).toBe(true)

    // ── Step 1: Draw circle centered at A through E ──
    const cirAE = addCircle(state, 'pt-A', 'pt-E')
    state = cirAE.state
    candidates = [...candidates, ...findNewIntersections(state, cirAE.circle, candidates, false)]
    expect(validateStep(steps[1].expected, state, cirAE.circle)).toBe(true)

    // ── Step 2: Mark where circle crosses AB → pt-F ──
    const step2 = steps[2].expected
    expect(step2.type).toBe('intersection')
    if (step2.type !== 'intersection') throw new Error('unreachable')

    const resolvedOfA = step2.ofA != null ? resolveSelector(step2.ofA, state) : null
    const resolvedOfB = step2.ofB != null ? resolveSelector(step2.ofB, state) : null
    expect(resolvedOfA).toBe(cirAE.circle.id)
    expect(resolvedOfB).toBeTruthy() // should resolve to seg-AB

    // Find matching candidate
    const step2Candidates = candidates.filter(c => {
      return (
        (c.ofA === resolvedOfA && c.ofB === resolvedOfB) ||
        (c.ofA === resolvedOfB && c.ofB === resolvedOfA)
      )
    })
    expect(step2Candidates.length).toBeGreaterThanOrEqual(1)

    const candF = step2Candidates[0]
    const ptFResult = addPoint(state, candF.x, candF.y, 'intersection', step2.label)
    state = ptFResult.state
    expect(ptFResult.point.label).toBe('F')
    expect(ptFResult.point.id).toBe('pt-F')

    // Derive Def.15 facts (F on circle(A,E) → AF = AE)
    const def15Facts = deriveDef15Facts(candF, ptFResult.point.id, state, factStore, 2)
    expect(def15Facts.length).toBeGreaterThan(0)

    expect(validateStep(steps[2].expected, state, ptFResult.point, candF)).toBe(true)

    // ── Verify conclusion: AF = CD (transitive via union-find) ──
    const dpAF = distancePair('pt-A', 'pt-F')
    // AF = AE (Def.15) and AE = CD (I.2 macro) → AF = CD (C.N.1, automatic)
    expect(queryEquality(factStore, dpAF, dpCD)).toBe(true)

    // Geometric verification: |AF| ≈ |CD|
    const ptF = getPoint(state, 'pt-F')!
    const distAF = Math.sqrt((ptA.x - ptF.x) ** 2 + (ptA.y - ptF.y) ** 2)
    expect(distAF).toBeCloseTo(distCD, 8)
  })

  it('point E is placed in the direction of C from A', () => {
    const state: ConstructionState = initializeGiven(PROP_3.givenElements)
    const candidates: IntersectionCandidate[] = []
    const factStore = createFactStore()

    const macro = MACRO_REGISTRY[2]
    const macroResult = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], candidates, factStore, 0, false, { result: 'E' })

    const ptA = getPoint(macroResult.state, 'pt-A')!
    const ptC = getPoint(macroResult.state, 'pt-C')!
    const ptE = getPoint(macroResult.state, 'pt-E')!

    // E should be in the direction of C from A
    const dirAC = Math.atan2(ptC.y - ptA.y, ptC.x - ptA.x)
    const dirAE = Math.atan2(ptE.y - ptA.y, ptE.x - ptA.x)
    expect(dirAE).toBeCloseTo(dirAC, 8)
  })

  it('point F lies between A and B on segment AB', () => {
    let state: ConstructionState = initializeGiven(PROP_3.givenElements)
    let candidates: IntersectionCandidate[] = []
    const factStore = createFactStore()

    // Execute macro
    const macro = MACRO_REGISTRY[2]
    const macroResult = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], candidates, factStore, 0, false, { result: 'E' })
    state = macroResult.state
    candidates = macroResult.candidates

    // Draw circle
    const cirAE = addCircle(state, 'pt-A', 'pt-E')
    state = cirAE.state
    candidates = [...candidates, ...findNewIntersections(state, cirAE.circle, candidates, false)]

    // Find intersection
    const step2 = PROP_3.steps[2].expected
    if (step2.type !== 'intersection') throw new Error('unreachable')
    const resolvedOfA = step2.ofA != null ? resolveSelector(step2.ofA, state) : null
    const resolvedOfB = step2.ofB != null ? resolveSelector(step2.ofB, state) : null

    const matchingCands = candidates.filter(c =>
      (c.ofA === resolvedOfA && c.ofB === resolvedOfB) ||
      (c.ofA === resolvedOfB && c.ofB === resolvedOfA),
    )
    expect(matchingCands.length).toBeGreaterThanOrEqual(1)

    const ptA = getPoint(state, 'pt-A')!
    const ptB = getPoint(state, 'pt-B')!
    const candF = matchingCands[0]

    // F should be between A and B (parameter t in [0, 1])
    const t = (candF.x - ptA.x) / (ptB.x - ptA.x)
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(1)
  })
})
