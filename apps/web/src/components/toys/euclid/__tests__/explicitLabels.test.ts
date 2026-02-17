import { describe, it, expect } from 'vitest'
import { addPoint, initializeGiven, getPoint } from '../engine/constructionState'
import type { ConstructionElement, ConstructionState } from '../types'
import { BYRNE } from '../types'

function givenABC(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 2, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 1, y: 1, label: 'C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

describe('addPoint with explicitLabel', () => {
  it('uses the explicit label instead of auto-generating', () => {
    const state = givenABC() // nextLabelIndex = 3 (next auto = 'D')
    const result = addPoint(state, 5, 5, 'intersection', 'Z')

    expect(result.point.label).toBe('Z')
    expect(result.point.id).toBe('pt-Z')
  })

  it('advances nextLabelIndex past the explicit label', () => {
    const state = givenABC() // nextLabelIndex = 3
    // 'D' is index 3, so nextLabelIndex should become 4
    const result = addPoint(state, 5, 5, 'intersection', 'D')

    expect(result.point.label).toBe('D')
    expect(result.state.nextLabelIndex).toBe(4)
  })

  it('does not regress nextLabelIndex when explicit label is before current', () => {
    let state = givenABC()
    // Auto-add D (index 3) and E (index 4)
    const r1 = addPoint(state, 3, 3, 'intersection')
    state = r1.state
    expect(r1.point.label).toBe('D')

    const r2 = addPoint(state, 4, 4, 'intersection')
    state = r2.state
    expect(r2.point.label).toBe('E')
    expect(state.nextLabelIndex).toBe(5)

    // Now add a point with explicit label 'D' — should NOT regress to 4
    // (In practice this would be unusual, but the invariant matters)
    const r3 = addPoint(state, 6, 6, 'intersection', 'D')
    expect(r3.state.nextLabelIndex).toBe(5) // max(5, 3+1) = 5
  })

  it('skips labels when explicit label is ahead of auto-sequence', () => {
    const state = givenABC() // nextLabelIndex = 3 (next auto = 'D')
    // Jump ahead to 'F' (index 5)
    const r1 = addPoint(state, 5, 5, 'intersection', 'F')
    expect(r1.point.label).toBe('F')
    expect(r1.state.nextLabelIndex).toBe(6) // max(3, 5+1) = 6

    // Next auto-generated label should be 'G'
    const r2 = addPoint(r1.state, 6, 6, 'intersection')
    expect(r2.point.label).toBe('G')
  })

  it('auto-generates when no explicit label is provided', () => {
    const state = givenABC()
    const r1 = addPoint(state, 5, 5, 'intersection')
    expect(r1.point.label).toBe('D')
    expect(r1.state.nextLabelIndex).toBe(4)
  })

  it('produces the expected label sequence for Prop I.2', () => {
    // Simulate the Prop I.2 label sequence:
    // Given: A, B, C → macro creates D → intersection creates E → intersection creates F
    let state = givenABC()

    // Macro creates apex with explicit label 'D'
    const rD = addPoint(state, 1, 2, 'intersection', 'D')
    state = rD.state
    expect(rD.point.id).toBe('pt-D')

    // Intersection creates E with explicit label
    const rE = addPoint(state, 3, 0, 'intersection', 'E')
    state = rE.state
    expect(rE.point.id).toBe('pt-E')

    // Intersection creates F with explicit label
    const rF = addPoint(state, -2, 3, 'intersection', 'F')
    state = rF.state
    expect(rF.point.id).toBe('pt-F')

    // Verify all points are retrievable
    expect(getPoint(state, 'pt-D')?.label).toBe('D')
    expect(getPoint(state, 'pt-E')?.label).toBe('E')
    expect(getPoint(state, 'pt-F')?.label).toBe('F')
    expect(state.nextLabelIndex).toBe(6) // past 'F'
  })
})
