import { describe, expect, it } from 'vitest'
import { catalogFromParams, type FilamentCatalog, type FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { beadRoleColors, defaultParams, type Params } from '../abacus-model'
import { materialize, reconciledRoles, SHIFT_DISTANCE_THRESHOLD } from '../abacus-plan'

// reconciledRoles is the pure projection the FilamentReconcileStrip reads: each
// designed color as a row, flagged `shifted` when it lands on a noticeably
// different filament. It replaced the old "My colors / Print preview" toggle, so
// its contract (which roles surface, when a fleck fires) is what the strip's UX
// rests on.

const params: Params = {
  ...defaultParams,
  color_scheme: 'heaven-earth',
  color_palette: 'default',
  filament_count: 8,
}
const design = toAbacusDesign(params, '')
const [heavenHex] = beadRoleColors(params.color_scheme, params.color_palette)

const spool = (id: string, name: string, hex: string, material: string): FilamentSpool => ({
  id,
  name,
  hex,
  material,
})
const thh = (spools: FilamentSpool[]): FilamentCatalog => ({
  source: 'thh-ams',
  fetchedAt: '2026-07-22T00:00:00Z',
  spools,
})

// An exact-match plate built from the design's OWN role colors, so every surfaced
// role has a spool at its intrinsic hex → distance 0 → nothing shifts. Enumerating
// the roles from a manual-params plan keeps this honest as roles change.
const exactCatalog: FilamentCatalog = (() => {
  const seed = catalogFromParams(params)
  const roleColors = reconciledRoles(materialize(design, seed), seed).map((r) => r.intrinsicHex)
  const byHex = new Map(
    roleColors.map((hex, i) => [hex.toLowerCase(), spool(`s${i}`, `Match ${i}`, hex, 'PLA')])
  )
  return thh([...byHex.values()])
})()

// A bare black+white plate: colored beads have nowhere true to land, so they snap
// onto a far-off filament and cross the shift threshold.
const limitedCatalog = thh([
  spool('s-black', 'PLA Black', '#101010', 'PLA'),
  spool('s-white', 'PLA White', '#f2f2f2', 'PLA'),
])

describe('reconciledRoles', () => {
  it('excludes the ArUco marker roles — they are B/W ink, not chosen colors', () => {
    const plan = materialize(design, exactCatalog)
    const keys = reconciledRoles(plan, exactCatalog).map((r) => r.key)
    expect(keys).not.toContain('marker-black')
    expect(keys).not.toContain('marker-white')
    // the beads + frame DO surface
    expect(keys).toContain('frame')
    expect(keys.some((k) => k.startsWith('bead-'))).toBe(true)
  })

  it('flags no shift when every designed color prints true (exact-match plate)', () => {
    const plan = materialize(design, exactCatalog)
    const roles = reconciledRoles(plan, exactCatalog)
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.every((r) => !r.shifted)).toBe(true)
    // filamentHex mirrors the exact-match spool for the beads
    const heaven = roles.find((r) => r.intrinsicHex.toLowerCase() === heavenHex.toLowerCase())
    expect(heaven?.filamentHex.toLowerCase()).toBe(heavenHex.toLowerCase())
  })

  it('flecks the colored beads on a bare black+white plate', () => {
    const plan = materialize(design, limitedCatalog)
    const roles = reconciledRoles(plan, limitedCatalog)
    const beads = roles.filter((r) => r.key.startsWith('bead-'))
    expect(beads.length).toBeGreaterThan(0)
    // saturated beads have no true home on a black/white plate → each flecks
    expect(beads.every((r) => r.shifted)).toBe(true)
    // and something shifts overall (the caption's "N colors shift" is non-empty)
    expect(roles.some((r) => r.shifted)).toBe(true)
  })

  it('sets `shifted` exactly when the assignment distance exceeds the threshold', () => {
    // the core contract: the fleck is a pure readout of RoleAssignment.distance vs
    // the threshold — no independent color math in the strip.
    const plan = materialize(design, limitedCatalog)
    for (const r of reconciledRoles(plan, limitedCatalog)) {
      const a = plan.assignments.find((x) => x.role.key === r.key)
      expect(r.shifted).toBe((a?.distance ?? 0) > SHIFT_DISTANCE_THRESHOLD)
    }
  })

  it('honors the threshold argument as the fleck cutoff', () => {
    const plan = materialize(design, limitedCatalog)
    const bead = reconciledRoles(plan, limitedCatalog).find((r) => r.key.startsWith('bead-'))
    // the assignment's own distance is what the threshold compares against; a
    // threshold above it silences the fleck, below it fires — proving the arg is live.
    const a = plan.assignments.find((x) => x.role.key === bead?.key)
    expect(a).toBeDefined()
    const d = a?.distance ?? 0
    expect(
      reconciledRoles(plan, limitedCatalog, d + 1).find((r) => r.key === bead?.key)?.shifted
    ).toBe(false)
    expect(
      reconciledRoles(plan, limitedCatalog, d - 1).find((r) => r.key === bead?.key)?.shifted
    ).toBe(true)
  })

  it('passes an override through as `overridden`', () => {
    const plan = materialize(design, limitedCatalog, { overrides: { frame: 's-white' } })
    const frame = reconciledRoles(plan, limitedCatalog).find((r) => r.key === 'frame')
    expect(frame?.overridden).toBe(true)
    // and the pinned spool drives the shown filament color
    expect(frame?.filamentHex.toLowerCase()).toBe('#f2f2f2')
  })

  it('reports every role as printing true for a manual-params catalog (no printer paired)', () => {
    // catalogFromParams builds slots straight from the design colors, so each role
    // lands on its own color → distance 0 → the strip is just the clean palette.
    const catalog = catalogFromParams(params)
    const plan = materialize(design, catalog)
    const roles = reconciledRoles(plan, catalog)
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.every((r) => !r.shifted)).toBe(true)
  })

  it('keeps SHIFT_DISTANCE_THRESHOLD in a sane redmean band', () => {
    // guards the calibration: high enough that same-hue near-matches stay silent,
    // low enough that a real hue swap flecks. (redmean scale ~0–800.)
    expect(SHIFT_DISTANCE_THRESHOLD).toBeGreaterThan(50)
    expect(SHIFT_DISTANCE_THRESHOLD).toBeLessThan(150)
  })
})
