/**
 * Stick-on bumper presets + the brim, and the fit rule that decides which of
 * them the geometry can actually seat (Gitea #23).
 *
 * The load-bearing part is the refusal. At every column the bead and end
 * channels open through the bottom face, so a foot pocket may only live in the
 * solid border strip — and the scad enforces that with assert(), which throws
 * mid-export in a message written for whoever edits the scad. `feetFit` mirrors
 * those asserts so the studio can refuse first and name the lever; if this file
 * ever goes green while the mirror has drifted from the scad, an export will
 * blow up on a foot the UI offered.
 */
import { describe, expect, it } from 'vitest'
import {
  BRIM_PRESETS,
  BUMPER_PRESETS,
  borderStrip,
  bumperLabel,
  bumperParams,
  bumperProud,
  defaultParams,
  feetFit,
  matchBrim,
  matchBumper,
  type Params,
} from '../abacus-model'

const adhesive = (over: Partial<Params> = {}) =>
  ({ ...defaultParams, feet_mode: 'adhesive', ...over }) as Params
const withBumper = (id: string, over: Partial<Params> = {}) => {
  const b = BUMPER_PRESETS.find((x) => x.id === id)
  if (!b) throw new Error(`no preset ${id}`)
  return adhesive({ ...bumperParams(b), ...over })
}

describe('bumper presets', () => {
  it('covers the six sizes on the packet, smallest first', () => {
    expect(BUMPER_PRESETS.map(bumperLabel)).toEqual([
      '1/4" × 1/16" dome',
      '5/16" × 1/8" dome',
      '3/8" × 1/8" dome',
      '7/16" × 1/8" flat, round',
      '1/2" × 1/8" flat, round',
      '1/2" × 1/8" flat, square',
    ])
  })

  it('labels thickness as a fraction, not our arithmetic', () => {
    // 1/16" is 0.0625 — a decimal here would be the conversion showing through
    // on a control whose whole job is to match what's printed on the packet.
    expect(bumperLabel(BUMPER_PRESETS[0])).toContain('1/16"')
    expect(bumperLabel(BUMPER_PRESETS[0])).not.toContain('0.06')
  })

  it('distinguishes the two 1/2" bumpers, which differ only in footprint', () => {
    const half = BUMPER_PRESETS.filter((b) => b.widthIn === 0.5)
    expect(half).toHaveLength(2)
    expect(new Set(half.map(bumperLabel)).size).toBe(2)
    expect(half.map((b) => b.shape)).toEqual(['circle', 'square'])
  })

  it('converts inches to mm exactly', () => {
    expect(bumperParams(BUMPER_PRESETS[0]).feet_w).toBeCloseTo(6.35, 10) // 1/4"
    expect(bumperParams(BUMPER_PRESETS[5]).feet_w).toBeCloseTo(12.7, 10) // 1/2"
    expect(bumperParams(BUMPER_PRESETS[5]).feet_shape).toBe('square')
  })

  it('buries HALF the bumper, so the other half is real ride height', () => {
    // a pocket as deep as the bumper is thick would seat it flush and the
    // abacus would stand on its frame, which is the whole point of a foot
    for (const b of BUMPER_PRESETS) {
      const thickness = b.thickIn * 25.4
      expect(bumperParams(b).feet_depth).toBeCloseTo(thickness / 2, 10)
      expect(bumperProud(b)).toBeCloseTo(thickness / 2, 10)
      expect(bumperProud(b)).toBeGreaterThan(0)
    }
  })

  it('derives the menu selection from the dimensions, both ways', () => {
    // `feet_preset` used to be a param and was deliberately retired, so the
    // dimensions are the only source of truth and the label is a projection
    for (const b of BUMPER_PRESETS) {
      expect(matchBumper(adhesive(bumperParams(b)))?.id).toBe(b.id)
    }
  })

  it('calls hand-set dimensions custom instead of snapping them to a preset', () => {
    // silently rounding a saved design's 9 mm feet to 3/8" would edit geometry
    // the user never touched — and it prints differently than it did before
    expect(matchBumper(adhesive({ feet_w: 9, feet_shape: 'circle' }))).toBeNull()
    // right width, wrong footprint is still not that preset
    expect(
      matchBumper(adhesive({ ...bumperParams(BUMPER_PRESETS[4]), feet_shape: 'square' }))?.id
    ).toBe(BUMPER_PRESETS[5].id)
  })
})

describe('border strip', () => {
  it('is the border-plus-shelf band at stock settings', () => {
    // 5.25 + 7.75; the scad's own comment pins the same 13.0
    expect(borderStrip(defaultParams)).toBeCloseTo(13, 6)
  })

  it('answers to the brim and to size, since both terms scale', () => {
    expect(borderStrip({ ...defaultParams, border_w: 8 })).toBeGreaterThan(
      borderStrip(defaultParams)
    )
    expect(borderStrip({ ...defaultParams, scale_factor: 1.5 })).toBeGreaterThan(
      borderStrip(defaultParams)
    )
  })
})

describe('feetFit — which bumpers the geometry can seat', () => {
  it('seats every bumper up to 3/8" at stock settings, across the size slider', () => {
    // 0.5–2 is the slider's whole range (DesignInspectorRail's "size ×")
    for (const id of ['d-250-062', 'd-312-125', 'd-375-125']) {
      for (const scale_factor of [0.5, 0.725, 1, 1.5, 2]) {
        expect(feetFit(withBumper(id, { scale_factor })).fits, `${id} @ ${scale_factor}`).toBe(true)
      }
    }
  })

  it('refuses 7/16" and both 1/2" bumpers at stock settings', () => {
    for (const id of ['f-437-125', 'f-500-125', 's-500-125']) {
      expect(feetFit(withBumper(id)).fits, id).toBe(false)
    }
  })

  it('a square 1/2" foot needs more room than a round one of the same width', () => {
    // the square's seat has to clear the chamfered corner outline differently,
    // which is why the two 1/2" rows grey out at different thresholds
    expect(feetFit(withBumper('s-500-125')).needs).toBeGreaterThan(
      feetFit(withBumper('f-500-125')).needs
    )
  })

  it('offers a brim that actually seats the foot — applying it flips fits', () => {
    for (const id of ['f-437-125', 'f-500-125', 's-500-125']) {
      const fit = feetFit(withBumper(id))
      expect(fit.minBorderW, id).not.toBeNull()
      const fixed = feetFit(withBumper(id, { border_w: fit.minBorderW as number }))
      expect(fixed.fits, `${id} at brim ${fit.minBorderW}`).toBe(true)
      // and it's the MINIMUM: a hair under still refuses
      expect(feetFit(withBumper(id, { border_w: (fit.minBorderW as number) - 0.05 })).fits).toBe(
        false
      )
    }
  })

  it('offers a size that actually seats the foot, to 2 decimals as displayed', () => {
    for (const id of ['f-437-125', 'f-500-125', 's-500-125']) {
      const fit = feetFit(withBumper(id))
      expect(fit.minScale, id).not.toBeNull()
      // the note rounds to 2dp, so the rounded value must seat it too — a
      // threshold that only works at full precision would be a lie on screen
      const shown = Math.ceil((fit.minScale as number) * 100) / 100
      expect(feetFit(withBumper(id, { scale_factor: shown })).fits, `${id} @ ×${shown}`).toBe(true)
    }
  })

  it('refuses a pocket deeper than the slab can spare — and only size can fix it', () => {
    // The third scad assert, feet_depth_eff + 2 <= s_fh. A bumper's thickness is
    // real hardware and never scales, but the slab is frame_h·S, so a 1/8"
    // bumper needs S >= 0.449. That's under the 0.5 slider floor — but a saved
    // ?design= snapshot can carry any scale, and then the export would throw.
    const fit = feetFit(withBumper('d-312-125', { scale_factor: 0.44 }))
    expect(fit.fits).toBe(false)
    expect(fit.tooDeep).toBe(true)
    // the brim widens the strip; it does not thicken the slab
    expect(fit.minBorderW).toBeNull()
    expect(fit.minScale).not.toBeNull()
    expect(feetFit(withBumper('d-312-125', { scale_factor: fit.minScale as number })).fits).toBe(
      true
    )
  })

  it('lets the thinner bumper survive a size the thicker one cannot', () => {
    // the two axes really are independent: same footprint class, different
    // thickness, and only the thick one runs out of slab
    expect(feetFit(withBumper('d-250-062', { scale_factor: 0.4 })).tooDeep).toBe(false)
    expect(feetFit(withBumper('d-312-125', { scale_factor: 0.4 })).tooDeep).toBe(true)
  })

  it('clears the depth limit for every preset at the size slider floor', () => {
    // 0.5 is the slider's minimum, so nothing reachable by dragging can trip
    // the depth assert — the 1/8" rows clear it by 0.41 mm, which is thin
    // enough to be worth pinning here.
    for (const b of BUMPER_PRESETS) {
      expect(
        feetFit(adhesive({ ...bumperParams(b), scale_factor: 0.5 })).tooDeep,
        bumperLabel(b)
      ).toBe(false)
    }
  })

  it('reports no remedy at all rather than a false one when none exists', () => {
    // an absurd foot: neither lever can seat a 60 mm pocket, and the note must
    // fall through to "choose a narrower foot" instead of naming a fix
    const fit = feetFit(adhesive({ feet_w: 60 }))
    expect(fit.fits).toBe(false)
    expect(fit.minScale).toBeNull()
  })

  it('still refuses a wide foot after switching to PRINTED mode', () => {
    // the width outlives the mode it was chosen in, and printed feet trade the
    // fit gap for a 0.35 mm retention flare — so the seat is WIDER, not
    // narrower. The greyed bumper menu is gone in printed mode; only the shared
    // note catches this, and without it the scad asserts mid-export.
    const wide = bumperParams(BUMPER_PRESETS[5])
    const printed = { ...defaultParams, ...wide, feet_mode: 'printed' } as Params
    expect(feetFit(printed).fits).toBe(false)
    expect(feetFit(printed).needs).toBeGreaterThan(feetFit(adhesive(wide)).needs)
  })
})

describe('brim presets', () => {
  it('starts at the value every abacus printed so far used', () => {
    expect(BRIM_PRESETS[0].border_w).toBe(defaultParams.border_w)
    expect(matchBrim(defaultParams)?.id).toBe('stock')
  })

  it('rises monotonically and says the millimetres out loud', () => {
    const widths = BRIM_PRESETS.map((b) => b.border_w)
    expect(widths).toEqual([...widths].sort((a, b) => a - b))
    for (const b of BRIM_PRESETS) expect(b.label).toContain('mm')
  })

  it('reaches a brim that seats every bumper at stock size', () => {
    const widest = BRIM_PRESETS[BRIM_PRESETS.length - 1].border_w
    for (const b of BUMPER_PRESETS) {
      expect(feetFit(adhesive({ ...bumperParams(b), border_w: widest })).fits, bumperLabel(b)).toBe(
        true
      )
    }
  })

  it('round-trips, and calls an off-preset width custom', () => {
    for (const b of BRIM_PRESETS) {
      expect(matchBrim({ ...defaultParams, border_w: b.border_w })?.id).toBe(b.id)
    }
    expect(matchBrim({ ...defaultParams, border_w: 6.02 })).toBeNull()
  })
})
