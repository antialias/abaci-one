import { describe, it, expect } from 'vitest'
import { MACRO_REGISTRY } from '../engine/macros'
import { initializeGiven, addSegment, getPoint } from '../engine/constructionState'
import { createFactStore } from '../engine/factStore'
import type { ConstructionElement, ConstructionState } from '../types'
import { BYRNE } from '../types'

function givenAB(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: -2, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 2, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-AB', fromId: 'pt-A', toId: 'pt-B', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

function givenABC(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: -1.5, y: 1.5, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 0, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 1.5, y: 0, label: 'C', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-BC', fromId: 'pt-B', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

describe('MACRO_PROP_1 with outputLabels', () => {
  const macro = MACRO_REGISTRY[1]

  it('uses the explicit apex label when provided', () => {
    const state = givenAB()
    const factStore = createFactStore()

    const result = macro.execute(
      state, ['pt-A', 'pt-B'], [], factStore, false,
      { apex: 'C' },
    )

    const apex = result.addedElements.find(e => e.kind === 'point')
    expect(apex).toBeDefined()
    expect(apex!.id).toBe('pt-C')
    expect((apex as { label: string }).label).toBe('C')
  })

  it('auto-generates the apex label when no outputLabels provided', () => {
    const state = givenAB()
    const factStore = createFactStore()

    const result = macro.execute(
      state, ['pt-A', 'pt-B'], [], factStore, false,
    )

    const apex = result.addedElements.find(e => e.kind === 'point')
    expect(apex).toBeDefined()
    // With given A(0), B(1), nextLabelIndex = 2 → auto label = 'C'
    expect(apex!.id).toBe('pt-C')
  })

  it('uses explicit label "D" for apex when called in Prop I.2 context', () => {
    // In Prop I.2, A=0, B=1, C=2 are given, so the macro should produce D
    let state = givenABC()
    // Step 1 of Prop I.2: add segment A-B
    const seg = addSegment(state, 'pt-A', 'pt-B')
    state = seg.state

    const factStore = createFactStore()

    const result = macro.execute(
      state, ['pt-A', 'pt-B'], [], factStore, true,
      { apex: 'D' },
    )

    const apex = result.addedElements.find(e => e.kind === 'point')
    expect(apex).toBeDefined()
    expect(apex!.id).toBe('pt-D')
    expect((apex as { label: string }).label).toBe('D')

    // Verify segments connect to the explicitly-labeled point
    const segments = result.addedElements.filter(e => e.kind === 'segment')
    expect(segments).toHaveLength(2)
    const segIds = segments.map(s => {
      if (s.kind !== 'segment') return null
      return [s.fromId, s.toId].sort().join(',')
    })
    expect(segIds).toContain('pt-A,pt-D')
    expect(segIds).toContain('pt-B,pt-D')
  })

  it('generates Def.15 facts referencing the explicit label', () => {
    const state = givenAB()
    const factStore = createFactStore()

    const result = macro.execute(
      state, ['pt-A', 'pt-B'], [], factStore, false,
      { apex: 'X' },
    )

    // Should have facts like "AX = AB" and "BX = BA"
    expect(result.newFacts.length).toBeGreaterThanOrEqual(2)
    const statements = result.newFacts.map(f => f.statement)
    expect(statements).toContain('AX = AB')
    expect(statements).toContain('BX = BA')
  })

  it('creates intersection candidates from new segments', () => {
    const state = givenAB()
    const factStore = createFactStore()

    const result = macro.execute(
      state, ['pt-A', 'pt-B'], [], factStore, false,
    )

    // Macro creates: 1 point + 2 segments = 3 elements
    expect(result.addedElements).toHaveLength(3)
    expect(result.addedElements.filter(e => e.kind === 'point')).toHaveLength(1)
    expect(result.addedElements.filter(e => e.kind === 'segment')).toHaveLength(2)
  })
})
