// Abacus Studio — the AbacusLink modular-column joint, TS mirror.
//
// SPEC: apps/web/docs/abacus-studio/modular-columns-spec.md
// GEOMETRY: public/scad/abacus-link.scad — that file stays the source of truth
// for the printed shape. This one mirrors its derived chain and its asserts,
// exactly as `derived()` mirrors abacus.scad's intent-knob chain and
// `feetEffective()` / `feetFit()` mirror the foot-pocket asserts.
//
// WHY THE MIRROR EARNS ITS KEEP HERE MORE THAN ANYWHERE ELSE. There is no
// headless OpenSCAD in this repo, so a scad `assert()` only ever fires inside a
// user's render — mid-export, in a message written for whoever edits the scad.
// The joint has two failure modes that are *silent* rather than loud, and both
// are caught below instead:
//
//   1. A release bore drilled at or before the latch shoulder removes the very
//      material the barb bears on. The part renders, slices, prints, and clicks
//      — and holds nothing.
//   2. Flat relief under the chevron's seating travel lets the seam faces bottom
//      out before the chevron flanks touch. Also renders, also prints, also
//      clicks — and quietly gives up the Z registration the ArUco markers'
//      coplanarity depends on.
//
// Neither shows up in a preview. Both are one arithmetic comparison.
//
// Framework-free: no React, no three, no geometry kernel. Pure numbers.

import { borderEff, derived, type Params } from './abacus-model'

/** PLA's effective modulus for printed parts at 3–4 walls + ~40% infill. The
 *  same 2 GPa abacus.scad's anti-bend feet napkin uses — kept identical so the
 *  two structural arguments in this project can be compared without conversion. */
export const E_PLA = 2000 // MPa

/** PLA-on-PLA sliding friction. Sets the self-locking bound on the cam ramp:
 *  below atan(MU_PLA) a wedge cannot be driven back out by load, only released
 *  by pushing the spring. Conservative — printed surfaces usually run higher. */
export const MU_PLA = 0.3
export const SELF_LOCK_MAX_DEG = (Math.atan(MU_PLA) * 180) / Math.PI // ≈ 16.7°

const rad = (deg: number): number => (deg * Math.PI) / 180

/** The joint's knob surface. Mirrors the `link_*` variables in abacus-link.scad
 *  one for one; anything derived from these lives in {@link linkDerived}. */
export type LinkParams = {
  h: number // seam height = frame_h · S
  pitch: number // modular col_pitch
  station: number // Y depth of a joint station (the solid border strip)
  // chevron
  teeth: number
  toothD: number
  fit: number
  relief: number
  // cam latch
  rampDeg: number
  leadDeg: number
  beamT: number
  beamL: number
  beamX0: number
  beamY0: number
  bump: number
  slot: number
  release: number
  // foot
  footW: number
  footX: number
  footY: number
}

/** The values the scad and this module both derive, and the coupon's defaults.
 *  Kept in one place so a sweep (§9 of the spec) is a spread, not a rewrite. */
export const defaultLinkParams: LinkParams = {
  h: 8,
  pitch: 15,
  station: 14.75,
  teeth: 2,
  toothD: 1.6,
  fit: 0.1,
  relief: 0.25,
  rampDeg: 8,
  leadDeg: 40,
  beamT: 1.8,
  beamL: 12,
  beamX0: -5,
  beamY0: 2.6,
  bump: 1.1,
  slot: 1.4,
  release: 2.6,
  footW: 6.35, // 1/4" — the largest BUMPER_PRESETS entry that clears the slot
  footX: 7.5,
  footY: 10.0,
}

/** An axis-aligned footprint on the module's solid strip, `[x0, y0, x1, y1]`. */
export type LinkBox = readonly [number, number, number, number]

export type LinkDerived = {
  /** one tooth's height */
  toothH: number
  /** chevron flank angle off VERTICAL, degrees. ≤ 45 is the self-support limit
   *  — the number that decides whether the groove's roof needs support. */
  flankDeg: number
  /** X travel needed to close a `fit` normal gap on the flank; the relief has to
   *  exceed this or the flats seat before the chevron does. */
  seatTravel: number
  /** the cam face's x-run — how much X the latch draws per full barb travel */
  takeUp: number
  /** the insertion lead-in's x-run */
  leadRun: number
  beamX1: number
  barbX: number
  slotEnd: number
  boreX: number
  slotBox: LinkBox
  footBox: LinkBox
}

export const linkDerived = (p: LinkParams): LinkDerived => {
  const toothH = p.h / p.teeth
  const flankDeg = (Math.atan(p.toothD / (toothH / 2)) * 180) / Math.PI
  const beamX1 = p.beamX0 + p.beamL
  const barbX = beamX1 - 3.4
  const takeUp = p.bump * Math.tan(rad(p.rampDeg))
  const leadRun = p.bump / Math.tan(rad(p.leadDeg))
  const slotEnd = beamX1 + 1.2
  return {
    toothH,
    flankDeg,
    seatTravel: p.fit / Math.cos(rad(flankDeg)),
    takeUp,
    leadRun,
    beamX1,
    barbX,
    slotEnd,
    boreX: beamX1 - 0.5,
    slotBox: [p.relief - 0.1, p.beamY0 - p.bump - 0.15, slotEnd, p.beamY0 + p.beamT + p.slot],
    footBox: [
      p.footX - p.footW / 2,
      p.footY - p.footW / 2,
      p.footX + p.footW / 2,
      p.footY + p.footW / 2,
    ],
  }
}

// ---- what the latch is actually worth ---------------------------------------
// The cantilever is `h` tall in Z and `beamT` thick in Y, so it springs in Y
// while staying stiff about the axis a sagging abacus loads. Everything below is
// straight Euler-Bernoulli on that beam — the point is not precision, it is that
// the three quantities trade against each other and you cannot improve one
// without paying in another:
//
//   clamp     ∝ 1/L³   (short beam → strong)
//   stress    ∝ 1/L²   (short beam → cracks)
//   take-up   ∝ tan(ramp)   while   clamp ∝ 1/tan(ramp)
//
// SEATED, NOT FULL, DEFLECTION. The clamp a seam actually holds is set by how
// far the barb still HAD to travel when the chevron flanks bottomed out — not by
// the barb's full height. Quoting the full-travel force would overstate the
// preload by 2×. Nominal design point is the barb seating at mid-travel, so
// `clampPerSeam` is taken at bump/2 and the full-travel figure is reported
// separately as what it really is: the peak the tongue sees while you push two
// modules together, and the deflection its fibre stress must be checked at.
export type LinkMechanics = {
  /** tip stiffness of one tongue, N/mm */
  beamK: number
  /** spring force at the nominal seated position (barb at mid-travel), N */
  springForceSeated: number
  /** spring force at full barb deflection — the INSERTION peak, not the preload */
  springForceFull: number
  /** X clamp one station holds when seated, N — the spring through the ramp's 1/tan */
  clampPerStation: number
  /** two stations (front strip + back strip) per seam */
  clampPerSeam: number
  /** peak bending stress at the tongue's root during insertion, MPa. The stress
   *  it lives at is roughly half this; the peak is what has to clear yield. */
  beamStressMPa: number
  /** ramp below the friction angle: load cannot back the joint out */
  selfLocking: boolean
  /** bending moment a seam carries before its tension side opens, N·mm.
   *  M_gap = P·h/6 for an axially preloaded rectangular joint face. Past this
   *  the joint does not fail — it opens onto the self-locking wedge and carries
   *  the rest in bearing — but it stops being as stiff as the slab it replaced. */
  gapMomentNmm: number
}

export const linkMechanics = (p: LinkParams): LinkMechanics => {
  const I = (p.h * p.beamT ** 3) / 12
  const beamK = (3 * E_PLA * I) / p.beamL ** 3
  const springForceSeated = beamK * (p.bump / 2)
  const clampPerStation = springForceSeated / Math.tan(rad(p.rampDeg))
  const clampPerSeam = 2 * clampPerStation
  return {
    beamK,
    springForceSeated,
    springForceFull: beamK * p.bump,
    clampPerStation,
    clampPerSeam,
    beamStressMPa: (3 * E_PLA * p.bump * p.beamT) / (2 * p.beamL ** 2),
    selfLocking: Math.tan(rad(p.rampDeg)) < MU_PLA,
    gapMomentNmm: (clampPerSeam * p.h) / 6,
  }
}

/** How far the far end of an `n`-seam stack falls out of plane if every joint
 *  hinges on `clearance` of residual latch play — the calculation in §3 of the
 *  spec, and the reason the latch has to cam the seam shut rather than merely
 *  hook it. Cantilevered from one end; each joint contributes clearance/h of
 *  rotation acting over its distance to the free end. */
export const linkHingeDroop = (p: LinkParams, clearance: number, seams: number): number => {
  const theta = clearance / p.h
  const span = (seams + 1) * p.pitch
  let droop = 0
  for (let i = 1; i <= seams; i++) droop += theta * (span - i * p.pitch)
  return droop
}

// ---- the fit guards — one per scad assert ------------------------------------
/** Why a link geometry is refused. One code per `assert()` in abacus-link.scad,
 *  same order, so the two can be read side by side. */
export type LinkProblemCode =
  | 'flank-overhang'
  | 'ramp-not-self-locking'
  | 'relief-too-small'
  | 'takeup-too-small'
  | 'slot-binds'
  | 'wall-too-thin'
  | 'slot-past-station'
  | 'slot-past-pitch'
  // The last two have no counterpart in `link_assert()`. The library is
  // deliberately foot-agnostic — a specialty column may seat something else
  // entirely — so where the bumper goes is the CONSUMER's business, and
  // abacus.scad asserts these two beside its own foot placement.
  | 'foot-hits-slot'
  | 'foot-off-strip'

export type LinkProblem = {
  code: LinkProblemCode
  /** written for whoever is turning the knob, not for whoever wrote the scad */
  message: string
  /** the LinkParams key that actually fixes it */
  knob: keyof LinkParams
}

export type LinkFit = { fits: boolean; problems: LinkProblem[] }

/** Smallest cam take-up worth shipping: under this the joint cannot swallow the
 *  ±0.1 mm a well-tuned FDM printer varies by, and the seam gap goes back to
 *  being whatever the printer felt like that day. */
export const MIN_TAKEUP = 0.12
/** Clear space demanded between two footprints on the same solid strip. */
export const BOX_CLEAR = 0.8

/** At least `clear` apart on some axis. The comparison is `>=`, not `>`: `clear`
 *  is the REQUIRED gap, so a placement that delivers exactly that much has met
 *  it. Strict `>` rejected the scad's own foot position, which is derived to sit
 *  exactly BOX_CLEAR past the slot — a guard that refuses the geometry it was
 *  written to describe. EPS absorbs the float drift of that derivation. */
const BOX_EPS = 1e-9
const disjoint = (a: LinkBox, b: LinkBox, clear: number): boolean =>
  a[0] + BOX_EPS >= b[2] + clear ||
  a[2] - BOX_EPS <= b[0] - clear ||
  a[1] + BOX_EPS >= b[3] + clear ||
  a[3] - BOX_EPS <= b[1] - clear

export function linkFit(p: LinkParams): LinkFit {
  const d = linkDerived(p)
  const problems: LinkProblem[] = []
  const bad = (code: LinkProblemCode, message: string, knob: keyof LinkParams) =>
    problems.push({ code, message, knob })

  if (d.flankDeg > 45.001)
    bad(
      'flank-overhang',
      `chevron flank is ${d.flankDeg.toFixed(1)}° off vertical; past 45° the groove's roof needs support, and support inside a snap fit is not a thing`,
      'toothD'
    )
  if (!(p.rampDeg > 0 && p.rampDeg < SELF_LOCK_MAX_DEG))
    bad(
      'ramp-not-self-locking',
      `cam ramp must sit in (0°, ${SELF_LOCK_MAX_DEG.toFixed(1)}°) to self-lock; above it, load can drive the joint open`,
      'rampDeg'
    )
  if (p.relief <= d.seatTravel + 0.05)
    bad(
      'relief-too-small',
      `flat relief ${p.relief} mm is under the ${d.seatTravel.toFixed(3)} mm of travel the chevron needs to seat — the seam faces would bottom out first and the joint would lose its Z registration silently`,
      'relief'
    )
  if (d.takeUp < MIN_TAKEUP)
    bad(
      'takeup-too-small',
      `cam take-up ${d.takeUp.toFixed(3)} mm cannot swallow a normal print's spread (${MIN_TAKEUP} mm)`,
      'bump'
    )
  if (p.slot <= p.bump + 0.2)
    bad(
      'slot-binds',
      "slot is narrower than the barb's travel — the tongue would bind on insertion",
      'slot'
    )
  if (p.beamY0 - p.bump <= 1.2)
    bad(
      'wall-too-thin',
      'outer wall left in front of the barb is thinner than a printable wall',
      'beamY0'
    )
  if (d.slotBox[3] >= p.station)
    bad(
      'slot-past-station',
      'latch slot runs past the solid strip into the bead channel',
      'station'
    )
  if (d.slotEnd + 1.0 >= p.pitch)
    bad(
      'slot-past-pitch',
      "latch slot runs past the module's far wall — the tongue is longer than a column is wide",
      'pitch'
    )
  if (!disjoint(d.footBox, d.slotBox, BOX_CLEAR))
    bad(
      'foot-hits-slot',
      'foot pocket overlaps the latch slot — they compete for the same strip, and the slot wins on X, so the foot has to clear it in Y',
      'footY'
    )
  if (
    !(
      d.footBox[0] > p.relief + 0.8 &&
      d.footBox[2] < p.relief + p.pitch - 0.8 &&
      d.footBox[1] > 0.8 &&
      d.footBox[3] < p.station - 0.8
    )
  )
    bad('foot-off-strip', "foot pocket runs off the module's solid strip", 'footW')

  return { fits: problems.length === 0, problems }
}

/** Project a studio design onto the joint's parameter surface — the bridge that
 *  makes `linkFit` a guard on the ACTUAL abacus rather than on a fixture with
 *  its own numbers.
 *
 *  The envelope (height, pitch, station depth) comes from the design's derived
 *  chain, so it tracks size and the modular floors; the joint's own proportions
 *  come from the `link_*` params. Foot placement mirrors the scad's
 *  `link_foot_y()` — measured off the slot's FAR edge, which is `slot` past the
 *  tongue, and NOT off the barb on its near side, which would put the pocket
 *  through the slot it is supposed to clear. */
export const linkParamsOf = (p: Params): LinkParams => {
  const d = derived(p)
  return {
    ...defaultLinkParams,
    h: p.frame_h * p.scale_factor,
    pitch: d.sCp,
    // the solid end strip: border band + shelf — the scad's strip_y
    station: borderEff(p) * p.scale_factor + d.sShelf,
    fit: p.link_fit,
    relief: p.link_relief,
    rampDeg: p.link_ramp,
    bump: p.link_bump,
    slot: p.link_slot_w,
    footW: p.link_foot_w,
    footX: d.sCp / 2,
    footY:
      defaultLinkParams.beamY0 +
      defaultLinkParams.beamT +
      p.link_slot_w +
      BOX_CLEAR +
      p.link_foot_w / 2,
  }
}
