// abacus-assembly-motion — the joint-path timeline (Gitea #44, PR D phase 2).
//
// This is where the FEEL of "take it apart / put it together" is pinned: the
// centre anchor, the centre-out travel order, the stagger, the two-phase path
// per joint topology, the detent click, the apart time-reversal (ends peel
// first, the slow centre pair last), and the
// reduced-motion escape hatch. Pure arithmetic, so all of it is testable
// without three.js, a canvas or a render.

import { describe, expect, it } from 'vitest'
import {
  ASSEMBLY,
  type AssemblyDims,
  anchorModule,
  modulePose,
  moduleWindow,
  movingModules,
  planMotion,
  sampleMotion,
  timelineMs,
  travelOrder,
} from '../abacus-assembly-motion'

const DIMS: AssemblyDims = { gap: 12, depth: 80 }
/** sample the whole timeline finely enough to catch an excursion */
const SAMPLES = Array.from({ length: 401 }, (_, k) => k / 400)
const len = (w: { start: number; end: number }) => w.end - w.start
/** the global `s` at which module i is `u` through its own (together) window */
const at = (i: number, cols: number, u: number) => {
  const w = moduleWindow(i, cols)
  return w.start + u * len(w)
}

describe('anchorModule / travelOrder', () => {
  it('anchors the centre module (just left of centre on an even count)', () => {
    expect(anchorModule(1)).toBe(0)
    expect(anchorModule(2)).toBe(0)
    expect(anchorModule(3)).toBe(1)
    expect(anchorModule(4)).toBe(1)
    expect(anchorModule(5)).toBe(2)
    expect(anchorModule(12)).toBe(5)
    expect(anchorModule(13)).toBe(6)
    expect(anchorModule(21)).toBe(10)
  })

  it('travels centre-out, alternating right-then-left by distance', () => {
    expect(travelOrder(1)).toEqual([])
    expect(travelOrder(2)).toEqual([1])
    expect(travelOrder(3)).toEqual([2, 0])
    expect(travelOrder(4)).toEqual([2, 0, 3])
    expect(travelOrder(12)).toEqual([6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11])
  })

  it('visits every non-anchor module exactly once', () => {
    for (const cols of [2, 3, 4, 5, 13, 21]) {
      const order = travelOrder(cols)
      expect(order.length).toBe(cols - 1)
      expect(new Set(order).size).toBe(cols - 1)
      expect(order).not.toContain(anchorModule(cols))
      for (const i of order) {
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(cols)
      }
    }
  })
})

describe('moduleWindow', () => {
  it('gives the anchor a degenerate window — it never moves', () => {
    for (const cols of [1, 2, 5, 13]) {
      expect(moduleWindow(anchorModule(cols), cols)).toEqual({ start: 0, end: 0 })
      expect(moduleWindow(anchorModule(cols), cols)).toEqual({ start: 0, end: 0 })
    }
  })

  it('starts the first traveller at 0 and lands the last exactly on 1', () => {
    for (const cols of [2, 3, 5, 13]) {
      const order = travelOrder(cols)
      expect(moduleWindow(order[0], cols).start).toBe(0)
      expect(moduleWindow(order[order.length - 1], cols).end).toBeCloseTo(1, 12)
    }
  })

  it('plays the first two travellers slowly and uniformly at the stagger cadence', () => {
    for (const cols of [3, 5, 13, 21]) {
      const total = timelineMs(cols)
      const order = travelOrder(cols)
      const a = moduleWindow(order[0], cols)
      const b = moduleWindow(order[1], cols)
      expect(a.start).toBe(0)
      expect(len(a)).toBeCloseTo(ASSEMBLY.slowModuleMs / total, 12)
      expect(len(b)).toBeCloseTo(ASSEMBLY.slowModuleMs / total, 12)
      // the second traveller starts staggerFraction of a slow window in, so
      // they are in flight together for the remaining 45%
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
    const order = travelOrder(cols)
    for (let k = 2; k < order.length - 1; k++) {
      const a = moduleWindow(order[k], cols)
      const b = moduleWindow(order[k + 1], cols)
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
    expect(moduleWindow(40, 4)).toEqual({ start: 1, end: 1 })
    expect(moduleWindow(40, 4)).toEqual({ start: 1, end: 1 })
  })

  it('is degenerate for a mono design', () => {
    expect(movingModules(1)).toBe(0)
    expect(moduleWindow(1, 1)).toEqual({ start: 0, end: 0 })
    expect(timelineMs(1)).toBe(0)
    expect(timelineMs(0)).toBe(0)
  })

  it('is the slow dance up to three travellers, then holds the budget forever', () => {
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
    const order = travelOrder(21)
    expect(moduleWindow(order[order.length - 1], 21).end).toBeCloseTo(1, 12)
    expect(timelineMs(21) / ASSEMBLY.apartSpeed).toBeLessThan(4000)
  })
})

describe('moduleWindow — apart is the exact time-reversal', () => {
  it('windows strictly increase along the travel order, so removal runs exactly backwards', () => {
    // as s sweeps 1→0 the module with the HIGHEST window moves first, so ends
    // increasing along the seating order means the chain peels from the ends
    // in — the only kinematically legal unhook order, since a module can only
    // unhook from a FREE end (user review 2026-09-10)
    for (const cols of [2, 4, 5, 13, 21]) {
      const order = travelOrder(cols)
      for (let k = 0; k < order.length - 1; k++) {
        const a = moduleWindow(order[k], cols)
        const b = moduleWindow(order[k + 1], cols)
        expect(b.start).toBeGreaterThan(a.start)
        expect(b.end).toBeGreaterThan(a.end)
      }
    }
  })

  it('peels the ends fast and saves the slow centre pair for last (as s sweeps 1→0)', () => {
    const cols = 13
    const total = timelineMs(cols)
    const order = travelOrder(cols)
    // the last traveller starts moving the instant s leaves 1…
    const last = moduleWindow(order[order.length - 1], cols)
    expect(last.end).toBe(1)
    // …and the centre pair comes apart LAST, at the slow deliberate cadence —
    // the legible beat still plays at the visual centre, where the shrinking
    // chain has dragged the viewer's eye
    const first = moduleWindow(order[0], cols)
    const second = moduleWindow(order[1], cols)
    expect(first.start).toBe(0)
    expect(len(first)).toBeCloseTo(ASSEMBLY.slowModuleMs / total, 12)
    expect(len(second)).toBeCloseTo(ASSEMBLY.slowModuleMs / total, 12)
    expect(second.end).toBeLessThan(last.start) // both centre windows below the tail's start
  })
})

describe('modulePose — the two end poses', () => {
  for (const joint of ['sliding_dovetail', 'vertical_snap'] as const) {
    it(`${joint}: s=1 is seated — module i pulled back exactly i·gap`, () => {
      for (let i = 0; i < 13; i++) {
        const q = modulePose(joint, i, 13, 1, DIMS)
        expect(q.x).toBeCloseTo(-i * DIMS.gap, 10)
        expect(q.y).toBeCloseTo(0, 10)
        expect(q.z).toBeCloseTo(0, 10)
      }
    })

    it(`${joint}: s=0 is the exploded render re-centred on the anchor — one constant offset`, () => {
      // every module carries the anchor's home offset; the viewer's per-frame
      // extent centring absorbs the constant, so this renders pixel-identical
      // to the plain exploded view
      const home = -anchorModule(13) * DIMS.gap
      for (let i = 0; i < 13; i++) {
        expect(modulePose(joint, i, 13, 0, DIMS)).toEqual({ x: home, y: 0, z: 0, rotY: 0 })
      }
    })

    it(`${joint}: the anchor sits at the home offset at EVERY point of the timeline`, () => {
      const anchor = anchorModule(13)
      const home = { x: -anchor * DIMS.gap, y: 0, z: 0, rotY: 0 }
      for (const s of SAMPLES) {
        expect(modulePose(joint, anchor, 13, s, DIMS)).toEqual(home)
      }
    })

    it(`${joint}: apart peels the ENDS first — the edge unhooks while the centre is still seated`, () => {
      const cols = 13
      const order = travelOrder(cols)
      const edge = order[order.length - 1] // the last module seated = the first freed
      const w = moduleWindow(edge, cols)
      const s = (w.start + w.end) / 2 // halfway through the first unhook of an apart play
      expect(modulePose(joint, edge, cols, s, DIMS)).not.toEqual({
        x: -edge * DIMS.gap + 0,
        y: 0,
        z: 0,
        rotY: 0,
      })
      // …and the slow centre pair hasn't moved a hair
      for (const i of order.slice(0, 2)) {
        expect(modulePose(joint, i, cols, s, DIMS)).toEqual({
          x: -i * DIMS.gap + 0, // (+0: the pose helper normalises −0, so must we)
          y: 0,
          z: 0,
          rotY: 0,
        })
      }
    })

    it(`${joint}: the centre module comes apart LAST — everything else already apart`, () => {
      const cols = 13
      const order = travelOrder(cols)
      const w = moduleWindow(order[0], cols)
      const s = (w.start + w.end) / 2 // the centre window sits at LOW s: the END of an apart play
      const home = -anchorModule(cols) * DIMS.gap
      expect(modulePose(joint, order[0], cols, s, DIMS)).not.toEqual({
        x: home,
        y: 0,
        z: 0,
        rotY: 0,
      })
      for (const i of order.slice(1)) {
        expect(modulePose(joint, i, cols, s, DIMS)).toEqual({ x: home, y: 0, z: 0, rotY: 0 })
      }
    })

    it(`${joint}: x closes monotonically on the anchor and never passes the seat`, () => {
      const home = -anchorModule(13) * DIMS.gap
      // right of the anchor: x falls from home to the seat
      for (const i of [8, 12]) {
        let prev = home
        for (const s of SAMPLES) {
          const { x } = modulePose(joint, i, 13, s, DIMS)
          expect(x).toBeLessThanOrEqual(prev + 1e-9)
          expect(x).toBeGreaterThanOrEqual(-i * DIMS.gap - 1e-9)
          prev = x
        }
      }
      // left of the anchor: x rises from home to the seat
      for (const i of [0, 4]) {
        let prev = home
        for (const s of SAMPLES) {
          const { x } = modulePose(joint, i, 13, s, DIMS)
          expect(x).toBeGreaterThanOrEqual(prev - 1e-9)
          expect(x).toBeLessThanOrEqual(-i * DIMS.gap + 1e-9)
          prev = x
        }
      }
    })
  }
})

describe('modulePose — sliding_dovetail enters from behind', () => {
  // cols = 5 anchors module 2; module 3 is the FIRST traveller (right side),
  // module 1 the second (left side)
  const pose = (i: number, u: number) => modulePose('sliding_dovetail', i, 5, at(i, 5, u), DIMS)

  it('lines up BEHIND the seat (−Y), aligned in X, before it slides', () => {
    const q = pose(3, ASSEMBLY.approachFraction)
    expect(q.x).toBeCloseTo(-3 * DIMS.gap, 10) // already in its column
    expect(q.y).toBeCloseTo(DIMS.depth * ASSEMBLY.slideBehindFactor, 10) // a full depth back
    expect(q.z).toBe(0)
  })

  it('stages left-side modules the same way, closing +X onto the anchor', () => {
    const q = pose(1, ASSEMBLY.approachFraction)
    expect(q.x).toBeCloseTo(-1 * DIMS.gap, 10)
    expect(q.y).toBeCloseTo(DIMS.depth * ASSEMBLY.slideBehindFactor, 10)
    expect(q.z).toBe(0)
  })

  it('slides from the narrow entry toward the wide anchor (−Y) through phase B', () => {
    let prev = pose(3, ASSEMBLY.approachFraction).y
    for (let u = 0.45; u <= ASSEMBLY.clickAt; u += 0.02) {
      const q = pose(3, u)
      expect(q.x).toBeCloseTo(-3 * DIMS.gap, 10)
      expect(q.y).toBeLessThan(prev)
      prev = q.y
    }
  })

  it('clicks into the wide final anchor and settles onto it', () => {
    expect(pose(3, ASSEMBLY.clickAt).y).toBeCloseTo(-ASSEMBLY.clickOvershootMm, 10)
    expect(pose(3, 1).y).toBeCloseTo(0, 10)
    // …and the settle comes back from the far side
    expect(pose(3, 0.97).y).toBeLessThan(0)
    expect(pose(3, 0.97).y).toBeGreaterThan(-ASSEMBLY.clickOvershootMm)
  })

  it('never overshoots past the detent and never leaves the Y/X plane', () => {
    for (const i of travelOrder(5)) {
      for (const s of SAMPLES) {
        const q = modulePose('sliding_dovetail', i, 5, s, DIMS)
        expect(q.y).toBeGreaterThanOrEqual(-ASSEMBLY.clickOvershootMm - 1e-9)
        expect(q.y).toBeLessThanOrEqual(DIMS.depth + 1e-9)
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
    const q = pose(3, A)
    expect(q.x).toBeCloseTo(-3 * DIMS.gap, 10)
    expect(q.z).toBeCloseTo(DIMS.depth * ASSEMBLY.liftFactor, 10)
    expect(q.y).toBe(0)
    // "at the point they start mating you have to have the column rotated"
    // — leaning OVER the seated part (negative = top toward the anchor,
    // for a module approaching from the right)
    expect(q.rotY).toBeCloseTo(-tilt, 12)
  })

  it('closes on the anchor from BOTH sides — right-side modules move −X, left-side +X', () => {
    // at first mating both are aligned in X over their own seats…
    expect(pose(3, A).x).toBeCloseTo(-3 * DIMS.gap, 10)
    expect(pose(1, A).x).toBeCloseTo(-1 * DIMS.gap, 10)
    // …and fully apart both sit at the anchor's home offset (the exploded
    // strip re-centred on the anchor)
    const home = -anchorModule(5) * DIMS.gap
    expect(pose(3, 0).x).toBeCloseTo(home, 10)
    expect(pose(1, 0).x).toBeCloseTo(home, 10)
  })

  it('mirrors the roll for left-side modules: same magnitude, opposite sign', () => {
    // modules 3 (right of the anchor) and 1 (left) are the first two
    // travellers of a 5-column chain — same windows, mirrored paths
    for (const u of SAMPLES) {
      const right = pose(3, u)
      const left = pose(1, u)
      expect(left.rotY).toBeCloseTo(-right.rotY, 12)
      expect(left.z).toBeCloseTo(right.z, 12)
      expect(left.y).toBe(right.y)
    }
  })

  it('leans over the seated part over the approach — upright at the start, tilted at the pocket', () => {
    // (landing ON tiltInAt to the ulp is a float coin toss — pin the flat
    // region just before it, and the boundary only approximately)
    expect(pose(3, A * ASSEMBLY.tiltInAt * 0.999).rotY).toBe(0)
    expect(pose(3, A * ASSEMBLY.tiltInAt).rotY).toBeCloseTo(0, 12)
    const mid = pose(3, A * (ASSEMBLY.tiltInAt + (1 - ASSEMBLY.tiltInAt) / 2)).rotY
    expect(mid).toBeLessThan(0)
    expect(mid).toBeGreaterThan(-tilt)
    // the seam-side bottom corner (the x0 = 0 offset path) never reverses
    // while the body swings onto the tilt
    let prev = pose(3, 0)
    for (let u = 0.02; u <= A + 1e-9; u += 0.02) {
      const q = pose(3, Math.min(u, A))
      expect(q.x).toBeLessThanOrEqual(prev.x + 1e-9)
      expect(q.z).toBeGreaterThanOrEqual(prev.z - 1e-9)
      prev = q
    }
  })

  it('holds the tilt while the sliver engages, then rolls upright before the click', () => {
    expect(pose(3, atB(ASSEMBLY.tiltHoldUntil)).rotY).toBeCloseTo(-tilt, 12)
    const mid = pose(3, atB((ASSEMBLY.tiltHoldUntil + ASSEMBLY.tiltOutAt) / 2)).rotY
    expect(mid).toBeGreaterThan(-tilt)
    expect(mid).toBeLessThan(0)
    expect(pose(3, atB(ASSEMBLY.tiltOutAt)).rotY).toBe(0)
    expect(pose(3, ASSEMBLY.clickAt).rotY).toBe(0)
  })

  it('slides the sliver home early, parks the pivot through the roll, presses at the click', () => {
    // the hook descends only while the sliver slides in (the hold)
    let prev = pose(3, A).z
    for (let b = 0.02; b <= ASSEMBLY.hookDescentEnd + 1e-9; b += 0.02) {
      const z = pose(3, atB(Math.min(b, ASSEMBLY.hookDescentEnd))).z
      expect(z).toBeLessThan(prev)
      prev = z
    }
    // from there to the clip press the pivot barely moves — the mate IS the
    // roll, not a descent — with x parked on the seat throughout
    const rest = pose(3, atB(ASSEMBLY.hookDescentEnd)).z
    expect(rest).toBeCloseTo(ASSEMBLY.hookRestMm, 10)
    const bClick = (ASSEMBLY.clickAt - A) / (1 - A)
    for (let b = ASSEMBLY.hookDescentEnd; b <= bClick - ASSEMBLY.clickDipSpan + 1e-9; b += 0.02) {
      const q = pose(3, atB(b))
      expect(q.x).toBeCloseTo(-3 * DIMS.gap, 10)
      expect(q.z).toBeCloseTo(rest, 10)
    }
  })

  it('dips past the seat as the clips snap, then settles', () => {
    expect(pose(3, ASSEMBLY.clickAt).z).toBeCloseTo(-ASSEMBLY.clickOvershootMm * 0.5, 10)
    expect(pose(3, 1).z).toBeCloseTo(0, 10)
    expect(pose(3, 0.97).z).toBeLessThan(0)
  })

  it('never dips deeper than the click, never over-tilts, never leaves the Z/X plane', () => {
    const anchor = anchorModule(5)
    for (const i of travelOrder(5)) {
      for (const s of SAMPLES) {
        const q = modulePose('vertical_snap', i, 5, s, DIMS)
        expect(q.z).toBeGreaterThanOrEqual(-ASSEMBLY.clickOvershootMm + 1e-9)
        expect(q.z).toBeLessThanOrEqual(DIMS.depth * ASSEMBLY.liftFactor + 1e-9)
        expect(q.y).toBe(0)
        expect(Math.abs(q.rotY)).toBeLessThanOrEqual(tilt + 1e-12)
        // the lean is always OVER the anchor: negative from the right,
        // positive from the left
        if (i > anchor) expect(q.rotY).toBeLessThanOrEqual(0)
        else expect(q.rotY).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('pivots about the seam-side bottom line: x0 pins that line, wherever it is', () => {
    // the correction must make the WORLD position of the local point (x0,0,0)
    // independent of the pivot: group.pos + R_y(rotY)·(x0,0,0) is the same
    // whether the caller passes x0 (group rolls, origin swings) or 0 (the
    // offset IS the corner path). three.js R_y maps (x,0,0) to
    // (x·cos, 0, −x·sin), so: world = (q.x + x0·cos, q.y, q.z − x0·sin).
    // Right-side modules pivot on their LEFT face, left-side modules on
    // their RIGHT — the correction is sign-agnostic, so pin both.
    for (const [i, X0] of [
      [3, 137.5],
      [1, 96.25],
    ] as const) {
      for (const s of SAMPLES) {
        const rolled = modulePose('vertical_snap', i, 5, s, DIMS, X0)
        const plain = modulePose('vertical_snap', i, 5, s, DIMS)
        expect(rolled.rotY).toBe(plain.rotY)
        expect(rolled.x + X0 * Math.cos(rolled.rotY)).toBeCloseTo(plain.x + X0, 9)
        expect(rolled.z - X0 * Math.sin(rolled.rotY)).toBeCloseTo(plain.z, 9)
        expect(rolled.y).toBe(plain.y)
      }
    }
  })

  it('leaves the end poses untouched by the pivot (no tilt at either end)', () => {
    for (const s of [0, 1]) {
      expect(modulePose('vertical_snap', 3, 5, s, DIMS, 137.5)).toEqual(
        modulePose('vertical_snap', 3, 5, s, DIMS)
      )
    }
  })
})

describe('modulePose — the chain seats from the anchor outward', () => {
  it('has the first traveller home before the last has started', () => {
    const cols = 13
    const order = travelOrder(cols)
    const s = moduleWindow(order[0], cols).end
    const first = order[0]
    const last = order[order.length - 1]
    expect(modulePose('sliding_dovetail', first, cols, s, DIMS).x).toBeCloseTo(
      -first * DIMS.gap,
      10
    )
    expect(modulePose('sliding_dovetail', last, cols, s, DIMS)).toEqual({
      x: -anchorModule(cols) * DIMS.gap, // still parked at the home offset
      y: 0,
      z: 0,
      rotY: 0,
    })
  })

  it('keeps earlier travellers ahead of later ones all the way through', () => {
    const cols = 8
    const anchor = anchorModule(cols)
    const home = -anchor * DIMS.gap
    const order = travelOrder(cols)
    /** progress as a fraction of that module's own X travel */
    const progress = (i: number, s: number) => {
      const seatX = -i * DIMS.gap
      return (modulePose('vertical_snap', i, cols, s, DIMS).x - home) / (seatX - home)
    }
    for (const s of SAMPLES) {
      for (let k = 0; k < order.length - 1; k++) {
        expect(progress(order[k], s)).toBeGreaterThanOrEqual(progress(order[k + 1], s) - 1e-9)
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
