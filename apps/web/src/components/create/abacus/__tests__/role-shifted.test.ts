import { describe, expect, it } from 'vitest'
import { exactMatchPlan, stubFilamentPlan } from '../__fixtures__/filament-plan-stub'
import { type FilamentCatalog, type FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { defaultParams, type Params } from '../abacus-model'
import {
  materialize,
  type RoleAssignment,
  roleShifted,
  SHIFT_DISTANCE_THRESHOLD,
} from '../abacus-plan'

// roleShifted is the pure predicate the mapping rows' corner fleck and the "N
// colors shift" footer read: a role prints "shifted" when the distance between its
// designed color and the spool it landed on exceeds the threshold. It replaced
// reconciledRoles when the reconcile strip was folded into the one part-aware list
// (Gitea #17), so its contract (which surfaces fleck, when) is what the row UX
// rests on.
//
// Since the authority swap (Gitea #37) that distance is the SERVICE's ΔE00, not a
// locally-computed redmean, and it can be null — "nobody measured this" — which is
// a third state the fleck has to answer for and the old redmean number never had.

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

// A bare black+white plate. The service has nowhere true to put a saturated bead,
// so it reports the shift it had to accept — a ΔE00 well past the threshold.
const limitedCatalog = thh([
  spool('s-black', 'PLA Black', '#101010', 'PLA'),
  spool('s-white', 'PLA White', '#f2f2f2', 'PLA'),
])

// A synthetic assignment, so the predicate's own contract can be tested without
// routing a distance through a whole plan.
const at = (distance: number | null, kind: RoleAssignment['role']['kind'] = 'bead') => ({
  role: { kind, key: `${kind}-x`, label: kind, intrinsicHex: '#dc2626' },
  spoolId: 's-black',
  spoolIndex: 0,
  distance,
  overridden: false,
})

describe('roleShifted', () => {
  it('is a pure readout of RoleAssignment.distance vs the threshold', () => {
    expect(roleShifted(at(SHIFT_DISTANCE_THRESHOLD + 1))).toBe(true)
    expect(roleShifted(at(SHIFT_DISTANCE_THRESHOLD))).toBe(false)
    expect(roleShifted(at(SHIFT_DISTANCE_THRESHOLD - 1))).toBe(false)
  })

  it('never flecks the feet, whatever the distance', () => {
    // Gitea #23: the feet spool is picked by MATERIAL (`preferred: [{family:'TPU'}]`),
    // so its distance from the fixed slate intrinsic is decorative — never a shift
    // for the user to audit. Exercised at a distance that would fleck any other role.
    expect(roleShifted(at(SHIFT_DISTANCE_THRESHOLD * 10, 'feet'))).toBe(false)
  })

  it('does not fleck an UNMEASURED role', () => {
    // Null is "nobody measured this", which arrives two ways: a spool whose color
    // metadata the service could not read, and a freshly-pinned role whose ΔE00
    // describes the spool the service picked, not the one the user just chose.
    // Silence is the honest answer — a fleck asserts "this prints noticeably
    // different", which is exactly the claim an unmeasured role cannot make.
    expect(roleShifted(at(null))).toBe(false)
  })

  it('honors the threshold argument as the fleck cutoff', () => {
    const a = at(20)
    expect(roleShifted(a, 21)).toBe(false)
    expect(roleShifted(a, 19)).toBe(true)
  })

  it('reads the distance the SERVICE reported, through materialize', () => {
    // The wiring assertion: ΔE00 from the plan's assignment has to reach the
    // predicate unchanged. A plan that reported a shift and a row that stayed
    // fleckless would be invisible in every other test here.
    const plan = materialize(design, limitedCatalog, {
      plan: stubFilamentPlan(design, limitedCatalog, {
        'marker-black': 's-black',
        'marker-white': 's-white',
        frame: 's-black',
        'bead-0': ['s-white', 34],
        'bead-1': ['s-black', 41],
      }),
    })
    const beads = plan.assignments.filter((a) => a.role.kind === 'bead')
    expect(beads.length).toBeGreaterThan(0)
    expect(beads.map((a) => a.distance)).toEqual([34, 41])
    expect(beads.every((a) => roleShifted(a))).toBe(true)
  })

  it('flags no shift when every colored surface prints true (exact-match plate)', () => {
    const { catalog, plan: staged } = exactMatchPlan(design)
    const plan = materialize(design, catalog, { plan: staged })
    const surfaces = plan.assignments.filter(colored)
    expect(surfaces.length).toBeGreaterThan(0)
    expect(surfaces.every((a) => !roleShifted(a))).toBe(true)
  })

  it('flags no shift when no plan exists at all (nothing is assigned)', () => {
    // The unplanned path: no printer paired, or the plan still in flight. There is
    // no assignment to fleck, and nothing invents one.
    const plan = materialize(design, limitedCatalog)
    expect(plan.planStatus).toBe('unplanned')
    expect(plan.assignments).toEqual([])
  })

  it('keeps SHIFT_DISTANCE_THRESHOLD in a sane CIEDE2000 band', () => {
    // Guards the recalibration (Gitea #37). This is ΔE00 (~0–100) now, not redmean
    // (~0–800): high enough that same-hue near-matches (#dc2626→#c1272d is 6.3)
    // stay silent, low enough that a real hue swap (#14b8a6→#22c55e is 19.0) flecks.
    // A threshold left at the old redmean 85 would silence every fleck there is,
    // which is the specific regression this band exists to catch.
    expect(SHIFT_DISTANCE_THRESHOLD).toBeGreaterThan(6.3)
    expect(SHIFT_DISTANCE_THRESHOLD).toBeLessThan(13.1)
  })
})
