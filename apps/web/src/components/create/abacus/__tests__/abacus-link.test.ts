import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE, solve } from '../abacus-solver'
import { borderEff, defaultParams, derived, type Params, webEff } from '../abacus-model'
import {
  BOX_CLEAR,
  defaultLinkParams,
  type LinkParams,
  linkDerived,
  linkFit,
  linkHingeDroop,
  linkMechanics,
  linkParamsOf,
  MIN_TAKEUP,
  SELF_LOCK_MAX_DEG,
} from '../abacus-link'

// The AbacusLink joint's arithmetic. There is no headless OpenSCAD in this repo
// (see export-defines.test.ts), so abacus-link.scad's asserts only ever fire
// inside a user's render — these are the copy that runs in CI.
//
// Two of the guards below exist because their failure is SILENT: the part still
// renders, still slices, still prints, and still clicks together. Those two get
// dedicated cases rather than riding along in a table.

const withP = (over: Partial<LinkParams>): LinkParams => ({ ...defaultLinkParams, ...over })
const codes = (p: LinkParams) => linkFit(p).problems.map((x) => x.code)

describe('linkDerived', () => {
  it('puts the chevron flank inside the self-support limit at defaults', () => {
    // atan(1.6 / 2) — the flank off VERTICAL. 45° is where the groove's roof
    // stops being printable, so this is the margin that matters.
    expect(linkDerived(defaultLinkParams).flankDeg).toBeCloseTo(38.66, 2)
    expect(linkDerived(defaultLinkParams).flankDeg).toBeLessThan(45)
  })

  it('derives the seating travel from the flank, not from the ramp', () => {
    // The two angles are unrelated and the early draft of the scad conflated
    // them, which made the relief guard demand 0.53 mm instead of 0.18 and
    // refused a geometry that is fine. Pinned so it cannot come back.
    const d = linkDerived(defaultLinkParams)
    expect(d.seatTravel).toBeCloseTo(0.1 / Math.cos((38.66 * Math.PI) / 180), 3)
    expect(d.seatTravel).toBeLessThan(defaultLinkParams.relief)
  })

  it('take-up is the cam face x-run, and clears the print-spread floor', () => {
    const p = defaultLinkParams
    const d = linkDerived(p)
    expect(d.takeUp).toBeCloseTo(p.bump * Math.tan((p.rampDeg * Math.PI) / 180), 4)
    expect(d.takeUp).toBeGreaterThanOrEqual(MIN_TAKEUP)
  })
})

describe('linkFit — the defaults are buildable', () => {
  it('accepts the shipped coupon geometry', () => {
    expect(linkFit(defaultLinkParams)).toEqual({ fits: true, problems: [] })
  })
})

describe('linkFit — the two silent failures', () => {
  it('refuses relief that lets the seam faces bottom out before the chevron seats', () => {
    // Silent because everything downstream still works: it renders, prints, and
    // clicks. What is lost is the chevron's Z registration — which is the only
    // thing keeping the four ArUco markers coplanar across a stack, and the CV
    // homography assumes coplanar and will not complain when they aren't.
    const p = withP({ relief: 0.12 })
    expect(codes(p)).toContain('relief-too-small')
    expect(linkFit(p).problems[0].knob).toBe('relief')
  })

  it('refuses a foot pocket that overlaps the latch slot', () => {
    // Silent in the other direction: OpenSCAD unions the two voids without
    // comment, and the result is a latch shoulder with a hole through it.
    expect(codes(withP({ footY: 6.5 }))).toContain('foot-hits-slot')
    // and the shipped 5/16" bumper is exactly what does NOT fit — the finding
    // that set the 1/4" preset and the widened strip.
    expect(codes(withP({ footW: 7.94, footY: 6.5 }))).toContain('foot-hits-slot')
  })
})

describe('linkFit — the loud ones', () => {
  it.each([
    ['toothD', { toothD: 2.4 }, 'flank-overhang'],
    ['rampDeg above the friction angle', { rampDeg: 20 }, 'ramp-not-self-locking'],
    ['bump too small to cam', { bump: 0.2, slot: 0.5 }, 'takeup-too-small'],
    ['slot narrower than the barb', { slot: 0.9 }, 'slot-binds'],
    ['tongue too close to the outer wall', { beamY0: 1.9 }, 'wall-too-thin'],
    ['station too shallow for the slot', { station: 5.0 }, 'slot-past-station'],
    ['foot wider than the strip', { footW: 12.7 }, 'foot-off-strip'],
  ])('refuses %s', (_label, over, code) => {
    expect(codes(withP(over))).toContain(code)
  })

  it('names a knob that actually moves the failing quantity', () => {
    for (const problem of linkFit(withP({ toothD: 2.4, rampDeg: 20, slot: 0.5 })).problems) {
      expect(Object.keys(defaultLinkParams)).toContain(problem.knob)
    }
  })
})

describe('linkMechanics', () => {
  it('self-locks at the default ramp and stops doing so past the friction angle', () => {
    expect(linkMechanics(defaultLinkParams).selfLocking).toBe(true)
    expect(linkMechanics(withP({ rampDeg: SELF_LOCK_MAX_DEG + 1 })).selfLocking).toBe(false)
  })

  it('keeps the tongue under PLA yield while still developing useful clamp', () => {
    const m = linkMechanics(defaultLinkParams)
    expect(m.beamStressMPa).toBeLessThan(50) // PLA yields ~55 MPa; peak is transient
    // 25 N hand press with a foot under every column wants 70 N; being carried
    // by one end wants ~105 N. Both inside the seated preload.
    expect(m.clampPerSeam).toBeGreaterThan(100)
  })

  it('quotes the preload at the SEATED position, not at full travel', () => {
    // Full travel is the insertion peak. Reporting it as the preload would
    // overstate what the seam actually holds by exactly 2×, which is the kind of
    // error that survives all the way to a physical part that feels loose.
    const m = linkMechanics(defaultLinkParams)
    expect(m.springForceFull).toBeCloseTo(2 * m.springForceSeated, 6)
    expect(m.clampPerStation).toBeCloseTo(
      m.springForceSeated / Math.tan((defaultLinkParams.rampDeg * Math.PI) / 180),
      6
    )
  })

  it('trades clamp against stress as the tongue shortens — the reason L is 12', () => {
    const short = linkMechanics(withP({ beamL: 8 }))
    const long = linkMechanics(defaultLinkParams)
    expect(short.clampPerSeam).toBeGreaterThan(long.clampPerSeam) // ∝ 1/L³
    expect(short.beamStressMPa).toBeGreaterThan(long.beamStressMPa) // ∝ 1/L²
    expect(short.beamStressMPa).toBeGreaterThan(50) // and that is what rules it out
  })

  it('trades clamp against take-up as the ramp steepens — the coupon sweep', () => {
    const steep = linkMechanics(withP({ rampDeg: 16 }))
    expect(steep.clampPerSeam).toBeLessThan(linkMechanics(defaultLinkParams).clampPerSeam)
    expect(linkDerived(withP({ rampDeg: 16 })).takeUp).toBeGreaterThan(
      linkDerived(defaultLinkParams).takeUp
    )
    // …and every rung of the sweep is still a legal geometry, so §9 can print
    // all three on one plate without hand-editing anything else.
    for (const rampDeg of [8, 12, 16]) expect(linkFit(withP({ rampDeg })).fits).toBe(true)
  })
})

describe('linkHingeDroop', () => {
  it('turns a twentieth of a millimetre of latch play into centimetres of droop', () => {
    // The number the whole cam mechanism exists to avoid: 0.05 mm of residual
    // clearance per joint, twelve joints in series, cantilevered from one end.
    const droop = linkHingeDroop(defaultLinkParams, 0.05, 12)
    expect(droop).toBeGreaterThan(6)
    expect(droop).toBeLessThan(11)
  })

  it('is linear in the residual clearance — which is why zero is the target', () => {
    expect(linkHingeDroop(defaultLinkParams, 0.1, 12)).toBeCloseTo(
      2 * linkHingeDroop(defaultLinkParams, 0.05, 12),
      6
    )
    expect(linkHingeDroop(defaultLinkParams, 0, 12)).toBe(0)
  })
})

describe('linkParamsOf — the bridge onto a real design', () => {
  it('takes its envelope from the design, not from the coupon defaults', () => {
    const modular: Params = { ...defaultParams, link_mode: 'modular' }
    const lp = linkParamsOf(modular)
    // pitch and station come off derived(), so they track the modular floors:
    // web 2.5 → 4.5 gives a 15 mm pitch, border 5.25 → 7.0 a 14.75 mm strip.
    expect(lp.pitch).toBeCloseTo(15, 6)
    expect(lp.station).toBeCloseTo(14.75, 6)
    expect(lp.h).toBeCloseTo(8, 6)
    expect(linkFit(lp).fits).toBe(true)
  })

  it('follows scale_factor, because the joint envelope scales but the joint does not', () => {
    const big = linkParamsOf({ ...defaultParams, link_mode: 'modular', scale_factor: 1.5 })
    expect(big.h).toBeCloseTo(12, 6)
    expect(big.pitch).toBeGreaterThan(20)
    // the tongue and barb are absolute hardware and must NOT have scaled
    expect(big.beamL).toBe(defaultLinkParams.beamL)
    expect(big.bump).toBe(defaultParams.link_bump)
  })

  it('seats the foot clear of the latch slot, measured off the slot far edge', () => {
    // The scad's link_foot_y() and this have to agree, or the pocket is punched
    // through the shoulder. Measuring off the barb (the slot's NEAR edge) is the
    // mistake this pins against.
    const lp = linkParamsOf({ ...defaultParams, link_mode: 'modular' })
    const d = linkDerived(lp)
    expect(lp.footY - lp.footW / 2).toBeCloseTo(d.slotBox[3] + BOX_CLEAR, 6)
    expect(linkFit(lp).problems.map((p) => p.code)).not.toContain('foot-hits-slot')
  })

  it('refuses a design whose modular pitch is too narrow for the tongue', () => {
    // The tongue is absolute, so shrinking the abacus is what eventually breaks
    // the joint — the size floor modular mode has and the monolith does not.
    const tiny = linkParamsOf({ ...defaultParams, link_mode: 'modular', scale_factor: 0.5 })
    expect(linkFit(tiny).problems.map((p) => p.code)).toContain('slot-past-pitch')
  })
})

describe('the modular dimension floors', () => {
  it('raise web and border only in modular mode, and never lower them', () => {
    expect(webEff(defaultParams)).toBe(defaultParams.web)
    expect(borderEff(defaultParams)).toBe(defaultParams.border_w)
    const m: Params = { ...defaultParams, link_mode: 'modular' }
    expect(webEff(m)).toBe(4.5)
    expect(borderEff(m)).toBe(7.0)
    // a design that already asked for more keeps it
    expect(webEff({ ...m, web: 6 })).toBe(6)
    expect(borderEff({ ...m, border_w: 9 })).toBe(9)
  })

  it('grows the abacus by the amount the spec quotes', () => {
    const mono = derived(defaultParams)
    const mod = derived({ ...defaultParams, link_mode: 'modular' })
    expect(mono.frameW).toBeCloseTo(192.5, 4)
    expect(mono.outerD).toBeCloseTo(100.5, 4)
    expect(mod.frameW).toBeCloseTo(220.0, 4)
    expect(mod.outerD).toBeCloseTo(104.0, 4)
  })

  it('makes the solver judge the HALF-web, which is the wall that has to print', () => {
    // The two modes diverge in a narrow band, and 0.5× sits in it: the mono web
    // is 2.5 · 0.5 = 1.25 and clears the 1.2 floor, while the modular half-web is
    // 2.25 · 0.5 = 1.125 and does not. Same design, same scale — the only
    // difference is that the seam splits the wall in half.
    const at = (s: number, link_mode: string): string[] =>
      solve({ ...defaultParams, scale_factor: s, link_mode }, DEFAULT_PROFILE).reasons.map(
        (r) => r.dim
      )
    expect(at(0.5, 'mono')).not.toContain('wall')
    expect(at(0.5, 'modular')).toContain('wall')
    // and the modular message names the half-web, so the fix is discoverable
    const r = solve(
      { ...defaultParams, scale_factor: 0.5, link_mode: 'modular' },
      DEFAULT_PROFILE
    ).reasons.find((x) => x.dim === 'wall')
    expect(r?.label).toBe('channel wall (half-web)')
  })
})
