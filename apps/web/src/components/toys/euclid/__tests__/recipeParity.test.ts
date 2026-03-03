/**
 * Parity tests: verify that recipe-derived MacroDefs produce identical results
 * to the handwritten implementations.
 */
import { describe, it, expect } from 'vitest'
import { MACRO_REGISTRY } from '../engine/macros'
import { recipeToMacroDef } from '../engine/recipe/adapters'
import { RECIPE_REGISTRY } from '../engine/recipe/definitions/registry'
import { deriveSteps } from '../engine/recipe/deriveSteps'
import {
  RECIPE_PROP_1,
  PROP_1_ANNOTATIONS,
  RECIPE_PROP_2,
  PROP_2_ANNOTATIONS,
  RECIPE_PROP_3,
  PROP_3_ANNOTATIONS,
} from '../engine/recipe/definitions/registry'
import { initializeGiven, getPoint } from '../engine/constructionState'
import { createFactStore, queryEquality } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import type { ConstructionElement, ConstructionState } from '../types'
import { BYRNE } from '../types'
import { PROP_1 } from '../propositions/prop1'
import { PROP_2 } from '../propositions/prop2'
import { PROP_3 } from '../propositions/prop3'

// ── Test helpers ──

function givenAB(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: -2, y: 0, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 2, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
  ]
  return initializeGiven(given)
}

function givenABC(): ConstructionState {
  const given: ConstructionElement[] = [
    { kind: 'point', id: 'pt-A', x: -1.5, y: 1.5, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: 0, y: 0, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: 1.5, y: 0, label: 'C', color: BYRNE.given, origin: 'given' },
  ]
  return initializeGiven(given)
}

function givenABCD(): ConstructionState {
  return initializeGiven(PROP_3.givenElements)
}

// ── I.1 parity ──

describe('Recipe parity: I.1 (Equilateral triangle)', () => {
  const oldMacro = MACRO_REGISTRY[1]
  const newMacro = recipeToMacroDef(RECIPE_PROP_1, RECIPE_REGISTRY)

  it('produces apex point at same position', () => {
    const stateOld = givenAB()
    const stateNew = givenAB()
    const fsOld = createFactStore()
    const fsNew = createFactStore()

    const oldResult = oldMacro.execute(stateOld, ['pt-A', 'pt-B'], [], fsOld, 0, false, {
      apex: 'C',
    })
    const newResult = newMacro.execute(stateNew, ['pt-A', 'pt-B'], [], fsNew, 0, false, {
      apex: 'C',
    })

    const oldApex = getPoint(oldResult.state, 'pt-C')!
    const newApex = getPoint(newResult.state, 'pt-C')!
    expect(newApex.x).toBeCloseTo(oldApex.x, 8)
    expect(newApex.y).toBeCloseTo(oldApex.y, 8)
  })

  it('produces same number of added elements', () => {
    const stateOld = givenAB()
    const stateNew = givenAB()
    const fsOld = createFactStore()
    const fsNew = createFactStore()

    const oldResult = oldMacro.execute(stateOld, ['pt-A', 'pt-B'], [], fsOld, 0, false, {
      apex: 'C',
    })
    const newResult = newMacro.execute(stateNew, ['pt-A', 'pt-B'], [], fsNew, 0, false, {
      apex: 'C',
    })

    expect(newResult.addedElements.length).toBe(oldResult.addedElements.length)
  })

  it('produces same number of facts', () => {
    const stateOld = givenAB()
    const stateNew = givenAB()
    const fsOld = createFactStore()
    const fsNew = createFactStore()

    const oldResult = oldMacro.execute(stateOld, ['pt-A', 'pt-B'], [], fsOld, 0, false, {
      apex: 'C',
    })
    const newResult = newMacro.execute(stateNew, ['pt-A', 'pt-B'], [], fsNew, 0, false, {
      apex: 'C',
    })

    expect(newResult.newFacts.length).toBe(oldResult.newFacts.length)
  })

  it('has ghost layers', () => {
    const state = givenAB()
    const fs = createFactStore()
    const result = newMacro.execute(state, ['pt-A', 'pt-B'], [], fs, 0, false, { apex: 'C' })
    expect(result.ghostLayers.length).toBeGreaterThan(0)
  })

  it('has matching inputs metadata', () => {
    expect(newMacro.propId).toBe(oldMacro.propId)
    expect(newMacro.label).toBe(oldMacro.label)
    expect(newMacro.inputs.length).toBe(oldMacro.inputs.length)
    expect(newMacro.distinctInputPairs).toEqual(oldMacro.distinctInputPairs)
  })
})

// ── I.2 parity ──

describe('Recipe parity: I.2 (Transfer distance)', () => {
  const oldMacro = MACRO_REGISTRY[2]
  const newMacro = recipeToMacroDef(RECIPE_PROP_2, RECIPE_REGISTRY)

  it('produces output point at same distance from target', () => {
    const stateOld = givenABC()
    const stateNew = givenABC()
    const fsOld = createFactStore()
    const fsNew = createFactStore()

    const oldResult = oldMacro.execute(stateOld, ['pt-B', 'pt-C', 'pt-A'], [], fsOld, 0, false, {
      result: 'E',
    })
    const newResult = newMacro.execute(stateNew, ['pt-B', 'pt-C', 'pt-A'], [], fsNew, 0, false, {
      result: 'E',
    })

    const oldPt = getPoint(oldResult.state, 'pt-E')!
    const newPt = getPoint(newResult.state, 'pt-E')!

    const ptA = getPoint(stateOld, 'pt-A')!
    const ptB = getPoint(stateOld, 'pt-B')!
    const ptC = getPoint(stateOld, 'pt-C')!

    const distBC = Math.sqrt((ptB.x - ptC.x) ** 2 + (ptB.y - ptC.y) ** 2)
    const distOld = Math.sqrt((ptA.x - oldPt.x) ** 2 + (ptA.y - oldPt.y) ** 2)
    const distNew = Math.sqrt((ptA.x - newPt.x) ** 2 + (ptA.y - newPt.y) ** 2)

    expect(distOld).toBeCloseTo(distBC, 8)
    expect(distNew).toBeCloseTo(distBC, 8)
    expect(distNew).toBeCloseTo(distOld, 8)
  })

  it('produces output at same position', () => {
    const stateOld = givenABC()
    const stateNew = givenABC()
    const fsOld = createFactStore()
    const fsNew = createFactStore()

    const oldResult = oldMacro.execute(stateOld, ['pt-B', 'pt-C', 'pt-A'], [], fsOld, 0, false, {
      result: 'E',
    })
    const newResult = newMacro.execute(stateNew, ['pt-B', 'pt-C', 'pt-A'], [], fsNew, 0, false, {
      result: 'E',
    })

    const oldPt = getPoint(oldResult.state, 'pt-E')!
    const newPt = getPoint(newResult.state, 'pt-E')!

    expect(newPt.x).toBeCloseTo(oldPt.x, 8)
    expect(newPt.y).toBeCloseTo(oldPt.y, 8)
  })

  it('produces correct equality fact', () => {
    const state = givenABC()
    const fs = createFactStore()
    const result = newMacro.execute(state, ['pt-B', 'pt-C', 'pt-A'], [], fs, 0, false, {
      result: 'E',
    })

    expect(result.newFacts.length).toBeGreaterThanOrEqual(1)
    expect(queryEquality(fs, distancePair('pt-A', 'pt-E'), distancePair('pt-B', 'pt-C'))).toBe(true)
  })

  it('has matching inputs metadata', () => {
    expect(newMacro.propId).toBe(oldMacro.propId)
    expect(newMacro.label).toBe(oldMacro.label)
    expect(newMacro.inputs.length).toBe(oldMacro.inputs.length)
    expect(newMacro.distinctInputPairs).toEqual(oldMacro.distinctInputPairs)
  })
})

// ── I.3 parity ──

describe('Recipe parity: I.3 (Cut off equal)', () => {
  const oldMacro = MACRO_REGISTRY[3]
  const newMacro = recipeToMacroDef(RECIPE_PROP_3, RECIPE_REGISTRY)

  it('produces result point at same distance from cut point', () => {
    const stateOld = givenABCD()
    const stateNew = givenABCD()
    const fsOld = createFactStore()
    const fsNew = createFactStore()

    const inputs = ['pt-A', 'pt-B', 'pt-C', 'pt-D']
    const oldResult = oldMacro.execute(stateOld, inputs, [], fsOld, 0, false, { result: 'E' })
    const newResult = newMacro.execute(stateNew, inputs, [], fsNew, 0, false, { result: 'E' })

    const ptA = getPoint(stateOld, 'pt-A')!
    const ptC = getPoint(stateOld, 'pt-C')!
    const ptD = getPoint(stateOld, 'pt-D')!
    const distCD = Math.sqrt((ptC.x - ptD.x) ** 2 + (ptC.y - ptD.y) ** 2)

    const oldPt = getPoint(oldResult.state, 'pt-E')!
    const newPt = getPoint(newResult.state, 'pt-E')!

    const distOld = Math.sqrt((ptA.x - oldPt.x) ** 2 + (ptA.y - oldPt.y) ** 2)
    const distNew = Math.sqrt((ptA.x - newPt.x) ** 2 + (ptA.y - newPt.y) ** 2)

    expect(distOld).toBeCloseTo(distCD, 8)
    expect(distNew).toBeCloseTo(distCD, 8)
  })

  it('produces correct equality fact', () => {
    const state = givenABCD()
    const fs = createFactStore()
    const inputs = ['pt-A', 'pt-B', 'pt-C', 'pt-D']
    const result = newMacro.execute(state, inputs, [], fs, 0, false, { result: 'E' })

    expect(result.newFacts.length).toBeGreaterThanOrEqual(1)
    expect(queryEquality(fs, distancePair('pt-A', 'pt-E'), distancePair('pt-C', 'pt-D'))).toBe(true)
  })

  it('has matching inputs metadata', () => {
    expect(newMacro.propId).toBe(oldMacro.propId)
    expect(newMacro.label).toBe(oldMacro.label)
    expect(newMacro.inputs.length).toBe(oldMacro.inputs.length)
    expect(newMacro.distinctInputPairs).toEqual(oldMacro.distinctInputPairs)
  })
})

// ── Step derivation parity ──

describe('Recipe step derivation parity', () => {
  it('I.1: derived steps match hand-authored steps', () => {
    const derived = deriveSteps(RECIPE_PROP_1, PROP_1_ANNOTATIONS)
    const original = PROP_1.steps

    expect(derived.length).toBe(original.length)
    for (let i = 0; i < derived.length; i++) {
      expect(derived[i].instruction).toBe(original[i].instruction)
      expect(derived[i].expected).toEqual(original[i].expected)
      expect(derived[i].tool).toBe(original[i].tool)
      expect(derived[i].citation).toBe(original[i].citation)
    }
  })

  it('I.2: derived steps match hand-authored steps', () => {
    const derived = deriveSteps(RECIPE_PROP_2, PROP_2_ANNOTATIONS)
    const original = PROP_2.steps

    expect(derived.length).toBe(original.length)
    for (let i = 0; i < derived.length; i++) {
      expect(derived[i].instruction).toBe(original[i].instruction)
      expect(derived[i].expected).toEqual(original[i].expected)
      expect(derived[i].tool).toBe(original[i].tool)
      expect(derived[i].citation).toBe(original[i].citation)
    }
  })

  it('I.3: derived steps match hand-authored steps', () => {
    const derived = deriveSteps(RECIPE_PROP_3, PROP_3_ANNOTATIONS)
    const original = PROP_3.steps

    expect(derived.length).toBe(original.length)
    for (let i = 0; i < derived.length; i++) {
      expect(derived[i].instruction).toBe(original[i].instruction)
      expect(derived[i].expected).toEqual(original[i].expected)
      expect(derived[i].tool).toBe(original[i].tool)
      expect(derived[i].citation).toBe(original[i].citation)
    }
  })
})
