import { describe, it, expect } from 'vitest'
import { MACRO_REGISTRY } from '../engine/macros'
import { initializeGiven, getPoint } from '../engine/constructionState'
import { createFactStore, queryEquality } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import type { ConstructionElement, ConstructionState } from '../types'
import { BYRNE } from '../types'

/** Given: target point A, segment CD to copy */
function givenACD(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: -2.5, y: 0.5, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 0.5, y: -1.5, label: 'C', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-D', x: 2.0, y: -1.5, label: 'D', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

/** Collinear points: A at origin, B along x-axis */
function givenCollinear(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 3, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 5, y: 0, label: 'C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

/** Target coincides with segFrom (degenerate direction) */
function givenCoincident(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: 1, y: 2, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 1, y: 2, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 4, y: 2, label: 'C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

describe('MACRO_PROP_2 (Transfer distance, I.2)', () => {
  const macro = MACRO_REGISTRY[2]

  it('is registered in MACRO_REGISTRY', () => {
    expect(macro).toBeDefined()
    expect(macro.propId).toBe(2)
    expect(macro.inputCount).toBe(3)
    expect(macro.inputLabels).toHaveLength(3)
  })

  it('creates one point and one segment', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false)

    const points = result.addedElements.filter((e) => e.kind === 'point')
    const segments = result.addedElements.filter((e) => e.kind === 'segment')
    expect(points).toHaveLength(1)
    expect(segments).toHaveLength(1)
  })

  it('uses explicit "result" label from outputLabels', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false, {
      result: 'E',
    })

    const pt = result.addedElements.find((e) => e.kind === 'point')
    expect(pt).toBeDefined()
    expect(pt!.id).toBe('pt-E')
    expect((pt as { label: string }).label).toBe('E')
  })

  it('auto-generates label when no outputLabels provided', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false)

    const pt = result.addedElements.find((e) => e.kind === 'point')
    expect(pt).toBeDefined()
    // A=0, C=2, D=3 → nextLabelIndex=4 → label 'E'
    expect(pt!.id).toBe('pt-E')
  })

  it('places output at correct distance from target', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false, {
      result: 'E',
    })

    const ptA = getPoint(result.state, 'pt-A')!
    const ptC = getPoint(result.state, 'pt-C')!
    const ptD = getPoint(result.state, 'pt-D')!
    const ptE = getPoint(result.state, 'pt-E')!

    const distCD = Math.sqrt((ptC.x - ptD.x) ** 2 + (ptC.y - ptD.y) ** 2)
    const distAE = Math.sqrt((ptA.x - ptE.x) ** 2 + (ptA.y - ptE.y) ** 2)
    expect(distAE).toBeCloseTo(distCD, 10)
  })

  it('places output in direction target → segFrom', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false, {
      result: 'E',
    })

    const ptA = getPoint(result.state, 'pt-A')!
    const ptC = getPoint(result.state, 'pt-C')!
    const ptE = getPoint(result.state, 'pt-E')!

    const dirAC = Math.atan2(ptC.y - ptA.y, ptC.x - ptA.x)
    const dirAE = Math.atan2(ptE.y - ptA.y, ptE.x - ptA.x)
    expect(dirAE).toBeCloseTo(dirAC, 10)
  })

  it('adds equality fact: dist(target, output) = dist(segFrom, segTo)', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false, {
      result: 'E',
    })

    expect(result.newFacts).toHaveLength(1)
    const fact = result.newFacts[0]
    expect(fact.citation).toEqual({ type: 'prop', propId: 2 })
    expect(fact.statement).toBe('AE = CD')
    expect(
      queryEquality(factStore, distancePair('pt-A', 'pt-E'), distancePair('pt-C', 'pt-D'))
    ).toBe(true)
  })

  it('segment connects target to output point', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false, {
      result: 'E',
    })

    const seg = result.addedElements.find((e) => e.kind === 'segment')
    expect(seg).toBeDefined()
    if (seg?.kind === 'segment') {
      const endpoints = [seg.fromId, seg.toId].sort()
      expect(endpoints).toEqual(['pt-A', 'pt-E'])
    }
  })

  it('stamps facts with the provided atStep value', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 7, false)

    for (const fact of result.newFacts) {
      expect(fact.atStep).toBe(7)
    }
  })

  it('works with collinear points', () => {
    const state = givenCollinear()
    const factStore = createFactStore()
    // Copy length |BC| = 2 to point A, in direction A→B (along x-axis)
    const result = macro.execute(state, ['pt-A', 'pt-B', 'pt-C'], [], factStore, 0, false, {
      result: 'E',
    })

    const ptE = getPoint(result.state, 'pt-E')!
    expect(ptE).toBeDefined()
    // |BC| = 2, direction A→B = (1,0), so E = A + 2*(1,0) = (2, 0)
    expect(ptE.x).toBeCloseTo(2, 10)
    expect(ptE.y).toBeCloseTo(0, 10)
  })

  it('uses fallback direction (0,1) when target coincides with segFrom', () => {
    const state = givenCoincident()
    const factStore = createFactStore()
    // target=A(1,2), segFrom=B(1,2) — same position
    // |BC| = 3, fallback direction = (0,1), so output = (1, 5)
    const result = macro.execute(state, ['pt-A', 'pt-B', 'pt-C'], [], factStore, 0, false, {
      result: 'E',
    })

    const ptE = getPoint(result.state, 'pt-E')!
    expect(ptE).toBeDefined()
    expect(ptE.x).toBeCloseTo(1, 10)
    expect(ptE.y).toBeCloseTo(5, 10)

    // Distance should still be correct
    const ptA = getPoint(result.state, 'pt-A')!
    const distAE = Math.sqrt((ptA.x - ptE.x) ** 2 + (ptA.y - ptE.y) ** 2)
    expect(distAE).toBeCloseTo(3, 10)
  })

  it('returns empty result when input points are missing', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-MISSING'], [], factStore, 0, false)

    expect(result.newFacts).toHaveLength(0)
    expect(result.addedElements).toHaveLength(0)
    expect(factStore.facts).toHaveLength(0)
  })

  it('facts in store match facts in result', () => {
    const state = givenACD()
    const factStore = createFactStore()
    const result = macro.execute(state, ['pt-A', 'pt-C', 'pt-D'], [], factStore, 0, false)

    expect(factStore.facts).toHaveLength(result.newFacts.length)
    for (let i = 0; i < result.newFacts.length; i++) {
      expect(factStore.facts[i]).toBe(result.newFacts[i])
    }
  })

  it('copies a zero-length segment correctly', () => {
    const given: ConstructionElement[] = [
      { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
      { kind: 'point', id: 'pt-B', x: 3, y: 4, label: 'B', color: BYRNE.given, origin: 'given' },
      { kind: 'point', id: 'pt-C', x: 3, y: 4, label: 'C', color: BYRNE.given, origin: 'given' },
    ]
    const state = initializeGiven(given)
    const factStore = createFactStore()

    // |BC| = 0, so output should be at target
    const result = macro.execute(state, ['pt-A', 'pt-B', 'pt-C'], [], factStore, 0, false, {
      result: 'E',
    })

    const ptA = getPoint(result.state, 'pt-A')!
    const ptE = getPoint(result.state, 'pt-E')!
    expect(ptE.x).toBeCloseTo(ptA.x, 10)
    expect(ptE.y).toBeCloseTo(ptA.y, 10)
  })
})
