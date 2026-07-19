import { BEAD_COLOR_PALETTES, beadColorActive } from '@soroban/abacus-react/color'
import { describe, expect, it } from 'vitest'
import {
  beadRoleColors,
  beadRoleIndex,
  clampCols,
  COLOR_PALETTES,
  defaultParams,
  derived,
  type DisplayConfigInput,
  type Params,
  paramsFromDisplayConfig,
} from '../abacus-model'

const cfg = (over: Partial<DisplayConfigInput> = {}): DisplayConfigInput => ({
  colorScheme: 'heaven-earth',
  colorPalette: 'colorblind',
  physicalAbacusColumns: 7,
  ...over,
})

describe('clampCols', () => {
  it('holds the scad 3-column floor', () => {
    expect(clampCols(1)).toBe(3)
    expect(clampCols(2)).toBe(3)
    expect(clampCols(0)).toBe(3)
  })

  it('holds the 21-column ceiling', () => {
    expect(clampCols(21)).toBe(21)
    expect(clampCols(25)).toBe(21)
  })

  it('rounds fractional counts to whole columns', () => {
    expect(clampCols(6.4)).toBe(6)
    expect(clampCols(6.6)).toBe(7)
  })
})

describe('paramsFromDisplayConfig', () => {
  it("carries the abacus's color identity + column count", () => {
    const p = paramsFromDisplayConfig(cfg())
    expect(p.color_scheme).toBe('heaven-earth')
    expect(p.color_palette).toBe('colorblind')
    expect(p.cols).toBe(7)
  })

  it('does NOT project on-screen zoom onto physical print size', () => {
    // scaleFactor is an on-screen zoom, not a requested print size — print size
    // stays a fabrication choice (the size knob), so scale_factor keeps its base.
    const p = paramsFromDisplayConfig(cfg())
    expect(p.scale_factor).toBe(defaultParams.scale_factor)
  })

  it('clamps the app column range (1–21) to the scad floor', () => {
    expect(paramsFromDisplayConfig(cfg({ physicalAbacusColumns: 1 })).cols).toBe(3)
    expect(paramsFromDisplayConfig(cfg({ physicalAbacusColumns: 21 })).cols).toBe(21)
  })

  it('leaves every other print param at the base defaults', () => {
    const p = paramsFromDisplayConfig(cfg())
    expect(p.clearance).toBe(defaultParams.clearance)
    expect(p.frame_h).toBe(defaultParams.frame_h)
    expect(p.fn).toBe(defaultParams.fn)
    expect(p.top_preset).toBe(defaultParams.top_preset)
  })

  it('projects onto a caller-supplied base (a customization carries through)', () => {
    const base = { ...defaultParams, clearance: 0.4, fn: 48 }
    const p = paramsFromDisplayConfig(cfg({ physicalAbacusColumns: 9 }), base)
    expect(p.cols).toBe(9)
    expect(p.clearance).toBe(0.4)
    expect(p.fn).toBe(48)
  })

  it('does not mutate the base', () => {
    const base = { ...defaultParams }
    paramsFromDisplayConfig(cfg({ physicalAbacusColumns: 9 }), base)
    expect(base.cols).toBe(defaultParams.cols)
  })
})

describe('mixed scaling — clearance is absolute, size is proportional (#6 spine)', () => {
  // Every print size we care to prove the joint tolerances hold at.
  const SIZES = [0.6, 1.0, 1.5, 2.0, 3.0]
  const at = (S: number): Params => ({ ...defaultParams, scale_factor: S })

  // The bead↔track channel is `bead_dia + 2*clearance` wide (one wall = `web`),
  // so the effective clearance recovers from the derived column pitch as
  //   (col_pitch − wall − bead) / 2.
  const channelClearance = (p: Params): number => {
    const S = p.scale_factor
    return (derived(p).sCp - p.web * S - p.bead_dia * S) / 2
  }

  it('holds bead↔track clearance at the absolute value across every print size', () => {
    // If clearance scaled with size (the dead scale([3,3,3]) bug), this would
    // grow with S. It must stay flat at defaultParams.clearance.
    for (const S of SIZES) {
      expect(channelClearance(at(S))).toBeCloseTo(defaultParams.clearance, 10)
    }
  })

  it('keeps the printed inter-bead air gap absolute (print_gap), not scaled', () => {
    // rest pitch = bead_len*S + print_gap  →  gap = pitch − bead_len*S = print_gap
    for (const S of SIZES) {
      const p = at(S)
      expect(derived(p).sEp - p.bead_len * S).toBeCloseTo(defaultParams.print_gap, 10)
    }
  })

  it('grows the whole frame with size, so a fixed clearance is a shrinking fraction', () => {
    const base = derived(at(1))
    const big = derived(at(2))
    expect(big.frameW).toBeGreaterThan(base.frameW)
    expect(big.outerD).toBeGreaterThan(base.outerD)
    // same absolute clearance occupies a smaller share of a bigger frame — the
    // point of the whole locked/proportional split.
    expect(defaultParams.clearance / big.frameW).toBeLessThan(
      defaultParams.clearance / base.frameW,
    )
  })

  it('column pitch is S·(bead+web) + a constant 2·clearance intercept (the mixed-scale fingerprint)', () => {
    // A uniform scale() would make pitch a pure S·k line through the origin.
    // Mixed scaling adds a non-zero intercept = 2·clearance. Recover slope +
    // intercept from two sizes and check both.
    const cp = (S: number) => derived(at(S)).sCp
    const slope = (cp(2) - cp(1)) / (2 - 1)
    const intercept = cp(1) - slope * 1
    expect(slope).toBeCloseTo(defaultParams.bead_dia + defaultParams.web, 10)
    expect(intercept).toBeCloseTo(2 * defaultParams.clearance, 10)
  })

  it('reproduces the master abacus 90mm field depth at scale 1', () => {
    // sanity anchor to the reverse-engineered master (~/projects/abacus STL).
    expect(derived(at(1)).sFd).toBeCloseTo(90, 6)
  })
})

describe('print-path color dedup — role table sources from the canonical resolver', () => {
  const SCHEMES = ['monochrome', 'heaven-earth', 'alternating', 'place-value'] as const
  const PALETTES = ['default', 'colorblind', 'mnemonic', 'grayscale', 'nature'] as const

  it('re-exports the shared palette table by reference (no hand-copied fork)', () => {
    // #7 replaced abacus-model's own COLOR_PALETTES copy with a re-export of the
    // single shared table; identity (not just equality) proves there is no fork.
    expect(COLOR_PALETTES).toBe(BEAD_COLOR_PALETTES)
  })

  it('composes (role index → role hex) back to the resolver for every bead', () => {
    // For each scheme/palette, walk every column of a full 13-wide abacus and both
    // bead types: the print path's role→hex must equal beadColorActive for that
    // bead's (placeValue, type). This is the whole point of the de-duplication —
    // the printed object matches the on-screen abacus bead for bead.
    const cols = 13
    for (const scheme of SCHEMES) {
      for (const palette of PALETTES) {
        const roleColors = beadRoleColors(scheme, palette)
        for (let i = 0; i < cols; i++) {
          for (const isHeaven of [true, false]) {
            const hex = roleColors[beadRoleIndex(i, isHeaven, scheme, cols, palette)]
            const expected = beadColorActive(
              { placeValue: cols - 1 - i, type: isHeaven ? 'heaven' : 'earth' },
              scheme,
              palette,
            )
            expect(hex).toBe(expected)
          }
        }
      }
    }
  })

  it('gives place-value one role per palette slot (the %len, not hardcoded %5, invariant)', () => {
    // Every shipped palette is length 5 today, but beadRoleIndex derives the wrap
    // from palette length — so this holds by construction, not by coincidence.
    for (const palette of PALETTES) {
      expect(beadRoleColors('place-value', palette)).toHaveLength(
        BEAD_COLOR_PALETTES[palette].length,
      )
    }
  })

  it('wraps place-value roles by palette length past the last slot (21-wide abacus)', () => {
    const cols = 21 // reaches place value 20
    // rightmost column i = cols-1 → placeValue 0 → role 0
    expect(beadRoleIndex(cols - 1, false, 'place-value', cols, 'default')).toBe(0)
    // placeValue 5 → role 0 again (5 % 5)
    expect(beadRoleIndex(cols - 1 - 5, false, 'place-value', cols, 'default')).toBe(0)
    // placeValue 6 → role 1
    expect(beadRoleIndex(cols - 1 - 6, false, 'place-value', cols, 'default')).toBe(1)
  })
})
