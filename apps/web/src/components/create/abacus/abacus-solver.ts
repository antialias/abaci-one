// Abacus Studio — printability solver (Gitea epic #5, Phase 1 #7, slice S1).
//
// SPEC: apps/web/docs/abacus-studio/master-model-spec.md — §4 "Where the locked
// floors come from — the printer profile".
//
// The #6 model splits every dimension into LOCKED (absolute mm — clearance,
// inlay depth) and PROPORTIONAL (scale with `scale_factor`). This module is the
// *guard* on that split: a pure `solve(params, profile)` that checks each scaled
// dimension against the absolute-mm floors of a selectable `PrinterProfile` and
// reports every floor it falls below.
//
// Reasons carry a SEVERITY. Hard floors (clearance, wall, feature, throw) are
// `'error'` — below them the model would seize or snap, so they flip `ok` false
// and the UI (S3) blocks Export. Inlay depth is a `'warning'` — a shallow marker
// still prints, it just may not scan; it never flips `ok` (else the Wide profile,
// whose 0.9 mm inlay floor the fixed 0.6 mm depth can never meet, would block
// Export for every marked design). So `ok` = "no error-severity reasons"; a
// solver that says `ok` never emits a seized model.
//
// PROFILE, NOT DEVICE. The floors come from a static tolerance table that
// DEFAULTS to a common-denominator FDM preset (`fdm-0.4`). Nozzle diameter is
// printer *configuration*, not a design input; a design always solves offline
// against the default. A connected printer (Phase 2, #8/#9) only *enriches* — it
// auto-fills the nearest profile and warns (non-blocking) at submit — and that
// seam lands in a later slice (S4), never gating the design-time solve here.
//
// Framework-free and three-free, like abacus-model.ts. Verdict-only: it returns
// a verdict + reasons, never mutated params — size stays a deliberate fabrication
// choice; the UI (S3) turns each reason's `fix` into a one-click action.

import { anyTokens, type Params } from './abacus-model'

// ---- printer profile --------------------------------------------------------
// A small static tolerance table. `nozzleMm`/`layerMm` are informational (shown
// in the UI + used by the future connected-printer auto-fill); the four `min*Mm`
// floors are what the solver actually checks scaled dimensions against.
export type PrinterProfile = {
  id: string
  label: string
  nozzleMm: number
  layerMm: number
  minClearanceMm: number // bead↔track fit gap; below → captive beads fuse
  minWallMm: number // wall between channels (`web`)
  minFeatureMm: number // thin structural strip (reckoning `bar`)
  minInlayDepthMm: number // ArUco/text color-inlay depth (Z)
}

// The `fdm-0.4` default is defined to reproduce today's baked `.scad` floors
// EXACTLY (see the citations below), so adopting the profile model is a no-op
// for existing designs. Wide/Fine raise/lower the floors together, so the same
// logical abacus re-solves differently per profile.
export const PRINTER_PROFILES: readonly PrinterProfile[] = [
  {
    id: 'fdm-0.4',
    label: 'Common (0.4 mm nozzle)',
    nozzleMm: 0.4,
    layerMm: 0.2,
    minClearanceMm: 0.2, // abacus.scad:64 — clearance floor for a 0.4 mm nozzle
    minWallMm: 1.2, // abacus.scad:188 — assert(web * S >= 1.2)
    minFeatureMm: 2.0, // abacus.scad:189 — assert(bar * S >= 2)
    minInlayDepthMm: 0.6, // abacus.scad:71 — inlay_d = 0.6 (3 layers @ 0.2 mm)
  },
  {
    id: 'fdm-0.6',
    label: 'Wide (0.6 mm nozzle)',
    nozzleMm: 0.6,
    layerMm: 0.3,
    minClearanceMm: 0.3, // ≈ 0.5 × nozzle — a fatter extrusion needs a wider captive gap
    minWallMm: 1.8, // ≈ 3 × nozzle
    minFeatureMm: 2.5,
    minInlayDepthMm: 0.9, // ≈ 3 × layer
  },
  {
    id: 'fdm-0.2',
    label: 'Fine (0.2 mm nozzle)',
    nozzleMm: 0.2,
    layerMm: 0.1,
    minClearanceMm: 0.1, // ≈ 0.5 × nozzle
    minWallMm: 0.6, // ≈ 3 × nozzle — unlocks smaller prints (wall binds at S ≥ 0.24)
    minFeatureMm: 1.0,
    minInlayDepthMm: 0.3, // ≈ 3 × layer
  },
]

export const DEFAULT_PROFILE_ID = 'fdm-0.4'
export const DEFAULT_PROFILE: PrinterProfile =
  PRINTER_PROFILES.find((p) => p.id === DEFAULT_PROFILE_ID) as PrinterProfile

// Resolve a profile id to its profile, falling back to the default for an
// unknown id (e.g. a stale `profileId` deserialized from an old saved design).
export const profileById = (id: string | undefined): PrinterProfile =>
  PRINTER_PROFILES.find((p) => p.id === id) ?? DEFAULT_PROFILE

// ---- baked constants the solver mirrors -------------------------------------
// The color-inlay depth is baked into abacus.scad (`inlay_d = 0.6`), not a Param,
// so it's absolute — scaling the design never deepens it.
export const INLAY_DEPTH_MM = 0.6 // abacus.scad:71
// Functional floors the .scad also asserts (NOT profile-driven — they come from
// the mechanism, not the printer):
export const MIN_THROW_MM = 2 // abacus.scad:207 — a bead must travel to register set/unset
//
// NOTE: abacus.scad:372 also asserts the bead's exposed cap has room for the
// master's 3 mm dome (`10*(frame_h+bead_proud)/bead_dia >= 10`; it was `> 8`
// while the dome was stretched to fit rather than sat on a taller belt). It is
// S-independent and can't be tripped from the studio controls (frame_h and
// bead_proud aren't studio knobs), so it stays a .scad-only backstop and is
// intentionally NOT mirrored here. Add it if a future UI exposes those knobs.

// ---- solve ------------------------------------------------------------------
export type SolveDim = 'clearance' | 'wall' | 'feature' | 'throw' | 'inlay'

// `'error'` = below a seizing/snapping floor → flips `ok` false, blocks Export.
// `'warning'` = advisory (inlay may not scan) → shows, but never flips `ok`.
export type SolveSeverity = 'error' | 'warning'

export type SolveReason = {
  dim: SolveDim
  severity: SolveSeverity
  label: string // short human label, e.g. "channel wall"
  measuredMm: number // the (scaled) dimension we measured
  floorMm: number // the floor it fell below
  message: string // full sentence, naming the profile
  fix: string // knob-level suggestion the UI can act on
  // Smallest `scale_factor` that clears a PROPORTIONAL floor. Absent for locked
  // floors (clearance, inlay) — scaling can't fix an absolute dimension.
  suggestedScale?: number
}

export type SolveResult = {
  ok: boolean
  profileId: string
  reasons: SolveReason[] // empty when ok
}

// Floor comparisons use a tiny epsilon so a dimension sitting exactly on its
// floor passes (contact/equality is allowed — we refuse only genuinely below).
const EPS = 1e-9

// Smallest scale_factor at which `knob * S >= floor`, rounded UP to 4 decimals so
// the returned value comfortably clears the floor (never lands just under it).
const clearsAtScale = (knob: number, floor: number): number =>
  Math.ceil((floor / knob) * 1e4) / 1e4

/**
 * Check a design against a printer profile. Pure: no I/O, no mutation. Returns a
 * verdict + the reasons it failed (empty when printable). Every check has the
 * form `scaledDim >= absoluteFloor` — there is deliberately NO overlap/contact
 * check (an ArUco tile touching the channel wall is fine; the shelf auto-grows to
 * fit tiles by construction in `derived()`), so contact never refuses.
 */
export function solve(p: Params, profile: PrinterProfile): SolveResult {
  const S = p.scale_factor
  const reasons: SolveReason[] = []

  // 1. bead↔track fit gap — LOCKED/absolute; scaling can't fix it.
  if (p.clearance < profile.minClearanceMm - EPS) {
    reasons.push({
      dim: 'clearance',
      severity: 'error',
      label: 'fit gap',
      measuredMm: p.clearance,
      floorMm: profile.minClearanceMm,
      message: `Bead↔track fit gap ${p.clearance.toFixed(2)} mm is below the ${profile.label} floor of ${profile.minClearanceMm.toFixed(2)} mm — captive beads would fuse to the track.`,
      fix: `Raise the fit gap to at least ${profile.minClearanceMm.toFixed(2)} mm (it's absolute — printing larger won't help).`,
    })
  }

  // 2. channel wall (`web`) — proportional.
  const wall = p.web * S
  if (wall < profile.minWallMm - EPS) {
    reasons.push({
      dim: 'wall',
      severity: 'error',
      label: 'channel wall',
      measuredMm: wall,
      floorMm: profile.minWallMm,
      message: `Channel wall ${wall.toFixed(2)} mm is below the ${profile.label} floor of ${profile.minWallMm.toFixed(2)} mm — walls between columns would be too thin to print.`,
      fix: `Print larger (≈${clearsAtScale(p.web, profile.minWallMm)}× or more), or raise the wall knob.`,
      suggestedScale: clearsAtScale(p.web, profile.minWallMm),
    })
  }

  // 3. reckoning bar (structural feature) — proportional.
  const feature = p.bar * S
  if (feature < profile.minFeatureMm - EPS) {
    reasons.push({
      dim: 'feature',
      severity: 'error',
      label: 'reckoning bar',
      measuredMm: feature,
      floorMm: profile.minFeatureMm,
      message: `Reckoning bar ${feature.toFixed(2)} mm is below the ${profile.label} floor of ${profile.minFeatureMm.toFixed(2)} mm — the divider would be too thin to survive.`,
      fix: `Print larger (≈${clearsAtScale(p.bar, profile.minFeatureMm)}× or more), or raise the bar knob.`,
      suggestedScale: clearsAtScale(p.bar, profile.minFeatureMm),
    })
  }

  // 4. bead travel (`throw`) — functional floor, proportional.
  const travel = p.throw * S
  if (travel < MIN_THROW_MM - EPS) {
    reasons.push({
      dim: 'throw',
      severity: 'error',
      label: 'bead travel',
      measuredMm: travel,
      floorMm: MIN_THROW_MM,
      message: `Bead travel ${travel.toFixed(2)} mm is below ${MIN_THROW_MM.toFixed(2)} mm — beads couldn't express set vs unset.`,
      fix: `Print larger (≈${clearsAtScale(p.throw, MIN_THROW_MM)}× or more), or raise the throw knob.`,
      suggestedScale: clearsAtScale(p.throw, MIN_THROW_MM),
    })
  }

  // 5. inlay depth — only when markers or perimeter text are inlaid. The depth is
  //    a baked scad constant (absolute), so scaling can't fix it; the fix is
  //    profile- or feature-level.
  if ((p.show_markers || anyTokens(p)) && INLAY_DEPTH_MM < profile.minInlayDepthMm - EPS) {
    reasons.push({
      dim: 'inlay',
      severity: 'warning',
      label: 'inlay depth',
      measuredMm: INLAY_DEPTH_MM,
      floorMm: profile.minInlayDepthMm,
      message: `Color inlays are ${INLAY_DEPTH_MM.toFixed(2)} mm deep but the ${profile.label} needs ${profile.minInlayDepthMm.toFixed(2)} mm — markers/text may not read.`,
      fix: `Choose a finer profile, or turn off markers and perimeter text.`,
    })
  }

  // `ok` ignores warnings — only a seizing/snapping (error) floor blocks Export.
  return { ok: reasons.every((r) => r.severity !== 'error'), profileId: profile.id, reasons }
}
