import { describe, it, expect } from 'vitest'
import { resolveSelector } from '../engine/selectors'
import { initializeGiven, addCircle, addSegment, addPoint } from '../engine/constructionState'
import type { ConstructionElement, ConstructionState, ElementSelector } from '../types'
import { BYRNE } from '../types'

function givenState(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: 0, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 2, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 1, y: 1, label: 'C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

describe('resolveSelector', () => {
  describe('string selectors (point IDs)', () => {
    it('returns the string as-is', () => {
      const state = givenState()
      expect(resolveSelector('pt-A', state)).toBe('pt-A')
    })

    it('returns string even if the point does not exist in state', () => {
      const state = givenState()
      // String selectors are pass-through — no existence check
      expect(resolveSelector('pt-Z', state)).toBe('pt-Z')
    })
  })

  describe('circle selectors', () => {
    it('resolves a circle by its center and radius point', () => {
      let state = givenState()
      const r1 = addCircle(state, 'pt-A', 'pt-B')
      state = r1.state
      const r2 = addCircle(state, 'pt-B', 'pt-A')
      state = r2.state

      const sel: ElementSelector = { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-B' }
      expect(resolveSelector(sel, state)).toBe(r1.circle.id)
    })

    it('distinguishes circles with different centers', () => {
      let state = givenState()
      const r1 = addCircle(state, 'pt-A', 'pt-B')
      state = r1.state
      const r2 = addCircle(state, 'pt-B', 'pt-A')
      state = r2.state

      const selB: ElementSelector = { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-A' }
      expect(resolveSelector(selB, state)).toBe(r2.circle.id)
    })

    it('returns null when no matching circle exists', () => {
      const state = givenState()
      const sel: ElementSelector = { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-C' }
      expect(resolveSelector(sel, state)).toBeNull()
    })

    it('does not match a circle with swapped center/radius', () => {
      let state = givenState()
      const r1 = addCircle(state, 'pt-A', 'pt-B')
      state = r1.state

      // centerId and radiusPointId are not interchangeable
      const sel: ElementSelector = { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-A' }
      expect(resolveSelector(sel, state)).toBeNull()
    })
  })

  describe('segment selectors', () => {
    it('resolves a segment by its endpoints', () => {
      let state = givenState()
      const r1 = addSegment(state, 'pt-A', 'pt-B')
      state = r1.state

      const sel: ElementSelector = { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' }
      expect(resolveSelector(sel, state)).toBe(r1.segment.id)
    })

    it('resolves regardless of endpoint order', () => {
      let state = givenState()
      const r1 = addSegment(state, 'pt-A', 'pt-B')
      state = r1.state

      const sel: ElementSelector = { kind: 'segment', fromId: 'pt-B', toId: 'pt-A' }
      expect(resolveSelector(sel, state)).toBe(r1.segment.id)
    })

    it('distinguishes segments with different endpoints', () => {
      let state = givenState()
      const r1 = addSegment(state, 'pt-A', 'pt-B')
      state = r1.state
      const r2 = addSegment(state, 'pt-A', 'pt-C')
      state = r2.state

      const selAC: ElementSelector = { kind: 'segment', fromId: 'pt-A', toId: 'pt-C' }
      expect(resolveSelector(selAC, state)).toBe(r2.segment.id)
    })

    it('returns null when no matching segment exists', () => {
      const state = givenState()
      const sel: ElementSelector = { kind: 'segment', fromId: 'pt-B', toId: 'pt-C' }
      expect(resolveSelector(sel, state)).toBeNull()
    })
  })

  describe('ID stability across creation order', () => {
    it('selectors resolve correctly regardless of how many elements were created before', () => {
      let state = givenState()

      // Create several elements in different orders
      const c1 = addCircle(state, 'pt-A', 'pt-B')
      state = c1.state
      const s1 = addSegment(state, 'pt-A', 'pt-C')
      state = s1.state
      const c2 = addCircle(state, 'pt-B', 'pt-C')
      state = c2.state
      const s2 = addSegment(state, 'pt-B', 'pt-C')
      state = s2.state

      // Selectors find the right element by definition, not by index
      expect(resolveSelector(
        { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-C' },
        state,
      )).toBe(c2.circle.id)

      expect(resolveSelector(
        { kind: 'segment', fromId: 'pt-B', toId: 'pt-C' },
        state,
      )).toBe(s2.segment.id)
    })
  })
})
