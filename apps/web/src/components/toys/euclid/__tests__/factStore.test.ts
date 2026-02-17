import { describe, it, expect } from 'vitest'
import {
  createFactStore,
  addFact,
  queryEquality,
  getEqualDistances,
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
