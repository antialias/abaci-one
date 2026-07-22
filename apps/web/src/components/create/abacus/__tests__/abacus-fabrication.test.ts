import { describe, expect, it } from 'vitest'
import { toAbacusDesign } from '../abacus-design'
import {
  DEFAULT_FABRICATION,
  FABRICATION_OPTIONS,
  type FabricationKind,
  intentOf,
} from '../abacus-fabrication'
import { defaultParams, type Params } from '../abacus-model'

const params = (over: Partial<Params> = {}): Params => ({ ...defaultParams, ...over })
const design = (over: Partial<Params> = {}) => toAbacusDesign(params(over), 'common')

describe('fabrication axis', () => {
  it('defaults to paper — the express, no-3D lane', () => {
    expect(DEFAULT_FABRICATION.kind).toBe<FabricationKind>('paper')
  })

  it('offers exactly paper + fdm, each with a label and icon (laser is not a target)', () => {
    expect(FABRICATION_OPTIONS.map((o) => o.kind)).toEqual(['paper', 'fdm'])
    for (const o of FABRICATION_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.icon.length).toBeGreaterThan(0)
    }
  })
})

describe('intentOf', () => {
  it('carries the neutral core: column count, colors, marker geometry', () => {
    const d = design({ cols: 9, marker_mm: 14, show_markers: true })
    const intent = intentOf(d)
    expect(intent.columns).toBe(9)
    expect(intent.markers).toEqual({ enabled: true, sizeMm: 14 })
    // colors come through by identity from the shared design (not re-derived)
    expect(intent.resolvedColors).toBe(d.resolvedColors)
  })

  it('reflects markers being turned off', () => {
    expect(intentOf(design({ show_markers: false })).markers.enabled).toBe(false)
  })

  it('is the same neutral core the design was built from (paper cannot drift from FDM)', () => {
    // Both realizers derive from ONE design; intentOf is a pure projection of it,
    // so the column count + marker size a paper sheet uses are exactly the values
    // the FDM params carry.
    const p = params({ cols: 13, marker_mm: 11 })
    const intent = intentOf(toAbacusDesign(p, 'fine'))
    expect(intent.columns).toBe(p.cols)
    expect(intent.markers.sizeMm).toBe(p.marker_mm)
  })

  it('is a pure JSON value (survives a serialize round-trip unchanged)', () => {
    const intent = intentOf(design({ cols: 7 }))
    expect(JSON.parse(JSON.stringify(intent))).toEqual(intent)
  })
})
