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
// render already put it, (−i·gap, 0, 0) is seated.
//
// Physical semantics (this is the point of the feature — see the assembly note
// in abacus-module-kit.ts, and abacus.scad's two seam topologies):
//   • sliding_dovetail — the module cannot drop in; it lines up BEHIND its seat
//     and slides forward (+Y) onto the rail until the detent clicks over the
//     front stop.
//   • vertical_snap — the module comes down from ABOVE (−Z) and the clips snap
//     past their catches.
// Taking apart is the same timeline run backwards (and faster): the reverse of
// "slide forward and click" is a rearward tug, the reverse of "drop and snap"
// is a lift.

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
} as const

export type Vec3 = { x: number; y: number; z: number }
/** a module's slice of the normalised [0,1] timeline */
export type AssemblyWindow = { start: number; end: number }
/** what a group's local frame needs from the design: EXPLODE_GAP and outerD */
export type AssemblyDims = { gap: number; depth: number }

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
/** −0 is a real float and `toEqual({x: 0})` knows it; keep the poses clean */
const vec = (x: number, y: number, z: number): Vec3 => ({ x: x + 0, y: y + 0, z: z + 0 })
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

/**
 * Where module `i`'s group sits at global timeline position `s`
 * (0 = fully taken apart, 1 = seated), as an offset from its exploded pose.
 *
 * Two phases per module, so the path reads as a real assembly move rather than
 * a slide through solid plastic:
 *   A (u ≤ approachFraction) — travel to the staging point: seated in X, but
 *     still `depth` behind the seat (sliding) or `liftFactor·depth` above it
 *     (snap). Nothing is ever inside anything else.
 *   B (the rest) — close the joint along its one legal axis, with the detent
 *     click at the end.
 */
export function modulePose(
  joint: JointType,
  i: number,
  cols: number,
  s: number,
  dims: AssemblyDims
): Vec3 {
  if (i <= 0) return vec(0, 0, 0)
  const u = localProgress(i, cols, s)
  const seatX = -i * dims.gap
  const A = ASSEMBLY.approachFraction
  const sliding = joint === 'sliding_dovetail'
  const stage = sliding
    ? -dims.depth * ASSEMBLY.slideBehindFactor
    : dims.depth * ASSEMBLY.liftFactor

  if (u <= A) {
    // phase A: line up off the seat (x closes, the joint axis opens)
    const a = easeInOut(A > 0 ? u / A : 1)
    const off = stage * a
    return sliding ? vec(seatX * a, off, 0) : vec(seatX * a, 0, off)
  }
  // phase B: x is home; close the joint with a click
  const b = (u - A) / (1 - A)
  const over = sliding ? ASSEMBLY.clickOvershootMm : -ASSEMBLY.clickOvershootMm * 0.5
  const along = seatWithClick(b, stage, over)
  return sliding ? vec(seatX, along, 0) : vec(seatX, 0, along)
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
