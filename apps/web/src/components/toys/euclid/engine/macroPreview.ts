/**
 * Pure preview geometry functions for macro tool.
 *
 * These compute result-focused preview geometry from raw {x,y} positions — no
 * construction state, no fact store, no side effects. The goal is to show
 * the student what the macro WILL PRODUCE, not the internal proof steps.
 */

import type { GhostElement } from '../types'
import type { Pt } from './recipe/types'
import { recipeToPreview } from './recipe/adapters'
import {
  RECIPE_PROP_1,
  RECIPE_PROP_2,
  RECIPE_PROP_3,
  RECIPE_REGISTRY,
} from './recipe/definitions/registry'

export interface MacroPreviewResult {
  /** Supporting ghost elements (construction circles that explain the result) */
  ghostElements: GhostElement[]
  /** Output geometry (result segments, points) — rendered slightly more opaque */
  resultElements: GhostElement[]
}

// ── Recipe-derived preview functions ──────────────────────────────

/** Registry mapping propId → preview function */
export const MACRO_PREVIEW_REGISTRY: Record<number, (inputs: Pt[]) => MacroPreviewResult | null> = {
  1: recipeToPreview(RECIPE_PROP_1, RECIPE_REGISTRY),
  2: recipeToPreview(RECIPE_PROP_2, RECIPE_REGISTRY),
  3: recipeToPreview(RECIPE_PROP_3, RECIPE_REGISTRY),
}
