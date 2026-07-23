import { describe, expect, it } from 'vitest'
import {
  beadRoleColors,
  contrastRatio,
  defaultParams,
  INK_DARK,
  INK_LIGHT,
  PICKER_INK_FLOOR,
  pickerInk,
} from '../abacus-model'

// pickerInk is the single source that colors the expanded filament picker's text
// against the DESIGNED role color it bathes in (Gitea #17). It replaced a fixed
// amber off-plate label that fell to ~1.2:1 on the place-value palette. The claims
// below are the legibility contract the picker rests on: whatever the ground, the
// caution tone clears the floor and the primary ink clears AA — solved, not tabled.

// The real designed grounds a picker can sit on: every place-value bead color
// plus the frame. These are the exact backgrounds in the reported screenshots.
const paletteGrounds = [...beadRoleColors('place-value', 'default'), defaultParams.frame_color]
// Grounds outside the palette, to prove the solve generalizes past the fixtures.
const edgeGrounds = ['#000000', '#ffffff', '#7f7f7f', '#3a2418', '#efe6d0']
const allGrounds = [...paletteGrounds, ...edgeGrounds]

describe('pickerInk', () => {
  it('keeps the caution tone at or above the contrast floor on every ground', () => {
    for (const bg of allGrounds) {
      const { warn } = pickerInk(bg)
      expect(contrastRatio(bg, warn)).toBeGreaterThanOrEqual(PICKER_INK_FLOOR - 1e-9)
    }
  })

  it('keeps the primary ink at AA (4.5:1) on every designed ground', () => {
    for (const bg of paletteGrounds) {
      const { fg } = pickerInk(bg)
      expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('picks the ink polarity that actually contrasts (the higher of the two poles)', () => {
    for (const bg of allGrounds) {
      const { light, fg } = pickerInk(bg)
      const lightIsBetter = contrastRatio(bg, INK_LIGHT) >= contrastRatio(bg, INK_DARK)
      expect(light).toBe(lightIsBetter)
      expect(fg).toBe(light ? INK_LIGHT : INK_DARK)
    }
  })

  it('flips polarity across the real crossover, not the old > 0.5 rule', () => {
    // the exact cases the fixed scheme got wrong: magenta (lum ~0.12) is dark enough
    // for LIGHT ink; green/orange (lum ~0.27/0.38) contrast better with DARK ink.
    expect(pickerInk('#A23B72').light).toBe(true) // magenta → light ink
    expect(pickerInk('#6A994E').light).toBe(false) // green → dark ink
    expect(pickerInk('#F18F01').light).toBe(false) // orange → dark ink
  })

  it('honors a stricter floor by pulling the warm tone toward the neutral base', () => {
    const bg = '#2E86AB' // blue — the warm brown clears 3.2 with little headroom
    const lenient = contrastRatio(bg, pickerInk(bg, 2.5).warn)
    const strict = contrastRatio(bg, pickerInk(bg, 4.5).warn)
    // raising the floor can only raise the tone's contrast (toward the base)
    expect(strict).toBeGreaterThanOrEqual(lenient - 1e-9)
    expect(strict).toBeGreaterThanOrEqual(4.5 - 1e-9)
  })

  it('ramps soft → hairline from the base ink toward the ground', () => {
    const bg = '#6A994E'
    const { fg, fgSoft, fgHair } = pickerInk(bg)
    // the hairline leans furthest toward the ground, so it contrasts least
    expect(contrastRatio(bg, fgSoft)).toBeGreaterThan(contrastRatio(bg, fgHair))
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(contrastRatio(bg, fgSoft))
  })
})
