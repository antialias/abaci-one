import type {
  ConstructionState,
  ConstructionElement,
  IntersectionCandidate,
  GhostLayer,
} from '../types'
import type { FactStore } from './factStore'
import type { EqualityFact } from './facts'
import { recipeToMacroDef } from './recipe/adapters'
import {
  RECIPE_PROP_1,
  RECIPE_PROP_2,
  RECIPE_PROP_3,
  RECIPE_REGISTRY,
} from './recipe/definitions/registry'

/** Structured definition for a single macro input slot. */
export interface MacroInput {
  /** Semantic role — machine-readable tag for UI/chat/preview */
  role: string
  /** User-facing label shown in MacroToolPanel prompt ("Select ___") */
  label: string
  /** Maps to the source proposition's given point ID (e.g. 'pt-A') */
  givenId: string
}

export interface MacroDef {
  propId: number
  label: string
  inputs: MacroInput[]
  /**
   * Pairs of input indices that must refer to distinct points.
   * E.g. [[0,1]] means input 0 and input 1 cannot be the same point.
   * Used to reject degenerate selections (zero-length segments, etc.)
   * while still allowing legitimate repeats (I.3 shares an endpoint
   * between its two segment arguments).
   */
  distinctInputPairs: [number, number][]
  execute: (
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    atStep: number,
    extendSegments?: boolean,
    outputLabels?: Record<string, string>
  ) => MacroResult
}

/** Derive input count from structured inputs */
export function macroInputCount(def: MacroDef): number {
  return def.inputs.length
}
/** Derive legacy label array from structured inputs */
export function macroInputLabels(def: MacroDef): string[] {
  return def.inputs.map((i) => i.label)
}
/** Derive legacy givenId mapping from structured inputs */
export function macroInputGivenIds(def: MacroDef): string[] {
  return def.inputs.map((i) => i.givenId)
}

export interface MacroResult {
  state: ConstructionState
  candidates: IntersectionCandidate[]
  addedElements: ConstructionElement[]
  newFacts: EqualityFact[]
  ghostLayers: GhostLayer[]
}

// ── Recipe-derived macro definitions ──────────────────────────────

export const MACRO_REGISTRY: Record<number, MacroDef> = {
  1: recipeToMacroDef(RECIPE_PROP_1, RECIPE_REGISTRY),
  2: recipeToMacroDef(RECIPE_PROP_2, RECIPE_REGISTRY),
  3: recipeToMacroDef(RECIPE_PROP_3, RECIPE_REGISTRY),
}

/**
 * Check whether selecting `candidatePointId` as the next input (at index
 * `selectedSoFar.length`) would violate any distinctness constraint.
 */
export function wouldViolateDistinctness(
  distinctInputPairs: [number, number][],
  selectedSoFar: string[],
  candidatePointId: string
): boolean {
  const nextIndex = selectedSoFar.length
  return distinctInputPairs.some(([i, j]) => {
    if (nextIndex === j && i < nextIndex && selectedSoFar[i] === candidatePointId) return true
    if (nextIndex === i && j < nextIndex && selectedSoFar[j] === candidatePointId) return true
    return false
  })
}
