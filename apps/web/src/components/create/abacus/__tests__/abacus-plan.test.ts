import { describe, expect, it } from 'vitest'
import { catalogFromParams, type FilamentCatalog } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { defaultParams, type Params } from '../abacus-model'
import {
  computeFilamentMap,
  materialize,
  PRINT_PLAN_SCHEMA_VERSION,
  planToFilamentMap,
} from '../abacus-plan'
import snapshot from './filament-map-snapshot.json'

// The matrix the characterization snapshot was captured over. computeFilamentMap
// depends only on color_scheme, color_palette, frame_color, and the loaded
// filament slots — NOT on cols — so this is the full behavioral surface.
const SCHEMES = ['monochrome', 'heaven-earth', 'alternating', 'place-value']
const PALETTES = ['default', 'colorblind', 'grayscale']
const COUNTS = [8, 3, 1]

const paramsFor = (
  color_scheme: string,
  color_palette: string,
  filament_count: number
): Params => ({
  ...defaultParams,
  color_scheme,
  color_palette,
  filament_count,
})

describe('computeFilamentMap — byte-parity with the pre-plan implementation', () => {
  // The whole point of moving computeFilamentMap into materialize(): the viewer's
  // marker + text-plug snapping must be untouched. This asserts the adapter
  // reproduces the frozen bench output EXACTLY for every scheme × palette × count.
  for (const color_scheme of SCHEMES) {
    for (const color_palette of PALETTES) {
      for (const filament_count of COUNTS) {
        const key = `${color_scheme}|${color_palette}|${filament_count}`
        it(key, () => {
          const got = computeFilamentMap(paramsFor(color_scheme, color_palette, filament_count))
          expect(got).toEqual((snapshot as Record<string, unknown>)[key])
        })
      }
    }
  }

  it('covers every captured combination (no snapshot rot)', () => {
    const expected = SCHEMES.length * PALETTES.length * COUNTS.length
    expect(Object.keys(snapshot as Record<string, unknown>)).toHaveLength(expected)
  })
})

describe('materialize — structure', () => {
  const plan = (p: Params, catalog?: FilamentCatalog) =>
    materialize(toAbacusDesign(p, 'test-profile'), catalog ?? catalogFromParams(p))

  it('tags the plan with the schema version and the catalog source', () => {
    const p = paramsFor('place-value', 'default', 8)
    const result = plan(p)
    expect(result.schemaVersion).toBe(PRINT_PLAN_SCHEMA_VERSION)
    expect(result.catalogSource).toBe('manual-params')
  })

  it('emits exactly one frame + two marker roles plus one assignment per bead role', () => {
    const p = paramsFor('place-value', 'default', 8) // 5 place-value bead roles
    const result = plan(p)
    const kinds = result.assignments.map((a) => a.role.kind)
    expect(kinds.filter((k) => k === 'frame')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'markerBlack')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'markerWhite')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'bead')).toHaveLength(5)
  })

  it('bakes each role its INTRINSIC (pre-quantization) hex', () => {
    const p = paramsFor('heaven-earth', 'default', 8)
    const result = plan(p)
    const frame = result.assignments.find((a) => a.role.kind === 'frame')
    // heaven-earth intrinsic pair is the fixed Typst orange/blue, regardless of the
    // spools loaded — the design boundary, not the catalog.
    const heaven = result.assignments.find((a) => a.role.key === 'bead-0')
    const earth = result.assignments.find((a) => a.role.key === 'bead-1')
    expect(frame?.role.intrinsicHex).toBe(p.frame_color)
    expect(heaven?.role.intrinsicHex).toBe('#F18F01')
    expect(earth?.role.intrinsicHex).toBe('#2E86AB')
  })

  it('scores an exact spool match at distance 0', () => {
    // frame_color equals filament_1 in defaultParams, so the frame lands on it.
    const p = paramsFor('monochrome', 'default', 8)
    const frame = plan(p).assignments.find((a) => a.role.kind === 'frame')
    expect(frame?.distance).toBe(0)
    expect(frame?.overridden).toBe(false)
  })

  it('is P1-clean: no error-severity warnings, so ok stays true', () => {
    for (const color_scheme of SCHEMES) {
      for (const color_palette of PALETTES) {
        for (const filament_count of COUNTS) {
          const result = plan(paramsFor(color_scheme, color_palette, filament_count))
          expect(result.warnings.every((w) => w.severity === 'warning')).toBe(true)
          expect(result.ok).toBe(true)
        }
      }
    }
  })
})

describe('materialize — warnings', () => {
  const plan = (p: Params) => materialize(toAbacusDesign(p, ''), catalogFromParams(p))

  it('warns on unreadable ArUco contrast when one filament is loaded', () => {
    // count=1 collapses black+white onto the same spool → 1:1 contrast.
    const result = plan(paramsFor('monochrome', 'default', 1))
    const w = result.warnings.find((x) => x.code === 'marker-contrast')
    expect(w).toBeDefined()
    expect(w?.severity).toBe('warning')
    expect(result.markerContrast).toBeCloseTo(1, 5)
  })

  it('warns budget-exceeded + role-collision when the palette outnumbers the spools', () => {
    // place-value has 5 bead roles; 3 slots forces reuse.
    const result = plan(paramsFor('place-value', 'default', 3))
    expect(result.warnings.some((w) => w.code === 'budget-exceeded')).toBe(true)
    const collision = result.warnings.find((w) => w.code === 'role-collision')
    expect(collision).toBeDefined()
    // the colliding roles are named so the review panel can point at them.
    expect(collision?.roleKeys?.length ?? 0).toBeGreaterThan(1)
  })

  it('does not warn budget-exceeded when every bead role gets a distinct spool', () => {
    const result = plan(paramsFor('place-value', 'default', 8)) // 5 roles ≤ 8 slots
    expect(result.warnings.some((w) => w.code === 'budget-exceeded')).toBe(false)
    expect(result.warnings.some((w) => w.code === 'role-collision')).toBe(false)
  })
})

describe('materialize — overrides + catalog source', () => {
  it('honors a role override, flags it, and rescoring the distance to the pinned spool', () => {
    const p = paramsFor('monochrome', 'default', 8)
    const design = toAbacusDesign(p, '')
    const catalog = catalogFromParams(p)
    const baseline = materialize(design, catalog)
    const frameBase = baseline.assignments.find((a) => a.role.kind === 'frame')
    expect(frameBase?.overridden).toBe(false)

    // pin the frame onto a deliberately different spool (filament-4 = #2E86AB).
    const pinned = materialize(design, catalog, { overrides: { frame: 'filament-4' } })
    const frame = pinned.assignments.find((a) => a.role.kind === 'frame')
    expect(frame?.spoolId).toBe('filament-4')
    expect(frame?.overridden).toBe(true)
    expect(frame?.spoolIndex).toBe(3)
  })

  it('carries a thh-ams catalog source through to the plan', () => {
    const p = paramsFor('monochrome', 'default', 8)
    const thh: FilamentCatalog = {
      source: 'thh-ams',
      fetchedAt: '2026-01-01T00:00:00Z',
      spools: [{ id: 's1', name: 'PLA White', hex: '#ffffff', material: 'PLA' }],
    }
    expect(materialize(toAbacusDesign(p, ''), thh).catalogSource).toBe('thh-ams')
  })
})

describe('planToFilamentMap — the viewer preview seam', () => {
  const slotsOf = (catalog: FilamentCatalog) => catalog.spools.map((s) => s.hex)

  it('projects the no-override plan identically to the legacy computeFilamentMap', () => {
    // the viewer colors through planToFilamentMap now; with no pins it MUST match
    // the byte-parity adapter so the preview is unchanged until the user overrides.
    for (const color_scheme of SCHEMES) {
      for (const color_palette of PALETTES) {
        for (const filament_count of COUNTS) {
          const p = paramsFor(color_scheme, color_palette, filament_count)
          const catalog = catalogFromParams(p)
          const fm = planToFilamentMap(
            materialize(toAbacusDesign(p, ''), catalog),
            slotsOf(catalog)
          )
          expect(fm).toEqual(computeFilamentMap(p))
        }
      }
    }
  })

  it('repoints the projected slot when a role is pinned (overrides reach the preview)', () => {
    const p = paramsFor('monochrome', 'default', 8)
    const catalog = catalogFromParams(p)
    const slots = slotsOf(catalog)
    const design = toAbacusDesign(p, '')

    // auto-snap lands the frame on its exact match (filament-1 === frame_color).
    const base = planToFilamentMap(materialize(design, catalog), slots)
    expect(base.frame).toBe(0)

    // pin it to filament-4 (#2E86AB, index 3) — the projected slot must follow.
    const pinned = planToFilamentMap(
      materialize(design, catalog, { overrides: { frame: 'filament-4' } }),
      slots
    )
    expect(pinned.frame).toBe(3)
    // pinning the frame does not disturb the ArUco pair the camera reads.
    expect(pinned.markerBlack).toBe(base.markerBlack)
    expect(pinned.markerWhite).toBe(base.markerWhite)
  })
})
