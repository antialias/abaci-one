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
// P1 scope: frame + ArUco markers + bead roles. Perimeter text roles and the
// rainbow multi-material hard gate are deferred to P4 — hence every warning here
// is severity 'warning' and `ok` stays true. Framework-free (no React, no three).
//
// Material compatibility (gh#163 + the P4 weld rule's auto half, landed): with a
// THH catalog (real families), auto-snap is ANCHOR-RESTRICTED — it picks one
// co-print temperature group (support media excluded) and keeps every automatic
// assignment inside it, so the default mapping can never mix plate temperatures
// or put a visible part on breakaway support. The welded same-part cluster —
// frame + ArUco markers + inset text — therefore lands on one family by
// construction. User PINS from the viewer's filament-mapping panel may cross any
// of these lines deliberately; the plan answers with warnings, never blocks
// (material-mix for plate temperature, support-material for breakaway media,
// material-interface for a mixed weld) — the slicer stays the final authority.
// BEADS ARE EXEMPT from the weld rule — captive on a print clearance gap, never
// welded — but they ride the plate's temperature anchor like everything else.

import {
  catalogFromParams,
  coPrintGroup,
  type FilamentCatalog,
  type FilamentSpool,
  isSupportMaterial,
} from './abacus-catalog'
import type { AbacusDesign } from './abacus-design'
import { toAbacusDesign } from './abacus-design'
import {
  beadRoleColors,
  beadRoleNames,
  colorDist,
  contrastRatio,
  type FilamentMap,
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
  | 'material-mix' // plate-wide temperature mix — the slicer's temp guard likely refuses it (gh#163)
  | 'support-material' // a visible role pinned onto breakaway support filament
  | 'material-interface' // the weld-adhesion rule: the fused frame/marker/text cluster mixes families
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
  // The co-print temperature group auto-snap anchored the plate to (e.g. "PLA").
  // Present only for a thh-ams catalog with at least one non-support spool —
  // the params catalog fabricates families, so it never claims an anchor. The
  // viewer's picker groups compatible-vs-not around this.
  anchorGroup?: string
  // true iff no error-severity warning — mirrors the solver's export gate. In P1
  // nothing is an error, so this is always true; the rainbow hard gate (P4) is the
  // first thing that can flip it.
  ok: boolean
}

// roleKey → spoolId. A user pin from the viewer's filament-mapping panel; the
// empty (no-override) path is exactly the historical mapping (proven by the
// snapshot). Pins onto an unloaded spool are ignored — the role stays auto-snapped.
export type MaterializeOpts = { overrides?: Record<string, string> }

// Weighting for the anchor-group choice: the ArUco markers are CV-critical (the
// detector must read them), so a group that serves them poorly pays triple.
const MARKER_COST_WEIGHT = 3

// One full auto-snap pass restricted to the `allowed` spool indexes, in catalog
// order — the exact algorithm that always ran (markers first: black darkest-fit,
// white lightest-fit distinct; then frame nearest; then beads distinct-first),
// now parameterized by the set it may choose from. `allowed` = every index
// reproduces the historical mapping byte-for-byte (the snapshot test pins it).
// Returns the chosen slots plus the weighted total color error, so anchor
// selection compares groups by running the REAL assignment, not an
// approximation of it.
type AutoSnap = {
  blackIdx: number
  whiteIdx: number
  frameIdx: number
  beadIdxs: number[]
  cost: number
}

function snapWithin(
  hexes: string[],
  frameHex: string,
  roleHexes: string[],
  allowed: number[]
): AutoSnap {
  const nearestIn = (target: string, exclude = -1): number => {
    let best = allowed[0]
    let bd = Number.POSITIVE_INFINITY
    for (const idx of allowed) {
      if (idx === exclude) continue
      const d = colorDist(target, hexes[idx])
      if (d < bd) {
        bd = d
        best = idx
      }
    }
    return best
  }
  const blackIdx = nearestIn('#000000')
  // with one allowed spool there's no distinct white, so both markers collapse
  const whiteIdx = allowed.length > 1 ? nearestIn('#ffffff', blackIdx) : blackIdx
  const frameIdx = nearestIn(frameHex)
  const usedByBeads = new Set<number>()
  const beadIdxs = roleHexes.map((intrinsicHex) => {
    let best = -1
    let bd = Number.POSITIVE_INFINITY
    for (const idx of allowed) {
      if (usedByBeads.has(idx)) continue
      const d = colorDist(intrinsicHex, hexes[idx])
      if (d < bd) {
        bd = d
        best = idx
      }
    }
    if (best < 0) best = nearestIn(intrinsicHex) // more roles than slots → reuse
    usedByBeads.add(best)
    return best
  })
  const cost =
    MARKER_COST_WEIGHT *
      (colorDist('#000000', hexes[blackIdx]) + colorDist('#ffffff', hexes[whiteIdx])) +
    colorDist(frameHex, hexes[frameIdx]) +
    beadIdxs.reduce((sum, idx, r) => sum + colorDist(roleHexes[r], hexes[idx]), 0)
  return { blackIdx, whiteIdx, frameIdx, beadIdxs, cost }
}

// The co-print groups automatic assignment may anchor to: THH spools bucketed by
// temperature group, support media excluded (breakaway filament is never an
// automatic pick for a visible part). null = no restriction — the params catalog
// fabricates families, and an all-support AMS has nothing sensible to prefer.
function candidateGroups(catalog: FilamentCatalog): Map<string, number[]> | null {
  if (catalog.source !== 'thh-ams') return null
  const groups = new Map<string, number[]>()
  catalog.spools.forEach((s, i) => {
    if (isSupportMaterial(s.material)) return
    const g = coPrintGroup(s.material)
    const idxs = groups.get(g) ?? []
    idxs.push(i)
    groups.set(g, idxs)
  })
  return groups.size > 0 ? groups : null
}

// Project a design onto a catalog. Role assignment order matches the bench's
// historical precedence EXACTLY (markers first — they're CV-critical — then
// frame, then bead roles distinct-first), so `computeFilamentMap` can adapt this
// back to the legacy `FilamentMap` shape without drift. With a THH catalog the
// pass is anchor-restricted (see candidateGroups): the cheapest co-print group
// wins the whole plate, so the default mapping never mixes temperatures and
// never lands a visible part on support media — the pit of success. Pins go
// wherever the user says; the warnings answer.
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

  const roleHexes = beadRoleColors(design.params.color_scheme, design.params.color_palette)
  const roleNames = beadRoleNames(design.params.color_scheme)
  const frameHex = design.resolvedColors.frame

  // Anchor choice: run the real assignment inside each candidate group and keep
  // the cheapest (ties → the bigger group, then AMS order). No groups → the
  // historical unrestricted pass.
  const groups = candidateGroups(catalog)
  let snap: AutoSnap
  let anchorGroup: string | undefined
  if (!groups) {
    snap = snapWithin(
      hexes,
      frameHex,
      roleHexes,
      spools.map((_, i) => i)
    )
  } else {
    let bestIdxs: number[] = []
    let bestSnap: AutoSnap | null = null
    for (const [g, idxs] of groups) {
      const s = snapWithin(hexes, frameHex, roleHexes, idxs)
      if (
        !bestSnap ||
        s.cost < bestSnap.cost ||
        (s.cost === bestSnap.cost && idxs.length > bestIdxs.length)
      ) {
        anchorGroup = g
        bestIdxs = idxs
        bestSnap = s
      }
    }
    snap = bestSnap as AutoSnap
  }

  const markerBlack = assign(
    { kind: 'markerBlack', key: 'marker-black', label: 'ArUco black', intrinsicHex: '#000000' },
    snap.blackIdx
  )
  const markerWhite = assign(
    { kind: 'markerWhite', key: 'marker-white', label: 'ArUco white', intrinsicHex: '#ffffff' },
    snap.whiteIdx
  )
  const frame = assign(
    { kind: 'frame', key: 'frame', label: 'Frame', intrinsicHex: frameHex },
    snap.frameIdx
  )
  const beadAssignments: RoleAssignment[] = snap.beadIdxs.map((idx, r) =>
    assign(
      {
        kind: 'bead',
        key: `bead-${r}`,
        label: roleNames[r] ?? `bead ${r}`,
        intrinsicHex: roleHexes[r],
      },
      idx
    )
  )

  // Contrast of the FINAL marker pair (pins included) — the camera reads what
  // actually prints, so a pinned marker must move this warning too.
  const markerContrast = contrastRatio(hexes[markerWhite.spoolIndex], hexes[markerBlack.spoolIndex])
  const assignments = [markerBlack, markerWhite, frame, ...beadAssignments]
  const warnings = planWarnings(markerContrast, beadAssignments, roleHexes.length)
  for (const w of [
    materialMixWarning(assignments, spools, catalog.source),
    supportMaterialWarning(assignments, spools, catalog.source),
    weldMixWarning(assignments, spools, catalog.source),
  ]) {
    if (w) warnings.push(w)
  }
  const ok = !warnings.some((w) => w.severity === 'error')

  return {
    schemaVersion: PRINT_PLAN_SCHEMA_VERSION,
    catalogSource: catalog.source,
    assignments,
    markerContrast,
    warnings,
    anchorGroup,
    ok,
  }
}

// Oxford-comma prose for a short list of family names.
const listProse = (xs: string[]): string =>
  xs.length === 1
    ? xs[0]
    : xs.length === 2
      ? `${xs[0]} and ${xs[1]}`
      : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`

// Bucket assignments by a key of their mapped spool, preserving assignment
// order, and split majority vs. the callout set (with no majority — a tie —
// there is no "odd one out", so everything is named). Shared by the material
// warnings below, which differ only in the key and the prose.
function splitByKey(
  assignments: RoleAssignment[],
  keyOf: (a: RoleAssignment) => string
): { keys: string[]; named: RoleAssignment[]; tie: boolean } | null {
  const buckets = new Map<string, RoleAssignment[]>()
  for (const a of assignments) {
    const k = keyOf(a)
    const arr = buckets.get(k) ?? []
    arr.push(a)
    buckets.set(k, arr)
  }
  if (buckets.size <= 1) return null
  const groups = [...buckets.values()]
  const top = Math.max(...groups.map((g) => g.length))
  const tie = groups.filter((g) => g.length === top).length > 1
  const named = tie ? assignments : groups.filter((g) => g.length !== top).flat()
  const keys = [...buckets.keys()].sort(
    (a, b) =>
      (buckets.get(b) as RoleAssignment[]).length - (buckets.get(a) as RoleAssignment[]).length
  )
  return { keys, named, tie }
}

// material-mix (gh#163): the plate-wide temperature heuristic. The first real
// print failed at the slicer, not here — color-blind auto-snap chased a bead
// onto the one PETG spool alongside three PLAs, and Orca refused the whole
// plate ("temperature difference of the filaments used is too large"). Auto-
// snap is anchor-restricted now, so it can no longer create that state; this
// is the backstop for user PINS that cross temperature groups. Buckets by
// CO-PRINT group, not raw family — Support-for-PLA prints at PLA temperatures
// by design, so PLA + PLA-S is not a temperature mix (the support-material
// warning owns that case). Warns and never blocks — the slicer stays the
// authority. Only the THH catalog carries real families; the params catalog
// fabricates PLA everywhere and stays inert by design (abacus-catalog.ts).
// Only spools actually used by the mapping count (a lone PETG sitting unmapped
// in the AMS is harmless).
function materialMixWarning(
  assignments: RoleAssignment[],
  spools: FilamentSpool[],
  source: FilamentCatalog['source']
): PlanWarning | null {
  if (source !== 'thh-ams') return null
  const split = splitByKey(assignments, (a) => coPrintGroup(spools[a.spoolIndex].material))
  if (!split) return null
  const { keys, named, tie } = split

  if (tie) {
    return {
      code: 'material-mix',
      severity: 'warning',
      message: `This plate splits across ${listProse(keys)} temperatures — the slicer will likely refuse the mix. Keep every part in one temperature family.`,
      roleKeys: named.map((a) => a.role.key),
    }
  }
  const majority = keys[0]
  const callouts = named
    .map(
      (a) => `${a.role.label} is on ${spools[a.spoolIndex].name} (${spools[a.spoolIndex].material})`
    )
    .join('; ')
  return {
    code: 'material-mix',
    severity: 'warning',
    message: `${callouts} — the rest of this plate prints at ${majority} temperatures, and the slicer will likely refuse the mix. Move ${
      named.length === 1 ? 'it' : 'them'
    } onto ${majority}, or change what's loaded.`,
    roleKeys: named.map((a) => a.role.key),
  }
}

// support-material: a visible role mapped onto breakaway support filament.
// Every studio role IS a visible part (an abacus has no support geometry), and
// support media is engineered to bond weakly and print chalky. Auto-snap never
// picks it, so this fires only on user pins. Deliberately distinct from the
// temperature story — Support-for-PLA co-prints with PLA just fine; it still
// looks and holds up wrong.
function supportMaterialWarning(
  assignments: RoleAssignment[],
  spools: FilamentSpool[],
  source: FilamentCatalog['source']
): PlanWarning | null {
  if (source !== 'thh-ams') return null
  const named = assignments.filter((a) => isSupportMaterial(spools[a.spoolIndex].material))
  if (named.length === 0) return null
  const callouts = named
    .map(
      (a) => `${a.role.label} is on ${spools[a.spoolIndex].name} (${spools[a.spoolIndex].material})`
    )
    .join('; ')
  const one = named.length === 1
  return {
    code: 'support-material',
    severity: 'warning',
    message: `${callouts} — that's breakaway support filament. It prints weak and chalky, so ${
      one ? 'this visible part' : 'these visible parts'
    } will look wrong and may crumble. Move ${one ? 'it' : 'them'} onto a regular spool.`,
    roleKeys: named.map((a) => a.role.key),
  }
}

// material-interface (the P4 weld rule — its warning half): frame + ArUco
// markers (+ inset text when it lands) fuse into ONE printed piece, so they
// must share a weldable material. Auto-snap satisfies this by construction (one
// anchor group, support excluded); this is the backstop for pins. The weld test
// is RAW family equality among non-support members — PLA↔PLA-CF welds, but
// PLA↔PETG delaminates even when the slicer would print it. Support members are
// excluded here (bonding weakly is their whole design) so the support-material
// warning owns them without double-reporting. Beads are exempt: captive on a
// clearance gap, never welded.
function weldMixWarning(
  assignments: RoleAssignment[],
  spools: FilamentSpool[],
  source: FilamentCatalog['source']
): PlanWarning | null {
  if (source !== 'thh-ams') return null
  const weldedKinds: PrintRoleKind[] = ['frame', 'markerBlack', 'markerWhite', 'text']
  const welded = assignments.filter(
    (a) => weldedKinds.includes(a.role.kind) && !isSupportMaterial(spools[a.spoolIndex].material)
  )
  const split = splitByKey(welded, (a) => spools[a.spoolIndex].material)
  if (!split) return null
  const { keys, named, tie } = split

  const remedy = 'Keep the frame and ArUco markers on one material.'
  if (tie) {
    return {
      code: 'material-interface',
      severity: 'warning',
      message: `The frame and ArUco markers print as one welded piece, but the mapping splits them across ${listProse(keys)} — mixed joints delaminate. ${remedy}`,
      roleKeys: named.map((a) => a.role.key),
    }
  }
  const callouts = named
    .map((a) => `${a.role.label} is on ${spools[a.spoolIndex].material}`)
    .join('; ')
  return {
    code: 'material-interface',
    severity: 'warning',
    message: `The frame and ArUco markers print as one welded piece, but ${callouts} while the rest is ${keys[0]} — mixed joints delaminate. ${remedy}`,
    roleKeys: named.map((a) => a.role.key),
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

// ---- shift signal -----------------------------------------------------------
// redmean distance (see `colorDist`, ~0–800) above which a role's spool reads as a
// genuinely different color rather than a near-match. Calibrated so a same-hue
// near-match like #dc2626→#c1272d (~46) stays silent while a real hue change like
// teal→green (~113) flecks. Tune here if the flecks feel too eager / too shy.
export const SHIFT_DISTANCE_THRESHOLD = 85

// Does a role print as a noticeably DIFFERENT color than the user designed? A pure
// readout of the assignment's own redmean distance (see `colorDist`) vs the shift
// threshold — no independent color math. The single source of truth the mapping
// rows' corner fleck and the "N colors shift" footer both read.
export const roleShifted = (a: RoleAssignment, threshold = SHIFT_DISTANCE_THRESHOLD): boolean =>
  a.distance > threshold
