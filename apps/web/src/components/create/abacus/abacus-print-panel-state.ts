// Abacus Studio — the print panel's top-level state decision (Gitea #9, #19).
//
// The panel body shows exactly ONE of a handful of states, chosen from the live
// roster signals. That choice used to be a chain of ternaries inline in the JSX,
// which made the five no-AMS / external-spool states (#19) impossible to unit-test
// without mounting the whole heavy component (React Query, the print-dialog UI, the
// doorbell ring). Factoring the decision into this pure function makes the state
// machine the testable seam: framework-free, no React, no service — just signals in,
// a discriminated state out. The JSX switches on `kind` and owns only the wording.
//
// The ORDER here is load-bearing and mirrors the panel's historical branch order:
//   unavailable → loading → (source!=='thh-ams' ⇒ a degrade sub-state) → printable.
// Within the degrade block the priority is most-specific-first — `externalUnprintable`
// BEFORE `rosterEmpty`, because a loaded-but-unidentified external spool (#19 state E)
// leaves a row in the roster (so `rosterEmpty` is false) yet something IS physically
// loaded; checking emptiness first would falsely say "nothing loaded".

import type { PrintUnavailableReason } from '@/lib/abacus/print/filament-wire'
import type { FilamentCatalog } from './abacus-catalog'

export interface AbacusPrintPanelStateInput {
  /** A print-service failure the panel surfaces with remediation, or null. */
  unavailable: PrintUnavailableReason | null
  /** The first printer+filament read is still in flight. */
  isLoading: boolean
  /** The catalog the panel renders — its `source` and `spools` decide printability. */
  catalog: FilamentCatalog
  /** Service fine, printer found, but the roster read resolved to zero rows. */
  rosterEmpty: boolean
  /** A spool is loaded on the external holder but its material is unresolved
   *  (`external:true`, `family:null`) — the catalog dropped it, so it isn't settable. */
  externalUnprintable: boolean
  /** Live AMS presence (#382): true/false when reported, `undefined` pre-#382. */
  amsPresent: boolean | undefined
  /** Static model AMS capability — the back-compat fallback when `amsPresent` is absent. */
  printerMultiMaterial: boolean
}

/**
 * Which panel state to render. `printable` carries whether it's the single
 * external-spool case, so the JSX can attach the non-blocking monochrome note (#19
 * state D) without recomputing it. The four degrade `kind`s double as the panel's
 * `data-degrade` attribute values.
 */
export type AbacusPrintPanelState =
  | { kind: 'unavailable' }
  | { kind: 'loading' }
  | { kind: 'external-unprintable' } // E — loaded, but material unidentified
  | { kind: 'roster-unavailable' } // defensive — read didn't resolve to a count
  | { kind: 'ams-empty' } // C(AMS) — an AMS with nothing loaded
  | { kind: 'no-ams-empty' } // C(no-AMS) — no AMS and the external holder is empty
  | { kind: 'printable'; monochromeExternal: boolean } // D when monochromeExternal

export function abacusPrintPanelState(input: AbacusPrintPanelStateInput): AbacusPrintPanelState {
  const {
    unavailable,
    isLoading,
    catalog,
    rosterEmpty,
    externalUnprintable,
    amsPresent,
    printerMultiMaterial,
  } = input

  if (unavailable !== null) return { kind: 'unavailable' }
  if (isLoading) return { kind: 'loading' }

  if (catalog.source !== 'thh-ams') {
    // priority chain, most-specific first (see the file header for why E precedes C)
    if (externalUnprintable) return { kind: 'external-unprintable' }
    if (!rosterEmpty) return { kind: 'roster-unavailable' }
    // prefer the live AMS flag; fall back to the static capability only when it's
    // absent (?? not ||) so a live `false` is honored, never masked by has_ams.
    const hasAms = amsPresent ?? printerMultiMaterial
    return { kind: hasAms ? 'ams-empty' : 'no-ams-empty' }
  }

  // A single external spool is the one printable no-AMS case: a one-nozzle printer
  // collapses a multi-color design onto its single loaded filament — submittable,
  // but the collapse must be surfaced (the monochrome note), never silent.
  const monochromeExternal = catalog.spools.length === 1 && catalog.spools[0]?.external === true
  return { kind: 'printable', monochromeExternal }
}
