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
//   • −X / +X  … along the chain (modules close on the anchor from BOTH sides)
//   • −Y  … BEHIND the chain (the rear-entry side of a sliding dovetail)
//   • +Z  … above the chain (where a vertical-snap module hovers before it drops)
// A module's pose is an OFFSET from its exploded position: seated is always
// (−i·gap, 0, 0). Fully apart every module carries the same constant offset
// E = −anchor·gap, which is what re-centres the exploded strip on the anchor —
// the viewer measures the chain's true extent every frame, so a constant
// shift of the whole strip is invisible and s = 0 stays pixel-identical to
// the exploded render. `rotY` is a rotation about the +Y axis applied to the
// group; with the pivot correction below, the module visibly rotates about
// its own seam-side bottom line, not the origin.
//
// The anchor is the CENTRE module (anchorModule), not an end: on a wide abacus
// the slow, legible part of the dance must happen where the viewer is looking.
// Travelling modules seat centre-out, alternating right-then-left by distance
// from the anchor (travelOrder), and the schedule is keyed by that ORDER — the
// first two travellers get the slow windows wherever they sit. Taking apart
// is the SAME schedule played in reverse (s sweeps 1→0) — the kinematics
// demand it: a module can only unhook from a FREE end of the chain (a middle
// module is hooked to both neighbours; pulling it out of the middle drags it
// through them), so disassembly peels the ends first, fast, and converges on
// the anchor, ending with the slow deliberate unhooking of the final centre
// pair — the legible beat still plays at the visual centre, where the
// shrinking chain has dragged the viewer's eye.
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
//     tilted ~40–45° leaning OVER the seated part (top toward the anchor),
//     hook the sliver into the pocket mouth, then ROLL it back upright into
//     place — the top swings away from the anchor as it closes, and the 45°
//     seat wedge is exactly the arc the roll traces. The crossbar clips
//     click at the very end.
// Taking apart is the exact reverse of putting together (and apartSpeed×
// faster): the reverse of "slide forward and click" is a rearward tug, the
// reverse of "lean over, hook and roll back" is lean over and lift off — and
// the reverse of centre-out seating is ends-in peeling, so the slow centre
// pair is the LAST thing to come apart, never the first (user review
// 2026-09-10: pulling a module out of the middle first breaks the kinematics).

import type { JointType } from './abacus-model'

/** View constants — the feel of the animation, in one place. */
export const ASSEMBLY = {
  /** the FIRST TWO travelling modules each get this full, deliberate
   *  window — slow enough to read the hook and the roll (4× the original
   *  600 ms a module used to get) */
  slowModuleMs: 2400,
  /** module i+1 starts this far into module i's window (so they overlap) */
  staggerFraction: 0.55,
  /** taking apart runs the same timeline backwards, this much faster */
  apartSpeed: 1.6,
  /** sliding_dovetail: how far beyond the NARROW entry the module lines up, × depth */
  slideBehindFactor: 1,
  /** vertical_snap: how high above the seat the module hovers, × depth */
  liftFactor: 0.6,
  /** the detent: how far past the stop the module flicks before settling, mm */
  clickOvershootMm: 0.5,
  /** modules from the third travelling module on get this brisk window —
   *  never shorter, so every module stays legible; the OVERLAP tightens to
   *  absorb the compression as the chain grows */
  fastModuleMs: 1200,
  /** constant wall-clock budget for a whole play, ms: the first two modules
   *  play slowly, the rest speed up to fit. = slowModuleMs·(1+2·stagger) —
   *  exactly three slow windows — so a 4-column abacus takes ~4× the
   *  original dance and a 21-column chain never takes longer */
  budgetMs: 5040,
  /** phase A (line up off the seat) ends here in a module's local progress */
  approachFraction: 0.4,
  /** …and the detent lands here, leaving the tail of the window to settle */
  clickAt: 0.94,
  /** vertical_snap hook-and-roll: the lateral tilt (deg) at first mating */
  tiltDeg: 42,
  /** …the tilt ramps in over the approach, starting this far through it —
   *  early enough that the approach itself reads as "carrying a tilted
   *  column" — and reaches full tilt exactly as mating begins */
  tiltInAt: 0.15,
  /** phase B holds the full tilt until here, while the sliver slides home… */
  tiltHoldUntil: 0.3,
  /** …and the column has rolled upright by here. The roll is the slow,
   *  deliberate beat of the mate: by then the pivot corner is already at
   *  its resting height, so it reads as ROTATION, not descent */
  tiltOutAt: 0.85,
  /** the hooked sliver has slid fully home by this far through phase B —
   *  from here to the clip press the pivot corner barely moves */
  hookDescentEnd: 0.45,
  /** …leaving the pivot this far (mm) above the seat until the clip press */
  hookRestMm: 1.2,
  /** the clip press is a short sharp beat, this wide (fraction of phase B),
   *  ending exactly at clickAt — the clips snap in the last mm */
  clickDipSpan: 0.05,
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

/**
 * The anchor is the centre module — the one that never travels. On an even
 * column count the anchor sits just left of centre (the right side is the
 * longer one, which is why the travel order alternates right-then-left).
 * Pinning the dance to the middle keeps the slow, legible beat on screen for
 * wide abaci; an edge anchor puts it off the side of the frame (user review
 * 2026-09-10).
 */
export function anchorModule(cols: number): number {
  return Math.max(0, Math.floor((cols - 1) / 2))
}

/** the anchor never moves, so cols−1 modules travel. */
export function movingModules(cols: number): number {
  return Math.max(0, cols - 1)
}

/**
 * Module `i`'s 1-based position in the travel order (0 = the anchor, which
 * never travels). Centre-out by distance, alternating right-then-left: for
 * cols = 4 (anchor 1) the order is 2, 0, 3; for cols = 12 (anchor 5) it is
 * 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11. Right-first always works: the right
 * side is never the shorter one.
 */
function travelPosition(i: number, anchor: number): number {
  if (i === anchor) return 0
  const d = Math.abs(i - anchor)
  return i > anchor ? 2 * d - 1 : 2 * d
}

/** the moving module indices in the order they seat (anchor excluded). */
export function travelOrder(cols: number): number[] {
  const anchor = anchorModule(cols)
  const order: number[] = []
  for (let d = 1; d < cols; d++) {
    if (anchor + d < cols) order.push(anchor + d)
    if (anchor - d >= 0) order.push(anchor - d)
  }
  return order
}

/**
 * Wall-clock length of a full assembly play (s: 0 → 1) for a chain of `cols`
 * modules. Up to three travelling modules the play is the slow dance at the
 * stagger cadence (a 4-column abacus lands exactly on the budget); past that
 * the tail speeds up and the total holds at budgetMs forever.
 */
export function timelineMs(cols: number): number {
  const n = movingModules(cols)
  if (n <= 0) return 0
  const full = ASSEMBLY.slowModuleMs * (1 + (n - 1) * ASSEMBLY.staggerFraction)
  return Math.min(full, ASSEMBLY.budgetMs)
}

/**
 * Module `i`'s slice of the normalised timeline. The anchor gets the
 * degenerate window {0,0} (it never moves); the FIRST module in the travel
 * order starts at 0 and the last ends at exactly 1, so a play is over
 * precisely when the last module clicks home. Indices past the chain (the
 * viewer's group pool only grows) park at {1,1}.
 *
 * The schedule is deliberately NOT uniform: the first two travellers (the
 * centre-out pair bracketing the anchor — the first thing the viewer
 * watches) get the full slow window at the stagger cadence; from the third
 * traveller on — only when there IS a third, i.e. n ≥ 4 — windows are brisk
 * and their overlap tightens so the last module lands exactly on the budget.
 *
 * Taking apart plays this same schedule with s sweeping 1→0, so modules
 * unhook in the EXACT reverse of the order they seat — the ends first (fast),
 * the slow centre pair last. That reversal is not a choice, it's the
 * kinematics: only a free end of the chain can unhook (user review
 * 2026-09-10).
 */
export function moduleWindow(i: number, cols: number): AssemblyWindow {
  const n = movingModules(cols)
  const k = travelPosition(i, anchorModule(cols))
  if (k <= 0 || n <= 0) return { start: 0, end: 0 }
  if (k > n) return { start: 1, end: 1 }
  const total = timelineMs(cols)
  const slowStart = (m: number) => (m - 1) * ASSEMBLY.staggerFraction * ASSEMBLY.slowModuleMs
  let w: AssemblyWindow
  if (n <= 3 || k <= 2) {
    const startMs = slowStart(k)
    if (startMs >= total) return { start: 1, end: 1 }
    w = { start: startMs / total, end: (startMs + ASSEMBLY.slowModuleMs) / total }
  } else {
    const tail = n - 2 // travellers 3..n share the fast tail
    const step = (ASSEMBLY.budgetMs - slowStart(3) - ASSEMBLY.fastModuleMs) / (tail - 1)
    const startMs = slowStart(3) + (k - 3) * step
    if (startMs >= total) return { start: 1, end: 1 }
    w = { start: startMs / total, end: Math.min((startMs + ASSEMBLY.fastModuleMs) / total, 1) }
  }
  return w
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
 * The vertical_snap pivot-corner height through phase B. Unlike the sliding
 * joint's long eased descent, the hook drops fast: the sliver slides down the
 * pocket's flared mouth at full tilt and is home by hookDescentEnd, leaving
 * the pivot a hair above the seat. From there to the press the pivot barely
 * moves — the mate IS the roll — and the last beat is the short firm press
 * that snaps the crossbar clips (the dip), then settles.
 */
function hookZ(b: number, lift: number, peak: number): number {
  const rest = ASSEMBLY.hookRestMm
  const bClick = (ASSEMBLY.clickAt - ASSEMBLY.approachFraction) / (1 - ASSEMBLY.approachFraction)
  if (b <= ASSEMBLY.hookDescentEnd) {
    return lift + (rest - lift) * easeInOut(clamp01(b / ASSEMBLY.hookDescentEnd))
  }
  const dipStart = bClick - ASSEMBLY.clickDipSpan
  if (b <= dipStart) return rest
  if (b <= bClick) return rest + (peak - rest) * easeInOut((b - dipStart) / (bClick - dipStart))
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
 * `x0` is the module's SEAM-side face X in the group's local frame — the
 * bottom line the vertical_snap roll pivots about (the left face for modules
 * right of the anchor, the right face for modules left of it; the caller
 * picks). sliding_dovetail ignores it.
 *
 * Every offset is measured from the exploded render, and the constant
 * `home = −anchor·gap` is the anchor's own offset: fully apart, ALL modules
 * carry it (the exploded strip re-centred on the anchor — invisible under
 * the viewer's per-frame extent centring, so s = 0 is still pixel-identical
 * to the render); seated, module i carries exactly −i·gap as it always has.
 * The anchor itself sits at `home` for the whole play.
 *
 * Two phases per module, so the path reads as a real assembly move rather than
 * a slide through solid plastic:
 *   A (u ≤ approachFraction) — travel to the staging point: seated in X, but
 *     still `depth` beyond the narrow entry (sliding) or `liftFactor·depth` above it
 *     (snap). A snap module also leans to its full tilt — over the seated
 *     part, top toward the anchor (NEGATIVE rotY for right-side modules,
 *     POSITIVE for left-side ones) — over A's tail, so it arrives at the
 *     pocket already hooked. Nothing is ever inside anything else.
 *   B (the rest) — close the joint: the slide runs the one legal axis straight
 *     home; the snap slides the sliver home at full tilt, ROLLS back upright
 *     about the seam-side bottom line (the top swinging away from the anchor —
 *     nearly pure rotation, the pivot already at its resting height), and both
 *     end on the detent/clip click.
 *
 * The roll is returned as `rotY` (rotation about +Y). The group would rotate
 * about its own origin, so the x/z offsets carry the correction that pins the
 * pivot line (x0, z=0): position += P − R_y(rotY)·P for P = (x0, 0, 0), i.e.
 * x += x0·(1−cos), z += x0·sin — sign-agnostic, so the mirrored roll about
 * the right face needs no special case. The seam-side bottom corner therefore
 * traces the plain approach-and-drop path while the body hangs off the roll —
 * hook the corner, swing the column.
 */
export function modulePose(
  joint: JointType,
  i: number,
  cols: number,
  s: number,
  dims: AssemblyDims,
  x0 = 0
): ModulePose {
  const anchor = anchorModule(cols)
  const home = -anchor * dims.gap
  if (i === anchor) return pose(home, 0, 0)
  if (i < 0 || i >= cols) return pose(0, 0, 0) // parked pool group: never moves
  const u = localProgress(i, cols, s)
  const seatX = -i * dims.gap
  const A = ASSEMBLY.approachFraction

  if (joint === 'sliding_dovetail') {
    // The graduated rail enters at its NARROW end. Its wide deep-anchor
    // section is the LAST part to reach the berth, so the visible insertion
    // runs from +Y toward the seated origin — not from −Y toward it (user
    // review 2026-09-10). Apart is this exact path in reverse.
    const stage = dims.depth * ASSEMBLY.slideBehindFactor
    if (u <= A) {
      // phase A: line up beyond the narrow entry (x closes, +Y opens)
      const a = easeInOut(A > 0 ? u / A : 1)
      return pose(home + (seatX - home) * a, stage * a, 0)
    }
    // phase B: slide toward the wide anchor, crossing its final detent
    const b = (u - A) / (1 - A)
    return pose(seatX, seatWithClick(b, stage, -ASSEMBLY.clickOvershootMm), 0)
  }

  // vertical_snap: hook-and-roll about the seam-side bottom line. The tilt
  // leans the column OVER the seated part, top toward the anchor — negative
  // rotY for modules approaching from the right, positive from the left —
  // and the roll swings the top away from the anchor as the body closes.
  const lift = dims.depth * ASSEMBLY.liftFactor
  const tiltRad = (ASSEMBLY.tiltDeg * Math.PI) / 180
  const rotY = snapTilt(u, i > anchor ? -tiltRad : tiltRad)
  let base: Vec3
  if (u <= A) {
    // phase A: close X and lift the column, rolling to full tilt at the end
    const a = easeInOut(A > 0 ? u / A : 1)
    base = vec(home + (seatX - home) * a, 0, lift * a)
  } else {
    // phase B: the sliver slides home at full tilt, the ROLL does the
    // mating (nearly pure rotation about the hooked corner), then the press
    const b = (u - A) / (1 - A)
    base = vec(seatX, 0, hookZ(b, lift, -ASSEMBLY.clickOvershootMm * 0.5))
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
