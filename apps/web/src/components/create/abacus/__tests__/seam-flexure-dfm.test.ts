import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  allowableStrainPct,
  type FilamentKind,
  flexureBendingStrainPct,
  flexureEngageForceN,
  HAND_ASSEMBLY_LIMIT_N,
} from '@eink/frames-engine'
import { describe, expect, it } from 'vitest'

// The seam snap clip (Gitea #30) is a two-prong flexure, and the house filament
// is WOOD PLA — it breaks at ~1–1.5% strain where plain PLA bends to 5%. A clip
// sized "by eye" for PLA doesn't flex in wood PLA, it snaps off on first
// assembly (the eink repo's #367 lesson, which is why its DFM solver exists).
// The scad carries a strain assert, but OpenSCAD can't express the force side:
// strain ∝ t while force ∝ t³, so a strain-passing prong can still be a
// press-fit no hand can seat or a clip too limp to retain. This test runs the
// REAL solver from @eink/frames-engine over the knob values parsed out of
// abacus.scad, so retuning the joint in the scad re-gates automatically.

const SCAD = readFileSync(join(process.cwd(), 'public/scad/abacus.scad'), 'utf8')

/** Parse a top-level scalar knob (`name = 1.5;`) out of the scad source. */
const knob = (name: string): number => {
  const m = SCAD.match(new RegExp(`^${name}\\s*=\\s*(-?[\\d.]+)\\s*;`, 'm'))
  if (!m) throw new Error(`knob ${name} not found in abacus.scad`)
  return Number(m[1])
}

// No wood-PLA entry exists in the eink filament registry, so the kind is
// defined here from datasheet-class seeds (curated constants, not measured —
// same epistemic tier as the registry's own values). Wood PLA is PLA loaded
// ~20–40% with wood flour: the particles stiffen the matrix slightly and act
// as crack initiation sites, which is why the strain limit collapses.
const WOOD_PLA: FilamentKind = {
  id: 'wood-pla',
  label: 'Wood PLA',
  strainLimitPct: 1.5, // breaks, not yields — vs 5 for plain PLA
  layerAdhesionDeratePct: 55, // wood particles weaken interlayer welds further
  brittlenessIndex: 0.95,
  elasticModulusMPa: 3200, // filler-stiffened vs plain PLA's 2500
  glassTransitionTempC: 60,
  minWallMm: 1.2, // = 2 lines of the 0.6 nozzle wood PLA wants
  overhangLimitDeg: 40,
  densityGCm3: 1.2,
  rfOpaque: false,
}

// Same safety factor philosophy as the scad assert: gate at strain × 1.5, not
// at the raw limit, because the deflection is a worst case built from nominal
// dimensions — real prints add stress concentration at the prong root.
const SAFETY = 1.5

const geometry = () => {
  const t = knob('sc_prong')
  const L = knob('joint_clip_l') - knob('sc_slot')
  // Worst intended deflection: ridge fully proud, plus 0.05 of headroom for
  // the negative-joint_fit end of the print-tuning ritual.
  const Y = knob('joint_ridge') + 0.05
  const w = knob('frame_h') // prongs run the full slab height
  return {
    crossSectionMm: t,
    cantileverLenMm: L,
    workingDeflectionMm: Y,
    beamWidthMm: w,
    sectionShape: 'rect' as const,
  }
}

describe('seam snap clip vs wood PLA (the eink DFM gate)', () => {
  it('click strain clears the wood-PLA break limit with 1.5× safety', () => {
    const f = geometry()
    const strain = flexureBendingStrainPct(f)
    // Prongs are vertical walls bending in-plane w.r.t. layers — the bend does
    // NOT pry layer welds apart, so no adhesion derate applies.
    const allowable = allowableStrainPct(WOOD_PLA, false)
    expect(strain * SAFETY).toBeLessThanOrEqual(allowable)
  })

  it('a hand can seat the module: 2-prong engage force under the assembly limit', () => {
    const perProng = flexureEngageForceN(geometry(), WOOD_PLA)
    expect(2 * perProng).toBeLessThanOrEqual(HAND_ASSEMBLY_LIMIT_N)
  })

  it('the clip is not limp: per-prong retention beats the module self-load', () => {
    // A middle module hanging by its clips (abacus carried upside down by one
    // end) sees < 0.5 N of gravity; demand ~3 N per prong so casual handling
    // and the dovetail-drag component never walk a module out.
    const perProng = flexureEngageForceN(geometry(), WOOD_PLA)
    expect(perProng).toBeGreaterThanOrEqual(3)
  })

  it('negative control: the pre-gate geometry (t=1.4, L=6.5) fails the wood gate', () => {
    // The clip as first drawn — sized against plain-PLA intuition. If this
    // starts PASSING, the gate itself has gone soft (limits or safety factor
    // edited); the point of the pin is that the gate can tell bad from good.
    const old = { ...geometry(), crossSectionMm: 1.4, cantileverLenMm: 6.5 }
    const strain = flexureBendingStrainPct(old)
    expect(strain * SAFETY).toBeGreaterThan(allowableStrainPct(WOOD_PLA, false))
  })

  it('the scad carries its own strain assert, in step with these knobs', () => {
    // The scad-side gate is what protects a user retuning knobs in OpenSCAD
    // directly, outside this test's reach. Pin its presence and its formula
    // inputs so a knob rename can't silently orphan it.
    expect(SCAD).toContain('snap-clip strain would crack wood PLA')
    expect(SCAD).toMatch(
      /assert\(150 \* sc_prong \* \(joint_ridge \+ 0\.05\) \/ pow\(joint_clip_l - sc_slot, 2\) <= 1\.0/
    )
  })
})
