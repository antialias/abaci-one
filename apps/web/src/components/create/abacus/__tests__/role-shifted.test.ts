import { describe, expect, it } from 'vitest'
import { catalogFromParams, type FilamentCatalog, type FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { defaultParams, type Params } from '../abacus-model'
import {
  materialize,
  type RoleAssignment,
  roleShifted,
  SHIFT_DISTANCE_THRESHOLD,
} from '../abacus-plan'

// roleShifted is the pure predicate the mapping rows' corner fleck and the "N
// colors shift" footer read: a role prints "shifted" when its assignment's redmean
// distance to the chosen spool exceeds the threshold. It replaced reconciledRoles
// when the reconcile strip was folded into the one part-aware list (Gitea #17), so
// its contract (which surfaces fleck, when) is what the row UX rests on.

const params: Params = {
  ...defaultParams,
  color_scheme: 'heaven-earth',
  color_palette: 'default',
  filament_count: 8,
}
const design = toAbacusDesign(params, '')

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

// the surfaces the user actually colored (frame + beads + inset text); ArUco ink is
// excluded from the shift readout, exactly as the footer's shift count is.
const colored = (a: RoleAssignment) =>
  a.role.kind === 'frame' || a.role.kind === 'bead' || a.role.kind === 'text'

// An exact-match plate built from the design's OWN role colors, so every colored
// surface has a spool at its intrinsic hex → distance 0 → nothing shifts.
const exactCatalog: FilamentCatalog = (() => {
  const seed = catalogFromParams(params)
  const roleColors = materialize(design, seed)
    .assignments.filter(colored)
    .map((a) => a.role.intrinsicHex)
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

describe('roleShifted', () => {
  it('is a pure readout of RoleAssignment.distance vs the threshold', () => {
    // the core contract: the fleck is a readout of the assignment's own distance,
    // no independent color math in the row.
    const plan = materialize(design, limitedCatalog)
    for (const a of plan.assignments) {
      expect(roleShifted(a)).toBe(a.distance > SHIFT_DISTANCE_THRESHOLD)
    }
  })

  it('flags no shift when every colored surface prints true (exact-match plate)', () => {
    const plan = materialize(design, exactCatalog)
    const surfaces = plan.assignments.filter(colored)
    expect(surfaces.length).toBeGreaterThan(0)
    expect(surfaces.every((a) => !roleShifted(a))).toBe(true)
  })

  it('flecks the colored beads on a bare black+white plate', () => {
    const plan = materialize(design, limitedCatalog)
    const beads = plan.assignments.filter((a) => a.role.kind === 'bead')
    expect(beads.length).toBeGreaterThan(0)
    // saturated beads have no true home on a black/white plate → each flecks
    expect(beads.every((a) => roleShifted(a))).toBe(true)
  })

  it('honors the threshold argument as the fleck cutoff', () => {
    const plan = materialize(design, limitedCatalog)
    const bead = plan.assignments.find((a) => a.role.kind === 'bead')
    if (!bead) throw new Error('expected a bead assignment')
    // the assignment's own distance is what the threshold compares against; a
    // threshold above it silences the fleck, below it fires — proving the arg is live.
    const d = bead.distance
    expect(roleShifted(bead, d + 1)).toBe(false)
    expect(roleShifted(bead, d - 1)).toBe(true)
  })

  it('reports every surface as printing true for a manual-params catalog (no printer paired)', () => {
    // catalogFromParams builds slots straight from the design colors, so each role
    // lands on its own color → distance 0 → the list is just the clean palette.
    const catalog = catalogFromParams(params)
    const plan = materialize(design, catalog)
    const surfaces = plan.assignments.filter(colored)
    expect(surfaces.length).toBeGreaterThan(0)
    expect(surfaces.every((a) => !roleShifted(a))).toBe(true)
  })

  it('keeps SHIFT_DISTANCE_THRESHOLD in a sane redmean band', () => {
    // guards the calibration: high enough that same-hue near-matches stay silent,
    // low enough that a real hue swap flecks. (redmean scale ~0–800.)
    expect(SHIFT_DISTANCE_THRESHOLD).toBeGreaterThan(50)
    expect(SHIFT_DISTANCE_THRESHOLD).toBeLessThan(150)
  })
})
