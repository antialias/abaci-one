// Abacus Studio — the print plan (Gitea epic #5, Phase 1 #7 → quantization).
//
// This is the SECOND boundary. `AbacusDesign` (abacus-design.ts) carries each
// bead's INTRINSIC color — what the user designed, never snapped to a spool. A
// print, though, can only lay down the filaments actually loaded (the
// `FilamentCatalog`). `materialize` is the pure projection that reconciles the
// two: it quantizes the design's roles onto the catalog's spools and reports
// where that reduction loses something (marker contrast, colors that collapse
// onto one filament, a palette wider than the loaded slots).
//
// Quantize by ROLE, not by pixel. A scheme has a small set of intended color
// roles (monochrome → 1, heaven-earth / alternating → 2, place-value → one per
// palette entry); mapping the roles — not each of the up-to-21 columns —
// preserves the distinctions the user meant. The algorithm is the role-aware,
// distinct-first, marker-contrast-locked mapping graduated verbatim from the
// bench (it lived in abacus-model as `computeFilamentMap`); `computeFilamentMap`
// now re-exports it as a thin adapter over `materialize`, byte-for-byte identical
// (see __tests__/filament-map-snapshot.json).
//
// P1 scope: frame + ArUco markers + bead roles. Perimeter text roles, the
// material-family interface check, and the rainbow multi-material hard gate are
// deferred to P4 — hence every warning here is severity 'warning' and `ok` stays
// true. Framework-free (no React, no three).
//
// Compatibility rule (P4 — activates once the THH catalog carries material
// families; today's params catalog is all-PLA, so it's trivially satisfied): the
// welded same-part cluster — frame + ArUco markers + inset text — must resolve to
// ONE compatible material family. Auto-snap never crosses an incompatible material
// at those welds; when the compatible spools force a poor color match it warns
// (material-interface) rather than silently breaking the bond. BEADS ARE EXEMPT —
// captive on a print clearance gap, never welded, so they chase best color on any
// material. The viewer's manual filament-mapping panel overrides all of this.

import { catalogFromParams, type FilamentCatalog } from './abacus-catalog'
import type { AbacusDesign } from './abacus-design'
import { toAbacusDesign } from './abacus-design'
import {
  beadRoleColors,
  beadRoleNames,
  colorDist,
  contrastRatio,
  type FilamentMap,
  nearestSlot,
  type Params,
} from './abacus-model'

export const PRINT_PLAN_SCHEMA_VERSION = 1

// The camera's floor for reading the ArUco corner markers; below this the black
// and white cells stop separating reliably. Mirrors the bench's marker-contrast
// intent (WCAG ratio of the mapped marker pair).
export const MARKER_CONTRAST_MIN = 3

export type PrintRoleKind = 'frame' | 'markerBlack' | 'markerWhite' | 'bead' | 'text'

// A single printable color region, tagged with its INTRINSIC (pre-quantization)
// hex. `key` is stable across a re-materialize so overrides can pin a role.
export type PrintRole = {
  kind: PrintRoleKind
  key: string
  label: string
  intrinsicHex: string
}

// A role after quantization: which spool it landed on, how far that spool is from
// the intrinsic color (redmean units), and whether a user override pinned it.
export type RoleAssignment = {
  role: PrintRole
  spoolId: string
  spoolIndex: number
  distance: number
  overridden: boolean
}

export type PlanWarningCode =
  | 'marker-contrast'
  | 'role-collision'
  | 'budget-exceeded'
  | 'material-interface' // reserved for P4 (needs THH material families)
  | 'rainbow-unrealizable' // reserved for P4 (the only 'error' — multi-material text)

export type PlanWarning = {
  code: PlanWarningCode
  severity: 'error' | 'warning'
  message: string
  roleKeys?: string[]
}

export type PrintPlan = {
  schemaVersion: number
  catalogSource: FilamentCatalog['source']
  assignments: RoleAssignment[]
  markerContrast: number // WCAG ratio of the mapped ArUco pair (camera wants ≥3)
  warnings: PlanWarning[]
  // true iff no error-severity warning — mirrors the solver's export gate. In P1
  // nothing is an error, so this is always true; the rainbow hard gate (P4) is the
  // first thing that can flip it.
  ok: boolean
}

// roleKey → spoolId. A user pin from the viewer's filament-mapping panel; the
// empty (no-override) path is exactly the historical mapping (proven by the
// snapshot). Pins onto an unloaded spool are ignored — the role stays auto-snapped.
export type MaterializeOpts = { overrides?: Record<string, string> }

// Project a design onto a catalog. Role assignment order matches the bench's
// historical precedence EXACTLY (markers first — they're CV-critical — then
// frame, then bead roles distinct-first), so `computeFilamentMap` can adapt this
// back to the legacy `FilamentMap` shape without drift.
export function materialize(
  design: AbacusDesign,
  catalog: FilamentCatalog,
  opts: MaterializeOpts = {}
): PrintPlan {
  const spools = catalog.spools
  const hexes = spools.map((s) => s.hex)
  const overrides = opts.overrides ?? {}
  const idToIndex = new Map(spools.map((s, i) => [s.id, i] as const))

  // Build an assignment for a role at its solver-chosen slot, letting an explicit
  // override repoint it. `distance` always reflects the FINAL spool.
  const assign = (role: PrintRole, chosenIndex: number): RoleAssignment => {
    let idx = chosenIndex
    let overridden = false
    const pinned = overrides[role.key]
    if (pinned && idToIndex.has(pinned)) {
      idx = idToIndex.get(pinned) as number
      overridden = true
    }
    return {
      role,
      spoolId: spools[idx].id,
      spoolIndex: idx,
      distance: colorDist(role.intrinsicHex, hexes[idx]),
      overridden,
    }
  }

  // 1. ArUco markers — assigned first (the detector reads them): black takes the
  //    darkest-fit slot, white the lightest-fit DISTINCT slot. With one spool
  //    loaded there's no distinct white, so both collapse onto it.
  const blackIdx = nearestSlot(hexes, '#000000')
  const whiteIdx = hexes.length > 1 ? nearestSlot(hexes, '#ffffff', blackIdx) : blackIdx
  const markerBlack = assign(
    { kind: 'markerBlack', key: 'marker-black', label: 'ArUco black', intrinsicHex: '#000000' },
    blackIdx
  )
  const markerWhite = assign(
    { kind: 'markerWhite', key: 'marker-white', label: 'ArUco white', intrinsicHex: '#ffffff' },
    whiteIdx
  )

  // 2. Frame = nearest spool (no exclusion — the frame may legitimately share a
  //    filament with a marker or bead).
  const frame = assign(
    { kind: 'frame', key: 'frame', label: 'Frame', intrinsicHex: design.resolvedColors.frame },
    nearestSlot(hexes, design.resolvedColors.frame)
  )

  // 3. Bead roles — distinct-first: each role claims the nearest slot no other
  //    BEAD role has taken (markers/frame don't block beads), reusing the global
  //    nearest only once distinct slots run out.
  const roleHexes = beadRoleColors(design.params.color_scheme, design.params.color_palette)
  const roleNames = beadRoleNames(design.params.color_scheme)
  const usedByBeads = new Set<number>()
  const beadAssignments: RoleAssignment[] = roleHexes.map((intrinsicHex, r) => {
    let best = -1
    let bd = Number.POSITIVE_INFINITY
    hexes.forEach((h, idx) => {
      if (usedByBeads.has(idx)) return
      const d = colorDist(intrinsicHex, h)
      if (d < bd) {
        bd = d
        best = idx
      }
    })
    if (best < 0) best = nearestSlot(hexes, intrinsicHex) // more roles than slots → reuse
    usedByBeads.add(best)
    return assign(
      { kind: 'bead', key: `bead-${r}`, label: roleNames[r] ?? `bead ${r}`, intrinsicHex },
      best
    )
  })

  const markerContrast = contrastRatio(hexes[whiteIdx], hexes[blackIdx])
  const warnings = planWarnings(markerContrast, beadAssignments, roleHexes.length)
  const ok = !warnings.some((w) => w.severity === 'error')

  return {
    schemaVersion: PRINT_PLAN_SCHEMA_VERSION,
    catalogSource: catalog.source,
    assignments: [markerBlack, markerWhite, frame, ...beadAssignments],
    markerContrast,
    warnings,
    ok,
  }
}

// The lossy-reduction report. All warning-severity in P1 (nothing blocks export
// yet — the rainbow error lands in P4).
function planWarnings(
  markerContrast: number,
  beadAssignments: RoleAssignment[],
  roleCount: number
): PlanWarning[] {
  const warnings: PlanWarning[] = []

  if (markerContrast < MARKER_CONTRAST_MIN) {
    warnings.push({
      code: 'marker-contrast',
      severity: 'warning',
      message: `The ArUco corner markers map to filaments only ${markerContrast.toFixed(
        1
      )}:1 apart — the camera wants at least ${MARKER_CONTRAST_MIN}:1 to read them. Load a light and a dark filament.`,
      roleKeys: ['marker-black', 'marker-white'],
    })
  }

  // budget-exceeded: the palette wants more distinct colors than beads could claim.
  const distinctBeadSpools = new Set(beadAssignments.map((a) => a.spoolIndex)).size
  if (beadAssignments.length > distinctBeadSpools) {
    warnings.push({
      code: 'budget-exceeded',
      severity: 'warning',
      message: `Your color scheme uses ${roleCount} bead colors but there aren't that many distinct filaments loaded, so some beads share one.`,
      roleKeys: beadAssignments.map((a) => a.role.key),
    })
  }

  // role-collision: name exactly which bead colors collapse onto one filament (the
  // concrete, visible consequence of the budget shortfall).
  const bySpool = new Map<number, string[]>()
  for (const a of beadAssignments) {
    const arr = bySpool.get(a.spoolIndex) ?? []
    arr.push(a.role.key)
    bySpool.set(a.spoolIndex, arr)
  }
  for (const keys of bySpool.values()) {
    if (keys.length > 1) {
      warnings.push({
        code: 'role-collision',
        severity: 'warning',
        message: `${keys.length} bead colors print on the same filament and won't be tellable apart.`,
        roleKeys: keys,
      })
    }
  }

  return warnings
}

// ---- legacy adapter ---------------------------------------------------------
// Project a PrintPlan back to the historical screen-colors → AMS-slots shape
// (role → slot index). The viewer's frame/bead/marker/text passes still color
// through a FilamentMap; deriving it FROM the plan (instead of recomputing) is what
// lets a manual override flow straight into the live preview, and keeps the plan
// the single source of truth for both the warnings and the pixels.
export function planToFilamentMap(plan: PrintPlan, slots: string[]): FilamentMap {
  const pick = (kind: PrintRoleKind): number =>
    (plan.assignments.find((a) => a.role.kind === kind) as RoleAssignment).spoolIndex
  return {
    slots,
    frame: pick('frame'),
    markerWhite: pick('markerWhite'),
    markerBlack: pick('markerBlack'),
    beadRoles: plan.assignments.filter((a) => a.role.kind === 'bead').map((a) => a.spoolIndex),
    markerContrast: plan.markerContrast,
  }
}

// The no-override map, byte-for-byte identical to the pre-plan implementation for
// every scheme × palette × filament_count (the snapshot test). The profileId is
// irrelevant to quantization, so the throwaway design uses ''.
export function computeFilamentMap(p: Params): FilamentMap {
  const catalog = catalogFromParams(p)
  const plan = materialize(toAbacusDesign(p, ''), catalog)
  return planToFilamentMap(
    plan,
    catalog.spools.map((s) => s.hex)
  )
}
