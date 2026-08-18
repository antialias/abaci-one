import { describe, expect, it } from 'vitest'
import {
  exactMatchPlan,
  stubCompatWarning,
  stubFilamentPlan,
  type StubPick,
} from '../__fixtures__/filament-plan-stub'
import { catalogFromParams, type FilamentCatalog, type FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { beadRoleColors, COLOR_PALETTES, defaultParams, type Params } from '../abacus-model'
import {
  designFilamentMap,
  materialize,
  NO_SPOOL,
  PRINT_PLAN_SCHEMA_VERSION,
  planToFilamentMap,
} from '../abacus-plan'

// `materialize` after the authority swap (Gitea #37).
//
// What this file no longer tests, because the code no longer does it: choosing a
// spool. There is no redmean search, no anchor-group restriction, no distinct-first
// loop, no TPU-by-name feet pick. THH's `filament-plan/v1` decides, and this module
// PROJECTS that decision onto the studio's role model. So the tests here are about
// the projection (does the service's answer arrive intact, and total on every
// degenerate input) and about the small set of warnings the studio still owns.
//
// The intent the deleted tests encoded did not evaporate — it moved to the layer
// that now owns it, and is asserted there:
//   • which roles must differ, what the feet prefer, what is welded to what
//     → abacus-plan-request.test.ts, as request constraints
//   • whether a given roster satisfies them → THH's planner, not this repo
//
// Gone with them: `filament-map-snapshot.json` and its byte-parity suite. That
// fixture characterized `computeFilamentMap` — a redmean quantization of the design
// onto the eight `filament_N` params. Its subject is deleted, and pinning it against
// `designFilamentMap` would be meaningless: the params catalog describes no real
// spools, so the unplanned path now shows the DESIGN rather than approximating it
// against a fictional roster.

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

const spool = (id: string, name: string, hex: string, material: string): FilamentSpool => ({
  id,
  name,
  hex,
  material,
})
const thh = (spools: FilamentSpool[]): FilamentCatalog => ({
  source: 'thh-ams',
  fetchedAt: '2026-08-14T00:00:00Z',
  spools,
})

// heaven-earth = the smallest scheme whose bead colors are distinct from the
// marker/frame anchors (monochrome's bead is intrinsically #000000).
const p = paramsFor('heaven-earth', 'default', 8)
const design = toAbacusDesign(p, 'test-profile')
const [heavenHex, earthHex] = beadRoleColors(p.color_scheme, p.color_palette)

const plaRoster = () => [
  spool('s-black', 'Matte Black', '#000000', 'PLA'),
  spool('s-white', 'Matte White', '#ffffff', 'PLA'),
  spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
  spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
  spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
]
// The mapping a healthy planner returns on that roster.
const plaPicks: Record<string, StubPick> = {
  'marker-black': 's-black',
  'marker-white': 's-white',
  frame: 's-frame',
  'bead-0': 's-heaven',
  'bead-1': 's-earth',
  feet: 's-frame',
}

/** materialize against a staged plan, in one line. */
const planned = (
  catalog: FilamentCatalog,
  picks: Record<string, StubPick> = plaPicks,
  opts: {
    overrides?: Record<string, string>
    d?: typeof design
    extra?: Parameters<typeof stubFilamentPlan>[3]
  } = {}
) => {
  const d = opts.d ?? design
  return materialize(d, catalog, {
    overrides: opts.overrides,
    plan: stubFilamentPlan(d, catalog, picks, opts.extra),
  })
}

describe('materialize — structure', () => {
  it('tags the plan with the schema version, the catalog source, and the plan status', () => {
    const result = planned(thh(plaRoster()))
    expect(result.schemaVersion).toBe(PRINT_PLAN_SCHEMA_VERSION)
    expect(result.catalogSource).toBe('thh-ams')
    expect(result.planStatus).toBe('satisfied')
  })

  it('emits exactly one frame + two marker roles plus one assignment per bead role', () => {
    const pv = toAbacusDesign(paramsFor('place-value', 'default', 8), '') // 5 bead roles
    const catalog = thh(plaRoster())
    const kinds = planned(catalog, {}, { d: pv }).assignments.map((a) => a.role.kind)
    expect(kinds.filter((k) => k === 'frame')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'markerBlack')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'markerWhite')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'bead')).toHaveLength(5)
  })

  it('bakes each role its INTRINSIC (pre-plan) hex', () => {
    const result = planned(thh(plaRoster()))
    // the heaven-earth intrinsic pair is the fixed Typst orange/blue regardless of
    // what the printer has loaded — the design boundary, not the roster.
    expect(result.assignments.find((a) => a.role.kind === 'frame')?.role.intrinsicHex).toBe(
      p.frame_color
    )
    expect(result.assignments.find((a) => a.role.key === 'bead-0')?.role.intrinsicHex).toBe(
      '#F18F01'
    )
    expect(result.assignments.find((a) => a.role.key === 'bead-1')?.role.intrinsicHex).toBe(
      '#2E86AB'
    )
  })
})

describe('materialize — the projection is a join, not a re-derivation', () => {
  const catalog = thh(plaRoster())

  it('lands every role on the spool the SERVICE named', () => {
    const result = planned(catalog)
    expect(
      Object.fromEntries(result.assignments.map((a) => [a.role.key, a.spoolId]))
    ).toMatchObject(plaPicks)
    expect(result.assignments.every((a) => !a.overridden)).toBe(true)
  })

  it('takes a color it would never have picked itself, without arguing', () => {
    // The proof that no local matcher survives: the service puts ArUco black on
    // the WHITE spool. A quantizer would "fix" this; a projection reports it.
    const result = planned(catalog, { ...plaPicks, 'marker-black': ['s-white', 0] })
    expect(result.assignments.find((a) => a.role.key === 'marker-black')?.spoolId).toBe('s-white')
    // ...and the consequence is judged honestly: both markers are now white.
    expect(result.markerContrast).toBeCloseTo(1, 5)
    expect(result.warnings.some((w) => w.code === 'marker-contrast')).toBe(true)
  })

  it('carries the service ΔE00 through as the assignment distance', () => {
    const result = planned(catalog, { ...plaPicks, 'bead-0': ['s-white', 37.5] })
    expect(result.assignments.find((a) => a.role.key === 'bead-0')?.distance).toBe(37.5)
    // an exact match reports 0, which is NOT the same as unmeasured
    expect(result.assignments.find((a) => a.role.key === 'frame')?.distance).toBe(0)
  })

  it('resolves the external spool by its flag, not by a slot id', () => {
    // A no-AMS printer's direct spool has no slotId (things-haunt-house#382), so the
    // plan names it with `external: true` and the join has to find it that way.
    const ext = thh([{ ...spool('ext-0', 'Direct PLA', '#101010', 'PLA'), external: true }])
    const result = planned(ext, {})
    expect(result.assignments.every((a) => a.spoolId === 'ext-0')).toBe(true)
  })

  it('reports NO_SPOOL — never slot 0 — for a role the service could not place', () => {
    const result = planned(catalog, plaPicks, { extra: { unplaced: ['bead-1'], status: 'degraded' } })
    const earth = result.assignments.find((a) => a.role.key === 'bead-1')
    expect(earth?.spoolIndex).toBe(NO_SPOOL)
    expect(earth?.spoolId).toBe('')
    expect(earth?.distance).toBeNull()
    expect(result.planStatus).toBe('degraded')
  })

  it('names the unplaced roles in a plan-unresolved warning', () => {
    // The alternative — a role quietly missing from the mapping panel — is how an
    // unprintable design reaches the plate looking fine.
    const w = planned(catalog, plaPicks, {
      extra: { unplaced: ['bead-1'], status: 'degraded' },
    }).warnings.find((x) => x.code === 'plan-unresolved')
    expect(w?.roleKeys).toEqual(['bead-1'])
    expect(w?.severity).toBe('warning')
    expect(w?.message).toContain('no loaded filament')
  })

  it('treats a spool the catalog no longer holds as unplaced (roster moved mid-flight)', () => {
    // Only reachable if the roster changed between the plan and this render, which
    // the cache key exists to prevent. It must not round to a neighbouring slot.
    const staged = stubFilamentPlan(design, thh(plaRoster()), plaPicks)
    const shrunk = thh([plaRoster()[0]]) // only s-black survives
    const result = materialize(design, shrunk, { plan: staged })
    const frame = result.assignments.find((a) => a.role.kind === 'frame')
    expect(frame?.spoolIndex).toBe(NO_SPOOL)
    expect(result.assignments.find((a) => a.role.key === 'marker-black')?.spoolId).toBe('s-black')
  })
})

describe('materialize — pins', () => {
  const catalog = thh([...plaRoster(), spool('s-pink', 'Hot Pink', '#ff69b4', 'PLA')])

  it('repoints the role and flags it, overriding the service pick', () => {
    const result = planned(catalog, plaPicks, { overrides: { frame: 's-pink' } })
    const frame = result.assignments.find((a) => a.role.kind === 'frame')
    expect(frame?.spoolId).toBe('s-pink')
    expect(frame?.spoolIndex).toBe(5)
    expect(frame?.overridden).toBe(true)
    expect(result.assignments.filter((a) => a.overridden)).toHaveLength(1)
  })

  it('drops the distance to null when the pin moves the role off the measured spool', () => {
    // The ΔE00 in the plan describes the SERVICE's pick. Keeping it on a role the
    // user just moved would attach a real-looking measurement to a different spool,
    // and this file no longer owns a color metric to recompute one with.
    const result = planned(
      catalog,
      { ...plaPicks, frame: ['s-frame', 4] },
      { overrides: { frame: 's-pink' } }
    )
    expect(result.assignments.find((a) => a.role.kind === 'frame')?.distance).toBeNull()
  })

  it('keeps the distance when the pin agrees with the service', () => {
    const result = planned(
      catalog,
      { ...plaPicks, frame: ['s-frame', 4] },
      { overrides: { frame: 's-frame' } }
    )
    const frame = result.assignments.find((a) => a.role.kind === 'frame')
    expect(frame?.distance).toBe(4)
    expect(frame?.overridden).toBe(true)
  })

  it('ignores a pin naming a spool this catalog does not hold', () => {
    const result = planned(catalog, plaPicks, { overrides: { frame: 's-nonexistent' } })
    const frame = result.assignments.find((a) => a.role.kind === 'frame')
    expect(frame?.spoolId).toBe('s-frame')
    expect(frame?.overridden).toBe(false)
  })
})

describe('materialize — the warnings the studio still owns', () => {
  const catalog = thh(plaRoster())

  it('marker-contrast: tracks the FINAL pair, so a pinned marker moves it', () => {
    expect(planned(catalog).warnings.some((w) => w.code === 'marker-contrast')).toBe(false)
    const w = planned(catalog, plaPicks, {
      overrides: { 'marker-white': 's-black' },
    }).warnings.find((x) => x.code === 'marker-contrast')
    expect(w).toBeDefined()
    expect(w?.origin).toBe('studio')
  })

  it('budget-exceeded + role-collision: bead roles the service had to collapse', () => {
    const pv = toAbacusDesign(paramsFor('place-value', 'default', 8), '')
    const result = planned(
      catalog,
      { 'bead-0': 's-heaven', 'bead-1': 's-heaven', 'bead-2': 's-heaven' },
      { d: pv }
    )
    expect(result.warnings.some((w) => w.code === 'budget-exceeded')).toBe(true)
    const collision = result.warnings.find((w) => w.code === 'role-collision')
    expect(collision?.roleKeys?.length ?? 0).toBeGreaterThan(1)
  })

  it('does not count UNPLACED beads as sharing a filament', () => {
    // Two roles the service placed nowhere are not colliding — they have no
    // filament to collide on, and plan-unresolved already names them.
    const pv = toAbacusDesign(paramsFor('place-value', 'default', 8), '')
    const result = planned(catalog, plaPicks, {
      d: pv,
      extra: { unplaced: ['bead-2', 'bead-3', 'bead-4'], status: 'degraded' },
    })
    expect(result.warnings.some((w) => w.code === 'role-collision')).toBe(false)
    expect(result.warnings.some((w) => w.code === 'plan-unresolved')).toBe(true)
  })

  it('support-material: fires when a visible role lands on breakaway media', () => {
    // The one material check THH structurally will not make: its planner filters
    // support media TOWARD a support-interface role, never away from a model one.
    const withSupport = thh([...plaRoster(), spool('s-sup', 'Support for PLA', '#fefefe', 'PLA-S')])
    const w = planned(withSupport, { ...plaPicks, 'marker-white': 's-sup' }).warnings.find(
      (x) => x.code === 'support-material'
    )
    expect(w?.roleKeys).toEqual(['marker-white'])
    expect(w?.origin).toBe('studio')
    expect(w?.message).toContain('breakaway support filament')
  })

  it("support-material: reads the SERVICE's supportKind, not the family name", () => {
    // A spool whose family says nothing (`SomeBrand-Matte`) but which the service
    // reports as support media must still warn — and the reverse: a PLA-S name the
    // service explicitly grades as plain model material must not.
    const oddName = thh([
      ...plaRoster(),
      { ...spool('s-odd', 'Breakaway Matte', '#fefefe', 'ACME'), supportKind: 'interface' as const },
      { ...spool('s-plas', 'Actually Fine', '#eeeeee', 'PLA-S'), supportKind: null },
    ])
    expect(
      planned(oddName, { ...plaPicks, 'marker-white': 's-odd' }).warnings.some(
        (w) => w.code === 'support-material'
      )
    ).toBe(true)
    expect(
      planned(oddName, { ...plaPicks, 'marker-white': 's-plas' }).warnings.some(
        (w) => w.code === 'support-material'
      )
    ).toBe(false)
  })

  it('feet-material: driven by the planner relaxing the TPU preference, not by a name test', () => {
    // The feet ask for a preferred TPU identity. The service says it could not
    // honour that by relaxing `preferred_identity_unavailable` — which is the whole
    // signal, replacing the old `/tpu\s*for\s*ams/i` match on a product string.
    const silent = planned(catalog)
    expect(silent.warnings.some((w) => w.code === 'feet-material')).toBe(false)

    const w = planned(catalog, plaPicks, {
      extra: { relaxations: { feet: ['preferred_identity_unavailable'] } },
    }).warnings.find((x) => x.code === 'feet-material')
    expect(w?.roleKeys).toEqual(['feet'])
    expect(w?.severity).toBe('warning')
    expect(w?.message).toContain('flexible (TPU)')
    // An all-PLA roster genuinely holds no TPU, so the inventory claim is true.
    expect(w?.message).toContain('No flexible (TPU) filament is loaded')
  })

  it('feet-material: never claims "no TPU is loaded" while the roster holds one', () => {
    // The relaxation is a claim about the PLAN — "no spool satisfied the
    // preference selector" — not about the printer. With Bambu's "TPU for AMS"
    // physically loaded (wire family TPU-AMS) and the preference still relaxed
    // (a selector miss, a conflict — the service's reasons are its own), the
    // banner must report plan-could-not-use-it, not inventory-absence. The old
    // wording lied here in production: TPU sat in slot 1.1 while the studio
    // said none was loaded.
    const withTpu = thh([...plaRoster(), spool('s-tpu', 'TPU for AMS', '#90ff1a', 'TPU-AMS')])
    const w = planned(withTpu, plaPicks, {
      extra: { relaxations: { feet: ['preferred_identity_unavailable'] } },
    }).warnings.find((x) => x.code === 'feet-material')
    expect(w?.message).toContain('flexible (TPU) filament is loaded, but the plan could not put it on the feet')
    expect(w?.message).not.toContain('No flexible (TPU) filament is loaded')
  })

  it('feet-material: a pin answers it (the user chose these feet deliberately)', () => {
    expect(
      planned(catalog, plaPicks, {
        overrides: { feet: 's-earth' },
        extra: { relaxations: { feet: ['preferred_identity_unavailable'] } },
      }).warnings.some((w) => w.code === 'feet-material')
    ).toBe(false)
  })

  it('never blocks: every studio warning is warning-severity and ok stays true', () => {
    // The house rule. Rainbow text is the DEFAULT fill, so an error on a thin
    // roster would ship a studio whose default design refuses to print.
    const worst = planned(thh([spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA')]), {})
    expect(worst.warnings.length).toBeGreaterThan(0)
    expect(worst.warnings.every((w) => w.severity === 'warning')).toBe(true)
    expect(worst.ok).toBe(true)
  })
})

describe('materialize — inset text inlay roles', () => {
  const catalog = thh(plaRoster())
  const withText = (over: Partial<Params> = {}) => toAbacusDesign({ ...p, ...over }, '')
  const textOf = (r: ReturnType<typeof materialize>) =>
    r.assignments.filter((a) => a.role.kind === 'text')

  it('mints one role per color group — this is what gives the plugs a slot to print in', () => {
    const roles = textOf(planned(catalog, {}, { d: withText() }))
    expect(roles.map((a) => a.role.key)).toEqual(['text-0', 'text-1', 'text-2', 'text-3', 'text-4'])
    // the intrinsic hex is the palette ink the scad would color that token
    expect(roles.map((a) => a.role.intrinsicHex)).toEqual(COLOR_PALETTES.default)
    // labels name the writing the row controls, not an opaque index
    expect(roles[0]?.role.label).toBe('1+9 1+4')
  })

  it('single fill is exactly one role, labelled for the whole inlay', () => {
    const d = withText({ text_fill: 'single', text_color: '#00ff88' })
    const roles = textOf(planned(catalog, {}, { d }))
    expect(roles).toHaveLength(1)
    expect(roles[0]?.role.key).toBe('text-0')
    expect(roles[0]?.role.intrinsicHex).toBe('#00ff88')
    expect(roles[0]?.role.label).toBe('Inlay text')
  })

  it('mints nothing when there is no inlay to ink (emboss mode, or no writing)', () => {
    expect(textOf(planned(catalog, {}, { d: withText({ text_mode: 'emboss' }) }))).toHaveLength(0)
    expect(
      textOf(planned(catalog, {}, { d: withText({ aid_10: 'off', aid_5: 'off' }) }))
    ).toHaveLength(0)
  })

  it('rainbow-unrealizable: reports the ink groups the service had to collapse', () => {
    const d = withText()
    const result = planned(
      catalog,
      { ...plaPicks, 'text-0': 's-black', 'text-1': 's-black', 'text-2': 's-black' },
      { d }
    )
    const w = result.warnings.find((x) => x.code === 'rainbow-unrealizable')
    expect(w?.severity).toBe('warning')
    expect(w?.message).toContain('5 ink colors')
    expect(w?.message).toMatch(/only \d+ distinct/)
    expect(w?.roleKeys).toEqual(['text-0', 'text-1', 'text-2', 'text-3', 'text-4'])
  })

  it('rainbow-unrealizable: silent when every group lands on its own filament', () => {
    const d = withText()
    const inks = COLOR_PALETTES.default.map((hex, i) => spool(`s-pal-${i}`, `Ink ${i}`, hex, 'PLA'))
    const roster = thh([...plaRoster(), ...inks])
    const picks: Record<string, StubPick> = { ...plaPicks }
    inks.forEach((s, i) => {
      picks[`text-${i}`] = s.id
    })
    expect(
      planned(roster, picks, { d }).warnings.some((w) => w.code === 'rainbow-unrealizable')
    ).toBe(false)
  })

  it('text-invisible: names the groups that landed on the frame filament', () => {
    // The one text outcome a user is guaranteed to notice: a plug fills its pocket
    // FLUSH and level, so frame-colored writing does not read as a near miss — it
    // vanishes. The request declares this as a `different` pair; this is what the
    // studio says when the planner had to shed it.
    const d = withText()
    // every other group named explicitly, so the one collision is the one asked for
    const w = planned(
      catalog,
      {
        ...plaPicks,
        'text-0': 's-black',
        'text-1': 's-white',
        'text-2': 's-frame',
        'text-3': 's-heaven',
        'text-4': 's-earth',
      },
      { d }
    ).warnings.find((x) => x.code === 'text-invisible')
    expect(w?.roleKeys).toEqual(['text-2'])
    expect(w?.message).toContain('1 of the inlay text colors print')
  })

  it('text-invisible: an unplaced frame cannot swallow anything', () => {
    const d = withText()
    const result = planned(catalog, plaPicks, { d, extra: { unplaced: ['frame'] } })
    expect(result.warnings.some((x) => x.code === 'text-invisible')).toBe(false)
  })
})

describe('materialize — relaying the service warnings', () => {
  const catalog = thh(plaRoster())

  it('relays a compatibility warning verbatim, tagged with its origin and severity', () => {
    // Relayed rather than re-worded: the detail carries provenance the studio
    // cannot reconstruct ("Orca reports 255 °C for this profile").
    const detail = 'PETG HF slices at 255 °C while the rest of this plate slices at 220 °C.'
    const w = planned(catalog, plaPicks, {
      extra: {
        status: 'degraded',
        warnings: [stubCompatWarning('plate_temperature_mix', ['frame'], detail)],
      },
    }).warnings.find((x) => x.code === 'plate_temperature_mix')
    expect(w?.origin).toBe('service')
    expect(w?.message).toBe(detail)
    expect(w?.roleKeys).toEqual(['frame'])
    // graded as a prediction, preserved — but never promoted into an export gate
    expect(w?.serviceSeverity).toBe('caution')
    expect(w?.severity).toBe('warning')
  })

  it('relays a code it has never heard of rather than dropping it', () => {
    const w = planned(catalog, plaPicks, {
      extra: { warnings: [stubCompatWarning('some_future_code', ['frame'], 'Something new.')] },
    }).warnings.find((x) => x.code === 'some_future_code')
    expect(w?.message).toBe('Something new.')
  })

  it('filters the two families the studio says better, and nothing else', () => {
    const result = planned(catalog, plaPicks, {
      extra: {
        status: 'degraded',
        unplaced: ['bead-1'],
        relaxations: { feet: ['preferred_identity_unavailable'] },
        warnings: [
          stubCompatWarning('palette_unresolved', ['bead-1'], 'No filament matches #2E86AB.'),
          {
            ...stubCompatWarning('preferred_identity_unavailable', ['feet'], 'No TPU is loaded.'),
            origin: 'planner' as const,
          },
          stubCompatWarning('poor_interlayer_adhesion', ['frame'], 'PLA does not bond to PETG.'),
        ],
      },
    })
    const codes = result.warnings.map((w) => w.code)
    // covered by 'plan-unresolved' and 'feet-material', which name real roles
    expect(codes).not.toContain('palette_unresolved')
    expect(codes).not.toContain('preferred_identity_unavailable')
    expect(codes).toContain('plan-unresolved')
    expect(codes).toContain('feet-material')
    // ...and the unrelated one still comes through
    expect(codes).toContain('poor_interlayer_adhesion')
  })

  it('does NOT filter a preferred_identity_unavailable for some other role', () => {
    const w = planned(catalog, plaPicks, {
      extra: {
        warnings: [
          stubCompatWarning('preferred_identity_unavailable', ['frame'], 'Frame preference shed.'),
        ],
      },
    }).warnings.find((x) => x.code === 'preferred_identity_unavailable')
    expect(w?.message).toBe('Frame preference shed.')
  })
})

describe('materialize — total on every degenerate input', () => {
  // `materialize` runs inside the studio provider, ABOVE every React error
  // boundary, so a throw here blanks the whole page instead of one pane. Each case
  // below reached that code path at least once in the studio's history.
  const d = toAbacusDesign(paramsFor('place-value', 'default', 8), '')

  it('no plan at all: an empty, explicitly UNPLANNED plan — never a local match', () => {
    // The params-catalog path and the still-loading path. Empty rather than
    // locally matched is the whole point of the swap.
    const plan = materialize(d, thh(plaRoster()))
    expect(plan.planStatus).toBe('unplanned')
    expect(plan.assignments).toEqual([])
    expect(plan.warnings).toEqual([])
    expect(plan.ok).toBe(true)
    expect(plan.schemaVersion).toBe(PRINT_PLAN_SCHEMA_VERSION)
  })

  it('a live THH read reporting ZERO loaded filaments returns a degenerate plan', () => {
    // The original studio crash: a successful read with no spools reached the
    // quantizer, which emitted an out-of-range slot, and `spools[idx].id` threw.
    const empty: FilamentCatalog = { source: 'thh-ams', fetchedAt: '2026-01-01T00:00:00Z', spools: [] }
    const plan = materialize(d, empty, { plan: stubFilamentPlan(d, empty) })
    expect(plan.planStatus).toBe('unresolved')
    expect(plan.assignments).toEqual([])
    expect(plan.catalogSource).toBe('thh-ams')
  })

  it('a degenerate plan never reads as "the markers are fine"', () => {
    // 1 (no contrast at all), not 21. A degenerate plan must not claim the camera
    // can read a marker pair that was never mapped.
    expect(materialize(d, thh(plaRoster())).markerContrast).toBe(1)
  })

  it('projects a degenerate plan to a FilamentMap without throwing', () => {
    const fm = planToFilamentMap(materialize(d, thh([])), [])
    expect(fm.frame).toBe(0)
    expect(fm.markerBlack).toBe(0)
    expect(fm.markerWhite).toBe(0)
    expect(fm.beadRoles).toEqual([])
  })
})

describe('planToFilamentMap — the viewer preview seam', () => {
  const roster = plaRoster()
  const catalog = thh(roster)
  const slots = roster.map((s) => s.hex)

  it('projects each role onto the slot the plan assigned', () => {
    const fm = planToFilamentMap(planned(catalog), slots)
    expect(fm.frame).toBe(2)
    expect(fm.markerBlack).toBe(0)
    expect(fm.markerWhite).toBe(1)
    expect(fm.beadRoles).toEqual([3, 4])
    expect(fm.feet).toBe(2)
    expect(fm.slots).toEqual(slots)
  })

  it('repoints the projected slot when a role is pinned (overrides reach the preview)', () => {
    const pinned = planToFilamentMap(
      planned(catalog, plaPicks, { overrides: { frame: 's-earth' } }),
      slots
    )
    expect(pinned.frame).toBe(4)
    // pinning the frame does not disturb the ArUco pair the camera reads
    expect(pinned.markerBlack).toBe(0)
    expect(pinned.markerWhite).toBe(1)
  })

  it('mints a DESIGN-COLOR slot for an unplaced role rather than pointing it at slot 0', () => {
    // Slot 0 would paint the role in whatever happens to be loaded first and look
    // exactly like a plan that worked.
    const fm = planToFilamentMap(
      planned(catalog, plaPicks, { extra: { unplaced: ['bead-1'], status: 'degraded' } }),
      slots
    )
    expect(fm.beadRoles[0]).toBe(3) // s-heaven, as planned
    expect(fm.beadRoles[1]).toBe(slots.length) // appended
    expect(fm.slots[fm.beadRoles[1]]).toBe('#2E86AB') // the color the user designed
  })

  it('carries feet and textRoles iff those roles exist', () => {
    const withFeet = planToFilamentMap(planned(catalog), slots)
    expect(withFeet.feet).toBe(2)
    const off = planToFilamentMap(
      planned(catalog, plaPicks, { d: toAbacusDesign({ ...p, feet_mode: 'adhesive' }, '') }),
      slots
    )
    expect('feet' in off).toBe(false)
    const noText = planToFilamentMap(
      planned(catalog, plaPicks, { d: toAbacusDesign({ ...p, text_mode: 'emboss' }, '') }),
      slots
    )
    expect('textRoles' in noText).toBe(false)
  })
})

describe('designFilamentMap — the unplanned preview', () => {
  it('gives every role its own slot holding exactly the designed color', () => {
    const fm = designFilamentMap(design)
    expect(fm.slots[fm.markerBlack]).toBe('#000000')
    expect(fm.slots[fm.markerWhite]).toBe('#ffffff')
    expect(fm.slots[fm.frame]).toBe(p.frame_color)
    expect(fm.beadRoles.map((i) => fm.slots[i])).toEqual(['#F18F01', '#2E86AB'])
    expect(fm.textRoles?.map((i) => fm.slots[i])).toEqual(COLOR_PALETTES.default)
  })

  it('claims perfect marker contrast — the DESIGN is pure black on pure white', () => {
    // And says nothing about what a printer would manage; that only becomes
    // knowable once a plan exists.
    expect(designFilamentMap(design).markerContrast).toBeCloseTo(21, 5)
  })

  it('omits feet and textRoles exactly when the design has no such role', () => {
    const bare = designFilamentMap(toAbacusDesign({ ...p, feet_mode: 'none', text_mode: 'emboss' }, ''))
    expect('feet' in bare).toBe(false)
    expect('textRoles' in bare).toBe(false)
  })

  it('never consults the catalog — it is a function of the design alone', () => {
    // The regression it exists to prevent: `computeFilamentMap` quantized onto the
    // eight `filament_N` params, approximating the design against a roster that
    // describes no real spools. `catalogFromParams` is now unrelated to it.
    const paramsCatalog = catalogFromParams(p)
    const fm = designFilamentMap(design)
    expect(fm.slots).not.toEqual(paramsCatalog.spools.map((s) => s.hex))
  })
})

describe('exactMatchPlan — the fixture itself holds', () => {
  it('serves every role at distance 0 on a roster built from the design', () => {
    const { catalog, plan: staged } = exactMatchPlan(design)
    const result = materialize(design, catalog, { plan: staged })
    expect(result.assignments.length).toBeGreaterThan(0)
    expect(result.assignments.every((a) => a.spoolIndex !== NO_SPOOL)).toBe(true)
    expect(result.assignments.every((a) => a.distance === 0)).toBe(true)
  })
})
