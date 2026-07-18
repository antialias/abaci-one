import { describe, expect, it } from 'vitest'
import {
  clampCols,
  defaultParams,
  type DisplayConfigInput,
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
