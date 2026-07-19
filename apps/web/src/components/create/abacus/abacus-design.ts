// Abacus Studio — the serializable design boundary (Gitea epic #5, Phase 1 #7).
//
// SPEC: apps/web/docs/abacus-studio/master-model-spec.md, and #7 §5 "Domain
// model". `AbacusDesign` is the pure, framework-free analog of eink's `Assembly`:
// the size intent + column count + selected printer profile + the "my abacus"
// style projection, in one JSON-serializable object that Phase 2 consumes.
//
// The style projection is COMPUTED, not authored: bead colors come from the one
// canonical resolver (`beadColorActive`) that the on-screen abacus uses, so the
// printed object matches what the user configured. `resolvedColors` carries each
// bead's INTRINSIC color for its (placeValue, type) — never AMS-quantized; the
// screen→spool reduction is a later phase (#10). No React, no three, no geometry.

import { beadColorActive } from '@soroban/abacus-react/color'
import type { Params } from './abacus-model'

export const ABACUS_DESIGN_SCHEMA_VERSION = 1

// One entry per column, keyed by place value (0 = ones place). Lossless: under
// every color scheme the resolver supports, a column's heaven beads all share one
// color and its earth beads all share one, so (placeValue → {heaven, earth}) is
// the complete per-bead color truth without per-bead duplication.
export type ResolvedColors = {
  frame: string
  columns: Array<{ placeValue: number; heaven: string; earth: string }>
}

export type AbacusDesign = {
  schemaVersion: number
  params: Params
  profileId: string
  resolvedColors: ResolvedColors
  // Reserved, opaque slot for the deferred bead-shape morph (v1 leaves it unset
  // so #7's handoff doesn't corner Phase 2).
  styleOverlay?: unknown
}

// Project the printable params + selected profile into a serializable design,
// baking intrinsic bead colors from the canonical resolver. Pure and
// deterministic — `params` already carries cols/scheme/palette/frame_color.
export function toAbacusDesign(params: Params, profileId: string): AbacusDesign {
  const columns = Array.from({ length: params.cols }, (_, placeValue) => ({
    placeValue,
    heaven: beadColorActive({ placeValue, type: 'heaven' }, params.color_scheme, params.color_palette),
    earth: beadColorActive({ placeValue, type: 'earth' }, params.color_scheme, params.color_palette),
  }))
  return {
    schemaVersion: ABACUS_DESIGN_SCHEMA_VERSION,
    params,
    profileId,
    resolvedColors: { frame: params.frame_color, columns },
  }
}

// The reverse of the physicalAbacusColumns bridge: the design's column count is
// the user's physical column count. Read-only — write-back to abacus_settings is
// out of scope for #7 (the projection never mutates the persisted config).
export const physicalColumnsOf = (design: AbacusDesign): number => design.params.cols
