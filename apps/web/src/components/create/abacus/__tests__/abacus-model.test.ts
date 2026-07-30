import { BEAD_COLOR_PALETTES, beadColorActive } from '@soroban/abacus-react/color'
import { describe, expect, it } from 'vitest'
import {
  anyTokens,
  beadRoleColors,
  beadRoleIndex,
  COLOR_PALETTES,
  clampCols,
  type DisplayConfigInput,
  defaultParams,
  definesFrom,
  derived,
  feetEffective,
  feetPositions,
  type Params,
  paramsFromDisplayConfig,
  TEXT_RAINBOW_GROUPS,
  textGroupCount,
  textGroupNeighbors,
  textGroups,
  textSlots,
  tokenCenters,
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
    expect(p.aid_10).toBe(defaultParams.aid_10)
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
    expect(defaultParams.clearance / big.frameW).toBeLessThan(defaultParams.clearance / base.frameW)
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
              palette
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
        BEAD_COLOR_PALETTES[palette].length
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

describe('printed-feet defines (Gitea #23)', () => {
  const defines = definesFrom(defaultParams)

  it('forwards the feet_mode / feet_proud / feet_retention knobs to the scad', () => {
    expect(defines).toContain('-Dfeet_mode="printed"')
    expect(defines).toContain('-Dfeet_proud=1.6')
    expect(defines).toContain('-Dfeet_retention="crossbar"')
  })

  it('never emits a bare -Dfeet= (the scad DERIVES feet from feet_mode; a stale boolean define would override that derivation)', () => {
    expect(defines.some((d) => d.startsWith('-Dfeet='))).toBe(false)
  })

  it('defaults to printed crossbar feet — the point of the feature', () => {
    expect(defaultParams.feet_mode).toBe('printed')
    expect(defaultParams.feet_retention).toBe('crossbar')
  })
})

describe('feet layout mirror (Gitea #23) — hand-computed against the scad chain', () => {
  // Defaults: S=1, chamf=1, s_cr=4, frame_w=192.5, outer_d=100.5 (pinned by the
  // mixed-scaling tests above). Printed: fit_eff=0, undercut_eff=0.35 →
  // mouth=9, seat=9.7, half=4.85; circle feet_c = max(1+0.5+4.85,
  // 4 − (4−1−4.85)/√2) = max(6.35, 5.308…) = 6.35.
  it('printed defaults: welded mouth, upgraded flare, crossbar depth stack', () => {
    const fx = feetEffective(defaultParams)
    expect(fx.mouth).toBe(9)
    expect(fx.seat).toBeCloseTo(9.7, 10)
    expect(fx.c).toBeCloseTo(6.35, 10)
    expect(fx.depthEff).toBeCloseTo(3.8, 10) // xbar_under 1 + xbar_h 1.6 + xbar_over 1.2
    expect(fx.proud).toBe(1.6)
    expect(fx.crossbar).toBe(true)
  })

  it('adhesive mode uses the raw knobs — and has no stand-off (pockets are empty)', () => {
    const fx = feetEffective({ ...defaultParams, feet_mode: 'adhesive' })
    expect(fx.mouth).toBeCloseTo(9.3, 10) // feet_w 9 + 2·feet_fit 0.15
    expect(fx.seat).toBeCloseTo(9.3, 10) // raw feet_undercut 0 stays 0
    expect(fx.c).toBeCloseTo(6.15, 10) // chamf 1 + 0.5 + half 4.65 dominates
    expect(fx.depthEff).toBe(1.5)
    expect(fx.proud).toBe(0)
    expect(fx.crossbar).toBe(false)
  })

  it('printed dovetail: no crossbar → the raw pocket depth, stand-off kept', () => {
    const fx = feetEffective({ ...defaultParams, feet_retention: 'dovetail' })
    expect(fx.crossbar).toBe(false)
    expect(fx.depthEff).toBe(1.5)
    expect(fx.proud).toBe(1.6)
    expect(fx.crossbarTooThin).toBe(false) // it was never asked for
  })

  // The 3.8 mm bar stack is absolute; the frame it hides in is frame_h·S. Below
  // s_fh = 5.8 the scad's web assert would fail the render outright, so both
  // sides degrade to the dovetail instead — this pins them in step.
  it('degrades crossbar → dovetail once the frame is too thin to hide the bar', () => {
    // stock frame_h 8 ⇒ the bar needs S ≥ (3.8+2)/8 = 0.725
    const at = (scale_factor: number) => feetEffective({ ...defaultParams, scale_factor })
    const thin = at(0.7)
    expect(thin.crossbar).toBe(false)
    expect(thin.crossbarTooThin).toBe(true)
    expect(thin.depthEff).toBe(1.5) // the dovetail pocket, which fits: 1.5+2 ≤ 5.6
    expect(thin.depthEff + 2).toBeLessThanOrEqual(defaultParams.frame_h * 0.7)

    const ok = at(0.725)
    expect(ok.crossbar).toBe(true)
    expect(ok.crossbarTooThin).toBe(false)
    expect(ok.depthEff).toBe(3.8)
  })

  it('every size the slider offers renders: the web assert holds across 0.5…1.5', () => {
    for (let s = 0.5; s <= 1.5001; s += 0.05) {
      const p = { ...defaultParams, scale_factor: Number(s.toFixed(2)) }
      const fx = feetEffective(p)
      expect(fx.depthEff + 2).toBeLessThanOrEqual(p.frame_h * p.scale_factor + 1e-9)
    }
  })

  it('square feet: the corner-point-inside-the-arc branch of feet_c', () => {
    // half + s_cr − (s_cr − chamf)/√2 = 4.85 + 4 − 3/√2 = 6.72867… > 6.35
    const fx = feetEffective({ ...defaultParams, feet_shape: 'square' })
    expect(fx.c).toBeCloseTo(4.85 + 4 - 3 / Math.SQRT2, 10)
  })

  it('defaults place 6 feet: 4 corners + ONE intermediate pair on the long edges', () => {
    // run_x = 192.5 − 12.7 = 179.8 > span 110 → nx=1 (pair at run midpoint);
    // run_y = 100.5 − 12.7 = 87.8 < 110 → ny=0. Scad order: corners, then pairs.
    const pos = feetPositions(defaultParams)
    expect(pos.length).toBe(6)
    const c = 6.35
    const W = 192.5
    const D = 100.5
    expect(pos.slice(0, 4)).toEqual([
      [c, c],
      [W - c, c],
      [W - c, D - c],
      [c, D - c],
    ])
    const [mid1, mid2] = pos.slice(4)
    expect(mid1[0]).toBeCloseTo(c + 179.8 / 2, 10) // 96.25 — the true centerline
    expect(mid1[1]).toBeCloseTo(c, 10)
    expect(mid2[0]).toBeCloseTo(c + 179.8 / 2, 10)
    expect(mid2[1]).toBeCloseTo(D - c, 10)
  })

  it('a short frame (cols=3) needs no intermediates — exactly the 4 corners', () => {
    // frame_w = 62.5 → run_x = 49.8 < 110; run_y unchanged 87.8 < 110.
    expect(feetPositions({ ...defaultParams, cols: 3 }).length).toBe(4)
  })

  it('scaling DOWN adds feet: span derates ∝ S^(4/3) faster than runs shrink ∝ S', () => {
    // S=0.5: frame_w=112.5, outer_d=66.75, feet_c stays 6.35 (absolute feet) →
    // run_x=99.8, run_y=54.05; span_eff = 110·0.5^(4/3) ≈ 43.65 → nx=2, ny=1
    // → 4 + 2·2 + 2·1 = 10 feet on a HALF-size board (stiffness ∝ S⁴).
    const pos = feetPositions({ ...defaultParams, scale_factor: 0.5 })
    expect(pos.length).toBe(10)
  })
})

describe('inset text color groups — hand-computed mirror of the scad tok_color rule', () => {
  // abacus.scad: tok_color(k) = text_fill == "rainbow" ? _palette(color_palette)[k % 5]
  //                                                    : text_color
  // with k the token's index WITHIN ITS OWN RAIL. Each distinct value is one
  // render pass, one plan role, one 3MF body — so this arithmetic decides what
  // actually gets printed, not just what the preview tints.
  const blank: Params = {
    ...defaultParams,
    aid_10: 'off',
    aid_5: 'off',
  }
  // n tokens on ONE rail, everything else empty
  const withTop = (n: number): Params => ({
    ...blank,
    top_text: Array.from({ length: n }, (_, i) => `t${i}`).join(' '),
  })

  it('pins the modulus the scad hardcodes: every palette is exactly TEXT_RAINBOW_GROUPS long', () => {
    // textGroups reads the palette at [g] for g < TEXT_RAINBOW_GROUPS. The scad
    // hardcodes `k % 5` and never receives color_palette, so a palette of any
    // other length would silently desync the two. This is the guard for that.
    for (const palette of Object.keys(BEAD_COLOR_PALETTES)) {
      expect(BEAD_COLOR_PALETTES[palette]).toHaveLength(TEXT_RAINBOW_GROUPS)
    }
  })

  it('present groups are the PREFIX 0…min(n,5)−1 for a single rail of n tokens', () => {
    // {k % 5 : k ∈ [0,n)} = {0 … min(n,5)−1}. The hole-free prefix shape is what
    // lets FilamentMap.textRoles be a dense array.
    for (let n = 1; n <= 9; n++) {
      const groups = textGroups(withTop(n))
      expect(groups.map((t) => t.g)).toEqual(
        Array.from({ length: Math.min(n, TEXT_RAINBOW_GROUPS) }, (_, i) => i)
      )
    }
  })

  it('takes the union over rails — the LONGEST rail sets the group count', () => {
    // top: 2 tokens (groups 0,1), bottom: 4 tokens (groups 0..3) → union 0..3.
    const p: Params = { ...blank, top_text: 'a b', bottom_text: 'w x y z' }
    expect(textGroups(p).map((t) => t.g)).toEqual([0, 1, 2, 3])
  })

  it('rainbow group hexes ARE the place-value bead hexes (same palette, same index)', () => {
    for (const palette of ['default', 'colorblind', 'nature'] as const) {
      const groups = textGroups({ ...defaultParams, color_palette: palette })
      expect(groups.map((t) => t.hex)).toEqual(BEAD_COLOR_PALETTES[palette])
    }
  })

  it('single fill collapses to exactly one group at text_color, holding EVERY token', () => {
    const p: Params = { ...defaultParams, text_fill: 'single', text_color: '#123456' }
    expect(textGroupCount(p)).toBe(1)
    expect(textGroups(p)).toEqual([
      {
        g: 0,
        hex: '#123456',
        // friends-of-10 then friends-of-5, in rail order — one filament inks all 9
        tokens: ['1+9', '2+8', '3+7', '4+6', '5+5', '1+4', '2+3', '3+2', '4+1'],
      },
    ])
  })

  it('rainbow partitions the tokens by per-rail index — group g inks token g of every rail', () => {
    // top = friends-of-10 (k 0..4), bottom = friends-of-5 (k 0..3), so group 4 is
    // the only one with a single token. Every token lands in exactly one group.
    const groups = textGroups(defaultParams)
    expect(groups.map((t) => t.tokens)).toEqual([
      ['1+9', '1+4'],
      ['2+8', '2+3'],
      ['3+7', '3+2'],
      ['4+6', '4+1'],
      ['5+5'],
    ])
    expect(groups.flatMap((t) => t.tokens)).toHaveLength(9)
  })

  it('no tokens → no groups (nothing to render, nothing to assign a filament)', () => {
    expect(textGroups(blank)).toEqual([])
    expect(textGroupCount(blank)).toBe(0)
    expect(textGroupCount({ ...blank, text_fill: 'single' })).toBe(0)
  })

  it('defaults use all five: friends-of-10 is a 5-token rail', () => {
    expect(textGroupCount(defaultParams)).toBe(TEXT_RAINBOW_GROUPS)
  })

  describe('textGroupNeighbors — which groups get written next to each other', () => {
    const asArrays = (p: Params) => textGroupNeighbors(p).map((s) => [...s].sort((a, b) => a - b))

    it('a rail of five is a PATH 0–1–2–3–4: the ends do not touch', () => {
      // 5 tokens, 5 groups, one each in order. The plan may reuse an ink for 0
      // and 4 (they are far apart on the rail); it may not for 3 and 4.
      expect(asArrays(withTop(5))).toEqual([[1], [0, 2], [1, 3], [2, 4], [3]])
    })

    it('a rail of six WRAPS: k=5 is group 0 again, sitting beside group 4', () => {
      // The reason this is read off the layout instead of assuming g±1.
      expect(asArrays(withTop(6))).toEqual([
        [1, 4],
        [0, 2],
        [1, 3],
        [2, 4],
        [0, 3],
      ])
    })

    it('the defaults are the union of both rails — friends-of-10 (5) and -of-5 (4)', () => {
      // the 4-token rail contributes 0–1, 1–2, 2–3, all already on the 5-token
      // one, so the shape is the 5-path. Groups never bridge rails: separate faces.
      expect(asArrays(defaultParams)).toEqual([[1], [0, 2], [1, 3], [2, 4], [3]])
    })

    it('single fill has one group and therefore no edges — one ink by definition', () => {
      expect(asArrays({ ...defaultParams, text_fill: 'single' })).toEqual([[]])
      expect(textGroupNeighbors(blank)).toEqual([])
    })

    it('is symmetric and self-edge-free for every rail length', () => {
      for (let n = 1; n <= 12; n++) {
        const nb = textGroupNeighbors(withTop(n))
        expect(nb).toHaveLength(textGroupCount(withTop(n)))
        nb.forEach((set, g) => {
          expect(set.has(g)).toBe(false)
          for (const o of set) expect(nb[o].has(g)).toBe(true)
        })
      }
    })
  })

  it('textSlots is the one token layout — definesFrom, tokenCenters and anyTokens read it', () => {
    // The de-fork guard: all four used to build their own copy of the 8-slot
    // list, so a placement change could reach one and not the others. That
    // stopped being survivable in #28, where the aid's rail is derived: two
    // copies would ink the plate on a different rail than the preview tints.
    const slots = textSlots(defaultParams)
    expect(slots).toHaveLength(8)
    // friends-of-10 (5) + friends-of-5 (4), the other six rails empty
    expect(slots.map((t) => t.length)).toEqual([5, 4, 0, 0, 0, 0, 0, 0])
    expect(tokenCenters(defaultParams)).toHaveLength(9)
    expect(anyTokens(defaultParams)).toBe(true)
    expect(anyTokens(blank)).toBe(false)
    // per-rail index: both rails restart at k=0
    expect(tokenCenters(defaultParams).map((c) => c.k)).toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3])
  })
})
