import { describe, it, expect } from 'vitest'
import {
  createFactStore,
  addFact,
  queryEquality,
  getEqualDistances,
  rebuildFactStore,
} from '../engine/factStore'
import { distancePair, distancePairKey } from '../engine/facts'
import type { FactStore } from '../engine/factStore'

describe('factStore', () => {
  describe('createFactStore', () => {
    it('creates a store with empty facts and nextId 1', () => {
      const store = createFactStore()
      expect(store.facts).toEqual([])
      expect(store.nextId).toBe(1)
    })

    it('creates independent stores', () => {
      const store1 = createFactStore()
      const store2 = createFactStore()
      addFact(store1, distancePair('pt-A', 'pt-B'), distancePair('pt-C', 'pt-D'),
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      expect(store1.facts).toHaveLength(1)
      expect(store2.facts).toHaveLength(0)
    })
  })

  describe('addFact', () => {
    it('adds a fact and returns it', () => {
      const store = createFactStore()
      const left = distancePair('pt-A', 'pt-B')
      const right = distancePair('pt-C', 'pt-D')
      const newFacts = addFact(store, left, right,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test justification', 0)

      expect(newFacts).toHaveLength(1)
      expect(newFacts[0].statement).toBe('AB = CD')
      expect(newFacts[0].justification).toBe('test justification')
      expect(newFacts[0].id).toBe(1)
      expect(newFacts[0].atStep).toBe(0)
    })

    it('mutates the store in place', () => {
      const store = createFactStore()
      const factsBefore = store.facts
      addFact(store, distancePair('pt-A', 'pt-B'), distancePair('pt-C', 'pt-D'),
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)

      // Same array reference — mutated in place
      expect(store.facts).toBe(factsBefore)
      expect(store.facts).toHaveLength(1)
      expect(store.nextId).toBe(2)
    })

    it('increments fact IDs', () => {
      const store = createFactStore()
      const f1 = addFact(store, distancePair('pt-A', 'pt-B'), distancePair('pt-C', 'pt-D'),
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      const f2 = addFact(store, distancePair('pt-E', 'pt-F'), distancePair('pt-G', 'pt-H'),
        { type: 'def15', circleId: 'cir-2' }, 'EF = GH', 'test', 1)

      expect(f1[0].id).toBe(1)
      expect(f2[0].id).toBe(2)
      expect(store.nextId).toBe(3)
    })

    it('rejects duplicate facts (same equality already established)', () => {
      const store = createFactStore()
      const left = distancePair('pt-A', 'pt-B')
      const right = distancePair('pt-C', 'pt-D')

      const first = addFact(store, left, right,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      expect(first).toHaveLength(1)

      // Same fact again — should be rejected
      const second = addFact(store, left, right,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      expect(second).toHaveLength(0)
      expect(store.facts).toHaveLength(1)
    })

    it('rejects transitively known equalities', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      // AB = CD
      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      // CD = EF
      addFact(store, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      // AB = EF is already known via transitivity — should be rejected
      const redundant = addFact(store, dpAB, dpEF,
        { type: 'cn1', via: dpCD }, 'AB = EF', 'test', 2)
      expect(redundant).toHaveLength(0)
    })
  })

  describe('queryEquality', () => {
    it('returns true for identical distance pairs', () => {
      const store = createFactStore()
      const dp = distancePair('pt-A', 'pt-B')
      expect(queryEquality(store, dp, dp)).toBe(true)
    })

    it('returns true for directly established equality', () => {
      const store = createFactStore()
      const left = distancePair('pt-A', 'pt-B')
      const right = distancePair('pt-C', 'pt-D')
      addFact(store, left, right,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)

      expect(queryEquality(store, left, right)).toBe(true)
      // Symmetric
      expect(queryEquality(store, right, left)).toBe(true)
    })

    it('returns true for transitively known equality (A=B, B=C → A=C)', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(store, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      expect(queryEquality(store, dpAB, dpEF)).toBe(true)
    })

    it('returns false for unrelated pairs', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)

      expect(queryEquality(store, dpAB, dpEF)).toBe(false)
    })

    it('returns false for pairs never registered in the store', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')

      expect(queryEquality(store, dpAB, dpCD)).toBe(false)
    })

    it('returns false when only one side is registered', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)

      // EF was never registered
      expect(queryEquality(store, dpAB, dpEF)).toBe(false)
    })
  })

  describe('getEqualDistances', () => {
    it('returns just the input for an unknown pair', () => {
      const store = createFactStore()
      const dp = distancePair('pt-A', 'pt-B')
      const result = getEqualDistances(store, dp)
      expect(result).toHaveLength(1)
      expect(result[0].a).toBe(dp.a)
      expect(result[0].b).toBe(dp.b)
    })

    it('returns the full equivalence class', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(store, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      const eqClass = getEqualDistances(store, dpAB)
      const keys = new Set(eqClass.map(distancePairKey))

      expect(keys.size).toBe(3)
      expect(keys.has(distancePairKey(dpAB))).toBe(true)
      expect(keys.has(distancePairKey(dpCD))).toBe(true)
      expect(keys.has(distancePairKey(dpEF))).toBe(true)
    })

    it('returns same class regardless of which member is queried', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(store, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      const fromAB = new Set(getEqualDistances(store, dpAB).map(distancePairKey))
      const fromEF = new Set(getEqualDistances(store, dpEF).map(distancePairKey))

      expect(fromAB).toEqual(fromEF)
    })

    it('keeps separate equivalence classes separate', () => {
      const store = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')
      const dpGH = distancePair('pt-G', 'pt-H')

      // Class 1: AB = CD
      addFact(store, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      // Class 2: EF = GH
      addFact(store, dpEF, dpGH,
        { type: 'def15', circleId: 'cir-2' }, 'EF = GH', 'test', 1)

      const class1 = getEqualDistances(store, dpAB)
      const class2 = getEqualDistances(store, dpEF)

      expect(class1).toHaveLength(2)
      expect(class2).toHaveLength(2)

      const keys1 = new Set(class1.map(distancePairKey))
      expect(keys1.has(distancePairKey(dpEF))).toBe(false)
    })
  })

  describe('rebuildFactStore', () => {
    it('rebuilds union-find correctly (transitive equality preserved)', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(original, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(original, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      const rebuilt = rebuildFactStore(original.facts)

      // Transitive equality should be preserved
      expect(queryEquality(rebuilt, dpAB, dpEF)).toBe(true)
      expect(rebuilt.facts).toHaveLength(2)
      expect(rebuilt.nextId).toBe(3)
    })

    it('handles empty facts array', () => {
      const rebuilt = rebuildFactStore([])
      expect(rebuilt.facts).toEqual([])
      expect(rebuilt.nextId).toBe(1)
    })

    it('rejects unknown equalities after rebuild', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(original, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)

      const rebuilt = rebuildFactStore(original.facts)
      expect(queryEquality(rebuilt, dpAB, dpEF)).toBe(false)
    })

    it('rebuilt store is independent from original', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')

      addFact(original, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)

      const rebuilt = rebuildFactStore(original.facts)

      // Adding to original shouldn't affect rebuilt
      const dpEF = distancePair('pt-E', 'pt-F')
      addFact(original, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      expect(queryEquality(original, dpAB, dpEF)).toBe(true)
      expect(queryEquality(rebuilt, dpAB, dpEF)).toBe(false)
    })

    it('preserves fact atStep values', () => {
      const original = createFactStore()
      addFact(original, distancePair('pt-A', 'pt-B'), distancePair('pt-C', 'pt-D'),
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(original, distancePair('pt-E', 'pt-F'), distancePair('pt-G', 'pt-H'),
        { type: 'def15', circleId: 'cir-2' }, 'EF = GH', 'test', 3)

      const rebuilt = rebuildFactStore(original.facts)
      expect(rebuilt.facts[0].atStep).toBe(0)
      expect(rebuilt.facts[1].atStep).toBe(3)
    })

    it('preserves fact ordering', () => {
      const original = createFactStore()
      addFact(original, distancePair('pt-A', 'pt-B'), distancePair('pt-C', 'pt-D'),
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'j1', 0)
      addFact(original, distancePair('pt-E', 'pt-F'), distancePair('pt-G', 'pt-H'),
        { type: 'def15', circleId: 'cir-2' }, 'EF = GH', 'j2', 1)
      addFact(original, distancePair('pt-C', 'pt-D'), distancePair('pt-E', 'pt-F'),
        { type: 'def15', circleId: 'cir-3' }, 'CD = EF', 'j3', 2)

      const rebuilt = rebuildFactStore(original.facts)
      expect(rebuilt.facts.map(f => f.statement)).toEqual([
        'AB = CD', 'EF = GH', 'CD = EF',
      ])
    })

    it('handles different citation types', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(original, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(original, dpCD, dpEF,
        { type: 'prop', propId: 1 }, 'CD = EF', 'test', 1)

      const rebuilt = rebuildFactStore(original.facts)
      expect(rebuilt.facts[0].citation).toEqual({ type: 'def15', circleId: 'cir-1' })
      expect(rebuilt.facts[1].citation).toEqual({ type: 'prop', propId: 1 })
      expect(queryEquality(rebuilt, dpAB, dpEF)).toBe(true)
    })

    it('rebuilds long transitive chains (A=B=C=D=E)', () => {
      const original = createFactStore()
      const dps = ['A', 'B', 'C', 'D', 'E'].map((l, i) =>
        distancePair(`pt-${l}1`, `pt-${l}2`),
      )
      for (let i = 0; i < dps.length - 1; i++) {
        addFact(original, dps[i], dps[i + 1],
          { type: 'def15', circleId: `cir-${i}` }, `s${i}`, `j${i}`, i)
      }

      const rebuilt = rebuildFactStore(original.facts)

      // First and last should be transitively equal
      expect(queryEquality(rebuilt, dps[0], dps[4])).toBe(true)
      // Non-adjacent pairs should also be equal
      expect(queryEquality(rebuilt, dps[1], dps[3])).toBe(true)
    })

    it('keeps separate equivalence classes separate after rebuild', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')
      const dpGH = distancePair('pt-G', 'pt-H')

      // Class 1: AB = CD
      addFact(original, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      // Class 2: EF = GH (separate)
      addFact(original, dpEF, dpGH,
        { type: 'def15', circleId: 'cir-2' }, 'EF = GH', 'test', 1)

      const rebuilt = rebuildFactStore(original.facts)
      expect(queryEquality(rebuilt, dpAB, dpCD)).toBe(true)
      expect(queryEquality(rebuilt, dpEF, dpGH)).toBe(true)
      expect(queryEquality(rebuilt, dpAB, dpEF)).toBe(false)
      expect(queryEquality(rebuilt, dpCD, dpGH)).toBe(false)
    })

    it('rebuilds from a subset of facts (simulating rewind)', () => {
      const original = createFactStore()
      const dpAB = distancePair('pt-A', 'pt-B')
      const dpCD = distancePair('pt-C', 'pt-D')
      const dpEF = distancePair('pt-E', 'pt-F')

      addFact(original, dpAB, dpCD,
        { type: 'def15', circleId: 'cir-1' }, 'AB = CD', 'test', 0)
      addFact(original, dpCD, dpEF,
        { type: 'def15', circleId: 'cir-2' }, 'CD = EF', 'test', 1)

      // Rebuild from only the first fact (simulating rewind to step 1)
      const rebuilt = rebuildFactStore(original.facts.slice(0, 1))
      expect(queryEquality(rebuilt, dpAB, dpCD)).toBe(true)
      expect(queryEquality(rebuilt, dpAB, dpEF)).toBe(false)
      expect(rebuilt.facts).toHaveLength(1)
    })
  })

  describe('WeakMap encapsulation', () => {
    it('FactStore interface has no _uf field', () => {
      const store = createFactStore()
      expect('_uf' in store).toBe(false)
    })

    it('store works correctly after multiple operations', () => {
      const store = createFactStore()

      // Chain: AB = CD = EF = GH
      addFact(store, distancePair('pt-A', 'pt-B'), distancePair('pt-C', 'pt-D'),
        { type: 'def15', circleId: 'c1' }, 's1', 'j1', 0)
      addFact(store, distancePair('pt-C', 'pt-D'), distancePair('pt-E', 'pt-F'),
        { type: 'def15', circleId: 'c2' }, 's2', 'j2', 1)
      addFact(store, distancePair('pt-E', 'pt-F'), distancePair('pt-G', 'pt-H'),
        { type: 'def15', circleId: 'c3' }, 's3', 'j3', 2)

      // All should be transitively equal
      expect(queryEquality(store,
        distancePair('pt-A', 'pt-B'),
        distancePair('pt-G', 'pt-H'),
      )).toBe(true)

      expect(store.facts).toHaveLength(3)
    })
  })
})
