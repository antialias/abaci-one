import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFINE_KEYS,
  defaultParams,
  INSPECT_PARTS,
  PART_ONLY_DEFINE_KEYS,
  previewDedupKey,
} from '../abacus-model'

// Stepped mechanical retention for inset letters (GitHub #180): a hidden neck +
// outset foot below the CV-locked 0.6 mm visible inlay, so letter filaments no
// longer need to certify-weld to the frame. Same drift-guard contract as
// seam-fit.test.ts: the TS knobs are a transcription of scad top-level
// constants, nothing at runtime checks they agree, and every expected number
// here was derived by hand from the scad — not read back from either
// implementation.

const SCAD = readFileSync(join(process.cwd(), 'public/scad/abacus.scad'), 'utf8')

const knob = (name: string): number => {
  const m = SCAD.match(new RegExp(`^${name}\\s*=\\s*(-?[\\d.]+)\\s*;`, 'm'))
  if (!m) throw new Error(`knob ${name} not found in abacus.scad`)
  return Number(m[1])
}

describe('retention knobs mirror the scad', () => {
  it.each([
    ['ret_shoulder', defaultParams.ret_shoulder],
    ['ret_band', defaultParams.ret_band],
    ['ret_step', defaultParams.ret_step],
  ] as const)('scad %s === TS default', (name, ts) => {
    expect(knob(name)).toBe(ts)
  })

  it('the flag asymmetry is intentional: scad false (legacy fingerprint), TS true', () => {
    // The scad default keeps every pre-#180 CLI render byte-identical; the app
    // sends text_retention on EVERY render so pocket and plug passes can never
    // disagree. Flipping either side is a breaking change — do it knowingly.
    expect(SCAD).toMatch(/^text_retention = false;$/m)
    expect(defaultParams.text_retention).toBe(true)
  })

  it('ret_eps stays scad-only', () => {
    // The overlap-never-abut fuse is an engine-doctrine constant, not a design
    // knob — the app must not be able to send it.
    expect(knob('ret_eps')).toBe(0.01)
    expect('ret_eps' in defaultParams).toBe(false)
    expect(DEFINE_KEYS).not.toContain('ret_eps' as never)
  })
})

describe('counter safety (the "0" problem)', () => {
  it('closing radius R = ret_step + 0.4 — the 0.4 is the printable-core floor', () => {
    // A counter that survives morphological closing gets bitten ret_step deep
    // from its rim but keeps a core ≥ 2·(R − ret_step) = 0.8 mm = two 0.4 mm
    // perimeters. Shrinking the 0.4 shrinks that core below a printable wall;
    // growing it closes more counters solid (safe but loses foot area).
    expect(SCAD).toMatch(/R = ret_step \+ 0\.4;/)
  })

  it('the foot is clipped to the token cell, so neighboring feet can never merge', () => {
    // Cells partition the run (pitch = span / len), so a per-cell square clip
    // is a disjointness proof, not a heuristic.
    expect(SCAD).toMatch(/square\(\[clip_w, clip_h\], center = true\)/)
  })
})

describe('z-stack: the feet fit the frame', () => {
  it('defaults leave ≥0.5 mm web between text feet and the TPU crossbar pocket', () => {
    // Hand-derived from the scad's own assert: the text foot bottoms out at
    // s_fh − (inlay_d + ret_shoulder + ret_band); the printed-crossbar TPU
    // pocket rises to xbar_under + xbar_h + xbar_over. At stock scale S = 1,
    // s_fh = frame_h. 0.6 + 1.0 + 0.8 + 3.8 + 0.5 = 6.7 ≤ 8.
    const textStack = knob('inlay_d') + knob('ret_shoulder') + knob('ret_band')
    const xbarStack = knob('xbar_under') + knob('xbar_h') + knob('xbar_over')
    expect(textStack + xbarStack + 0.5).toBeLessThanOrEqual(knob('frame_h'))
    // and the scad actually guards it — the assert exists with this shape
    expect(SCAD).toMatch(/frame too thin for the text-retention feet/)
  })
})

describe('render plumbing', () => {
  it('the retention keys ride every render (DEFINE_KEYS, not part-only)', () => {
    // In DEFINE_KEYS ⇒ pocket and plug passes share one -D set and always
    // agree; NOT in PART_ONLY_DEFINE_KEYS ⇒ toggling re-renders the assembled
    // preview (the keys change assembled topology).
    for (const k of ['text_retention', 'ret_shoulder', 'ret_band', 'ret_step'] as const) {
      expect(DEFINE_KEYS).toContain(k)
      expect(PART_ONLY_DEFINE_KEYS).not.toContain(k)
    }
    expect(previewDedupKey(defaultParams)).not.toBe(
      previewDedupKey({ ...defaultParams, text_retention: false })
    )
  })

  it('the coupon passes exist on both sides of the dispatch mirror', () => {
    // INSPECT_PARTS mirrors the scad's only= dispatch — keep the two in step.
    expect(INSPECT_PARTS).toContain('retention_coupon')
    expect(INSPECT_PARTS).toContain('retention_coupon_plugs')
    expect(SCAD).toMatch(/only == "retention_coupon"/)
    expect(SCAD).toMatch(/only == "retention_coupon_plugs"/)
    // and the coupon ignores the toggle — it exists to test the feature
    expect(SCAD).toMatch(/retention = true\)\s*\n\s*rc_tok/)
  })
})
