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
// Scope: frame + ArUco markers + bead roles + printed feet + one role per inset
// text color group (Gitea #26 — those roles are what give the inlay plugs a slot
// to print in; without them the writing shipped as empty pockets). Every warning
// here is severity 'warning' and `ok` stays true, including the rainbow ink
// budget: erroring on it would refuse to print the studio's own default design.
// Framework-free (no React, no three).
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
  isSupportSpool,
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
  type TextGroup,
  textGroups,
} from './abacus-model'

export const PRINT_PLAN_SCHEMA_VERSION = 1

// The camera's floor for reading the ArUco corner markers; below this the black
// and white cells stop separating reliably. Mirrors the bench's marker-contrast
// intent (WCAG ratio of the mapped marker pair).
export const MARKER_CONTRAST_MIN = 3

export type PrintRoleKind = 'frame' | 'markerBlack' | 'markerWhite' | 'bead' | 'text' | 'feet'

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
  | 'feet-material' // printed feet found no flexible (TPU) spool — they fall back to the frame's
  | 'rainbow-unrealizable' // rainbow inset text asks for more inks than the loaded spools can give
  | 'text-invisible' // an inlay group landed on the frame's own filament — unreadable writing

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
  // true iff no error-severity warning — mirrors the solver's export gate.
  // Nothing here is an error today and nothing should lightly become one: this
  // file warns and never blocks (the slicer stays the authority), and the export
  // gate users actually hit comes from the solver, not from here.
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
    // `?? 0` guards an empty `allowed` (e.g. a future candidate group with no
    // members): never emit `undefined`, which would index `spools[undefined]`
    // and throw in the provider. materialize's empty-catalog guard makes slot 0
    // always exist here.
    let best = allowed[0] ?? 0
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
    if (isSupportSpool(s)) return
    const g = coPrintGroup(s.material)
    const idxs = groups.get(g) ?? []
    idxs.push(i)
    groups.set(g, idxs)
  })
  return groups.size > 0 ? groups : null
}

// The feet spool is picked by FAMILY, not color — printed TPU feet (Gitea #23)
// want a flexible filament, and `coPrintGroup('TPU') === 'TPU'` means a TPU
// spool can never sit inside the plate's (PLA-led) anchor group, so the pick
// runs OUTSIDE the anchor loop entirely. Preference order: a spool literally
// named "TPU for AMS" (Bambu's Shore-68D — the only AMS-safe TPU) beats any
// other TPU, which beats AMS order. No TPU loaded → null; the caller falls back
// to the frame's spool (rigid feet still print — the geometry is identical)
// and raises the 'feet-material' warning on a real roster. The params catalog
// fabricates families, so it never has a TPU to find and stays silent.
function pickFeetSpool(spools: FilamentSpool[], source: FilamentCatalog['source']): number | null {
  if (source !== 'thh-ams') return null
  const tpus = spools
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => coPrintGroup(s.material) === 'TPU' && !isSupportSpool(s))
  if (tpus.length === 0) return null
  return (tpus.find(({ s }) => /tpu\s*for\s*ams/i.test(s.name)) ?? tpus[0]).i
}

// A valid plan for an EMPTY catalog: no spools ⇒ nothing to assign. materialize's
// production caller (the studio provider) guarantees a non-empty catalog by
// falling back to the always-populated params catalog, so this is a defensive
// floor, not a normal path. It exists because materialize runs INSIDE the studio
// provider — above every React error boundary — so a throw here blanks the whole
// page instead of one pane. Returning a degenerate-but-valid plan keeps the
// function total: an empty roster degrades, never crashes.
function emptyPlan(source: FilamentCatalog['source']): PrintPlan {
  return {
    schemaVersion: PRINT_PLAN_SCHEMA_VERSION,
    catalogSource: source,
    assignments: [],
    markerContrast: 1,
    warnings: [],
    ok: true,
  }
}

// A text row's label: the writing that group actually inks, so the mapping panel
// row explains itself ("1+9 2+8" beats "Text 3"). A present group always has at
// least one token — it exists because some rail reached that index. Single fill
// inks every token, so it says so instead of naming two arbitrary ones.
const textGroupLabel = (t: TextGroup, single: boolean): string =>
  single ? 'Inlay text' : t.tokens.slice(0, 2).join(' ')

// Project a design onto a catalog. Role assignment order matches the bench's
// historical precedence EXACTLY (markers first — they're CV-critical — then
// frame, then bead roles distinct-first), so `computeFilamentMap` can adapt this
// back to the legacy `FilamentMap` shape without drift. With a THH catalog the
// pass is anchor-restricted (see candidateGroups): the cheapest co-print group
// wins the whole plate, so the default mapping never mixes temperatures and
// never lands a visible part on support media — the pit of success. Pins go
// wherever the user says; the warnings answer.
//
// TOTAL by contract: a catalog with zero spools returns emptyPlan rather than
// throwing (see above). Every index the quantizer produces below therefore
// references a real spool, so the assignments can't read `.id` off undefined.
export function materialize(
  design: AbacusDesign,
  catalog: FilamentCatalog,
  opts: MaterializeOpts = {}
): PrintPlan {
  const spools = catalog.spools
  if (spools.length === 0) return emptyPlan(catalog.source)
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
  // The index set the winning pass drew from. Hoisted because the text roles
  // below must stay INSIDE it (they weld to the frame) without being part of the
  // pass that chooses it — see the text block for why.
  let allowed: number[]
  if (!groups) {
    allowed = spools.map((_, i) => i)
    snap = snapWithin(hexes, frameHex, roleHexes, allowed)
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
    allowed = bestIdxs
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

  // Printed feet (Gitea #23): a family-picked role, minted only when the design
  // wants in-place feet. The intrinsic hex is a fixed dark slate — feet are
  // picked by MATERIAL, so their color distance is decorative and must never
  // influence snapping (the pick runs outside the anchor loop, see
  // pickFeetSpool). Appended LAST so every historical assignment keeps its
  // index. A pin (`overrides['feet']`) can still repoint it anywhere.
  //
  // Deliberately NOT gated on `show_frame`, even though the feet BODY is (see
  // abacus-3mf.ts). This plan describes design intent — which spool each role
  // would use — not which bodies a particular render emits; that's why the frame
  // and marker roles are minted whatever `show_frame`/`show_markers` say. The
  // 3MF re-checks `show_frame` before consuming `filamentMap.feet`, so an unused
  // role index here is inert, exactly as an unused marker index already is.
  let feetAssignment: RoleAssignment | null = null
  let feetFallback = false
  if (design.params.feet_mode === 'printed') {
    const tpuIdx = pickFeetSpool(spools, catalog.source)
    feetFallback = tpuIdx === null && catalog.source === 'thh-ams'
    feetAssignment = assign(
      { kind: 'feet', key: 'feet', label: 'Feet', intrinsicHex: '#1f2937' },
      // The fallback is "the frame's filament" as the warning below promises, so
      // it has to read the FINAL frame spool — a pinned frame moves the feet with
      // it. snap.frameIdx is only where the auto-snapper started.
      tpuIdx ?? frame.spoolIndex
    )
  }

  // Inset text inlay: one role per color group (see textGroups — rainbow text
  // spans up to 5 inks, single fill exactly 1). Without these the plugs ride no
  // slot, which is why every 3MF to date printed the perimeter writing as bare
  // pockets in frame filament.
  //
  // Assigned AFTER the anchor pass and deliberately NOT part of it. snapWithin's
  // distinct-first loop and its cost are what choose the anchor group, so letting
  // text vote there would move bead assignments on existing designs and could
  // flip the whole plate to another temperature family. Text is decorative ink:
  // it takes the nearest spool in the group the structure already picked, sharing
  // freely (an honest near-match beats being forced onto the black marker spool).
  // Restricting it to `allowed` is also what satisfies the weld rule by
  // construction — the inlay is fused into the frame, and weldedKinds counts it.
  //
  // Gated like the geometry: only `inset` mode carves pockets that need filling.
  // Not gated on show_frame — same reasoning as feet above, the plan describes
  // design intent and the 3MF re-checks before consuming the slot.
  // DISTINCT-FIRST, FRAME-LAST — the same shape as snapWithin's bead loop, plus
  // one rule the beads don't need.
  //
  // Independent nearest-match was the bug: five rainbow groups each picked their
  // own closest spool, four of them landed on the same one, and two perfectly
  // good contrasting spools sat unused. A rainbow that prints as two colors when
  // three were available isn't a near-miss, it's a wasted slot. So a group
  // prefers a spool no other group has taken.
  //
  // The frame's spool is held back until every other candidate is spoken for.
  // An inlay plug fills its pocket FLUSH and level, so text in frame filament
  // doesn't print a near-miss color — it VANISHES. Distinctness must never be
  // bought with invisibility, and neither must fidelity: this is the one role
  // where the nearest color can be the wrong answer.
  //
  // Groups still share once the spools run out, and that's honest: a 5-ink
  // rainbow needs 5 spare spools, and a 4-slot AMS already owes slots to the
  // frame, both ArUco markers and the bead roles. rainbow-unrealizable reports
  // what it actually got.
  const textAssignments: RoleAssignment[] = []
  if (design.params.text_mode === 'inset') {
    const usedByText = new Set<number>()
    // every candidate that isn't the frame's own filament, i.e. the ones that
    // will actually read as writing. Uses the FINAL frame index, so pinning the
    // frame moves what counts as invisible.
    const visible = allowed.filter((i) => i !== frame.spoolIndex)
    const nearestIn = (pool: number[], hex: string): number | null => {
      let best: number | null = null
      let bd = Number.POSITIVE_INFINITY
      for (const i of pool) {
        const d = colorDist(hex, hexes[i])
        if (d < bd) {
          bd = d
          best = i
        }
      }
      return best
    }
    for (const t of textGroups(design.params)) {
      const idx =
        nearestIn(
          visible.filter((i) => !usedByText.has(i)),
          t.hex
        ) ?? // fresh and readable — the rainbow's whole point
        nearestIn(visible, t.hex) ?? // out of fresh spools: share, stay readable
        nearestIn(allowed, t.hex) ?? // a roster whose only candidate IS the frame
        allowed[0] ??
        0
      usedByText.add(idx)
      textAssignments.push(
        assign(
          {
            kind: 'text',
            key: `text-${t.g}`,
            label: textGroupLabel(t, design.params.text_fill !== 'rainbow'),
            intrinsicHex: t.hex,
          },
          idx
        )
      )
    }
  }

  // Contrast of the FINAL marker pair (pins included) — the camera reads what
  // actually prints, so a pinned marker must move this warning too.
  const markerContrast = contrastRatio(hexes[markerWhite.spoolIndex], hexes[markerBlack.spoolIndex])
  // Text is appended LAST (after feet) for the same reason feet went last: every
  // historical assignment keeps its index. Display order is independent — the
  // panel sorts by kind.
  const assignments = [
    markerBlack,
    markerWhite,
    frame,
    ...beadAssignments,
    ...(feetAssignment ? [feetAssignment] : []),
    ...textAssignments,
  ]
  const warnings = planWarnings(markerContrast, beadAssignments, roleHexes.length)
  const voters = materialVoters(assignments)
  for (const w of [
    materialMixWarning(voters, spools, catalog.source),
    supportMaterialWarning(assignments, spools, catalog.source),
    weldMixWarning(voters, spools, catalog.source),
  ]) {
    if (w) warnings.push(w)
  }
  if (feetAssignment && feetFallback && !feetAssignment.overridden) {
    warnings.push({
      code: 'feet-material',
      severity: 'warning',
      message:
        'No flexible (TPU) filament is loaded, so the printed feet fall back to the frame\'s filament — rigid feet slide and scuff. Load Bambu "TPU for AMS" for feet that grip.',
      roleKeys: ['feet'],
    })
  }
  warnings.push(...textWarnings(textAssignments, frame.spoolIndex))
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

// Which assignments get a VOTE in the two material-majority warnings below.
//
// Inset text is ink riding a spool, and rainbow text is five roles that normally
// land on one or two filaments the structure already prints in. Letting each of
// those vote would make "what does this plate print at" answer a question about
// how many ink groups a design happens to have rather than about what's loaded —
// enough to flip a genuine 2/2 tie into a false majority. So a text role votes
// only when it occupies a spool nothing else does: that alone introduces a
// material to the plate (and to the weld), which is exactly what these warnings
// are looking for. Text still shows up unfiltered in support-material, where
// there's no majority math and a text group on breakaway media is a real defect.
const materialVoters = (assignments: RoleAssignment[]): RoleAssignment[] => {
  const spoken = new Set(assignments.filter((a) => a.role.kind !== 'text').map((a) => a.spoolIndex))
  return assignments.filter((a) => {
    if (a.role.kind !== 'text') return true
    if (spoken.has(a.spoolIndex)) return false
    spoken.add(a.spoolIndex) // two groups on one new spool are still one material
    return true
  })
}

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
  // Feet riding TPU are EXEMPT from the temperature bucketing: Bambu's "TPU for
  // AMS" (220–240 °C) genuinely co-prints on a PLA-led plate — the whole point of
  // the feet role is that deliberate mix (crossbar-retained, Gitea #23), and
  // bucketing it would fire this warning on every default printed-feet plan.
  // The exemption is the MATERIAL's, not the role's: the feet row has a full
  // picker, so a foot pinned to ABS on a PLA plate is the ordinary plate-temp
  // hazard this check exists for and must still warn.
  const split = splitByKey(
    assignments.filter(
      (a) => a.role.kind !== 'feet' || coPrintGroup(spools[a.spoolIndex].material) !== 'TPU'
    ),
    (a) => coPrintGroup(spools[a.spoolIndex].material)
  )
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
  const named = assignments.filter((a) => isSupportSpool(spools[a.spoolIndex]))
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

// material-interface (the weld rule — its warning half): frame + ArUco markers
// + inset-text inlays fuse into ONE printed piece, so they
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
  // 'feet' is deliberately ABSENT: the TPU foot ↔ PLA pocket boundary is a
  // cross-material weld by design, mechanically backed by the crossbar (the
  // foot is a closed loop around a frame bar — retention doesn't depend on
  // the weld, Gitea #23). 'bead' stays absent too (captive, never welded).
  const weldedKinds: PrintRoleKind[] = ['frame', 'markerBlack', 'markerWhite', 'text']
  const welded = assignments.filter(
    (a) => weldedKinds.includes(a.role.kind) && !isSupportSpool(spools[a.spoolIndex])
  )
  const split = splitByKey(welded, (a) => spools[a.spoolIndex].material)
  if (!split) return null
  const { keys, named, tie } = split

  // Name the parts actually in the weld, not a fixed pair: inset text joins the
  // cluster whenever the design has any (its plugs are fused flush into the
  // frame's pockets), and a design can have markers off.
  const has = (k: PrintRoleKind): boolean => welded.some((a) => a.role.kind === k)
  const subject = listProse(
    [
      has('frame') ? 'the frame' : null,
      has('markerBlack') || has('markerWhite') ? 'the ArUco markers' : null,
      has('text') ? 'the inset text' : null,
    ].filter((s): s is string => s !== null)
  )
  const Subject = subject.charAt(0).toUpperCase() + subject.slice(1)
  const remedy = `Keep ${subject} on one material.`
  if (tie) {
    return {
      code: 'material-interface',
      severity: 'warning',
      message: `${Subject} print as one welded piece, but the mapping splits them across ${listProse(keys)} — mixed joints delaminate. ${remedy}`,
      roleKeys: named.map((a) => a.role.key),
    }
  }
  const callouts = named
    .map((a) => `${a.role.label} is on ${spools[a.spoolIndex].material}`)
    .join('; ')
  return {
    code: 'material-interface',
    severity: 'warning',
    message: `${Subject} print as one welded piece, but ${callouts} while the rest is ${keys[0]} — mixed joints delaminate. ${remedy}`,
    roleKeys: named.map((a) => a.role.key),
  }
}

// The inset-text reductions. Both are warnings, deliberately: this file warns
// and never blocks, and the reduction they describe still prints — just with
// less color than the design asked for.
function textWarnings(textAssignments: RoleAssignment[], frameIndex: number): PlanWarning[] {
  const warnings: PlanWarning[] = []
  if (textAssignments.length === 0) return warnings

  // rainbow-unrealizable: the ink budget. Rainbow text wants one filament per
  // color group; when the loaded spools can't serve that many distinctly, groups
  // collapse and tokens that should read as different colors print identically.
  //
  // NOT an error, though the code was long reserved as one. Five distinct ink
  // slots are unreachable on a 4-slot AMS that already owes slots to the frame,
  // both ArUco markers, the bead roles and the feet — and rainbow text is the
  // DEFAULT, so erroring here would ship a studio whose default design refuses
  // to print.
  const distinct = new Set(textAssignments.map((a) => a.spoolIndex)).size
  if (distinct < textAssignments.length) {
    warnings.push({
      code: 'rainbow-unrealizable',
      severity: 'warning',
      message: `Your rainbow inlay text asks for ${textAssignments.length} ink colors, but only ${distinct} distinct ${
        distinct === 1 ? 'filament serves' : 'filaments serve'
      } it — some tokens print the same color as others.`,
      roleKeys: textAssignments.map((a) => a.role.key),
    })
  }

  // text-invisible: an inlay group landed on the frame's own filament. The plug
  // fills its pocket FLUSH and in the same color, so the writing simply
  // disappears — the one text outcome a user is guaranteed to notice on the
  // plate, and the reason a near-color match is not good enough here.
  const invisible = textAssignments.filter((a) => a.spoolIndex === frameIndex)
  if (invisible.length > 0) {
    const all = invisible.length === textAssignments.length
    warnings.push({
      code: 'text-invisible',
      severity: 'warning',
      message: `${
        all ? 'The inlay text prints' : `${invisible.length} of the inlay text colors print`
      } in the frame's own filament — flush and the same color, so the writing won't be readable. Pin ${
        invisible.length === 1 ? 'it' : 'them'
      } to a contrasting spool.`,
      roleKeys: invisible.map((a) => a.role.key),
    })
  }
  return warnings
}

// The lossy-reduction report — every entry warning-severity (nothing here blocks
// export; the slicer and the solver own the real gates).
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
  // `?? 0` keeps this total for an emptyPlan (no assignments): a missing role maps
  // to slot 0. Paired with hexRGB's neutral fallback, a degenerate catalog renders
  // a neutral preview instead of throwing. A normal plan always has every role, so
  // this changes nothing on the live path (the snapshot test pins that).
  const pick = (kind: PrintRoleKind): number =>
    plan.assignments.find((a) => a.role.kind === kind)?.spoolIndex ?? 0
  // feet is CONDITIONAL, not defaulted: the key exists iff the plan minted a
  // feet role (feet_mode === 'printed'), so the 3MF builder can distinguish
  // "no printed feet" from "feet on slot 0".
  const feet = plan.assignments.find((a) => a.role.kind === 'feet')?.spoolIndex
  // text is CONDITIONAL for the same reason: absent means the design has no
  // inset text to ink, which the 3MF must distinguish from "text on slot 0".
  // Dense over the groups by construction (they're minted in group order and the
  // present set is always the prefix 0…G−1 — see textGroups).
  const textRoles = plan.assignments.filter((a) => a.role.kind === 'text').map((a) => a.spoolIndex)
  return {
    slots,
    frame: pick('frame'),
    markerWhite: pick('markerWhite'),
    markerBlack: pick('markerBlack'),
    beadRoles: plan.assignments.filter((a) => a.role.kind === 'bead').map((a) => a.spoolIndex),
    markerContrast: plan.markerContrast,
    ...(feet !== undefined ? { feet } : {}),
    ...(textRoles.length > 0 ? { textRoles } : {}),
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
// rows' corner fleck and the "N colors shift" footer both read. Feet never
// shift: their spool is picked by FAMILY (TPU), so the color distance from the
// fixed intrinsic slate is decorative, not a reduction the user should audit.
export const roleShifted = (a: RoleAssignment, threshold = SHIFT_DISTANCE_THRESHOLD): boolean =>
  a.role.kind !== 'feet' && a.distance > threshold
