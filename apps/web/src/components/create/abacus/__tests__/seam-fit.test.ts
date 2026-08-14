import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDesignSnapshot } from '@/lib/abacus/design-snapshot'
import {
  analyzeShells,
  BUMPER_PRESETS,
  bumperParams,
  DEFINE_KEYS,
  defaultParams,
  definesFrom,
  derived,
  EXPLODE_GAP,
  feetEffective,
  isModular,
  moduleFeetLayout,
  moduleFeetPositions,
  PART_ONLY_DEFINE_KEYS,
  type Params,
  previewDedupKey,
  SEAM,
  type SeamProfile,
  SLIDING_DOVETAIL,
  SLIDING_FIT_VALUES,
  seamFit,
  slideDeepGrooveProfile,
  slideDeepProfile,
  slideProfile,
  slidingAnchorGeometry,
  slidingDetentGeometry,
  slidingDovetailDerived,
} from '../abacus-model'

// CP4 of the modular-columns epic (Gitea #30): the TS model grew a mirror of the
// scad's seam geometry — SEAM constants, modular pitch in derived(), the
// moduleFeetLayout derivation, and seamFit (one row per scad assert, so the
// panel can refuse a kit download instead of letting the worker abort
// mid-export). Every expected number in this file was derived BY HAND from the
// scad's formulas (frame chain, band edges, foot derivation) — not read back
// from the TS implementation — so a change that breaks either side of the
// mirror breaks a pinned constant here.

const p = (over: Partial<Params> = {}): Params => ({ ...defaultParams, ...over })

// The two bumpers the adhesive tests lean on: the 1/4" × 1/16" dome is the
// largest catalog bumper that seats beside the seam socket at stock size, and
// the 3/8" × 1/8" dome is the smallest that does not.
const quarterBumper = BUMPER_PRESETS.find((b) => b.id === 'd-250-062')!
const threeEighthsBumper = BUMPER_PRESETS.find((b) => b.id === 'd-375-125')!

// ---- SEAM constants: pinned against the scad source --------------------------
// Same drift guard seam-flexure-dfm.test.ts runs on the flexure knobs: SEAM is
// a TS transcription of scad top-level constants, and nothing at runtime checks
// they agree — a scad retune that skips this file would leave seamFit approving
// geometry the render then rejects (or worse, the reverse).

const SCAD = readFileSync(join(process.cwd(), 'public/scad/abacus.scad'), 'utf8')

const knob = (name: string): number => {
  const m = SCAD.match(new RegExp(`^${name}\\s*=\\s*(-?[\\d.]+)\\s*;`, 'm'))
  if (!m) throw new Error(`knob ${name} not found in abacus.scad`)
  return Number(m[1])
}

describe('SEAM constants mirror the scad', () => {
  const pins: [keyof typeof SEAM, string][] = [
    ['jointTab', 'joint_tab'],
    ['jointNeck', 'joint_neck'],
    ['jointFlare', 'joint_flare'],
    ['jointClipW', 'joint_clip_w'],
    ['jointClipL', 'joint_clip_l'],
    ['jointRidge', 'joint_ridge'],
    ['scSlot', 'sc_slot'],
    ['scProng', 'sc_prong'],
    ['scSeat', 'sc_seat'],
    ['scDeep', 'sc_deep'],
    ['mfWall', 'mf_wall'],
    ['xbarEmbed', 'xbar_embed'],
  ]
  it.each(pins)('SEAM.%s === scad %s', (ts, scad) => {
    expect(SEAM[ts]).toBe(knob(scad))
  })

  it('scad defaults for the seam Params match defaultParams', () => {
    const seam = SCAD.match(/^seam_mode\s*=\s*"(\w+)"\s*;/m)
    const joint = SCAD.match(/^joint_type\s*=\s*"(\w+)"\s*;/m)
    expect(seam?.[1]).toBe(defaultParams.seam_mode)
    expect(joint?.[1]).toBe(defaultParams.joint_type)
    expect(knob('joint_fit')).toBe(defaultParams.joint_fit)
  })

  it('sliding constants mirror SCAD and preserve conventional profile arithmetic', () => {
    const pins: [keyof typeof SLIDING_DOVETAIL, string][] = [
      ['angleDeg', 'slide_angle'],
      ['maleDepth', 'slide_depth'],
      ['edgeAllowance', 'slide_edge_allow'],
      ['neck', 'slide_neck'],
      ['step', 'slide_step'],
      ['minBackingWall', 'slide_min_backing'],
      ['minLip', 'slide_min_lip'],
      ['keyLength', 'slide_key_l'],
      ['funnel', 'slide_funnel'],
      ['pinch', 'slide_pinch'],
      ['pinchLength', 'slide_pinch_l'],
      ['floorRelief', 'slide_relief'],
      ['datumRelief', 'slide_datum_relief'],
      ['leadOut', 'slide_lead_out'],
      ['seatClear', 'slide_seat_clear'],
      ['mouthFlare', 'slide_mouth_flare'],
      ['deepDepth', 'slide_deep_depth'],
      ['deepFloor', 'slide_deep_floor'],
      ['mouthLength', 'slide_mouth_l'],
      ['corner', 'slide_corner'],
      ['anchorLead', 'slide_anchor_lead'],
      ['detent', 'slide_detent'],
      ['detentRelief', 'slide_detent_relief'],
      ['channelClear', 'slide_ch_clear'],
      ['channelAir', 'slide_ch_air'],
      ['detentLand', 'slide_detent_l'],
      ['detentHalfHeight', 'slide_detent_h'],
      ['detentOutDeg', 'slide_detent_out'],
      ['detentInDeg', 'slide_detent_in'],
      ['detentSlop', 'slide_detent_slop'],
      ['springSlot', 'slide_spring_slot'],
      ['leafT', 'slide_leaf_t'],
      ['springA', 'slide_spring_a'],
      ['modulusMPa', 'slide_modulus'],
      ['selfHoldMu', 'slide_mu'],
    ]
    for (const [ts, scad] of pins) expect(SLIDING_DOVETAIL[ts]).toBe(knob(scad))
    const g = slidingDovetailDerived(0.1)
    // graduated rail family: neck ± step, heads = neck + 2·depth·tan14° (+0.997312)
    expect(g.necks.s).toBeCloseTo(2.2, 12)
    expect(g.necks.m).toBe(2.8)
    expect(g.necks.l).toBeCloseTo(3.4, 12)
    expect(g.head).toBeCloseTo(3.797312, 5)
    expect(g.headL).toBeCloseTo(4.397312, 5)
    // deepest SHALLOW female cut = depth + fit + floor relief = 2.25 at fit 0.10
    expect(g.deepestCut).toBeCloseTo(2.25, 12)
    // deep anchor pocket cut = deep depth + fit + floor relief = 9.25
    expect(g.deepPocketCut).toBeCloseTo(9.25, 12)
    // widest SHALLOW female Z opening = the large segment's relieved runway:
    // 3.4 + 2·2.35·tan14° = 4.571842 (the deep mouth's Z-flare is lip-budget
    // capped in the scad, so the runway is the honest z_lips driver)
    expect(g.runwayOpening).toBeCloseTo(4.571842, 5)
    // the large rail head passes its own relieved runway with room to spare
    expect(g.runwayOpening).toBeGreaterThan(g.headL)
    // the anchor berth's floor is the anchor's ceiling lip mirrored — 1.8 − fit,
    // scale-free, and the mouth flare is what is left of it over the 1.2 minimum
    expect(g.anchorFloor).toBeCloseTo(1.7, 12)
    expect(g.anchorMouthFlare).toBeCloseTo(0.5, 12)
    expect(slidingDovetailDerived(0.12).anchorMouthFlare).toBeCloseTo(0.48, 12)
    // any rail section passing a one-step-up station clears ≥ step/2 + fit·tan14° per side
    expect(g.passClearance).toBeCloseTo(0.324933, 5)
    // retention physics: 0.05/1.5 seat taper = 1.909° ≪ atan(µ 0.25) = 14.036°
    expect(g.seatTaperDeg).toBeCloseTo(1.90915, 4)
    expect(g.selfHoldLimitDeg).toBeCloseTo(14.03624, 4)
  })
})

// ---- the deep anchor's cross-section ------------------------------------------
// The rear anchor is the one section whose profile is NOT the graduated
// trapezoid: both flanks clamp flat at the berth floor and its mirror. These
// pins are the shape itself — hand-derived from the scad's slide_deep_profile /
// slide_deep_groove_profile — plus the two properties the shape exists for
// (a symmetric hook, and a berth every smaller section can still sweep through).

const TAN14 = Math.tan((14 * Math.PI) / 180) // 0.249328…

/** Vertical [zmin, zmax] span of a convex XZ profile at depth x, by clipping
 *  every edge against the vertical line — the containment question these
 *  profiles have to answer, asked directly of the polygons. */
const spanAt = (poly: SeamProfile, x: number): [number, number] | null => {
  const zs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i]
    const [x2, z2] = poly[(i + 1) % poly.length]
    if (x1 === x2) {
      if (Math.abs(x1 - x) < 1e-12) zs.push(z1, z2)
      continue
    }
    const t = (x - x1) / (x2 - x1)
    if (t >= 0 && t <= 1) zs.push(z1 + t * (z2 - z1))
  }
  return zs.length ? [Math.min(...zs), Math.max(...zs)] : null
}

/** Worst top/bottom clearance of a male section inside a female berth, over the
 *  whole depth the section occupies. Negative ⇒ the section would collide on
 *  its way past that berth. */
const passMargin = (section: SeamProfile, berth: SeamProfile, depth: number): number => {
  let worst = Number.POSITIVE_INFINITY
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * depth
    const s = spanAt(section, x)
    const b = spanAt(berth, x)
    if (!s || !b) return Number.NaN
    worst = Math.min(worst, s[0] - b[0], b[1] - s[1])
  }
  return worst
}

const shiftZ = (poly: SeamProfile, dz: number): SeamProfile => poly.map(([x, z]) => [x, z + dz])

describe('deep anchor profile', () => {
  const S_FH = 8 // frame_h × scale_factor at stock size
  const N_L = SLIDING_DOVETAIL.neck + SLIDING_DOVETAIL.step // 3.4 — the anchor is always LARGE

  it('is one symmetric block: 14° off the neck, then clamped at the floor and its mirror', () => {
    // rb 2.3, rt 5.7 (neck centered in an 8 mm slab); floor 1.8, cap 8 − 1.8;
    // each flank runs 0.5/tan14° = 2.005390 before it clamps; bite 9, whose two
    // long tip edges are broken by slide_corner.
    const male = slideDeepProfile(N_L, S_FH)
    const k = SLIDING_DOVETAIL.corner
    const xFlank = 0.5 / TAN14
    expect(xFlank).toBeCloseTo(2.00539, 5)
    expect(male).toHaveLength(8)
    const expected: SeamProfile = [
      [0, 2.3],
      [xFlank, 1.8],
      [9 - k, 1.8],
      [9, 1.8 + k],
      [9, 6.2 - k],
      [9 - k, 6.2],
      [xFlank, 6.2],
      [0, 5.7],
    ]
    for (const [i, [x, z]] of expected.entries()) {
      expect(male[i][0]).toBeCloseTo(x, 9)
      expect(male[i][1]).toBeCloseTo(z, 9)
    }
    // symmetry is the whole design: floor + cap planes sum to the slab, and the
    // two flanks clamp at the same depth, so both lips hook the same amount
    const a = slidingAnchorGeometry(S_FH)
    expect(a.floorPlane + a.capPlane).toBeCloseTo(S_FH, 12)
    expect(male[1][0]).toBeCloseTo(male[6][0], 12)
    expect(a.rootBottom - a.floorPlane).toBeCloseTo(a.capPlane - a.rootTop, 12)
  })

  it('the tip breaks at 45° in section, and an inset profile breaks each END at 45°', () => {
    // Section: both long tip edges lose slide_corner in x and in z — equal runs,
    // so the underside break is exactly 45°, not a shallower overhang.
    const male = slideDeepProfile(N_L, S_FH)
    const k = SLIDING_DOVETAIL.corner
    expect(male[3][0] - male[2][0]).toBeCloseTo(k, 12)
    expect(male[3][1] - male[2][1]).toBeCloseTo(k, 12)
    expect(male[4][0] - male[5][0]).toBeCloseTo(k, 12)
    expect(male[5][1] - male[4][1]).toBeCloseTo(k, 12)
    // Ends: the scad hulls an inset section `corner` in Y ahead of a full one.
    // The floor rises by the inset over that run and the tip pulls back by it,
    // so every face the hull sweeps — underside included — is at 45° exactly.
    const inset = slideDeepProfile(N_L, S_FH, k)
    const floorOf = (poly: SeamProfile) => Math.min(...poly.map(([, z]) => z))
    const tipOf = (poly: SeamProfile) => Math.max(...poly.map(([x]) => x))
    expect(floorOf(inset) - floorOf(male)).toBeCloseTo(k, 12)
    expect(tipOf(male) - tipOf(inset)).toBeCloseTo(k, 12)
    // dz/dy on the swept underside is exactly 1 — the printability limit, which
    // is why this is admissible where the anchor's front STEP could not be a
    // blend at all
    expect((floorOf(inset) - floorOf(male)) / k).toBeCloseTo(1, 12)
    // the seam root never moves: only the floor, cap and tip are inset, so the
    // hull cannot pull the profile off the neck it grows from
    expect(inset[0]).toEqual(male[0])
    expect(inset[inset.length - 1]).toEqual(male[male.length - 1])
  })

  it('keeps the full-length tooth’s undercut and spends the extra depth on bearing', () => {
    const a = slidingAnchorGeometry(S_FH)
    // 0.5 per side — the same hook a 2 mm-deep graduated tooth gets from its
    // flank (2·tan14° = 0.498656), to a thousandth of a millimetre
    expect(a.undercut).toBeCloseTo(0.5, 12)
    expect(a.undercut).toBeCloseTo(SLIDING_DOVETAIL.maleDepth * TAN14, 2)
    // …so the 9 mm bite is 7 mm of flat bearing, not 7 mm of deeper hook
    expect(a.flankRun).toBeCloseTo(2.00539, 5)
    expect(a.flatLength).toBeCloseTo(9 - 2.00539, 5)
  })

  it('the female berth grows the same shape and keeps a solid floor under it', () => {
    const fit = 0.1
    const berth = slideDeepGrooveProfile(N_L, fit, S_FH)
    const xCorner = 0.6 / TAN14 - fit // 2.306469 — grown flank meets grown floor
    const expected: SeamProfile = [
      [-0.01, 2.3 - 0.09 * TAN14], // the seam-face lip trick, on the flank line
      [xCorner, 1.7],
      [9.1, 1.7],
      [9.1, 6.3],
      [xCorner, 6.3],
      [-0.01, 5.7 + 0.09 * TAN14],
    ]
    for (const [i, [x, z]] of expected.entries()) {
      expect(berth[i][0]).toBeCloseTo(x, 9)
      expect(berth[i][1]).toBeCloseTo(z, 9)
    }
    // flanks: offset fit along +x ⇒ exactly fit·sin(angle) flank-normal running
    // clearance, the file's convention. Floor/ceiling: offset fit along ∓z.
    const male = slideDeepProfile(N_L, S_FH)
    expect(spanAt(male, 1)![0] - spanAt(berth, 1)![0]).toBeCloseTo(fit * TAN14, 12)
    expect(slidingDovetailDerived(fit).runningClearance).toBeCloseTo(
      fit * Math.sin((14 * Math.PI) / 180),
      12
    )
    expect(male[1][1] - berth[1][1]).toBeCloseTo(fit, 12) // floor
    expect(berth[3][1] - male[5][1]).toBeCloseTo(fit, 12) // ceiling (past the corner break)
    // the floor lip: at the seam face the berth's underside sits 0.575 mm ABOVE
    // the floor flat, so the female keeps a wedge that hooks the male's bottom
    // flank — the underside is a closed face, not an opening
    expect(spanAt(berth, 0)![0]).toBeCloseTo(2.275067, 6)
    expect(spanAt(berth, 0)![0] - 1.7).toBeCloseTo(0.575067, 6)
    expect(spanAt(berth, 0)![0]).toBeLessThan(spanAt(male, 0)![0])
    // and the berth ceiling clears the slab top by the mirrored floor
    expect(S_FH - spanAt(berth, 5)![1]).toBeCloseTo(slidingDovetailDerived(fit).anchorFloor, 12)
  })

  it('the rear mouth flares all four sides, out of one lip budget', () => {
    // The flare only became possible once the anchor landed on a floor: it opens
    // the berth's floor and ceiling by the same amount it opens the two roots,
    // and what it may spend is whatever the floor keeps over slide_min_lip.
    const fit = 0.1
    const g = slidingDovetailDerived(fit)
    expect(g.anchorMouthFlare).toBeCloseTo(0.5, 12)
    const mouth = slideDeepGrooveProfile(
      N_L,
      fit,
      S_FH,
      SLIDING_DOVETAIL.floorRelief,
      g.anchorMouthFlare
    )
    const floor = Math.min(...mouth.map(([, z]) => z))
    const ceiling = Math.max(...mouth.map(([, z]) => z))
    expect(floor).toBeCloseTo(SLIDING_DOVETAIL.minLip, 12) // 1.2 — the budget spent exactly
    expect(S_FH - ceiling).toBeCloseTo(SLIDING_DOVETAIL.minLip, 12)
    expect(floor + ceiling).toBeCloseTo(S_FH, 12) // still symmetric about mid-slab
    // both seam-face roots open too, by the same flare, so no corner is left square
    const plain = slideDeepGrooveProfile(N_L, fit, S_FH, SLIDING_DOVETAIL.floorRelief)
    expect(spanAt(plain, 0)![0] - spanAt(mouth, 0)![0]).toBeCloseTo(g.anchorMouthFlare, 9)
    expect(spanAt(mouth, 0)![1] - spanAt(plain, 0)![1]).toBeCloseTo(g.anchorMouthFlare, 9)
    // and the budget itself is asserted, not silently clamped to zero
    expect(SLIDING_DOVETAIL.deepFloor - fit - SLIDING_DOVETAIL.minLip).toBeGreaterThanOrEqual(0)
  })

  it('every smaller section still sweeps through the anchor berth', () => {
    // Rear entry: the A (2.2) and B (2.8) sections travel through the deep berth
    // on their way to their own. The berth's flanks ARE the graduated flanks
    // until they clamp — outside any 2 mm-deep section's reach — so the margin
    // is the ordinary one-graduation pass clearance, top and bottom.
    const g = slidingDovetailDerived(0.1)
    const berth = slideDeepGrooveProfile(N_L, 0.1, S_FH)
    const depth = SLIDING_DOVETAIL.maleDepth
    const sectionA = slideProfile(g.necks.s, S_FH)
    const sectionB = slideProfile(g.necks.m, S_FH)
    expect(passMargin(sectionB, berth, depth)).toBeCloseTo(g.passClearance, 9)
    // A is two graduations under the anchor's neck, so it clears by two halves
    expect(passMargin(sectionA, berth, depth)).toBeCloseTo(
      g.passClearance + SLIDING_DOVETAIL.step / 2,
      9
    )
    // the tight seat squeezes the berth by the pinch and it still clears
    const seated = slideDeepGrooveProfile(N_L, 0.1 - SLIDING_DOVETAIL.pinch, S_FH)
    expect(passMargin(sectionB, seated, depth)).toBeGreaterThan(0.3)
    // the anchor itself is contained by its own berth over the whole bite
    expect(passMargin(slideDeepProfile(N_L, S_FH), berth, SLIDING_DOVETAIL.deepDepth)).toBeCloseTo(
      0.1 * TAN14,
      9
    )
  })

  it('the clearance check can fail — a floor raised into the passing section collides', () => {
    const berth = slideDeepGrooveProfile(N_L, 0.1, S_FH)
    const sectionB = slideProfile(SLIDING_DOVETAIL.neck, S_FH)
    // dropping the section 0.7 mm is the same geometry as a berth floor raised
    // to 2.4: the check must go negative, or it is proving nothing above
    expect(passMargin(shiftZ(sectionB, -0.7), berth, SLIDING_DOVETAIL.maleDepth)).toBeLessThan(0)
    // and on real knobs: a 7 mm slab pulls the necks down onto the absolute
    // floor. seamFit refuses that geometry (anchor_flanks) before the sweep
    // would ever see it — the gate is upstream of the collision.
    const squat = passMargin(
      slideProfile(SLIDING_DOVETAIL.neck, 7),
      slideDeepGrooveProfile(N_L, 0.1, 7),
      SLIDING_DOVETAIL.maleDepth
    )
    expect(squat).toBeLessThan(0)
    expect(slidingAnchorGeometry(7).undercut).toBeLessThan(0.3)
  })
})

// ---- the detent: the click, and the only flexure in this topology --------------
// A wedge on the female MIDDLE BERTH's floor drops into a notch in the male rail's
// middle (B) section, at the mid-length of the track. The crest goes at the berth's
// mid-length: that is the one stretch of groove with a flat, known floor, so the
// proud height is a constant instead of something that rides the runway relief.
// Mid-track gives up the kinematic exclusivity a front-berth ridge got free from
// rear entry, so exclusivity is bought geometrically instead — the RELIEF CHANNEL
// down the rail's tip face, which every un-sprung section passes the ridge inside.
// The spring is the MALE side — an L-shaped Z-through slot behind the rail frees
// the B key and the skin backing it into a cantilever tongue whose free tip is
// buried mid-module — so the female stays rigid. The tongue's bending SECTION is
// skin AND rail; the tests below integrate it rather than trusting the closed form,
// because counting the skin alone understates it ~11×. And the gate an insertion
// sweep is blind to gets its own test: the tongue cannot deflect further than the
// rail it carries can RETRACT out of its own groove.

describe('the detent', () => {
  const sliding = p({ joint_type: 'sliding_dovetail' })
  const dt = slidingDetentGeometry(sliding)
  const c = SLIDING_DOVETAIL
  const S_FH_1 = sliding.frame_h * sliding.scale_factor // 8 — the slab at stock size

  it('stations: crest pinned to the middle berth’s mid-length, toes worked back', () => {
    expect(dt.k0S).toBeCloseTo(2.02, 12)
    expect(dt.k0M).toBeCloseTo(46.25, 12)
    // the middle berth runs k0M − datumRelief → k0M + keyLength + 0.3 (its front
    // stands off: one Y stop locates the seam, and it is the SMALL berth's), and
    // the crest land straddles the key's own midpoint
    expect(dt.midY0).toBeCloseTo(46.05, 12)
    expect(dt.midY1).toBeCloseTo(54.55, 12)
    expect(dt.berthY1).toBe(dt.midY1)
    expect(dt.crestY).toBeCloseTo(50.25, 12)
    expect(dt.crestY - dt.k0M).toBeCloseTo(c.keyLength / 2, 12)
    // and that lands on outerD / 2 exactly — the literal middle of the track,
    // which is the whole point of moving it off the module's front corner
    expect(dt.crestY).toBeCloseTo(derived(sliding).outerD / 2, 12)
    expect(dt.crest0).toBeCloseTo(49.95, 12)
    expect(dt.crest1).toBeCloseTo(50.55, 12)
    // proud = fit + detent = 0.25 over the BERTH floor (not the relieved runway —
    // the ridge never leaves the berth), and each flank run is that height over
    // the flank's own tangent
    expect(dt.proud).toBeCloseTo(0.25, 12)
    expect(dt.y0).toBeCloseTo(49.774948, 5)
    expect(dt.rearToe).toBeCloseTo(51.319421, 5)
    // both toes land inside the berth: past the seat pinch at the front, clear of
    // the berth's rear station behind
    expect(dt.y0).toBeGreaterThan(dt.midY0 + c.pinchLength)
    expect(dt.rearToe).toBeLessThan(dt.berthY1)
    // the tongue's root sits behind the wedge and lands ON the bar strip — the
    // only solid it can grow out of with no bead channel behind it to bow into
    expect(dt.springA).toBe(11.25)
    expect(dt.springY1).toBeCloseTo(61.5, 12)
    const dv0 = derived(sliding)
    const scB0 =
      sliding.border_w * sliding.scale_factor +
      dv0.sEhi +
      (sliding.bead_len * sliding.scale_factor) / 2 +
      sliding.clearance
    expect(dt.springY1).toBeCloseTo(scB0, 12)
  })

  it('mid-track is swept by A and B alike — the relief channel is what excludes them', () => {
    // Rear entry: a male section starting at male-Y m sweeps female-Y ∈
    // [m, outerD] and nothing ahead of m. At the FRONT berth that made the ridge
    // A's alone; mid-track it does not, and pretending otherwise is the error this
    // test exists to pin. A and B both reach the crest; only the anchor cannot.
    const dv = derived(sliding)
    const sBw = sliding.border_w * sliding.scale_factor
    const sBl = sliding.bead_len * sliding.scale_factor
    const taper0 = sBw + dv.sHhi + sBl / 2 + sliding.clearance + 0.3
    const anchor0 = taper0 + c.funnel + c.datumRelief
    const fronts: [string, number, boolean][] = [
      ['A', dt.k0S, true],
      ['B', dt.k0M, true],
      ['anchor', anchor0, false],
    ]
    for (const [name, m, reaches] of fronts) {
      const sweeps = (y: number) => y >= m
      expect(sweeps(dt.y0), `${name} vs the ridge toe`).toBe(reaches)
      expect(sweeps(dt.rearToe), `${name} vs the ridge's rear toe`).toBe(reaches)
    }
    expect(anchor0 - dt.rearToe).toBeGreaterThan(30)
    // So exclusivity is geometric. The channel runs the rail's tip face from the
    // nose to the tongue's tip, and every section ahead of that tip passes the
    // ridge INSIDE it: channelAir under the crest, channelClear past each Z edge.
    expect(dt.channel.y0).toBeCloseTo(dt.k0S, 12)
    expect(dt.channel.y1).toBeCloseTo(dt.springY0, 12)
    expect(dt.channel.x0).toBeCloseTo(c.maleDepth - dt.channelDepth, 12)
    expect(dt.channelDepth).toBeCloseTo(c.detent + c.channelAir, 12)
    expect(dt.channel.x0).toBeLessThan(dt.crestX) // crest sits inside the channel…
    expect(dt.crestX - dt.channel.x0).toBeCloseTo(c.channelAir, 12) // …by this much
    expect(dt.channel.z[0]).toBeLessThan(dt.ridgeZ[0])
    expect(dt.ridgeZ[0] - dt.channel.z[0]).toBeCloseTo(c.channelClear, 12)
    expect(dt.channel.z[1] - dt.ridgeZ[1]).toBeCloseTo(c.channelClear, 12)
    // Tip face ONLY: it stops short of the flanks, so the small section — the one
    // that has to run the whole track past this ridge — keeps its full undercut.
    const smallHalfAtChannelFloor = (c.neck - c.step) / 2 + (c.maleDepth - dt.channelDepth) * TAN14
    expect(smallHalfAtChannelFloor - dt.channelWidth / 2).toBeGreaterThanOrEqual(0.3)
    // and the un-sprung run is nearly the whole track: contact starts only when
    // the ridge reaches the tongue, a couple of millimetres before seat
    expect(dt.channel.y1 - dt.channel.y0).toBeGreaterThan(46)
    expect(dt.rearToe - dt.springY0).toBeCloseTo(2.969421, 5)
  })

  it('ridge and notch: the same wedge, the notch grown off the rail’s tip face', () => {
    // ridge: berth floor 2.10 → crest 1.85 (0.15 inside the rail's 2.0 tip face).
    // The floor it stands on is the BERTH's — depth + fit, with no runway relief,
    // which is the whole reason the crest is inside the berth and not behind it.
    expect(dt.floorX).toBeCloseTo(2.1, 12)
    expect(dt.crestX).toBeCloseTo(1.85, 12)
    const ridge = dt.ridge()
    const flat: number[] = ridge.flat()
    expect(flat).toHaveLength(8)
    for (const [i, v] of [2.1, dt.y0, 1.85, dt.crest0, 1.85, dt.crest1, 2.1, dt.rearToe].entries())
      expect(flat[i]).toBeCloseTo(v, 9)
    // the crest land is the same at every coupon fit — only the toes ride the
    // floor down, so no sample can drag the crest off the berth's mid-length
    for (const fit of SLIDING_FIT_VALUES) {
      const r = slidingDetentGeometry(p({ joint_type: 'sliding_dovetail', joint_fit: fit })).ridge(
        fit
      )
      expect(r[1][1], `crest0 at fit ${fit}`).toBeCloseTo(49.95, 12)
      expect(r[2][1], `crest1 at fit ${fit}`).toBeCloseTo(50.55, 12)
      expect(r[0][0]).toBeCloseTo(c.maleDepth + fit, 12)
    }
    // notch: crest floor a fit deeper, Z half-height a fit taller, and each flank
    // stated where the RIDGE's flank crosses the rail tip face — which the 0.01
    // overshoot breaks — then stepped back detentSlop along its own normal
    const notch = dt.notch()
    expect(dt.notchFloorX).toBeCloseTo(1.75, 12)
    expect(notch[0][0]).toBeCloseTo(2.01, 12)
    expect(notch[0][1]).toBeCloseTo(49.789136, 5)
    expect(notch[1][0]).toBeCloseTo(1.75, 12)
    expect(notch[1][1]).toBeCloseTo(49.97119, 5)
    expect(notch[2][0]).toBeCloseTo(1.75, 12)
    expect(notch[2][1]).toBeCloseTo(50.371674, 5)
    expect(notch[3][1]).toBeCloseTo(51.171872, 5)
    // …and in Z the notch is a fit taller than the ridge, top and bottom
    expect(dt.ridgeZ).toEqual([S_FH_1 / 2 - c.detentHalfHeight, S_FH_1 / 2 + c.detentHalfHeight])
    expect(dt.notchZ[0]).toBeCloseTo(dt.ridgeZ[0] - sliding.joint_fit, 12)
    expect(dt.notchZ[1]).toBeCloseTo(dt.ridgeZ[1] + sliding.joint_fit, 12)
  })

  it('the seated flank gaps are detentSlop exactly, at every coupon fit', () => {
    // The notch's flanks are the RIDGE's flank lines stepped back along their own
    // normals, so the gap is detentSlop and nothing else. State them off the
    // ridge's toes on the runway floor instead — the first cut of this design —
    // and each flank silently gains (floor − tip)·cos(flank), which is pure Y
    // backlash: the seam still seats on its blind front stop, but the click is
    // loose against a pull by that much before it bites.
    const gap = (
      a: [number, number],
      b: [number, number],
      pt: [number, number],
      deg: number
    ): number => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const cross = ((b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0])) / len
      expect(Math.abs((b[1] - a[1]) / (b[0] - a[0]))).toBeCloseTo(
        1 / Math.tan((deg * Math.PI) / 180),
        9
      )
      return Math.abs(cross)
    }
    const rad = (deg: number) => (deg * Math.PI) / 180
    for (const fit of SLIDING_FIT_VALUES) {
      const g = slidingDetentGeometry(p({ joint_type: 'sliding_dovetail', joint_fit: fit }))
      const ridge = g.ridge(fit)
      const notch = g.notch(fit)
      expect(gap(ridge[0], ridge[1], notch[0], c.detentOutDeg), `out at ${fit}`).toBeCloseTo(
        c.detentSlop,
        9
      )
      expect(gap(ridge[3], ridge[2], notch[3], c.detentInDeg), `in at ${fit}`).toBeCloseTo(
        c.detentSlop,
        9
      )
    }
    // A y-shift of s closes a flank-normal gap by s·sin(flank), so the free
    // travel before the RETENTION flank bites — the only direction a flank
    // bounds, since forward is the blind stop's business — is slop/sin(55°).
    // That is the click's whole backlash, and the scad asserts it under 0.05.
    const notch = dt.notch()
    // read the notch's two flanks at the crest plane, where the ridge's own land
    // is: the difference IS the free travel, in each direction
    const at = (a: [number, number], b: [number, number], x: number) =>
      a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
    expect(dt.crest0 - at(notch[0], notch[1], dt.crestX)).toBeCloseTo(dt.backlashOut, 12)
    expect(at(notch[3], notch[2], dt.crestX) - dt.crest1).toBeCloseTo(dt.backlashIn, 12)
    expect(dt.backlashOut).toBeCloseTo(0.048831, 6)
    expect(dt.backlashOut).toBeLessThanOrEqual(0.05)
    expect(dt.backlashIn).toBeCloseTo(0.129443, 6)
    // what the discarded datum would have cost, in the same units
    const wrong = (deg: number) =>
      (sliding.joint_fit + (dt.floorX - (c.maleDepth + 0.01)) * Math.cos(rad(deg))) /
      Math.sin(rad(deg))
    expect(wrong(c.detentOutDeg)).toBeCloseTo(0.185099, 5)
    expect(wrong(c.detentOutDeg) / dt.backlashOut).toBeGreaterThan(3.5)
  })

  it('the notch keeps off the rail’s flanks and leaves real rail behind it', () => {
    // The B rail's half-height at the notch floor, against the notch's own — this
    // is the scad's flank gate, and it binds at the LOOSEST coupon fit. It is the
    // B section that carries the notch now, so the gate reads the middle neck; the
    // relief channel gets the same gate read against the SMALL one, in its own test.
    const railHalf = (fit: number) => c.neck / 2 + (c.maleDepth - c.detent - fit) * TAN14
    for (const fit of SLIDING_FIT_VALUES) {
      const notchHalf = c.detentHalfHeight + fit
      expect(railHalf(fit) - notchHalf, `flank margin at fit ${fit}`).toBeGreaterThanOrEqual(0.3)
      expect(c.maleDepth - c.detent - fit).toBeGreaterThanOrEqual(1.2)
    }
    // the dovetail's grip is untouched: the notch is a void in the tip face,
    // 1.75 mm of rail deep, and the flanks it hooks on never see it
    expect(dt.notchFloorX).toBeCloseTo(1.75, 12)
    expect(railHalf(0.1) - (c.detentHalfHeight + 0.1)).toBeCloseTo(0.836327, 5)
  })

  it('the tongue is skin AND rail, not the 1.2 mm skin alone', () => {
    // The slot frees the key together with the skin behind it, and the rail is
    // welded to that skin down the whole free length — so the bending section is
    // a rectangle plus the B trapezoid, and the rail is most of it. Integrated
    // here from the section itself, so the closed form in the model cannot drift
    // from the shape it claims to describe.
    const neckB = c.neck
    const depth = c.maleDepth
    const total = c.leafT + depth
    // material height at depth x from the slot's inner face: full slab through
    // the skin, then the rail's own trapezoid out to the tip
    const hAt = (x: number) =>
      x < c.leafT ? S_FH_1 : neckB + 2 * (x - c.leafT) * Math.tan((c.angleDeg * Math.PI) / 180)
    const N = 400000
    let a = 0
    let q = 0
    let j = 0
    for (let i = 0; i < N; i++) {
      const x = (total * (i + 0.5)) / N
      const dA = (hAt(x) * total) / N
      a += dA
      q += x * dA
      j += x * x * dA
    }
    const xbar = q / a
    expect(dt.leafA).toBeCloseTo(a, 3)
    expect(dt.leafX).toBeCloseTo(xbar, 5)
    expect(dt.inertia).toBeCloseTo(j - a * xbar ** 2, 3)
    // the numbers themselves, and how far off the skin alone would be
    expect(dt.leafA).toBeCloseTo(16.197312, 5)
    expect(dt.leafX).toBeCloseTo(1.272219, 5)
    // the outer fibre is the TIP side (3.2 − 1.272), not the slot side
    expect(dt.leafC).toBeCloseTo(1.927781, 5)
    expect(dt.leafC).toBeCloseTo(total - dt.leafX, 9)
    expect(dt.inertia).toBeCloseTo(13.984813, 5)
    expect(dt.inertia / ((S_FH_1 * c.leafT ** 3) / 12)).toBeGreaterThan(10)
    // the female's post-groove wall is still reported, and is NOT the spring:
    // this topology's flexure moved to the male when the ridge took the berth
    expect(dt.backing).toBeCloseTo(1.25, 12)
  })

  it('the beam: an 11.25 mm cantilever, loaded at the notch', () => {
    // Free at the tip gap, rooted at the slot's blind end 11.25 mm behind the
    // crest — set so that root lands on the bar strip. The root wall does rotate,
    // so the real spring is ~14% softer than this — overstating stiffness and
    // strain alike is the safe direction for both gates.
    expect(dt.springA).toBe(11.25)
    // δ = F·a³/(3EI) and M = F·a at the root ⇒ ε = M·c/(EI) = 3·δ·c/a², E and I
    // gone. Same wood-PLA line the snap clip is judged against (1.0% = ~1.5%/1.5).
    expect(dt.strainPct).toBeCloseTo(0.685433, 6)
    expect(dt.strainPct).toBeLessThanOrEqual(1.0)
    expect(dt.strainPct).toBeCloseTo((300 * c.detent * dt.leafC) / c.springA ** 2, 12)
    // …and the same thing the long way round, through a force the gate cancels
    const force = (3 * c.modulusMPa * dt.inertia * c.detent) / c.springA ** 3
    expect(dt.strainPct).toBeCloseTo(
      (100 * (force * c.springA) * dt.leafC) / (c.modulusMPa * dt.inertia),
      12
    )
    // force does NOT cancel: it is what says a hand can still push this home
    expect(dt.stiffnessN).toBeCloseTo(73.664858, 5)
    expect(dt.forceN).toBeCloseTo(11.049729, 5)
    expect(dt.seatForceN).toBeCloseTo(6.91436, 5)
    expect(dt.seatForceN).toBeLessThanOrEqual(15)
    expect(dt.partForceN).toBeCloseTo(28.840042, 5)
    expect(dt.partForceN).toBeGreaterThan(dt.seatForceN) // 55° out, 18° in
  })

  it('the retraction limit: the tongue can’t deflect past what the rail can back out', () => {
    // The gate an insertion sweep cannot see. A sweep is a rigid-overlap check —
    // it measures the ridge's volume, not whether the rail has anywhere to go.
    // slideGrooveProfile builds the female by translating the male jointFit in +x,
    // so the rail backs out of its groove EXACTLY jointFit before its own 14°
    // flanks bottom on the groove's; refusing to come out radially is the whole
    // job of a dovetail, and it is also the ceiling on this flexure's travel.
    expect(dt.retractRoom).toBeGreaterThan(sliding.joint_fit)
    expect(dt.retractRoom - sliding.joint_fit).toBeCloseTo(c.detentRelief / (2 * TAN14), 12)
    expect(dt.retractRoom).toBeCloseTo(0.240377, 5)
    // Peak deflection is the free TIP's, not the notch's: past its load a
    // cantilever is straight, so the tip overswings by 1.5·b/a.
    expect(dt.tipOver).toBeCloseTo(1.9, 12)
    expect(dt.tipDefl).toBeCloseTo(c.detent * (1 + (1.5 * dt.tipOver) / dt.springA), 12)
    expect(dt.tipDefl).toBeCloseTo(0.188, 12)
    expect(dt.tipDefl).toBeGreaterThan(c.detent) // the overswing is real, ~25%
    expect(dt.tipDefl).toBeLessThanOrEqual(dt.retractRoom)
    // Without the neck relief this design does NOT clear: 0.188 into 0.10.
    expect(dt.tipDefl).toBeGreaterThan(sliding.joint_fit)
    // and the gate is a live predicate, not a coincidence
    expect(failing(sliding)).not.toContain('detent_retract')
    for (const fit of SLIDING_FIT_VALUES)
      expect(
        failing(p({ joint_type: 'sliding_dovetail', joint_fit: fit })),
        `retraction at fit ${fit}`
      ).not.toContain('detent_retract')
  })

  it('the spring slot is an L buried mid-module, and the front foot got its X back', () => {
    const mf = moduleFeetLayout(sliding)
    // it hugs the male seam edge: leafT of skin outboard of it, and the rest of
    // sc_wall (1.5 mm) inboard, in front of the bead channel
    expect(dt.slot.x0).toBeCloseTo(15.5, 12)
    expect(dt.slot.w).toBeCloseTo(0.8, 12)
    expect(derived(sliding).scW - (dt.slot.x0 + dt.slot.w)).toBeCloseTo(c.leafT, 12)
    expect(dt.slot.x0).toBeGreaterThanOrEqual(c.minBackingWall)
    // BOTH ends are inside the module now. The long leg runs tip → root, blind at
    // each end; the short leg is the same width of Y turned 90° and driven out
    // through the seam face, and THAT is what frees the tongue's tip.
    expect(dt.slot.y0).toBeCloseTo(47.55, 12)
    expect(dt.slot.y1).toBeCloseTo(61.5, 12)
    expect(dt.slot.tipY0).toBe(dt.slot.y0)
    expect(dt.slot.tipY1 - dt.slot.tipY0).toBeCloseTo(c.springSlot, 12)
    expect(dt.slot.tipY1).toBeCloseTo(dt.springY0, 12)
    // The tip gap goes at the forward-most station that does NOT cut the middle
    // berth's seat pinch — one station splits un-sprung rail from tongue, so the
    // pinch and the relief window can never overlap.
    expect(dt.channelY1).toBeCloseTo(dt.midY0 + c.pinchLength, 12)
    expect(dt.springY0).toBeCloseTo(dt.channelY1 + c.springSlot, 12)
    // …and it still leaves the notch land in front of it
    expect(dt.springY0).toBeLessThan(dt.y0)
    // the free end is buried: ~48 mm from the front face, ~52 from the rear, with
    // a neighbour's groove around it. Nothing can reach it to snap it off — which
    // is the entire reason it is not at the module's front corner any more.
    expect(dt.springY0).toBeGreaterThan(45)
    expect(derived(sliding).outerD - dt.springY0).toBeGreaterThan(45)
    // and with the slot off the front face, the FRONT foot shares the rear's X
    // again instead of being squeezed into a band of its own
    expect(mf.xFront).toBe(mf.x)
    expect(mf.x).toBeCloseTo(13.375, 12)
    // that band's bounds stay as a scale gate — a scale that couldn't fit them
    // couldn't fit this pocket either
    expect(mf.frontHi - mf.frontLo).toBeCloseTo(5, 12)
  })

  it('the gates can fail — but none of them is what bounds this topology’s scale', () => {
    // The tongue is made of absolute knobs (leafT, maleDepth, springA, detent);
    // only the slab height reaches its section, and only through the skin's
    // height, so strain barely moves with scale and never reaches the gate.
    const strainAt = (scale_factor: number) =>
      slidingDetentGeometry(p({ joint_type: 'sliding_dovetail', scale_factor })).strainPct
    expect(strainAt(0.9)).toBeCloseTo(0.670375, 5)
    expect(strainAt(1.4)).toBeCloseTo(0.731238, 5)
    expect(strainAt(1.4) - strainAt(0.9)).toBeLessThan(0.07)
    for (const scale_factor of [0.9, 1, 1.2, 1.4])
      expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor }))).not.toContain(
        'detent_strain'
      )
    // …so the gates are proved on their predicates instead. Halving the free
    // length quadruples the strain, which is the same statement as ε ∝ 1/a²:
    expect((300 * c.detent * dt.leafC) / (c.springA / 2) ** 2).toBeGreaterThan(1)
    // The slot's own scale gate DOES bind, at S ≥ 0.88 — sc_wall = 2.5S + 1 has
    // to carry leafT + springSlot and still leave minBackingWall in front of the
    // bead channel — but the female's backing wall gives out first (S ≥ 0.98),
    // so the detent moves neither end of the buildable window.
    expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor: 0.87 }))).toContain(
      'detent_slot'
    )
    expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor: 0.88 }))).not.toContain(
      'detent_slot'
    )
    // The reach gate cannot be tripped from the studio: the berth's rear station
    // and the wedge both hang off outerD/2 and absolute knobs, so the margin is a
    // constant 3.23 mm at every size. Moving the ridge is a scad -D, and the
    // predicate is what decides:
    const reaches = (rearToe: number) => rearToe <= dt.berthY1
    expect(reaches(dt.rearToe)).toBe(true)
    expect(reaches(dt.berthY1 + 0.001)).toBe(false)
    expect(dt.rearToe - dt.y0).toBeCloseTo(1.544473, 5)
    expect(dt.berthY1 - dt.rearToe).toBeCloseTo(3.230579, 5)
    for (const scale_factor of [0.4, 0.85, 1, 1.35])
      expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor }))).not.toContain(
        'detent_reach'
      )
    // The channel's two gates are absolute in the same way — they read maleDepth,
    // the small neck and the ridge's own size, none of which scale — so they too
    // are proved on their predicates, at every size the studio can ask for.
    for (const scale_factor of [0.4, 0.85, 1, 1.35]) {
      const bad = failing(p({ joint_type: 'sliding_dovetail', scale_factor }))
      expect(bad).not.toContain('detent_channel_rail')
      expect(bad).not.toContain('detent_channel_flanks')
      expect(bad).not.toContain('detent_tip_land')
    }
    expect(c.maleDepth - dt.channelDepth).toBeCloseTo(1.6, 12)
    expect(dt.channelWidth).toBeCloseTo(2.2, 12)
  })
})

// ---- modular pitch and width --------------------------------------------------

describe('modular derived()', () => {
  it('modular pitch = mono pitch + one full web (the honest cost per seam)', () => {
    for (const S of [0.85, 1, 1.4]) {
      const mono = derived(p({ scale_factor: S }))
      const mod = derived(p({ scale_factor: S, seam_mode: 'modular' }))
      expect(mod.sCp).toBeCloseTo(mono.sCp + defaultParams.web * S, 12)
    }
  })

  it('width identity: 2·modWe + (cols−2)·scW === frameW for both modular joints', () => {
    // exact at defaults (all inputs are dyadic decimals): 2·26 + 11·15.5 = 222.5
    const d = derived(p({ seam_mode: 'modular' }))
    expect(d.scW).toBe(15.5)
    expect(d.modWe).toBe(26)
    expect(d.frameW).toBe(222.5)
    expect(2 * d.modWe + (defaultParams.cols - 2) * d.scW).toBe(222.5)
    // the sliding edge allowance widens every edge wall to 3.5: 2·27 + 11·17.5
    const s = derived(p({ seam_mode: 'modular', joint_type: 'sliding_dovetail' }))
    expect(s.scW).toBe(17.5)
    expect(s.modWe).toBe(27)
    expect(s.frameW).toBe(246.5)
    expect(2 * s.modWe + (defaultParams.cols - 2) * s.scW).toBe(246.5)
    // and to float precision across the knob space, on either topology
    for (const joint_type of ['vertical_snap', 'sliding_dovetail'] as const)
      for (const S of [0.85, 1, 1.4])
        for (const cols of [3, 13, 21]) {
          const dd = derived(p({ scale_factor: S, cols, seam_mode: 'modular', joint_type }))
          expect(2 * dd.modWe + (cols - 2) * dd.scW).toBeCloseTo(dd.frameW, 9)
        }
  })

  it('modular widens the abacus by (cols−1)·web·S, plus 2 mm per sliding seam', () => {
    expect(derived(p({ seam_mode: 'modular' })).frameW - derived(p()).frameW).toBeCloseTo(
      12 * 2.5,
      12
    )
    // the allowance is absolute (1 mm of print material per edge), so it does
    // NOT scale with the design the way the web does
    const slide = derived(p({ seam_mode: 'modular', joint_type: 'sliding_dovetail' }))
    expect(slide.frameW - derived(p({ seam_mode: 'modular' })).frameW).toBeCloseTo(12 * 2, 12)
    const over = { cols: 5, scale_factor: 0.9 } as const
    expect(
      derived(p({ ...over, seam_mode: 'modular' })).frameW - derived(p(over)).frameW
    ).toBeCloseTo(4 * 2.5 * 0.9, 12)
    expect(
      derived(p({ ...over, seam_mode: 'modular', joint_type: 'sliding_dovetail' })).frameW -
        derived(p({ ...over, seam_mode: 'modular' })).frameW
    ).toBeCloseTo(4 * 2, 12)
  })

  it('joint_type moves ONLY the module widths — the mono footprint is topology-blind', () => {
    const snap = derived(p())
    const slide = derived(p({ joint_type: 'sliding_dovetail' }))
    for (const k of Object.keys(snap) as (keyof typeof snap)[]) {
      if (k === 'scW' || k === 'modWe') continue
      expect(slide[k], `mono derived().${k} must not depend on joint_type`).toBe(snap[k])
    }
    expect(slide.scW).toBe(17.5)
    expect(slide.modWe).toBe(27)
  })

  it('mono is untouched: pre-CP4 pitch and outer dims, and seam_mode moves ONLY sCp/frameW', () => {
    const mono = derived(p())
    // the values every other pinned suite (feet, 3MF, text) has always assumed
    expect(mono.sCp).toBe(13)
    expect(mono.frameW).toBe(192.5)
    expect(mono.outerD).toBe(100.5)
    const mod = derived(p({ seam_mode: 'modular' }))
    for (const k of Object.keys(mono) as (keyof typeof mono)[]) {
      if (k === 'sCp' || k === 'frameW') continue
      expect(mod[k], `derived().${k} must not depend on seam_mode`).toBe(mono[k])
    }
  })

  it('isModular is the seam_mode predicate', () => {
    expect(isModular(p())).toBe(false)
    expect(isModular(p({ seam_mode: 'modular' }))).toBe(true)
  })
})

// ---- module feet layout --------------------------------------------------------

describe('moduleFeetLayout', () => {
  it('defaults: the 6.35 mm (1/4") class binds, centered beside the socket', () => {
    const mf = moduleFeetLayout(p())
    // sock = 4.5 + 0.1 + 0.3; band = 15.5 − 4.9 − 2·1.6 − 2·0.35 = 6.7 > 6.35
    expect(mf.sock).toBeCloseTo(4.9, 12)
    expect(mf.w).toBe(6.35)
    expect(mf.x).toBeCloseTo((4.9 + 15.5) / 2, 12) // 10.2
    // printed feet weld (fit 0) and auto-flare 0.35/side
    expect(mf.mouth).toBe(6.35)
    expect(mf.seat).toBeCloseTo(7.05, 12)
    expect(mf.fits).toBe(true)
    expect(mf.walls).toBe(true)
    expect(mf.capped).toBe(false)
  })

  it('the band becomes the binding constraint as the design shrinks', () => {
    // band(S) = 15S + 0.5 − 4.9 − 3.2 − 0.7 = 15S − 8.3 (printed feet, fit 0.1)
    const at85 = moduleFeetLayout(p({ scale_factor: 0.85 }))
    expect(at85.w).toBeCloseTo(15 * 0.85 - 8.3, 12) // 4.45 — band < class cap
    expect(at85.capped).toBe(true)
    expect(at85.fits).toBe(true)
    const at80 = moduleFeetLayout(p({ scale_factor: 0.8 }))
    expect(at80.w).toBeCloseTo(3.7, 12) // below the 4 mm floor
    expect(at80.fits).toBe(false)
    // monotone degradation
    expect(moduleFeetLayout(p()).w).toBeGreaterThan(at85.w)
    expect(at85.w).toBeGreaterThan(at80.w)
  })

  it('joint_fit deepens the socket and eats the band when the band binds', () => {
    const over = { scale_factor: 0.9 } as const // band-bound region
    const stock = moduleFeetLayout(p(over))
    const loose = moduleFeetLayout(p({ ...over, joint_fit: 0.3 }))
    expect(loose.sock).toBeCloseTo(stock.sock + 0.2, 12)
    expect(loose.w).toBeCloseTo(stock.w - 0.2, 12)
  })

  it('adhesive mode recovers the raw fit/undercut knobs from feetEffective', () => {
    // fitEff = 0.15, undercutEff = 0 → band = 15.5 − 4.9 − 3.2 − 0.3 = 7.1;
    // the 1/4" bumper (6.35) seats in it
    const mf = moduleFeetLayout(p({ feet_mode: 'adhesive', ...bumperParams(quarterBumper) }))
    expect(mf.w).toBe(6.35)
    expect(mf.mouth).toBeCloseTo(6.35 + 0.3, 12)
    expect(mf.seat).toBeCloseTo(mf.mouth, 12) // no flare asked for, none upgraded
  })

  it('adhesive carves the TRUE bumper width — the 6.35 stud cap is a printed-mode rule', () => {
    // 1/4" × 1/16" dome: fits the band, and the pocket class is IDENTICAL to
    // the mono corner pocket — every module offers the same seat
    const quarter = p({ feet_mode: 'adhesive', ...bumperParams(quarterBumper) })
    const mf = moduleFeetLayout(quarter)
    expect(mf.bumperFits).toBe(true)
    expect(mf.minScale).toBeNull()
    expect(mf.mouth).toBeCloseTo(feetEffective(quarter).mouth, 12)
    // 3/8" × 1/8" dome: 9.525 into a 7.1 band — kept at TRUE width and refused,
    // never silently shrunk to a pocket no bought bumper can seat in
    const threeEighths = p({ feet_mode: 'adhesive', ...bumperParams(threeEighthsBumper) })
    const wide = moduleFeetLayout(threeEighths)
    expect(wide.w).toBeCloseTo(9.525, 12)
    expect(wide.bumperFits).toBe(false)
    // the band scales while the socket doesn't: band(S) = 15S − 7.9 at these
    // knobs, so 9.525 first fits at S = 17.425/15 ≈ 1.162
    expect(wide.minScale).toBeCloseTo(17.425 / 15, 5)
    expect(
      moduleFeetLayout({ ...threeEighths, scale_factor: wide.minScale as number }).bumperFits
    ).toBe(true)
  })

  it('printed mode keeps the stud cap: the same 3/8" foot prints capped, not refused', () => {
    const mf = moduleFeetLayout(p({ ...bumperParams(threeEighthsBumper), feet_mode: 'printed' }))
    expect(mf.w).toBe(6.35)
    expect(mf.bumperFits).toBe(true)
    expect(mf.minScale).toBeNull()
  })
})

describe('moduleFeetPositions', () => {
  it('mid feet sit beside the socket at the mono corner inset', () => {
    const { c } = feetEffective(p())
    expect(c).toBeCloseTo(6.35, 12) // circle @ defaults: chamf + 0.5 + seat/2
    const [[x1, y1], [x2, y2]] = moduleFeetPositions(p(), 'mid')
    expect(x1).toBeCloseTo(10.2, 12) // (sock + scW)/2
    expect(x2).toBe(x1)
    expect(y1).toBe(c)
    expect(y2).toBe(100.5 - c)
  })

  it('end modules keep the monolith corner feet; right collapses to modWe − c', () => {
    const { c } = feetEffective(p())
    expect(moduleFeetPositions(p(), 'left')).toEqual([
      [c, c],
      [c, 100.5 - c],
    ])
    expect(moduleFeetPositions(p(), 'right')).toEqual([
      [26 - c, c],
      [26 - c, 100.5 - c],
    ])
  })

  it('right-module local X is independent of cols (the mono frame width cancels)', () => {
    expect(moduleFeetPositions(p({ cols: 5 }), 'right')[0][0]).toBe(
      moduleFeetPositions(p({ cols: 13 }), 'right')[0][0]
    )
  })
})

// ---- seamFit verdict table ------------------------------------------------------

const failing = (params: Params): string[] =>
  seamFit(params)
    .verdicts.filter((v) => !v.ok)
    .map((v) => v.code)

describe('seamFit', () => {
  it('defaults pass every row; strain is the wood-PLA number the coupon shipped with', () => {
    const fit = seamFit(p())
    expect(fit.ok).toBe(true)
    // ε = 150·t·Y/L² = 150·1.2·0.25/8² = 45/64 — the flexure gate's own worst case
    expect(fit.strainPct).toBeCloseTo(45 / 64, 12)
    expect(fit.verdicts.map((v) => v.code)).toEqual([
      'strain',
      'dove_walls',
      'clip_walls',
      'seat',
      'module_feet',
      'feet_bumper',
      'feet_socket',
      'feet_crossbar',
    ])
  })

  it('a too-wide stick-on bumper trips feet_bumper (and the socket-wall row) with the feet_w knob', () => {
    const wide = p({ feet_mode: 'adhesive', ...bumperParams(threeEighthsBumper) })
    expect(failing(wide)).toEqual(['feet_bumper', 'feet_socket'])
    const row = seamFit(wide).verdicts.find((v) => v.code === 'feet_bumper')
    expect(row?.knob).toBe('feet_w')
    expect(row?.message).toContain('9.5 mm into a 7.1 mm band')
    // the bumper that fits passes every row — every module carries a usable seat
    expect(seamFit(p({ feet_mode: 'adhesive', ...bumperParams(quarterBumper) })).ok).toBe(true)
  })

  it('S = 0.6: bar strip, seat and module feet all fail — but the marker-held borders hold', () => {
    // clip needs 7.1 ≤ bar·S = 4.5; seat stack 6.7 ≤ s_fh = 4.8; foot band goes
    // negative. The dovetail row PASSES: shelf auto-grows for the ArUco tile, so
    // the border strips stay ≈13 mm wide long after everything else collapses.
    expect(failing(p({ scale_factor: 0.6 }))).toEqual(['clip_walls', 'seat', 'module_feet'])
  })

  it('feet off ⇒ the three feet rows pass trivially (same predicate as the scad asserts)', () => {
    expect(failing(p({ scale_factor: 0.6, feet_mode: 'none' }))).toEqual(['clip_walls', 'seat'])
  })

  it('joint_fit is a real lever: 1.0 mm of slop breaches both socket-wall rows', () => {
    // dove: 6 + 2(1+1) + 3.2 = 13.2 > border strip 13; clip: 8.9 > bar 7.5
    expect(failing(p({ joint_fit: 1.0 }))).toEqual(['dove_walls', 'clip_walls'])
  })

  it('every verdict names a knob the panel can point at', () => {
    for (const v of seamFit(p({ scale_factor: 0.6, joint_fit: 1.0 })).verdicts) {
      expect(['scale_factor', 'joint_fit', 'feet_w', 'feet_mode', 'none']).toContain(v.knob)
      expect(v.message.length).toBeGreaterThan(0)
    }
  })

  it.each(SLIDING_FIT_VALUES)(
    'sliding fit %.2f derives groove and flank-normal clearance',
    (fit) => {
      const g = slidingDovetailDerived(fit)
      expect(g.grooveDepth).toBeCloseTo(2 + fit, 12)
      expect(g.runningClearance).toBeCloseTo(fit * Math.sin((14 * Math.PI) / 180), 12)
      expect(seamFit(p({ joint_type: 'sliding_dovetail', joint_fit: fit })).ok).toBe(true)
    }
  )

  it('sliding dispatch changes foot topology while vertical arithmetic stays unchanged', () => {
    const vertical = moduleFeetLayout(p())
    const sliding = moduleFeetLayout(p({ joint_type: 'sliding_dovetail' }))
    expect(vertical.sock).toBeCloseTo(4.9, 12)
    // sliding sock clears the DEEP ANCHOR pocket — deep depth + fit + floor
    // relief. A 9 mm bite reaches most of the way across the module, so the
    // band beside it is what sizes the rear foot: 17.5 − 9.25 − 3.2 − 0.7 =
    // 4.35, still over the 4 mm floor, and 1.6 mm of wall on both sides.
    expect(sliding.sock).toBeCloseTo(9.25, 12)
    expect(sliding.band).toBeCloseTo(4.35, 12)
    expect(sliding.w).toBeCloseTo(4.35, 12)
    expect(sliding.capped).toBe(true)
    expect(sliding.fits).toBe(true)
    expect(sliding.x).toBeCloseTo(13.375, 12)
    expect(sliding.seat).toBeCloseTo(5.05, 12)
    expect(sliding.x - sliding.seat / 2 - sliding.sock).toBeCloseTo(1.6, 12)
    expect(
      derived(p({ joint_type: 'sliding_dovetail' })).scW - sliding.x - sliding.seat / 2
    ).toBeCloseTo(1.6, 12)
    expect(sliding.walls).toBe(true)
    expect(seamFit(p()).verdicts.map((v) => v.code)).toEqual([
      'strain',
      'dove_walls',
      'clip_walls',
      'seat',
      'module_feet',
      'feet_bumper',
      'feet_socket',
      'feet_crossbar',
    ])
  })

  it('sliding verdict table: retention is physics, plus the detent’s own gates', () => {
    const fit = seamFit(p({ joint_type: 'sliding_dovetail' }))
    expect(fit.ok).toBe(true)
    // the one flexure: the male tongue the notch is cut into, at the engagement
    // it gives up to let the ridge past
    expect(fit.strainPct).toBeCloseTo(0.685433, 5)
    expect(fit.verdicts.map((v) => v.code)).toEqual([
      'sliding_fit',
      'backing_wall',
      'z_lips',
      'datum_lead',
      'deep_backing',
      'deep_lip',
      'anchor_flanks',
      'anchor_flats',
      'anchor_lead_tip',
      'anchor_lead_bearing',
      'mouth_lip',
      'detent_flanks',
      'detent_rail',
      'detent_pinch',
      'detent_reach',
      'detent_retract',
      'detent_tip_land',
      'detent_channel_rail',
      'detent_channel_flanks',
      'detent_strain',
      'detent_push',
      'detent_backlash',
      'detent_skin',
      'detent_slot',
      'detent_slot_end',
      'retention',
      'module_feet',
      'feet_bumper',
      'feet_socket',
      'feet_crossbar',
      'feet_front_band',
    ])
    const retention = fit.verdicts.find((v) => v.code === 'retention')
    expect(retention?.ok).toBe(true)
    expect(retention?.knob).toBe('none')
    expect(retention?.message).toContain('self-holding')
  })

  it('the deeper rail is paid for by the edge allowance: the backing wall is unmoved', () => {
    // 2.5S + 1 − (2 + 0.1 + 0.15) is the same 2.5S − 1.25 a 1 mm rail had, so
    // the sliding topology's minimum scale is exactly where it was: S ≥ 0.98.
    const row = (S: number) =>
      seamFit(p({ joint_type: 'sliding_dovetail', scale_factor: S })).verdicts.find(
        (v) => v.code === 'backing_wall'
      )
    expect(row(1)?.message).toContain('1.25 mm backing wall')
    expect(row(1)?.ok).toBe(true)
    expect(row(0.98)?.ok).toBe(true)
    expect(row(0.97)?.ok).toBe(false)
  })

  it('sliding rejects non-coupon fit, thin backing and an anchor the slab cannot hold', () => {
    expect(failing(p({ joint_type: 'sliding_dovetail', joint_fit: 0.13 }))).toContain('sliding_fit')
    expect(
      failing(p({ joint_type: 'sliding_dovetail', joint_fit: 0.1, scale_factor: 0.8 }))
    ).toContain('backing_wall')
    // The berth floor and the ceiling lip mirroring it are BOTH absolute, so
    // deep_lip is scale-free now (1.8 − 0.1 = 1.7 ≥ 1.2 at every size) — what
    // shrinking actually kills is the room between neck and floor.
    const at85 = failing(p({ joint_type: 'sliding_dovetail', joint_fit: 0.1, scale_factor: 0.85 }))
    expect(at85).not.toContain('deep_lip')
    expect(at85).toContain('anchor_flanks') // 3.4 − 1.7 − 1.8 = −0.10 < 0.30
    expect(at85).toContain('z_lips') // (6.8 − 4.5718)/2 = 1.11 < 1.2
    // the gate opens just under S = 0.95 (4S − 3.5 ≥ 0.3), well below the
    // backing wall's S ≥ 0.98, so it never fires alone on a buildable design
    expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor: 0.96 }))).not.toContain(
      'anchor_flanks'
    )
    // …and GROWING is bounded too, uniquely in this cluster: a taller slab puts
    // the neck further above the absolute floor, so the flanks run longer before
    // they clamp. Past S ≈ 1.374 they would reach the floor behind the tip, and
    // the anchor is still what says so — the detent's own rows are all absolute
    // knobs, so the window is exactly the one this topology had before the click.
    expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor: 1.4 }))).toEqual([
      'anchor_flats',
    ])
    expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor: 1.37 }))).toEqual([])
    expect(failing(p({ joint_type: 'sliding_dovetail', scale_factor: 1.15 }))).toEqual([])
  })
})

// ---- preview dedup key ------------------------------------------------------------

describe('previewDedupKey', () => {
  it('part-only keys are DEFINE_KEYS (a part-only key the worker never sees is a no-op)', () => {
    for (const k of PART_ONLY_DEFINE_KEYS) expect(DEFINE_KEYS).toContain(k)
  })

  it('joint_fit rides every render and re-solves topology-dependent preview geometry', () => {
    expect(definesFrom(p())).toContain('-Djoint_fit=0.1')
    expect(definesFrom(p())).toContain('-Djoint_type="vertical_snap"')
    expect(definesFrom(p())).toContain('-Dseam_mode="mono"')
    expect(previewDedupKey(p({ joint_fit: 0.25 }))).not.toBe(previewDedupKey(p()))
    expect(previewDedupKey(p())).toContain('-Djoint_fit=0.1')
  })

  it('joint topology, seam_mode, and ordinary geometry knobs DO move the key', () => {
    expect(previewDedupKey(p({ joint_type: 'sliding_dovetail' }))).not.toBe(previewDedupKey(p()))
    expect(previewDedupKey(p({ seam_mode: 'modular' }))).not.toBe(previewDedupKey(p()))
    expect(previewDedupKey(p({ cols: 7 }))).not.toBe(previewDedupKey(p()))
  })

  it('the key is the define list minus part-only entries, joined unambiguously', () => {
    const parts = previewDedupKey(p()).split('\u0001')
    expect(parts).toHaveLength(definesFrom(p()).length - PART_ONLY_DEFINE_KEYS.length)
    for (const d of definesFrom(p())) expect(d).not.toContain('\u0001')
  })
})

// ---- snapshot back-compat -----------------------------------------------------------

describe('design snapshots across the CP4 vocabulary change', () => {
  const envelope = (params: Record<string, unknown>) => ({
    v: 1,
    params,
    overrides: {},
    profileId: '',
  })

  it('pre-CP4 snapshots (no seam keys) load as mono at stock fit — zero migration', () => {
    const old: Record<string, unknown> = { ...defaultParams }
    delete old.seam_mode
    delete old.joint_fit
    const snap = parseDesignSnapshot(envelope(old))
    expect(snap?.params.seam_mode).toBe('mono')
    expect(snap?.params.joint_fit).toBe(0.1)
  })

  it('a modular design round-trips, including a negative tuned fit', () => {
    const snap = parseDesignSnapshot(
      envelope({ ...defaultParams, seam_mode: 'modular', joint_fit: -0.05 })
    )
    expect(snap?.params.seam_mode).toBe('modular')
    expect(snap?.params.joint_fit).toBe(-0.05)
  })

  it('per-key junk degrades to defaults, same as every other param', () => {
    const snap = parseDesignSnapshot(
      envelope({ ...defaultParams, seam_mode: 42, joint_fit: '0.2' })
    )
    expect(snap?.params.seam_mode).toBe('mono')
    expect(snap?.params.joint_fit).toBe(0.1)
  })
})

// ---- the assembled modular preview and the shell classifier (CP5) --------------
// The modular assembly seats modules at ZERO gap, so OpenSCAD's union welds the
// chain into one connected mesh — and the viewer's recolor pass leans on exactly
// that: analyzeShells must see ONE frame shell (the widest), not one per module.
// The soup below models a two-module seam the way the 3MF fixture models the
// frame: rectangles that SHARE their seam-edge vertices, which is what a real
// dissolved seam looks like to the 0.01 mm weld grid.

const rect = (x0: number, x1: number, y0 = 95, y1 = 105): number[] => [
  ...[x0, y0, 0, x1, y0, 0, x1, y1, 0],
  ...[x0, y0, 0, x1, y1, 0, x0, y1, 0],
]
const beadTri = (x: number, y: number): number[] => [x - 1, y - 1, 0, x + 1, y - 1, 0, x, y + 1, 0]

describe('analyzeShells on a welded modular chain', () => {
  const mp = p({ seam_mode: 'modular' })
  const d = derived(mp)
  const sEm = mp.border_w * mp.scale_factor + d.sEm // bead-0 center x
  const sHy = mp.border_w * mp.scale_factor + d.sHy // heaven row y

  it('zero-gap modules weld transitively into ONE frame shell; beads land on the modular grid', () => {
    // left end + two mids, each sharing its seam-edge vertices with the next —
    // welded span 57 beats the 2-pitch (31) frame threshold
    const soup = new Float32Array([
      ...rect(0, d.modWe),
      ...rect(d.modWe, d.modWe + d.scW),
      ...rect(d.modWe + d.scW, d.modWe + 2 * d.scW),
      ...beadTri(sEm, sHy), // column 0, heaven row
      ...beadTri(sEm + 2 * d.sCp, sHy - 3 * d.sEp), // column 2, earth region
    ])
    const { shellInfo } = analyzeShells(soup, mp)
    expect(shellInfo).toHaveLength(3)
    expect(shellInfo.filter((s) => s.isFrame)).toHaveLength(1)
    const beads = shellInfo.filter((s) => !s.isFrame)
    expect(beads.map((b) => [b.i, b.isHeaven])).toEqual([
      [0, true],
      [2, false],
    ])
  })

  it('negative control: a real gap splits the chain — the zero-gap seat is load-bearing', () => {
    const soup = new Float32Array([
      ...rect(0, d.modWe),
      ...rect(d.modWe, d.modWe + d.scW), // welded pair: span 41.5, still the frame
      ...rect(d.modWe + d.scW + 0.05, d.modWe + 2 * d.scW), // 0.05 mm gap > the weld grid
      ...beadTri(sEm, sHy),
    ])
    const { shellInfo } = analyzeShells(soup, mp)
    expect(shellInfo).toHaveLength(3) // welded pair + the stranded module + one bead
    expect(shellInfo.filter((s) => s.isFrame)).toHaveLength(1) // widest wins, the strand does not
  })
})

// ---- the exploded "take it apart" view --------------------------------------
// With explode > 0 every module is its own shell, so the widest-shell heuristic
// dies: the exploded classifier calls ANY shell spanning the full frame depth in
// Y a frame (module slabs span exactly outerD; beads never come close), and the
// bead column pitch widens to sCp + explode because column i rides module i.
// Explode is view state, never a Param — the 2-arg calls above double as the
// e=0 regression control.

describe('analyzeShells on the exploded ("take it apart") chain', () => {
  const mp = p({ seam_mode: 'modular' })
  const d = derived(mp)
  const sEm = mp.border_w * mp.scale_factor + d.sEm
  const sHy = mp.border_w * mp.scale_factor + d.sHy
  const e = EXPLODE_GAP
  // exploded module slab: full frame depth in Y, unlike the shallow rect() strips
  const slab = (x0: number, x1: number): number[] => rect(x0, x1, 0, d.outerD)

  it('separated modules all classify as frame by Y span; beads map by the widened pitch', () => {
    const soup = new Float32Array([
      ...slab(0, d.modWe), // left end (carries column 0)
      ...slab(d.modWe + e, d.modWe + d.scW + e), // mid 1, slid by 1·e
      ...slab(d.modWe + d.scW + 2 * e, d.modWe + 2 * d.scW + 2 * e), // mid 2, slid by 2·e
      ...beadTri(sEm, sHy), // column 0, heaven row — seated position
      ...beadTri(sEm + 2 * (d.sCp + e), sHy - 3 * d.sEp), // column 2 rides mid 2
    ])
    const { shellInfo } = analyzeShells(soup, mp, e)
    expect(shellInfo).toHaveLength(5)
    expect(shellInfo.filter((s) => s.isFrame)).toHaveLength(3)
    const beads = shellInfo.filter((s) => !s.isFrame)
    expect(beads.map((b) => [b.i, b.isHeaven])).toEqual([
      [0, true],
      [2, false],
    ])
  })

  it('explode=0 takes exactly the seated path — same result object as the 2-arg call', () => {
    const soup = new Float32Array([
      ...rect(0, d.modWe),
      ...rect(d.modWe, d.modWe + d.scW),
      ...beadTri(sEm, sHy),
    ])
    expect(analyzeShells(soup, mp, 0)).toEqual(analyzeShells(soup, mp))
  })

  it('mono designs never explode: nonzero explode keeps the widest-shell rule and pitch', () => {
    const mono = p()
    const dm = derived(mono)
    const sEmM = mono.border_w * mono.scale_factor + dm.sEm
    const sHyM = mono.border_w * mono.scale_factor + dm.sHy
    const soup = new Float32Array([
      ...rect(0, 100), // wide shallow strip — only the widest-shell rule calls this a frame
      ...beadTri(sEmM + dm.sCp, sHyM),
    ])
    const { shellInfo } = analyzeShells(soup, mono, e)
    expect(shellInfo.map((s) => s.isFrame)).toEqual([true, false])
    expect(shellInfo[1].i).toBe(1) // pitch NOT widened — explode is modular-only
  })
})
