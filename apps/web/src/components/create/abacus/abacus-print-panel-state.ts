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

import type { TicketStyle } from '@eink/print-dialog'
import type { PrintUnavailableReason } from '@/lib/abacus/print/filament-wire'
import type { FilamentCatalog } from './abacus-catalog'
import type { FilamentMap, Params } from './abacus-model'

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

/**
 * The slot ids the DESIGN itself prints in — every role the filament map assigns.
 *
 * The support-interface pick has to avoid these. THH derives
 * `support_interface_filament` from the role entry's POSITION in `filaments`, and
 * that entry must come last while the model entries stay in body order, so a pick
 * coinciding with a model slot can't be appended without either duplicating the
 * slot or breaking extruder→spool alignment. `buildAbacusTicket` therefore drops
 * such a pick — which is right, but it means offering one in the editor would have
 * the UI claim an interface material the print never uses. Filtering the roster
 * keeps the editor honest instead: the row simply isn't there, and the pick falls
 * back to the "Model material" default that describes what would happen anyway.
 */
export function designSlotIds(
  map: Pick<FilamentMap, 'frame' | 'markerWhite' | 'markerBlack' | 'beadRoles' | 'feet'>,
  spools: readonly { id: string }[]
): Set<string> {
  const ids = new Set<string>()
  const add = (index: number | undefined) => {
    const id = index === undefined ? undefined : spools[index]?.id
    if (id !== undefined) ids.add(id)
  }
  add(map.frame)
  add(map.markerWhite)
  add(map.markerBlack)
  add(map.feet)
  map.beadRoles.forEach(add)
  return ids
}

/**
 * Whether a controlled ticket style EXPLICITLY sets a process boolean. Bambu
 * process booleans ride as '1'/'0' strings; the kit's editor may hold real
 * booleans. Absence is off — the abacus never defaults one on silently.
 */
function processTruthy(style: TicketStyle | null, key: string): boolean {
  const v = style?.process?.[key]
  return v === true || v === 1 || v === '1' || v === 'true'
}

/**
 * Whether the style explicitly turns supports on (the client owns
 * `enable_support`; THH 400s a support-role filament entry on a supports-off
 * ticket).
 */
export function supportsEnabled(style: TicketStyle | null): boolean {
  return processTruthy(style, 'enable_support')
}

/**
 * The support recipe printed feet need on the SUBMITTED print — not just on a
 * downloaded 3MF. THH slices with `--load-settings printer.json;preset.json`,
 * which OVERRIDES the 3MF's `Metadata/project_settings.config`, so a key we only
 * write into the 3MF reaches a direct download and nothing else. Anything the
 * print actually depends on has to ride the ticket style.
 *
 * Measured against THH's capability document (2026-07-29; draft, standard and
 * fine resolve identically here), only two of the five support keys the 3MF
 * writes differ from what a ticket already resolves to on its own:
 *
 *   enable_support              false in every preset. Without it the bottom
 *                               face — held `feet_proud` up by the feet — prints
 *                               in mid-air.
 *   support_on_build_plate_only false in every preset. Off, Orca may rest
 *                               supports ON the model: inside the bead channels
 *                               and on the beads, where nobody can reach them.
 *
 * The other three are deliberately NOT pinned, because the presets already agree
 * with the 3MF: `support_type` is "normal(auto)" everywhere and
 * `support_interface_top_layers` is 2 everywhere, while `support_top_z_distance`
 * is 0.2 at draft/standard and 0.12 at fine — pinning 0.2 would coarsen the fine
 * preset for no reason.
 */
export const FEET_SUPPORT_PROCESS = {
  enable_support: true,
  support_on_build_plate_only: true,
} as const

export type FeetSupportKey = keyof typeof FEET_SUPPORT_PROCESS

export interface FeetSupportGate {
  /** Recipe keys the style has yet to set, in recipe order. Empty = nothing to do. */
  missing: FeetSupportKey[]
  /** Supports are off outright, so the print would fail — submission is blocked.
   *  A missing `support_on_build_plate_only` is advice, not a blocker: the print
   *  still succeeds, it's just messier to clean up. */
  blocked: boolean
}

/**
 * The printed-feet support gate (Gitea #23): in-place TPU feet stand the whole
 * bottom face off the bed. The v2 ticket discipline means nobody injects these
 * keys silently — the panel renders a one-click that writes the missing ones
 * through the normal style-change path, visibly, into the editor.
 *
 * Mirrors the exporter/3MF gate exactly (`feet_mode === 'printed' && show_frame`):
 * a frameless render has no feet body and needs no supports.
 */
export function feetSupportGate(
  params: Pick<Params, 'feet_mode' | 'show_frame'>,
  style: TicketStyle | null
): FeetSupportGate {
  if (params.feet_mode !== 'printed' || !params.show_frame) return { missing: [], blocked: false }
  const missing = (Object.keys(FEET_SUPPORT_PROCESS) as FeetSupportKey[]).filter(
    (key) => !processTruthy(style, key)
  )
  return { missing, blocked: missing.includes('enable_support') }
}
