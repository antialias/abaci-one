import type { ConstructionState } from '../types'
import type { FactStore } from '../engine/factStore'
import type { EqualityFact } from '../engine/facts'
import { distancePair } from '../engine/facts'
import { addFact, queryEquality } from '../engine/factStore'

/**
 * Derive I.2 conclusion: AF = BC via C.N.3 + C.N.1
 *
 * Known from fact store at this point:
 * - DA = AB [Def.15, from I.1 macro]
 * - DB = AB [Def.15, from I.1 macro]
 * - DA = DB [C.N.1, auto-derived]
 * - BE = BC [Def.15, from step 4]
 * - DF = DE [Def.15, from step 6]
 *
 * Derivation:
 * 1. C.N.3: DF - DA = DE - DB (since DA = DB)
 *    → AF = BE  (because F is on DA produced, E is on DB produced)
 * 2. C.N.1: AF = BE and BE = BC → AF = BC
 */
export function deriveProp2Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number,
): EqualityFact[] {
  const allNewFacts: EqualityFact[] = []

  const dpAF = distancePair('pt-A', 'pt-F')
  const dpBE = distancePair('pt-B', 'pt-E')
  const dpBC = distancePair('pt-B', 'pt-C')
  const dpDF = distancePair('pt-D', 'pt-F')
  const dpDA = distancePair('pt-D', 'pt-A')

  // Step 1: C.N.3 — AF = BE
  // DF - DA = DE - DB, and DA = DB, so AF = BE
  allNewFacts.push(...addFact(
    store,
    dpAF,
    dpBE,
    { type: 'cn3', whole: dpDF, part: dpDA },
    'AF = BE',
    'C.N.3: DF − DA = DE − DB (since DA = DB)',
    atStep,
  ))

  // Step 2: C.N.1 transitivity — AF = BC
  // Already handled by union-find if BE = BC is in the store.
  // But let's make it explicit for the proof transcript.
  if (!queryEquality(store, dpAF, dpBC)) {
    allNewFacts.push(...addFact(
      store,
      dpAF,
      dpBC,
      { type: 'cn1', via: dpBE },
      'AF = BC',
      'C.N.1: AF = BE and BE = BC',
      atStep,
    ))
  }

  return allNewFacts
}

/**
 * Derive I.4 conclusion: BC = EF via C.N.4 (superposition)
 *
 * Known from given facts:
 * - AB = DE [Given]
 * - AC = DF [Given]
 * - ∠BAC = ∠EDF [Given — declared on the PropositionDef]
 *
 * Derivation:
 * Since two sides and the included angle are equal, the triangles
 * coincide by superposition (C.N.4), so BC = EF.
 */
export function deriveProp4Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number,
): EqualityFact[] {
  const dpBC = distancePair('pt-B', 'pt-C')
  const dpEF = distancePair('pt-E', 'pt-F')

  return addFact(
    store,
    dpBC,
    dpEF,
    { type: 'cn4' },
    'BC = EF',
    'C.N.4: Since AB = DE, AC = DF, and ∠BAC = ∠EDF, triangles coincide by superposition',
    atStep,
  )
}

/** Registry of per-proposition conclusion derivation functions.
 *  Each function mutates the store in place and returns newly derived facts. */
export const PROP_CONCLUSIONS: Record<
  number,
  (store: FactStore, state: ConstructionState, atStep: number) => EqualityFact[]
> = {
  2: deriveProp2Conclusion,
  4: deriveProp4Conclusion,
}
