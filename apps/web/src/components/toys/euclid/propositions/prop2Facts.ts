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
): { store: FactStore; newFacts: EqualityFact[] } {
  const allNewFacts: EqualityFact[] = []
  let currentStore = store

  const dpAF = distancePair('pt-A', 'pt-F')
  const dpBE = distancePair('pt-B', 'pt-E')
  const dpBC = distancePair('pt-B', 'pt-C')
  const dpDF = distancePair('pt-D', 'pt-F')
  const dpDA = distancePair('pt-D', 'pt-A')
  const dpDE = distancePair('pt-D', 'pt-E')

  // Step 1: C.N.3 — AF = BE
  // DF - DA = DE - DB, and DA = DB, so AF = BE
  {
    const result = addFact(
      currentStore,
      dpAF,
      dpBE,
      { type: 'cn3', whole: dpDF, part: dpDA },
      'AF = BE',
      'C.N.3: DF − DA = DE − DB (since DA = DB)',
      atStep,
    )
    currentStore = result.store
    allNewFacts.push(...result.newFacts)
  }

  // Step 2: C.N.1 transitivity — AF = BC
  // Already handled by union-find if BE = BC is in the store.
  // But let's make it explicit for the proof transcript.
  if (queryEquality(currentStore, dpAF, dpBC)) {
    // Already derived via transitivity — good
  } else {
    // Explicitly add it
    const result = addFact(
      currentStore,
      dpAF,
      dpBC,
      { type: 'cn1', via: dpBE },
      'AF = BC',
      'C.N.1: AF = BE and BE = BC',
      atStep,
    )
    currentStore = result.store
    allNewFacts.push(...result.newFacts)
  }

  // Also add the explicit DE - DB = BE subtraction fact if not already present
  // This helps the proof transcript tell the full story

  return { store: currentStore, newFacts: allNewFacts }
}

/** Registry of per-proposition conclusion derivation functions */
export const PROP_CONCLUSIONS: Record<
  number,
  (store: FactStore, state: ConstructionState, atStep: number) => { store: FactStore; newFacts: EqualityFact[] }
> = {
  2: deriveProp2Conclusion,
}
