/**
 * The infill knob's two pure functions: what a design's `infill_*` params
 * resolve to, and what each level writes as per-part config. Everything the 3MF
 * emit and the two UIs read comes through these, so the copy table and the
 * link/unlink rule are pinned here rather than three times downstream.
 */
import { describe, expect, it } from 'vitest'
import {
  INFILL_OPTIONS,
  type InfillLevel,
  infillOption,
  infillPartProcess,
  resolveInfill,
} from '../abacus-infill'
import { defaultParams } from '../abacus-model'

describe('resolveInfill', () => {
  it('makes the beads follow the frame when linked, whatever the bead level says', () => {
    // Linked is the default, and the stored bead value is kept (not mirrored) so
    // unlinking can restore it — which is exactly why "ignored" has to be pinned.
    expect(
      resolveInfill({ infill_frame: 'sturdy', infill_beads: 'light', infill_linked: true })
    ).toEqual({ frame: 'sturdy', beads: 'sturdy' })
  })

  it('honours both levels when unlinked', () => {
    expect(
      resolveInfill({ infill_frame: 'light', infill_beads: 'solid', infill_linked: false })
    ).toEqual({ frame: 'light', beads: 'solid' })
  })

  it('resolves a stock design to standard on both', () => {
    expect(resolveInfill(defaultParams)).toEqual({ frame: 'standard', beads: 'standard' })
  })
})

describe('infillPartProcess', () => {
  it('writes Orca’s own percent serialization per level', () => {
    const density = (level: InfillLevel) => infillPartProcess(level).sparse_infill_density
    expect(density('light')).toBe('10%')
    expect(density('standard')).toBe('15%')
    expect(density('sturdy')).toBe('30%')
    expect(density('solid')).toBe('100%')
  })

  it('pins the pattern only at solid — a 100 % gyroid is a slow solid layer', () => {
    expect(infillPartProcess('solid')).toEqual({
      sparse_infill_density: '100%',
      sparse_infill_pattern: 'rectilinear',
    })
    expect(infillPartProcess('sturdy')).toEqual({ sparse_infill_density: '30%' })
  })
})

describe('INFILL_OPTIONS', () => {
  it('reads back by id and ascends in density (the rail renders it as the menu)', () => {
    expect(INFILL_OPTIONS.map((o) => o.id)).toEqual(['light', 'standard', 'sturdy', 'solid'])
    expect(INFILL_OPTIONS.map((o) => o.densityPct)).toEqual([10, 15, 30, 100])
    for (const o of INFILL_OPTIONS) expect(infillOption(o.id)).toBe(o)
  })

  it('explains every level in all three registers, since the UI shows all three', () => {
    for (const o of INFILL_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0)
      for (const line of [o.frame, o.beads, o.time]) expect(line).toMatch(/\.$/)
    }
  })
})
