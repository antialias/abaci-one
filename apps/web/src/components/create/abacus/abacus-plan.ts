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
// preserves the distinctions the user meant.
//
// WHO CHOOSES THE SPOOL (Gitea #37 — the authority swap). Not this file, and no
// longer a redmean nearest-color search over a family-name heuristic. The design's
// intent leaves as a `filament-plan/v1` request (abacus-plan-request.ts) and THH
// answers it against the roster that is loaded RIGHT NOW; `materialize` projects
// that answer onto the studio's role/warning vocabulary. The old local matcher —
// `snapWithin`, `candidateGroups`, the `/tpu\s*for\s*ams/i` feet test and the
// co-print anchor loop — is deleted rather than kept as a fallback, because a
// fallback matcher is a second answer that silently disagrees with the first.
//
// So this file is now PURE JUDGEMENT over someone else's assignment. It stays
// synchronous and side-effect-free on purpose: the fetch is the caller's problem
// (useFilamentPlan, cached on the request bytes + the roster bytes), so the panel
// and the parent's recolor still agree by construction.
//
// Scope: frame + ArUco markers + bead roles + printed feet + one role per inset
// text color group (Gitea #26 — those roles are what give the inlay plugs a slot
// to print in; without them the writing shipped as empty pockets). Every warning
// here is severity 'warning' and `ok` stays true, including the rainbow ink
// budget: erroring on it would refuse to print the studio's own default design.
// Framework-free (no React, no three).
//
// WHICH WARNINGS ARE OURS. Material compatibility is THH's — its `compat` module
// exists precisely so that "cockpit, eink-web, abaci" don't each re-encode
// filament folklore, and it answers from real Orca profile temperatures with
// provenance, which this file never could. `poor_interlayer_adhesion` (the weld
// rule, driven by the `interfaces` we declare), `nozzle_temp_conflict` (the old
// material-mix), `thermal_environment_conflict` and `ams_feed_unsuitable` all
// arrive as service warnings and are projected verbatim.
//
// What stays local is what is ABACUS semantics and has no service equivalent:
// marker contrast, bead role collision and its budget, the rainbow ink budget,
// text that vanishes into the frame's own filament, and — the one material check
// THH structurally will not make — a visible role sitting on breakaway support
// media. Every role an abacus prints is a visible part, and the planner only
// filters support media *toward* a `support-interface` role, never away from a
// `model` one. That check survives, but it now reads the service's own
// `supportKind` instead of guessing from the family name.

import {
  coPrintGroup,
  type FilamentCatalog,
  type FilamentSpool,
  isSupportSpool,
} from './abacus-catalog'
import type { AbacusDesign } from './abacus-design'
import { contrastRatio, type FilamentMap, type TextGroup, textGroups } from './abacus-model'
import { designRoles, type PrintRole, type PrintRoleKind } from './abacus-plan-request'
import type { FilamentPlanResponseV1 } from '@eink/print-dialog'

export const PRINT_PLAN_SCHEMA_VERSION = 1

// The camera's floor for reading the ArUco corner markers; below this the black
// and white cells stop separating reliably. Mirrors the bench's marker-contrast
// intent (WCAG ratio of the mapped marker pair).
export const MARKER_CONTRAST_MIN = 3

// `PrintRole` and the role vocabulary are minted by abacus-plan-request.ts, which
// is also what turns them into the planner's palette. Re-exported here because
// this module is what the studio has always imported them from, and because
// keeping ONE definition is what guarantees a palette id and a role key are the
// same string — the whole join between the request and the answer.
export type { PrintRole, PrintRoleKind }

// A role after planning: which spool it landed on, how far that spool is from the
// intrinsic color, and whether a user override pinned it.
export type RoleAssignment = {
  role: PrintRole
  spoolId: string
  spoolIndex: number
  // CIEDE2000 distance from the designed color to the spool's, as the SERVICE
  // measured it. Was redmean (~0–800) computed locally; ΔE00 (~0–100) is both a
  // different scale and a better one — see SHIFT_DISTANCE_THRESHOLD.
  //
  // Null when there is no measurement rather than 0: the service reports null for
  // a spool with no usable color metadata, and a locally-echoed pin has no
  // measurement until the next plan lands. Zero would mean "an exact match",
  // which is the one thing an unknown distance must not claim.
  distance: number | null
  overridden: boolean
}

export type PlanWarningCode =
  | 'marker-contrast'
  | 'role-collision'
  | 'budget-exceeded'
  | 'support-material' // a visible role sitting on breakaway support filament
  | 'feet-material' // the plan put no flexible (TPU) spool on the feet — they print rigid
  | 'rainbow-unrealizable' // rainbow inset text asks for more inks than the loaded spools can give
  | 'text-invisible' // an inlay group landed on the frame's own filament — unreadable writing
  | 'plan-unresolved' // the service found no live filament that can serve a role
  // Service warning codes pass through under their own names (`origin: 'service'`)
  // — `poor_interlayer_adhesion`, `nozzle_temp_conflict`, `ams_feed_unsuitable`,
  // `thermal_environment_conflict`, `color_tolerance_exceeded`… Open on purpose:
  // THH adding a compatibility axis must reach the user without an Abaci release,
  // which is the entire reason compatibility lives there and not here.
  | (string & {})

export type PlanWarning = {
  code: PlanWarningCode
  // Who is making this claim. 'studio' is abacus semantics (a marker that won't
  // read, writing that vanishes); 'service' is THH's material authority, relayed
  // verbatim. Worth distinguishing in the UI: one is about your design, the other
  // about what's loaded.
  origin: 'studio' | 'service'
  severity: 'error' | 'warning'
  message: string
  roleKeys?: string[]
  // The service's own severity, preserved unflattened. THH grades 'blocker' /
  // 'caution' / 'info' as PREDICTIONS ("the slicer will likely refuse this"), and
  // collapsing them into this file's two-value severity would throw away the
  // difference between a clog risk and an advisory note.
  serviceSeverity?: 'blocker' | 'caution' | 'info'
}

export type PrintPlan = {
  schemaVersion: number
  catalogSource: FilamentCatalog['source']
  assignments: RoleAssignment[]
  markerContrast: number // WCAG ratio of the mapped ArUco pair (camera wants ≥3)
  warnings: PlanWarning[]
  // Where this plan came from. 'unplanned' is a first-class state, not an error:
  // no printer paired, the roster still loading, or a params catalog — cases where
  // the honest answer is "nobody has decided yet", and the studio renders the
  // DESIGNED colors rather than a guess. It used to be impossible to represent,
  // which is exactly why a local matcher had to invent something.
  planStatus: 'satisfied' | 'degraded' | 'unresolved' | 'unplanned'
  // The co-print group most of the plate's model roles actually landed on (e.g.
  // "PLA"), read back off the plan. DISPLAY ONLY — the picker sections
  // compatible-vs-not around it. It is no longer an input to any decision: nothing
  // is restricted to it, because the service decides what co-prints.
  anchorGroup?: string
  // true iff no error-severity warning — mirrors the solver's export gate.
  // Nothing here is an error today and nothing should lightly become one: this
  // file warns and never blocks (the slicer stays the authority), and the export
  // gate users actually hit comes from the solver, not from here.
  ok: boolean
}

export type MaterializeOpts = {
  // roleKey → spoolId. A user pin from the viewer's filament-mapping panel.
  //
  // A pin's REAL home is the request: it becomes a `required` identity selector so
  // the service plans (and judges compatibility) around it. Applying it here too
  // is a local echo so the preview moves on the same frame as the click, instead
  // of blanking until the re-plan returns. The echo and the authoritative answer
  // agree by construction — `required` is a hard constraint — so this can never
  // drift into a second opinion.
  //
  // Pins onto a spool that isn't loaded are ignored; the role keeps the service's
  // assignment.
  overrides?: Record<string, string>
  // The service's answer for this design. Null ⇒ 'unplanned' (see planStatus):
  // no spool is assigned to anything, and the caller renders designed colors.
  plan?: FilamentPlanResponseV1 | null
}

// A valid plan for an EMPTY catalog: no spools ⇒ nothing to assign. materialize's
// production caller (the studio provider) guarantees a non-empty catalog by
// falling back to the always-populated params catalog, so this is a defensive
// floor, not a normal path. It exists because materialize runs INSIDE the studio
// provider — above every React error boundary — so a throw here blanks the whole
// page instead of one pane. Returning a degenerate-but-valid plan keeps the
// function total: an empty roster degrades, never crashes.
function emptyPlan(source: FilamentCatalog['source'], planStatus: PrintPlan['planStatus']): PrintPlan {
  return {
    schemaVersion: PRINT_PLAN_SCHEMA_VERSION,
    catalogSource: source,
    assignments: [],
    // No mapped pair to measure. 1 (no contrast at all) rather than 21, so a
    // degenerate plan can never read as "the markers are fine".
    markerContrast: 1,
    warnings: [],
    planStatus,
    ok: true,
  }
}

// Which catalog spool the service named. The plan speaks the printer's language
// (a slot id, or the external-spool flag); the catalog speaks the studio's (a
// stable `id` per row). `thhFilamentsToCatalog` mints those ids FROM the same
// rows the planner ranked, so this join is exact rather than a nearest guess:
// slot rows keep their `slotId`, and the one external row is found by its flag.
//
// A null means the service picked something this catalog doesn't contain — only
// reachable if the roster moved between the two reads, which the plan's cache key
// (request bytes + roster bytes) is built to prevent. Treated as "no spool"
// rather than silently rounded to a neighbouring slot.
function indexOfPlanned(
  planned: FilamentPlanResponseV1['assignments'][number]['filament'],
  spools: readonly FilamentSpool[]
): number {
  if (!planned) return NO_SPOOL
  if (planned.slotId) {
    const i = spools.findIndex((s) => s.id === planned.slotId)
    if (i >= 0) return i
  }
  if (planned.external) {
    const i = spools.findIndex((s) => s.external === true)
    if (i >= 0) return i
  }
  return NO_SPOOL
}

// A role the service could not place has NO spool — not slot 0. The sentinel is
// explicit so every consumer has to decide what to do about it; a defaulted 0
// would print the whole role in whatever happened to be loaded first and look
// exactly like a successful plan.
export const NO_SPOOL = -1

// A text row's label: the writing that group actually inks, so the mapping panel
// row explains itself ("1+9 2+8" beats "Text 3"). A present group always has at
// least one token — it exists because some rail reached that index. Single fill
// inks every token, so it says so instead of naming two arbitrary ones.
const textGroupLabel = (t: TextGroup, single: boolean): string =>
  single ? 'Inlay text' : t.tokens.slice(0, 2).join(' ')

/**
 * Project a design + the service's filament plan onto the studio's role model.
 *
 * The role list and the plan's palette are the SAME list (both come from
 * `designRoles`, and `abacus-plan-request` uses `role.key` as the palette id), so
 * this is a join on a shared key, not a re-derivation. That is the property that
 * makes the swap safe: there is no second opinion to disagree with the first.
 *
 * TOTAL by contract. Three degenerate inputs all return a valid plan rather than
 * throwing, because `materialize` runs inside the studio provider — above every
 * React error boundary — so a throw here blanks the whole page instead of one
 * pane: a catalog with no spools, no service plan at all ('unplanned'), and a
 * plan whose assignments name spools this catalog no longer has.
 */
export function materialize(
  design: AbacusDesign,
  catalog: FilamentCatalog,
  opts: MaterializeOpts = {}
): PrintPlan {
  const spools = catalog.spools
  const servicePlan = opts.plan ?? null
  // No plan ⇒ no spool assignment. This is the params-catalog path and the
  // still-loading path, and it is deliberately EMPTY rather than locally matched:
  // the caller renders the designed colors (see `designFilamentMap`), which is
  // what the fallback always claimed to do and now actually does.
  if (!servicePlan) return emptyPlan(catalog.source, 'unplanned')
  if (spools.length === 0) return emptyPlan(catalog.source, 'unresolved')

  const hexes = spools.map((s) => s.hex)
  const overrides = opts.overrides ?? {}
  const idToIndex = new Map(spools.map((s, i) => [s.id, i] as const))
  const byPaletteId = new Map(servicePlan.assignments.map((a) => [a.paletteId, a] as const))

  // Build an assignment from the service's answer, letting an explicit pin
  // repoint it. The pin is only an ECHO here — it also travelled into the request
  // as a `required` selector, so the next plan agrees with what this shows now.
  const assign = (role: PrintRole): RoleAssignment => {
    const answer = byPaletteId.get(role.key)
    let idx = answer ? indexOfPlanned(answer.filament, spools) : NO_SPOOL
    // `deltaE00` describes the SERVICE's pick. A pin that moves the role
    // invalidates that measurement, and this file no longer owns a color metric
    // to recompute one with — so it becomes null ("not measured") until the
    // re-plan lands, never a stale number attached to a different spool.
    let distance = answer?.deltaE00 ?? null
    let overridden = false
    const pinned = overrides[role.key]
    if (pinned && idToIndex.has(pinned)) {
      const pinnedIdx = idToIndex.get(pinned) as number
      if (pinnedIdx !== idx) distance = null
      idx = pinnedIdx
      overridden = true
    }
    return {
      role,
      spoolId: idx === NO_SPOOL ? '' : spools[idx].id,
      spoolIndex: idx,
      distance,
      overridden,
    }
  }

  // Roles are minted from the SAME function that built the request, so the
  // palette ids and the role keys cannot drift apart.
  const roles = designRoles(design)
  const single = design.params.text_fill !== 'rainbow'
  const textLabels = new Map<string, string>(
    textGroups(design.params).map((t) => [`text-${t.g}`, textGroupLabel(t, single)] as const)
  )
  const assignments = roles.map((role) =>
    assign(textLabels.has(role.key) ? { ...role, label: textLabels.get(role.key) as string } : role)
  )

  const at = (kind: PrintRoleKind): RoleAssignment | undefined =>
    assignments.find((a) => a.role.kind === kind)
  const markerBlack = at('markerBlack')
  const markerWhite = at('markerWhite')
  const frame = at('frame')
  const beadAssignments = assignments.filter((a) => a.role.kind === 'bead')
  const textAssignments = assignments.filter((a) => a.role.kind === 'text')

  // The color a role will ACTUALLY show: its spool's, or — when nothing is
  // assigned — the color the user designed. Nothing here invents a spool; it
  // answers "what does the viewer paint", which for an unplaced role is the
  // design's own intent.
  const effectiveHex = (a: RoleAssignment | undefined, fallback: string): string =>
    a && a.spoolIndex !== NO_SPOOL ? hexes[a.spoolIndex] : fallback

  // Contrast of the FINAL marker pair (pins included) — the camera reads what
  // actually prints, so a pinned marker must move this warning too. An unplaced
  // marker falls back to its designed hex, so a roster that can't serve the
  // markers reports 'plan-unresolved' rather than a spurious contrast failure.
  const markerContrast = contrastRatio(
    effectiveHex(markerWhite, '#ffffff'),
    effectiveHex(markerBlack, '#000000')
  )

  const warnings = planWarnings(markerContrast, beadAssignments, beadAssignments.length)

  // The one material check THH structurally will not make (see the header): a
  // visible role on breakaway support media. Reads the service's own
  // `supportKind`, projected verbatim onto the catalog — not a family-name guess.
  const support = supportMaterialWarning(assignments, spools, catalog.source)
  if (support) warnings.push(support)

  // Printed feet want a FLEXIBLE material, and that preference travels as a
  // `preferred` family selector. The service says it couldn't honour it by
  // relaxing `preferred_identity_unavailable` — so the studio's friendlier prose
  // is driven by the service's own relaxation instead of by a name regex over
  // the spool's product string. But that relaxation is a claim about the PLAN
  // ("no spool satisfied the preference selector"), not about the printer's
  // inventory — the roster in hand is what knows whether TPU is physically
  // loaded, and the message must not claim more than its evidence: saying "no
  // TPU is loaded" off the relaxation alone lied to the user the day a Bambu
  // spool reported the wire family TPU-AMS and the selector missed it.
  const feet = at('feet')
  const feetRelaxed = byPaletteId
    .get('feet')
    ?.relaxations.includes('preferred_identity_unavailable')
  if (feet && feetRelaxed && !feet.overridden) {
    const tpuLoaded = spools.some((s) => coPrintGroup(s.material) === 'TPU')
    warnings.push({
      code: 'feet-material',
      origin: 'studio',
      severity: 'warning',
      message: tpuLoaded
        ? 'A flexible (TPU) filament is loaded, but the plan could not put it on the feet, so they fall back to a rigid one — rigid feet slide and scuff.'
        : 'No flexible (TPU) filament is loaded, so the printed feet fall back to a rigid one — rigid feet slide and scuff. Load Bambu "TPU for AMS" for feet that grip.',
      roleKeys: ['feet'],
    })
  }

  if (frame) warnings.push(...textWarnings(textAssignments, frame.spoolIndex))

  // Roles the service could not place. Named explicitly, because the alternative
  // — a role quietly missing from the mapping panel — is how an unprintable design
  // reaches the plate looking fine.
  //
  // Only roles the plan ANSWERED, though. A role the response doesn't mention at
  // all is not evidence the roster can't serve it — it is an answer to a different
  // question, which is exactly what the studio holds on screen while a new plan is
  // in flight (`keepPreviousData` in useFilamentPlan). Warning on those would flash
  // "no loaded filament can serve this" about a role the planner hasn't been asked
  // about yet. They still render in their designed color; the fresh plan decides.
  const unplaced = assignments.filter(
    (a) => a.spoolIndex === NO_SPOOL && byPaletteId.has(a.role.key)
  )
  if (unplaced.length > 0) {
    warnings.push({
      code: 'plan-unresolved',
      origin: 'studio',
      severity: 'warning',
      message: `${listProse(unplaced.map((a) => a.role.label))} ${
        unplaced.length === 1 ? 'has' : 'have'
      } no loaded filament that can serve ${
        unplaced.length === 1 ? 'it' : 'them'
      } — ${unplaced.length === 1 ? 'it prints' : 'they print'} in the designed color here, but not on the plate. Load a suitable spool or pin one.`,
      roleKeys: unplaced.map((a) => a.role.key),
    })
  }

  warnings.push(...serviceWarnings(servicePlan, feetRelaxed === true))

  // Display-only: what the plate mostly turned out to be. Read off the plan, not
  // used to restrict anything.
  const anchorGroup =
    catalog.source === 'thh-ams'
      ? majorityGroup(
          assignments
            .filter((a) => a.spoolIndex !== NO_SPOOL && a.role.kind !== 'feet')
            .map((a) => coPrintGroup(spools[a.spoolIndex].material))
        )
      : undefined

  const ok = !warnings.some((w) => w.severity === 'error')

  return {
    schemaVersion: PRINT_PLAN_SCHEMA_VERSION,
    catalogSource: catalog.source,
    assignments,
    markerContrast,
    warnings,
    planStatus: servicePlan.status,
    ...(anchorGroup ? { anchorGroup } : {}),
    ok,
  }
}

// The most common entry, ties broken by first appearance. `undefined` for an
// empty list rather than a fabricated default.
function majorityGroup(groups: string[]): string | undefined {
  const counts = new Map<string, number>()
  for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1)
  let best: string | undefined
  let bestN = 0
  for (const [g, n] of counts) {
    if (n > bestN) {
      best = g
      bestN = n
    }
  }
  return best
}

/**
 * THH's warnings, relayed under their own codes.
 *
 * Relayed rather than re-worded: the detail text carries provenance the studio
 * cannot reconstruct ("Orca reports 255 °C for this profile" beats "the slicer
 * will likely refuse the mix"), and an unrecognized future code still reaches the
 * user instead of being dropped by a switch that hasn't heard of it.
 *
 * Two families are filtered, and only because the studio says the same thing
 * better with role labels the user recognises: the unresolved-palette blockers
 * (covered by 'plan-unresolved') and, when it fired, the feet's preferred-identity
 * relaxation (covered by 'feet-material'). Nothing else is suppressed.
 */
function serviceWarnings(plan: FilamentPlanResponseV1, feetCovered: boolean): PlanWarning[] {
  const covered = new Set(['palette_unresolved', 'palette_constraint_unresolved'])
  return plan.warnings
    .filter((w) => !covered.has(w.code))
    .filter(
      (w) =>
        !(
          feetCovered &&
          w.code === 'preferred_identity_unavailable' &&
          w.paletteIds.length === 1 &&
          w.paletteIds[0] === 'feet'
        )
    )
    .map((w) => ({
      code: w.code,
      origin: 'service' as const,
      // This file warns and never blocks — the slicer stays the authority, and
      // THH grades its own severities as predictions. The prediction is preserved
      // in `serviceSeverity` rather than promoted into an export gate here.
      severity: 'warning' as const,
      message: w.detail,
      roleKeys: [...w.paletteIds],
      serviceSeverity: w.severity,
    }))
}

// Oxford-comma prose for a short list of family names.
const listProse = (xs: string[]): string =>
  xs.length === 1
    ? xs[0]
    : xs.length === 2
      ? `${xs[0]} and ${xs[1]}`
      : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`

// support-material: a visible role sitting on breakaway support filament.
//
// The one material check that stays local, and only because THH structurally
// will not make it: its planner filters support media *toward* a
// `support-interface` role, never away from a `model` one, so a chalky PLA-S can
// still win a bead on color alone. Every studio role IS a visible part (an abacus
// has no support geometry), and support media is engineered to bond weakly.
//
// The EVIDENCE is the service's, not a guess: `supportKind` is projected verbatim
// from the roster row, and `spoolSupportKind` only falls back to the family-name
// heuristic when talking to a pre-#367 service that omitted the field. So this
// warning states a fact the printer reported, then applies an abacus rule to it.
//
// Deliberately distinct from the temperature story, which is THH's now:
// Support-for-PLA co-prints with PLA just fine; it still looks and holds up wrong.
function supportMaterialWarning(
  assignments: RoleAssignment[],
  spools: FilamentSpool[],
  source: FilamentCatalog['source']
): PlanWarning | null {
  if (source !== 'thh-ams') return null
  const named = assignments.filter(
    (a) => a.spoolIndex !== NO_SPOOL && isSupportSpool(spools[a.spoolIndex])
  )
  if (named.length === 0) return null
  const callouts = named
    .map(
      (a) => `${a.role.label} is on ${spools[a.spoolIndex].name} (${spools[a.spoolIndex].material})`
    )
    .join('; ')
  const one = named.length === 1
  return {
    code: 'support-material',
    origin: 'studio',
    severity: 'warning',
    message: `${callouts} — that's breakaway support filament. It prints weak and chalky, so ${
      one ? 'this visible part' : 'these visible parts'
    } will look wrong and may crumble. Move ${one ? 'it' : 'them'} onto a regular spool.`,
    roleKeys: named.map((a) => a.role.key),
  }
}
// The inset-text reductions. Both are warnings, deliberately: this file warns
// and never blocks, and the reduction they describe still prints — just with
// less color than the design asked for.
function textWarnings(all: RoleAssignment[], frameIndex: number): PlanWarning[] {
  const warnings: PlanWarning[] = []
  // Unplaced roles are excluded from BOTH checks below. They share no filament
  // (they have none), so counting them would report a collision between two roles
  // that the service placed nowhere — 'plan-unresolved' is what describes them,
  // and saying it twice in different words helps nobody.
  const textAssignments = all.filter((a) => a.spoolIndex !== NO_SPOOL)
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
      origin: 'studio',
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
  // An unplaced FRAME matches nothing: `frameIndex` is then NO_SPOOL, and the
  // filter above already removed every assignment that could equal it.
  const invisible = textAssignments.filter((a) => a.spoolIndex === frameIndex)
  if (invisible.length > 0) {
    const all = invisible.length === textAssignments.length
    warnings.push({
      code: 'text-invisible',
      origin: 'studio',
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
  allBeads: RoleAssignment[],
  roleCount: number
): PlanWarning[] {
  const warnings: PlanWarning[] = []
  // Same reason as textWarnings: two roles the service placed nowhere are not
  // "sharing a filament", and 'plan-unresolved' already names them.
  const beadAssignments = allBeads.filter((a) => a.spoolIndex !== NO_SPOOL)

  if (markerContrast < MARKER_CONTRAST_MIN) {
    warnings.push({
      code: 'marker-contrast',
      origin: 'studio',
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
      origin: 'studio',
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
        origin: 'studio',
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
//
// UNPLACED ROLES get an appended slot carrying the color the user designed, so the
// viewer paints the design's own intent for anything the service could not serve.
// That is the honest picture — "we don't know what this would print as, here's
// what you asked for" — and it is why `slots` is returned possibly longer than the
// catalog. Mapping them to slot 0 instead would paint them in whatever happens to
// be loaded first and look exactly like a plan that worked.
export function planToFilamentMap(plan: PrintPlan, slots: string[]): FilamentMap {
  const out = [...slots]
  // Slot index for an assignment, minting a design-color slot for an unplaced one.
  // `?? 0` still guards a role the plan never minted at all (an emptyPlan), where
  // there is no intrinsic color to fall back to either.
  const slotFor = (a: RoleAssignment | undefined): number | undefined => {
    if (!a) return undefined
    if (a.spoolIndex !== NO_SPOOL) return a.spoolIndex
    out.push(a.role.intrinsicHex)
    return out.length - 1
  }
  const of = (kind: PrintRoleKind): RoleAssignment | undefined =>
    plan.assignments.find((a) => a.role.kind === kind)
  const pick = (kind: PrintRoleKind): number => slotFor(of(kind)) ?? 0
  const frame = pick('frame')
  const markerWhite = pick('markerWhite')
  const markerBlack = pick('markerBlack')
  const beadRoles = plan.assignments
    .filter((a) => a.role.kind === 'bead')
    .map((a) => slotFor(a) as number)
  // feet is CONDITIONAL, not defaulted: the key exists iff the plan minted a
  // feet role (feet_mode === 'printed'), so the 3MF builder can distinguish
  // "no printed feet" from "feet on slot 0".
  const feet = slotFor(of('feet'))
  // text is CONDITIONAL for the same reason: absent means the design has no
  // inset text to ink, which the 3MF must distinguish from "text on slot 0".
  // Dense over the groups by construction (they're minted in group order and the
  // present set is always the prefix 0…G−1 — see textGroups).
  const textRoles = plan.assignments
    .filter((a) => a.role.kind === 'text')
    .map((a) => slotFor(a) as number)
  return {
    slots: out,
    frame,
    markerWhite,
    markerBlack,
    beadRoles,
    markerContrast: plan.markerContrast,
    ...(feet !== undefined ? { feet } : {}),
    ...(textRoles.length > 0 ? { textRoles } : {}),
  }
}

// The map for a design NOBODY HAS PLANNED — no printer paired, the roster still
// loading, or a params catalog. Every role gets its own slot holding exactly the
// color the user designed, so the viewer renders the design itself.
//
// This is what replaced `computeFilamentMap`, and the difference is the whole
// point of Gitea #37. That function quantized the design onto the eight
// `filament_N` params with a redmean nearest-color search — a full matching
// algorithm whose answer nothing could print, since the params catalog describes
// no real spools. Approximating a design against a fictional roster is strictly
// worse than showing the design, and it was the last place redmean survived.
export function designFilamentMap(design: AbacusDesign): FilamentMap {
  const roles = designRoles(design)
  const slots = roles.map((r) => r.intrinsicHex)
  const indexOf = (kind: PrintRoleKind): number => roles.findIndex((r) => r.kind === kind)
  const kindSlots = (kind: PrintRoleKind): number[] =>
    roles.map((r, i) => (r.kind === kind ? i : -1)).filter((i) => i >= 0)
  const feet = indexOf('feet')
  const textRoles = kindSlots('text')
  return {
    slots,
    frame: indexOf('frame'),
    markerWhite: indexOf('markerWhite'),
    markerBlack: indexOf('markerBlack'),
    beadRoles: kindSlots('bead'),
    // The DESIGNED markers are pure black on pure white, so the design's own
    // contrast is perfect. Nothing is claimed about what a printer would manage —
    // that only becomes knowable once a plan exists.
    markerContrast: contrastRatio('#ffffff', '#000000'),
    ...(feet >= 0 ? { feet } : {}),
    ...(textRoles.length > 0 ? { textRoles } : {}),
  }
}

// ---- shift signal -----------------------------------------------------------
// CIEDE2000 distance above which a role's spool reads as a genuinely different
// color rather than a near-match.
//
// RECALIBRATED, not merely renamed (Gitea #37): the old threshold was 85 in
// redmean units (~0–800), and `distance` is now the service's ΔE00 (~0–100), so
// carrying the number across would have silenced every fleck. Placed by measuring
// the same reference pairs the old comment named:
//
//   #dc2626 → #c1272d   same-hue near-match   redmean  46   ΔE00  6.3   stay silent
//   #ffffff → #f3f4f6   off-white             redmean  33   ΔE00  2.5   stay silent
//   #000000 → #1f2937   black → slate         redmean 133   ΔE00 13.1   fleck
//   #14b8a6 → #22c55e   teal → green          redmean 127   ΔE00 19.0   fleck
//
// 10 sits in the empirical gap (6.3 … 13.1) and coincides with the textbook mark
// for "a different color at a glance". Tune here if the flecks feel too eager /
// too shy.
export const SHIFT_DISTANCE_THRESHOLD = 10

// Does a role print as a noticeably DIFFERENT color than the user designed? A pure
// readout of the assignment's own ΔE00 vs the shift threshold — no independent
// color math, and none available: this file no longer owns a color metric.
//
// A null distance is NOT a shift. It means unmeasured — a spool with no color
// metadata, a pin the next plan hasn't confirmed, or an unplaced role — and
// flecking on "we don't know" would cry wolf on every click of the picker.
//
// Feet never shift: their spool is chosen by MATERIAL (the `preferred` TPU
// selector), so the color distance from the fixed intrinsic slate is decorative,
// not a reduction the user should audit.
export const roleShifted = (a: RoleAssignment, threshold = SHIFT_DISTANCE_THRESHOLD): boolean =>
  a.role.kind !== 'feet' && a.distance !== null && a.distance > threshold

// ---- the print gate ---------------------------------------------------------
// Roles that would print in a color no loaded spool can produce — the labels the
// panel names when it refuses to submit.
//
// This gate is new with the authority swap (Gitea #37), and it exists because the
// swap changed what a FilamentMap can contain. The local quantizer always returned
// a real catalog slot for every role, because it snapped onto whatever was loaded;
// a plan does not. `planToFilamentMap` appends a design-color slot for anything the
// service could not place, so the viewer paints the user's intent — and that slot
// has no spool behind it. Sent to a printer it is not a near miss, it is a body
// referencing an extruder that will never be loaded.
//
// An UNPLANNED plan (no printer paired, or the read still in flight) reports no
// unplaced roles: nothing has been judged yet, and the panel's own loading and
// roster states already describe that. Only a plan that answered and came up short
// blocks the submit.
export function unplacedRoleLabels(plan: PrintPlan): string[] {
  return plan.assignments.filter((a) => a.spoolIndex === NO_SPOOL).map((a) => a.role.label)
}
