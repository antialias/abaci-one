// abacus-assembly-motion — the joint-path timeline (Gitea #44, PR D phase 2).
//
// This is where the FEEL of "take it apart / put it together" is pinned: the
// stagger, the two-phase path per joint topology, the detent click, and the
// reduced-motion escape hatch. Pure arithmetic, so all of it is testable
// without three.js, a canvas or a render.

import { describe, expect, it } from 'vitest'
import {
  ASSEMBLY,
  type AssemblyDims,
  modulePose,
  moduleWindow,
  movingModules,
  planMotion,
  sampleMotion,
  timelineMs,
} from '../abacus-assembly-motion'

const DIMS: AssemblyDims = { gap: 12, depth: 80 }
/** sample the whole timeline finely enough to catch an excursion */
const SAMPLES = Array.from({ length: 401 }, (_, k) => k / 400)
const len = (w: { start: number; end: number }) => w.end - w.start
/** the global `s` at which module i is `u` through its own window */
const at = (i: number, cols: number, u: number) => {
  const w = moduleWindow(i, cols)
  return w.start + u * len(w)
}

describe('moduleWindow', () => {
  it('gives module 0 a degenerate window — the anchor never moves', () => {
    for (const cols of [1, 2, 5, 13]) expect(moduleWindow(0, cols)).toEqual({ start: 0, end: 0 })
  })

  it('starts the first travelling module at 0 and lands the last exactly on 1', () => {
    for (const cols of [2, 3, 5, 13]) {
      expect(moduleWindow(1, cols).start).toBe(0)
      expect(moduleWindow(cols - 1, cols).end).toBeCloseTo(1, 12)
    }
  })

  it('plays the first two modules slowly and uniformly at the stagger cadence', () => {
    for (const cols of [3, 5, 13, 21]) {
      const total = timelineMs(cols)
      const a = moduleWindow(1, cols)
      const b = moduleWindow(2, cols)
      expect(a.start).toBe(0)
      expect(len(a)).toBeCloseTo(ASSEMBLY.slowModuleMs / total, 12)
      expect(len(b)).toBeCloseTo(ASSEMBLY.slowModuleMs / total, 12)
      // module 2 starts staggerFraction of a slow window in, so they are in
      // flight together for the remaining 45%
      expect(b.start - a.start).toBeCloseTo(
        (ASSEMBLY.staggerFraction * ASSEMBLY.slowModuleMs) / total,
        12
      )
      expect(b.start).toBeLessThan(a.end)
    }
  })

  it('runs the tail briskly inside the budget — ordered, overlapping, landing on 1', () => {
    const cols = 13
    const total = timelineMs(cols)
    expect(total).toBe(ASSEMBLY.budgetMs)
    for (let i = 3; i < cols - 1; i++) {
      const a = moduleWindow(i, cols)
      const b = moduleWindow(i + 1, cols)
      // every tail module keeps the full brisk window — the OVERLAP tightens
      expect(len(a)).toBeCloseTo(ASSEMBLY.fastModuleMs / total, 12)
      expect(b.start).toBeGreaterThan(a.start)
      expect(b.end).toBeGreaterThan(a.end)
      expect(b.start).toBeLessThan(a.end) // tighter overlap, never a gap
    }
  })

  it('gives a 2-module chain the whole timeline', () => {
    expect(moduleWindow(1, 2)).toEqual({ start: 0, end: 1 })
  })

  it('parks indices past the chain (the viewer group pool only grows)', () => {
    const w = moduleWindow(40, 4)
    expect(w).toEqual({ start: 1, end: 1 })
  })

  it('is degenerate for a mono design', () => {
    expect(movingModules(1)).toBe(0)
    expect(moduleWindow(1, 1)).toEqual({ start: 0, end: 0 })
    expect(timelineMs(1)).toBe(0)
    expect(timelineMs(0)).toBe(0)
  })

  it('is the slow dance up to three modules, then holds the budget forever', () => {
    expect(timelineMs(2)).toBeCloseTo(ASSEMBLY.slowModuleMs, 9)
    expect(timelineMs(3)).toBeCloseTo(ASSEMBLY.slowModuleMs * (1 + ASSEMBLY.staggerFraction), 9)
    // a 4-column abacus: exactly three slow windows = the budget, ~4× the
    // original 1260 ms dance (user review: the sequences were far too fast)
    expect(ASSEMBLY.budgetMs).toBeCloseTo(
      ASSEMBLY.slowModuleMs * (1 + 2 * ASSEMBLY.staggerFraction),
      9
    )
    expect(timelineMs(4)).toBe(ASSEMBLY.budgetMs)
    expect(timelineMs(13)).toBe(ASSEMBLY.budgetMs)
    expect(timelineMs(21)).toBe(ASSEMBLY.budgetMs)
  })

  it('never exceeds the budget, however wide the chain — and still comes apart fast', () => {
    expect(moduleWindow(20, 21).end).toBeCloseTo(1, 12)
    expect(timelineMs(21) / ASSEMBLY.apartSpeed).toBeLessThan(4000)
  })
})

describe('modulePose — the two end poses', () => {
  for (const joint of ['sliding_dovetail', 'vertical_snap'] as const) {
    it(`${joint}: s=0 is the exploded render itself (no offset at all)`, () => {
      for (let i = 0; i < 13; i++) {
        expect(modulePose(joint, i, 13, 0, DIMS)).toEqual({ x: 0, y: 0, z: 0, rotY: 0 })
      }
    })

    it(`${joint}: s=1 is seated — module i pulled back exactly i·gap`, () => {
      for (let i = 0; i < 13; i++) {
        const q = modulePose(joint, i, 13, 1, DIMS)
        expect(q.x).toBeCloseTo(-i * DIMS.gap, 10)
        expect(q.y).toBeCloseTo(0, 10)
        expect(q.z).toBeCloseTo(0, 10)
      }
    })

    it(`${joint}: module 0 is the anchor at EVERY point of the timeline`, () => {
      for (const s of SAMPLES)
        expect(modulePose(joint, 0, 13, s, DIMS)).toEqual({ x: 0, y: 0, z: 0, rotY: 0 })
    })

    it(`${joint}: x closes monotonically and never passes the seat`, () => {
      for (const i of [1, 4, 12]) {
        let prev = 0
        for (const s of SAMPLES) {
          const { x } = modulePose(joint, i, 13, s, DIMS)
          expect(x).toBeLessThanOrEqual(prev + 1e-9)
          expect(x).toBeGreaterThanOrEqual(-i * DIMS.gap - 1e-9)
          prev = x
        }
      }
    })
  }
})

describe('modulePose — sliding_dovetail enters from behind', () => {
  const pose = (i: number, u: number) => modulePose('sliding_dovetail', i, 5, at(i, 5, u), DIMS)

  it('lines up BEHIND the seat (−Y), aligned in X, before it slides', () => {
    const q = pose(2, ASSEMBLY.approachFraction)
    expect(q.x).toBeCloseTo(-2 * DIMS.gap, 10) // already in its column
    expect(q.y).toBeCloseTo(-DIMS.depth * ASSEMBLY.slideBehindFactor, 10) // a full depth back
    expect(q.z).toBe(0)
  })

  it('slides forward (+Y) through phase B with x parked on the seat', () => {
    let prev = pose(2, ASSEMBLY.approachFraction).y
    for (let u = 0.45; u <= ASSEMBLY.clickAt; u += 0.02) {
      const q = pose(2, u)
      expect(q.x).toBeCloseTo(-2 * DIMS.gap, 10)
      expect(q.y).toBeGreaterThan(prev)
      prev = q.y
    }
  })

  it('clicks over the front stop and settles onto it', () => {
    expect(pose(3, ASSEMBLY.clickAt).y).toBeCloseTo(ASSEMBLY.clickOvershootMm, 10)
    expect(pose(3, 1).y).toBeCloseTo(0, 10)
    // …and the settle comes back from the far side
    expect(pose(3, 0.97).y).toBeGreaterThan(0)
    expect(pose(3, 0.97).y).toBeLessThan(ASSEMBLY.clickOvershootMm)
  })

  it('never overshoots past the detent and never leaves the Y/X plane', () => {
    for (let i = 1; i < 5; i++) {
      for (const s of SAMPLES) {
        const q = modulePose('sliding_dovetail', i, 5, s, DIMS)
        expect(q.y).toBeLessThanOrEqual(ASSEMBLY.clickOvershootMm + 1e-9)
        expect(q.y).toBeGreaterThanOrEqual(-DIMS.depth - 1e-9)
        expect(q.z).toBe(0)
      }
    }
  })
})

describe('modulePose — vertical_snap hooks the sliver and rolls in', () => {
  const pose = (i: number, u: number) => modulePose('vertical_snap', i, 5, at(i, 5, u), DIMS)
  const tilt = (ASSEMBLY.tiltDeg * Math.PI) / 180
  const A = ASSEMBLY.approachFraction
  /** the local u at which phase B is `b` through itself */
  const atB = (b: number) => A + (1 - A) * b

  it('stages ABOVE the seat (+Z), aligned in X, fully tilted at first mating', () => {
    const q = pose(2, A)
    expect(q.x).toBeCloseTo(-2 * DIMS.gap, 10)
    expect(q.z).toBeCloseTo(DIMS.depth * ASSEMBLY.liftFactor, 10)
    expect(q.y).toBe(0)
    // "at the point they start mating you have to have the column rotated"
    // — leaning OVER the seated part (negative = top toward the anchor)
    expect(q.rotY).toBeCloseTo(-tilt, 12)
  })

  it('leans over the seated part over the approach — upright at the start, tilted at the pocket', () => {
    // (landing ON tiltInAt to the ulp is a float coin toss — pin the flat
    // region just before it, and the boundary only approximately)
    expect(pose(2, A * ASSEMBLY.tiltInAt * 0.999).rotY).toBe(0)
    expect(pose(2, A * ASSEMBLY.tiltInAt).rotY).toBeCloseTo(0, 12)
    const mid = pose(2, A * (ASSEMBLY.tiltInAt + (1 - ASSEMBLY.tiltInAt) / 2)).rotY
    expect(mid).toBeLessThan(0)
    expect(mid).toBeGreaterThan(-tilt)
    // the seam-side bottom corner (the x0 = 0 offset path) never reverses
    // while the body swings onto the tilt
    let prev = pose(2, 0)
    for (let u = 0.02; u <= A + 1e-9; u += 0.02) {
      const q = pose(2, Math.min(u, A))
      expect(q.x).toBeLessThanOrEqual(prev.x + 1e-9)
      expect(q.z).toBeGreaterThanOrEqual(prev.z - 1e-9)
      prev = q
    }
  })

  it('holds the tilt while the sliver engages, then rolls upright before the click', () => {
    expect(pose(2, atB(ASSEMBLY.tiltHoldUntil)).rotY).toBeCloseTo(-tilt, 12)
    const mid = pose(2, atB((ASSEMBLY.tiltHoldUntil + ASSEMBLY.tiltOutAt) / 2)).rotY
    expect(mid).toBeGreaterThan(-tilt)
    expect(mid).toBeLessThan(0)
    expect(pose(2, atB(ASSEMBLY.tiltOutAt)).rotY).toBe(0)
    expect(pose(2, ASSEMBLY.clickAt).rotY).toBe(0)
  })

  it('slides the sliver home early, parks the pivot through the roll, presses at the click', () => {
    // the hook descends only while the sliver slides in (the hold)
    let prev = pose(2, A).z
    for (let b = 0.02; b <= ASSEMBLY.hookDescentEnd + 1e-9; b += 0.02) {
      const z = pose(2, atB(Math.min(b, ASSEMBLY.hookDescentEnd))).z
      expect(z).toBeLessThan(prev)
      prev = z
    }
    // from there to the clip press the pivot barely moves — the mate IS the
    // roll, not a descent — with x parked on the seat throughout
    const rest = pose(2, atB(ASSEMBLY.hookDescentEnd)).z
    expect(rest).toBeCloseTo(ASSEMBLY.hookRestMm, 10)
    const bClick = (ASSEMBLY.clickAt - A) / (1 - A)
    for (let b = ASSEMBLY.hookDescentEnd; b <= bClick - ASSEMBLY.clickDipSpan + 1e-9; b += 0.02) {
      const q = pose(2, atB(b))
      expect(q.x).toBeCloseTo(-2 * DIMS.gap, 10)
      expect(q.z).toBeCloseTo(rest, 10)
    }
  })

  it('dips past the seat as the clips snap, then settles', () => {
    expect(pose(3, ASSEMBLY.clickAt).z).toBeCloseTo(-ASSEMBLY.clickOvershootMm * 0.5, 10)
    expect(pose(3, 1).z).toBeCloseTo(0, 10)
    expect(pose(3, 0.97).z).toBeLessThan(0)
  })

  it('never dips deeper than the click, never over-tilts, never leaves the Z/X plane', () => {
    for (let i = 1; i < 5; i++) {
      for (const s of SAMPLES) {
        const q = modulePose('vertical_snap', i, 5, s, DIMS)
        expect(q.z).toBeGreaterThanOrEqual(-ASSEMBLY.clickOvershootMm + 1e-9)
        expect(q.z).toBeLessThanOrEqual(DIMS.depth * ASSEMBLY.liftFactor + 1e-9)
        expect(q.y).toBe(0)
        expect(q.rotY).toBeLessThanOrEqual(0)
        expect(q.rotY).toBeGreaterThanOrEqual(-tilt - 1e-12)
      }
    }
  })

  it('pivots about the seam-side bottom line: x0 pins that line, wherever it is', () => {
    // the correction must make the WORLD position of the local point (x0,0,0)
    // independent of the pivot: group.pos + R_y(rotY)·(x0,0,0) is the same
    // whether the caller passes x0 (group rolls, origin swings) or 0 (the
    // offset IS the corner path). three.js R_y maps (x,0,0) to
    // (x·cos, 0, −x·sin), so: world = (q.x + x0·cos, q.y, q.z − x0·sin)
    const X0 = 137.5
    for (const s of SAMPLES) {
      const rolled = modulePose('vertical_snap', 2, 5, s, DIMS, X0)
      const plain = modulePose('vertical_snap', 2, 5, s, DIMS)
      expect(rolled.rotY).toBe(plain.rotY)
      expect(rolled.x + X0 * Math.cos(rolled.rotY)).toBeCloseTo(plain.x + X0, 9)
      expect(rolled.z - X0 * Math.sin(rolled.rotY)).toBeCloseTo(plain.z, 9)
      expect(rolled.y).toBe(plain.y)
    }
  })

  it('leaves the end poses untouched by the pivot (no tilt at either end)', () => {
    for (const s of [0, 1]) {
      expect(modulePose('vertical_snap', 2, 5, s, DIMS, 137.5)).toEqual(
        modulePose('vertical_snap', 2, 5, s, DIMS)
      )
    }
  })
})

describe('modulePose — the chain seats from the anchor outward', () => {
  it('has module 1 home before the last module has started', () => {
    const cols = 13
    const s = moduleWindow(1, cols).end
    expect(modulePose('sliding_dovetail', 1, cols, s, DIMS).x).toBeCloseTo(-DIMS.gap, 10)
    expect(modulePose('sliding_dovetail', 12, cols, s, DIMS)).toEqual({
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
    })
  })

  it('keeps earlier modules ahead of later ones all the way through', () => {
    const cols = 8
    for (const s of SAMPLES) {
      for (let i = 1; i < cols - 1; i++) {
        // progress as a fraction of that module's own travel
        const a = modulePose('vertical_snap', i, cols, s, DIMS).x / -(i * DIMS.gap)
        const b = modulePose('vertical_snap', i + 1, cols, s, DIMS).x / -((i + 1) * DIMS.gap)
        expect(a).toBeGreaterThanOrEqual(b - 1e-9)
      }
    }
  })
})

describe('planMotion / sampleMotion', () => {
  it('takes a full play to put a chain together', () => {
    const m = planMotion(0, 1, 5, { now: 1000 })
    expect(m.durationMs).toBeCloseTo(timelineMs(5), 9)
    expect(sampleMotion(m, 1000)).toEqual({ s: 0, done: false })
    expect(sampleMotion(m, 1000 + m.durationMs / 2).s).toBeCloseTo(0.5, 10)
    // (the frame that lands ON the end, to the ulp, is a float coin toss —
    // what matters is that the next one finishes it)
    expect(sampleMotion(m, 1000 + m.durationMs + 1)).toEqual({ s: 1, done: true })
  })

  it('takes it apart apartSpeed× faster', () => {
    const together = planMotion(0, 1, 5, { now: 0 })
    const apart = planMotion(1, 0, 5, { now: 0 })
    expect(apart.durationMs).toBeCloseTo(together.durationMs / ASSEMBLY.apartSpeed, 9)
    expect(sampleMotion(apart, apart.durationMs / 2).s).toBeCloseTo(0.5, 10)
    expect(sampleMotion(apart, apart.durationMs + 1)).toEqual({ s: 0, done: true })
  })

  it('holds one speed when a play is interrupted (duration scales with distance)', () => {
    const full = planMotion(0, 1, 9, { now: 0 })
    const half = planMotion(0.5, 1, 9, { now: 0 })
    expect(half.durationMs).toBeCloseTo(full.durationMs / 2, 9)
  })

  it('jumps under prefers-reduced-motion', () => {
    const m = planMotion(1, 0, 13, { now: 500, reducedMotion: true })
    expect(m.durationMs).toBe(0)
    expect(sampleMotion(m, 500)).toEqual({ s: 0, done: true })
    expect(sampleMotion(m, 0)).toEqual({ s: 0, done: true })
  })

  it('jumps on a mono design (no modules to stagger)', () => {
    const m = planMotion(1, 0, 1, { now: 0 })
    expect(m.durationMs).toBe(0)
    expect(sampleMotion(m, 0)).toEqual({ s: 0, done: true })
  })

  it('clamps a sample taken before the start', () => {
    const m = planMotion(0, 1, 5, { now: 1000 })
    expect(sampleMotion(m, 900)).toEqual({ s: 0, done: false })
  })
})
