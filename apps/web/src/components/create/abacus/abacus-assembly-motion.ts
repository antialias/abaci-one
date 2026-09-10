// Assembly motion — the joint-path timeline for "take it apart / put it
// together" (Gitea #44, PR D phase 2).
//
// PURE: no three.js, no React, no DOM. The viewer owns a `s ∈ [0,1]` scalar
// (1 = seated, 0 = fully taken apart) and asks this module, once per module per
// frame, where that module's GROUP should sit. Everything here is arithmetic on
// numbers, so the whole feel of the animation is unit-testable.
//
// Coordinates: the group-local frame is the EXPLODED render's frame, Z-up (the
// module groups live under `centered`, before the model's −90° X rotation). So
//   • −X  … toward the anchor module (seating pulls module i back by i·gap)
//   • −Y  … BEHIND the chain (the rear-entry side of a sliding dovetail)
//   • +Z  … above the chain (where a vertical-snap module hovers before it drops)
// A module's pose is an OFFSET from its exploded position: (0,0,0) is where the
// render already put it, (−i·gap, 0, 0) is seated. `rotY` is a rotation about
// the +Y axis applied to the group; with the pivot correction below, the
// module visibly rotates about its own seam-side bottom line, not the origin.
//
// Physical semantics (this is the point of the feature — see the assembly note
// in abacus-module-kit.ts, and abacus.scad's two seam topologies):
//   • sliding_dovetail — the module cannot drop in; it lines up BEHIND its seat
//     and slides forward (+Y) onto the rail until the detent clicks over the
//     front stop.
//   • vertical_snap — a straight drop is NOT how these mate. The seat wedge
//     pinches the dovetail post to a razor sliver at its foot (abacus.scad
//     sc_seated_post — "slide-through is impossible" and even drop-through is
//     meant to start thin), so the real move is hook-and-roll: hold the column
//     tilted ~40–45° laterally, hook the sliver into the pocket mouth, then
//     ROLL upright into place — the 45° seat wedge is exactly the arc the roll
//     traces. The crossbar clips click at the very end.
// Taking apart is the same timeline run backwards (and faster): the reverse of
// "slide forward and click" is a rearward tug, the reverse of "hook, roll and
// snap" is tilt away and lift off.

import type { JointType } from './abacus-model'

/** View constants — the feel of the animation, in one place. */
export const ASSEMBLY = {
  /** how long ONE module takes to travel its whole path, ms */
  perModuleMs: 600,
  /** module i+1 starts this far into module i's window (so they overlap) */
  staggerFraction: 0.55,
  /** taking apart runs the same timeline backwards, this much faster */
  apartSpeed: 1.6,
  /** sliding_dovetail: how far behind the seat the module lines up, × depth */
  slideBehindFactor: 1,
  /** vertical_snap: how high above the seat the module hovers, × depth */
  liftFactor: 0.6,
  /** the detent: how far past the stop the module flicks before settling, mm */
  clickOvershootMm: 0.5,
  /** ceiling on a whole play, ms. The choreography is normalised to [0,1], so a
   *  long chain just runs the SAME dance faster rather than holding the pill
   *  hostage: 21 columns would otherwise be 7.2 s (and 4.5 s to come apart). */
  maxTotalMs: 3600,
  /** phase A (line up off the seat) ends here in a module's local progress */
  approachFraction: 0.4,
  /** …and the detent lands here, leaving the tail of the window to settle */
  clickAt: 0.94,
  /** vertical_snap hook-and-roll: the lateral tilt (deg) at first mating */
  tiltDeg: 42,
  /** …the tilt ramps in over the tail of phase A, starting this far through
   *  it — so the column reaches full tilt exactly as mating begins */
  tiltInAt: 0.55,
  /** phase B holds the full tilt until here (the sliver engages the pocket)… */
  tiltHoldUntil: 0.25,
  /** …and the column has rolled upright by here, well before the clip click */
  tiltOutAt: 0.6,
} as const

export type Vec3 = { x: number; y: number; z: number }
/** a module's group pose: the offset from its exploded pose, plus the roll */
export type ModulePose = Vec3 & { rotY: number }
/** a module's slice of the normalised [0,1] timeline */
export type AssemblyWindow = { start: number; end: number }
/** what a group's local frame needs from the design: EXPLODE_GAP and outerD */
export type AssemblyDims = { gap: number; depth: number }

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
/** −0 is a real float and `toEqual({x: 0})` knows it; keep the poses clean */
const vec = (x: number, y: number, z: number): Vec3 => ({ x: x + 0, y: y + 0, z: z + 0 })
const pose = (x: number, y: number, z: number, rotY = 0): ModulePose => ({
  ...vec(x, y, z),
  rotY: rotY + 0,
})
const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2) * (-2 * t + 2)) / 2
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t)

/** module 0 is the anchor and never moves, so cols−1 modules travel. */
export function movingModules(cols: number): number {
  return Math.max(0, cols - 1)
}

/**
 * Wall-clock length of a full assembly play (s: 0 → 1) for a chain of `cols`
 * modules. Windows overlap, so N modules cost far less than N × perModuleMs.
 */
export function timelineMs(cols: number): number {
  const n = movingModules(cols)
  if (n <= 0) return 0
  const full = ASSEMBLY.perModuleMs * (1 + (n - 1) * ASSEMBLY.staggerFraction)
  return Math.min(full, ASSEMBLY.maxTotalMs)
}

/**
 * Module `i`'s slice of the normalised timeline. Module 0 gets the degenerate
 * window {0,0} (it never moves); module 1 starts at 0 and the last module ends
 * at exactly 1, so a play is over precisely when the last module clicks home.
 * Indices past the chain (the viewer's group pool only grows) park at {1,1}.
 */
export function moduleWindow(i: number, cols: number): AssemblyWindow {
  const n = movingModules(cols)
  if (i <= 0 || n <= 0) return { start: 0, end: 0 }
  const total = 1 + (n - 1) * ASSEMBLY.staggerFraction
  const start = ((i - 1) * ASSEMBLY.staggerFraction) / total
  if (start >= 1) return { start: 1, end: 1 }
  return { start, end: Math.min(start + 1 / total, 1) }
}

/** module i's local progress at global timeline position `s` */
function localProgress(i: number, cols: number, s: number): number {
  const { start, end } = moduleWindow(i, cols)
  if (end <= start) return s >= end ? 1 : 0
  return clamp01((s - start) / (end - start))
}

/**
 * Phase B along the joint axis: travel from `from` (behind/above the seat) to
 * the seat at 0, overshooting to `peak` at ASSEMBLY.clickAt and settling back.
 * `peak` is on the far side of 0 from `from` — that flick IS the detent.
 */
function seatWithClick(b: number, from: number, peak: number): number {
  const A = ASSEMBLY.approachFraction
  const bClick = (ASSEMBLY.clickAt - A) / (1 - A)
  if (b <= bClick) return from + (peak - from) * easeInOut(bClick > 0 ? b / bClick : 1)
  return peak * (1 - easeOut((b - bClick) / (1 - bClick)))
}

/** the hook-and-roll tilt schedule: 0 upright … tiltRad fully tilted */
function snapTilt(u: number, tiltRad: number): number {
  const A = ASSEMBLY.approachFraction
  if (u <= A) {
    // ramp in over the tail of the approach: full tilt exactly at first mating
    const t = A > 0 ? u / A : 1
    return tiltRad * easeInOut(clamp01((t - ASSEMBLY.tiltInAt) / (1 - ASSEMBLY.tiltInAt)))
  }
  // hold while the sliver engages, then roll upright well before the click
  const b = (u - A) / (1 - A)
  const t = clamp01((b - ASSEMBLY.tiltHoldUntil) / (ASSEMBLY.tiltOutAt - ASSEMBLY.tiltHoldUntil))
  return tiltRad * (1 - easeInOut(t))
}

/**
 * Where module `i`'s group sits at global timeline position `s`
 * (0 = fully taken apart, 1 = seated), as an offset from its exploded pose.
 * `x0` is the module's seam-side (left) face X in the group's local frame —
 * the line the vertical_snap roll pivots about; sliding_dovetail ignores it.
 *
 * Two phases per module, so the path reads as a real assembly move rather than
 * a slide through solid plastic:
 *   A (u ≤ approachFraction) — travel to the staging point: seated in X, but
 *     still `depth` behind the seat (sliding) or `liftFactor·depth` above it
 *     (snap). A snap module also rolls to its full tilt over A's tail, so it
 *     arrives at the pocket already hooked. Nothing is ever inside anything
 *     else.
 *   B (the rest) — close the joint: the slide runs the one legal axis straight
 *     home; the snap holds its tilt while the sliver engages, rolls upright
 *     about the seam-side bottom line, and both end on the detent click.
 *
 * The roll is returned as `rotY` (rotation about +Y). The group would rotate
 * about its own origin, so the x/z offsets carry the correction that pins the
 * pivot line (x0, z=0): position += P − R_y(rotY)·P for P = (x0, 0, 0), i.e.
 * x += x0·(1−cos), z += x0·sin. The seam-side bottom corner therefore traces
 * the plain approach-and-drop path while the body hangs off the roll — hook
 * the corner, swing the column.
 */
export function modulePose(
  joint: JointType,
  i: number,
  cols: number,
  s: number,
  dims: AssemblyDims,
  x0 = 0
): ModulePose {
  if (i <= 0) return pose(0, 0, 0)
  const u = localProgress(i, cols, s)
  const seatX = -i * dims.gap
  const A = ASSEMBLY.approachFraction

  if (joint === 'sliding_dovetail') {
    const stage = -dims.depth * ASSEMBLY.slideBehindFactor
    if (u <= A) {
      // phase A: line up behind the seat (x closes, −Y opens)
      const a = easeInOut(A > 0 ? u / A : 1)
      return pose(seatX * a, stage * a, 0)
    }
    // phase B: x is home; slide forward with the detent click
    const b = (u - A) / (1 - A)
    return pose(seatX, seatWithClick(b, stage, ASSEMBLY.clickOvershootMm), 0)
  }

  // vertical_snap: hook-and-roll about the seam-side bottom line
  const lift = dims.depth * ASSEMBLY.liftFactor
  const rotY = snapTilt(u, (ASSEMBLY.tiltDeg * Math.PI) / 180)
  let base: Vec3
  if (u <= A) {
    // phase A: close X and lift the column, rolling to full tilt at the end
    const a = easeInOut(A > 0 ? u / A : 1)
    base = vec(seatX * a, 0, lift * a)
  } else {
    // phase B: the hooked sliver descends; the roll finishes, then the click
    const b = (u - A) / (1 - A)
    base = vec(seatX, 0, seatWithClick(b, lift, -ASSEMBLY.clickOvershootMm * 0.5))
  }
  if (rotY === 0) return pose(base.x, base.y, base.z)
  const cos = Math.cos(rotY)
  const sin = Math.sin(rotY)
  return pose(base.x + x0 * (1 - cos), base.y, base.z + x0 * sin, rotY)
}

/** an in-flight play of the timeline; `t0`/`now` are performance.now() ms */
export type Motion = { from: number; to: number; t0: number; durationMs: number }

/**
 * Plan a play from `from` to `to`. Duration is proportional to the distance
 * travelled (so an interrupted move keeps one constant speed), and taking
 * apart runs apartSpeed× faster. `prefers-reduced-motion: reduce` → 0 ms, i.e.
 * `s` jumps straight to the end pose on the next frame.
 */
export function planMotion(
  from: number,
  to: number,
  cols: number,
  opts: { now: number; reducedMotion?: boolean }
): Motion {
  const dist = Math.abs(to - from)
  const full = opts.reducedMotion ? 0 : timelineMs(cols) * dist
  const durationMs = to < from ? full / ASSEMBLY.apartSpeed : full
  return { from, to, t0: opts.now, durationMs }
}

/** Sample a motion at `now`. `done` means the caller should drop it. */
export function sampleMotion(m: Motion, now: number): { s: number; done: boolean } {
  if (!(m.durationMs > 0)) return { s: m.to, done: true }
  const t = (now - m.t0) / m.durationMs
  if (t >= 1) return { s: m.to, done: true }
  if (t <= 0) return { s: m.from, done: false }
  return { s: m.from + (m.to - m.from) * t, done: false }
}
