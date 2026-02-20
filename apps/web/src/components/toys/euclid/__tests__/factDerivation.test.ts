import { describe, it, expect } from 'vitest'
import { deriveDef15Facts } from '../engine/factDerivation'
import { createFactStore, queryEquality } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import { initializeGiven, addCircle, addPoint } from '../engine/constructionState'
import type { ConstructionElement, IntersectionCandidate } from '../types'
import { BYRNE } from '../types'

function givenAB() {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 2, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

describe('deriveDef15Facts', () => {
  it('derives equality for a point on one circle', () => {
    let state = givenAB()
    const cir = addCircle(state, 'pt-A', 'pt-B')
    state = cir.state

    // Add intersection point C on the circle centered at A through B
    const ptC = addPoint(state, 1, 1.73, 'intersection', 'C')
    state = ptC.state

    const store = createFactStore()
    const candidate: IntersectionCandidate = {
      x: 1,
      y: 1.73,
      ofA: cir.circle.id,
      ofB: 'seg-1', // doesn't matter — only circles produce Def.15 facts
      which: 0,
    }

    const newFacts = deriveDef15Facts(candidate, 'pt-C', state, store, 0)

    expect(newFacts).toHaveLength(1)
    expect(newFacts[0].statement).toBe('AC = AB')
    expect(newFacts[0].citation).toEqual({ type: 'def15', circleId: cir.circle.id })

    // AC = AB should now be queryable
    expect(queryEquality(store, distancePair('pt-A', 'pt-C'), distancePair('pt-A', 'pt-B'))).toBe(
      true
    )
  })

  it('derives equalities for a point on two circles', () => {
    let state = givenAB()
    const cir1 = addCircle(state, 'pt-A', 'pt-B')
    state = cir1.state
    const cir2 = addCircle(state, 'pt-B', 'pt-A')
    state = cir2.state

    // Add intersection point C at the intersection of both circles
    const ptC = addPoint(state, 1, 1.73, 'intersection', 'C')
    state = ptC.state

    const store = createFactStore()
    const candidate: IntersectionCandidate = {
      x: 1,
      y: 1.73,
      ofA: cir1.circle.id,
      ofB: cir2.circle.id,
      which: 0,
    }

    const newFacts = deriveDef15Facts(candidate, 'pt-C', state, store, 0)

    // Two Def.15 facts: AC = AB (from cir1), BC = BA (from cir2)
    expect(newFacts).toHaveLength(2)
    const statements = newFacts.map((f) => f.statement)
    expect(statements).toContain('AC = AB')
    expect(statements).toContain('BC = BA')

    // Transitivity: AC = AB and BC = BA, so AC = BC via C.N.1
    expect(queryEquality(store, distancePair('pt-A', 'pt-C'), distancePair('pt-B', 'pt-C'))).toBe(
      true
    )
  })

  it('produces no facts when candidate involves no circles', () => {
    const state = givenAB()
    const store = createFactStore()

    // Candidate from two segments — no circles
    const candidate: IntersectionCandidate = {
      x: 1,
      y: 0.5,
      ofA: 'seg-1',
      ofB: 'seg-2',
      which: 0,
    }

    const newFacts = deriveDef15Facts(candidate, 'pt-C', state, store, 0)
    expect(newFacts).toHaveLength(0)
  })

  it('produces no facts when circle is not found in state', () => {
    const state = givenAB()
    const store = createFactStore()

    // Candidate references a circle that doesn't exist in state
    const candidate: IntersectionCandidate = {
      x: 1,
      y: 0.5,
      ofA: 'cir-99',
      ofB: 'seg-1',
      which: 0,
    }

    const newFacts = deriveDef15Facts(candidate, 'pt-C', state, store, 0)
    expect(newFacts).toHaveLength(0)
  })

  it('records the correct atStep value', () => {
    let state = givenAB()
    const cir = addCircle(state, 'pt-A', 'pt-B')
    state = cir.state
    const ptC = addPoint(state, 1, 1.73, 'intersection', 'C')
    state = ptC.state

    const store = createFactStore()
    const candidate: IntersectionCandidate = {
      x: 1,
      y: 1.73,
      ofA: cir.circle.id,
      ofB: 'seg-1',
      which: 0,
    }

    const newFacts = deriveDef15Facts(candidate, 'pt-C', state, store, 7)
    expect(newFacts[0].atStep).toBe(7)
  })

  it('does not duplicate facts if called twice with same data', () => {
    let state = givenAB()
    const cir = addCircle(state, 'pt-A', 'pt-B')
    state = cir.state
    const ptC = addPoint(state, 1, 1.73, 'intersection', 'C')
    state = ptC.state

    const store = createFactStore()
    const candidate: IntersectionCandidate = {
      x: 1,
      y: 1.73,
      ofA: cir.circle.id,
      ofB: 'seg-1',
      which: 0,
    }

    const first = deriveDef15Facts(candidate, 'pt-C', state, store, 0)
    expect(first).toHaveLength(1)

    // Same derivation again — should produce nothing (already in store)
    const second = deriveDef15Facts(candidate, 'pt-C', state, store, 0)
    expect(second).toHaveLength(0)
    expect(store.facts).toHaveLength(1)
  })
})
