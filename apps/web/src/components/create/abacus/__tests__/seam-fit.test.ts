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
  feetEffective,
  isModular,
  moduleFeetLayout,
  moduleFeetPositions,
  PART_ONLY_DEFINE_KEYS,
  type Params,
  previewDedupKey,
  SEAM,
  SLIDING_DOVETAIL,
  SLIDING_FIT_VALUES,
  seamFit,
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
      ['seatClear', 'slide_seat_clear'],
      ['mouthFlare', 'slide_mouth_flare'],
    ]
    for (const [ts, scad] of pins) expect(SLIDING_DOVETAIL[ts]).toBe(knob(scad))
    const g = slidingDovetailDerived(0.1)
    // graduated key family: neck ± step, heads = neck + 2·depth·tan14° (+0.498656)
    expect(g.necks.s).toBeCloseTo(2.2, 12)
    expect(g.necks.m).toBe(2.8)
    expect(g.necks.l).toBeCloseTo(3.4, 12)
    expect(g.head).toBeCloseTo(3.298656, 5)
    expect(g.headL).toBeCloseTo(3.898656, 5)
    // deepest female cut = depth + fit + floor relief = 1.25 at coupon fit 0.10
    expect(g.deepestCut).toBeCloseTo(1.25, 12)
    // widest female Z opening = flared rear mouth: 4.6 + 2·1.35·tan14° = 5.273186
    expect(g.mouthOpening).toBeCloseTo(5.273186, 5)
    // any key passing a one-step-up section clears ≥ step/2 + fit·tan14° per side
    expect(g.passClearance).toBeCloseTo(0.324933, 5)
    // retention physics: 0.05/1.5 seat taper = 1.909° ≪ atan(µ 0.25) = 14.036°
    expect(g.seatTaperDeg).toBeCloseTo(1.90915, 4)
    expect(g.selfHoldLimitDeg).toBeCloseTo(14.03624, 4)
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

  it('width identity: 2·modWe + (cols−2)·scW === frameW in modular mode', () => {
    // exact at defaults (all inputs are dyadic decimals): 2·26 + 11·15.5 = 222.5
    const d = derived(p({ seam_mode: 'modular' }))
    expect(d.scW).toBe(15.5)
    expect(d.modWe).toBe(26)
    expect(d.frameW).toBe(222.5)
    expect(2 * d.modWe + (defaultParams.cols - 2) * d.scW).toBe(222.5)
    // and to float precision across the knob space
    for (const S of [0.85, 1, 1.4])
      for (const cols of [3, 13, 21]) {
        const dd = derived(p({ scale_factor: S, cols, seam_mode: 'modular' }))
        expect(2 * dd.modWe + (cols - 2) * dd.scW).toBeCloseTo(dd.frameW, 9)
      }
  })

  it('modular widens the abacus by exactly (cols−1)·web·S', () => {
    expect(derived(p({ seam_mode: 'modular' })).frameW - derived(p()).frameW).toBeCloseTo(
      12 * 2.5,
      12
    )
    const over = { cols: 5, scale_factor: 0.9 } as const
    expect(
      derived(p({ ...over, seam_mode: 'modular' })).frameW - derived(p(over)).frameW
    ).toBeCloseTo(4 * 2.5 * 0.9, 12)
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
      expect(g.grooveDepth).toBeCloseTo(1 + fit, 12)
      expect(g.runningClearance).toBeCloseTo(fit * Math.sin((14 * Math.PI) / 180), 12)
      expect(seamFit(p({ joint_type: 'sliding_dovetail', joint_fit: fit })).ok).toBe(true)
    }
  )

  it('sliding dispatch changes foot topology while vertical arithmetic stays unchanged', () => {
    const vertical = moduleFeetLayout(p())
    const sliding = moduleFeetLayout(p({ joint_type: 'sliding_dovetail' }))
    expect(vertical.sock).toBeCloseTo(4.9, 12)
    // sliding sock clears the DEEPEST female cut: groove depth + floor relief
    expect(sliding.sock).toBeCloseTo(1.25, 12)
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

  it('sliding verdict table: no flexures, so no strain row — retention is physics instead', () => {
    const fit = seamFit(p({ joint_type: 'sliding_dovetail' }))
    expect(fit.ok).toBe(true)
    expect(fit.strainPct).toBe(0) // nothing bends in this topology
    expect(fit.verdicts.map((v) => v.code)).toEqual([
      'sliding_fit',
      'backing_wall',
      'z_lips',
      'datum_lead',
      'retention',
      'module_feet',
      'feet_bumper',
      'feet_socket',
      'feet_crossbar',
    ])
    const retention = fit.verdicts.find((v) => v.code === 'retention')
    expect(retention?.ok).toBe(true)
    expect(retention?.knob).toBe('none')
    expect(retention?.message).toContain('self-holding')
  })

  it('sliding rejects non-coupon fit and insufficient backing wall', () => {
    expect(failing(p({ joint_type: 'sliding_dovetail', joint_fit: 0.13 }))).toContain('sliding_fit')
    expect(
      failing(p({ joint_type: 'sliding_dovetail', joint_fit: 0.1, scale_factor: 0.8 }))
    ).toContain('backing_wall')
    // S=0.85: lips (6.8 − 5.273)/2 = 0.76 < 1.2 — the flared mouth is the widest cut
    expect(
      failing(p({ joint_type: 'sliding_dovetail', joint_fit: 0.1, scale_factor: 0.85 }))
    ).toContain('z_lips')
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

