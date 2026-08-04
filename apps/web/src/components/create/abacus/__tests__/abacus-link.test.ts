import { describe, expect, it } from 'vitest'
import {
  defaultLinkParams,
  type LinkParams,
  linkDerived,
  linkFit,
  linkHingeDroop,
  linkMechanics,
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
