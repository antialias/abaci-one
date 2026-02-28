import { replayConstruction } from '../engine/replayConstruction'
import type { ReplayResult } from '../engine/replayConstruction'
import { PROP_REGISTRY } from '../propositions/registry'
import type { ConstructionState } from '../types'
import type { FactStore } from '../engine/factStore'

export interface FinalStateResult {
  state: ConstructionState
  factStore: FactStore
}

/**
 * Replay a proposition's construction steps to produce the final state
 * and fact store. Uses the generic replayConstruction engine which handles
 * all step types (compass, straightedge, intersection, extend, macro).
 */
export function buildFinalState(propId: number): FinalStateResult | null {
  const prop = PROP_REGISTRY[propId]
  if (!prop || prop.steps.length === 0) return null
  const result = replayConstruction(prop.givenElements, prop.steps, prop)
  return { state: result.state, factStore: result.factStore }
}
