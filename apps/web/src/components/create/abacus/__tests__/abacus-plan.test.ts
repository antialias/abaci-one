import { describe, expect, it } from 'vitest'
import { catalogFromParams, type FilamentCatalog, type FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { beadRoleColors, COLOR_PALETTES, defaultParams, type Params } from '../abacus-model'
import {
  computeFilamentMap,
  materialize,
  PRINT_PLAN_SCHEMA_VERSION,
  planToFilamentMap,
  roleShifted,
  SHIFT_DISTANCE_THRESHOLD,
} from '../abacus-plan'
import snapshot from './filament-map-snapshot.json'

// The matrix the characterization snapshot was captured over: the structure
// roles (frame, ArUco pair, beads) depend only on color_scheme, color_palette,
// frame_color and the loaded filament slots — NOT on cols. That is the surface
// the frozen fixture pins. The map ALSO carries text roles now, which depend on
// text_mode / text_fill / text_color and the four rail presets; that axis is
// covered by its own describe below rather than by widening this matrix 5×.
const SCHEMES = ['monochrome', 'heaven-earth', 'alternating', 'place-value']
const PALETTES = ['default', 'colorblind', 'grayscale']
const COUNTS = [8, 3, 1]
// Keys the frozen fixture pins byte-for-byte.
const FROZEN_KEYS = [
  'beadRoles',
  'feet',
  'frame',
  'markerBlack',
  'markerContrast',
  'markerWhite',
  'slots',
]

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

  it('the frozen fixture still pins the exact key set it was captured with', () => {
    for (const entry of Object.values(snapshot as Record<string, Record<string, unknown>>)) {
      expect(Object.keys(entry).sort()).toEqual(FROZEN_KEYS)
    }
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

// Shared fixtures for the material suites: heaven-earth = the smallest scheme
// whose bead colors are distinct from the marker/frame anchors (monochrome's
// bead is intrinsically #000000 and would collide with the ArUco black spool).
// Five roles: marker pair, frame, heaven, earth. Catalogs load an EXACT-match
// spool per role so auto-snap's landing spots are fixed by construction.
const materialFixtures = () => {
  const p = paramsFor('heaven-earth', 'default', 8)
  const design = toAbacusDesign(p, '')
  const [heavenHex, earthHex] = beadRoleColors(p.color_scheme, p.color_palette)
  const spool = (id: string, name: string, hex: string, material: string): FilamentSpool => ({
    id,
    name,
    hex,
    material,
  })
  const thh = (spools: FilamentSpool[]): FilamentCatalog => ({
    source: 'thh-ams',
    fetchedAt: '2026-07-16T00:00:00Z',
    spools,
  })
  return { p, design, heavenHex, earthHex, spool, thh }
}

describe('materialize — material-aware auto-snap (gh#163: the pit of success)', () => {
  const { design, heavenHex, earthHex, spool, thh } = materialFixtures()

  it('keeps every role inside one anchor group — the prod failure cannot happen by default', () => {
    // four PLAs + the one PETG the heaven bead color chases — the exact shape
    // that slipped through to Orca's temp guard in prod. Color-blind snapping
    // would land heaven on the PETG; the anchor restriction must not.
    const result = materialize(
      design,
      thh([
        spool('s-black', 'Matte Black', '#000000', 'PLA'),
        spool('s-white', 'Matte White', '#ffffff', 'PLA'),
        spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
        spool('s-petg', 'Bambu PETG Basic', heavenHex, 'PETG'),
        spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
      ])
    )
    expect(result.anchorGroup).toBe('PLA')
    expect(result.warnings.find((w) => w.code === 'material-mix')).toBeUndefined()
    const heaven = result.assignments.find((a) => a.role.key === 'bead-0')
    expect(heaven?.spoolId).not.toBe('s-petg') // stays in-group, at a color cost
    expect(result.assignments.find((a) => a.spoolId === 's-petg')).toBeUndefined()
    expect(result.assignments.every((a) => !a.overridden)).toBe(true)
  })

  it('never auto-assigns breakaway support media, even on an exact color match', () => {
    // the support spool is EXACTLY ArUco black; the honest PLA is slightly off.
    const result = materialize(
      design,
      thh([
        spool('s-sup', 'Bambu Support for PLA', '#000000', 'PLA-S'),
        spool('s-black', 'Matte Black', '#101010', 'PLA'),
        spool('s-white', 'Matte White', '#ffffff', 'PLA'),
        spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
        spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
        spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
      ])
    )
    const black = result.assignments.find((a) => a.role.key === 'marker-black')
    expect(black?.spoolId).toBe('s-black')
    expect(result.warnings.find((w) => w.code === 'support-material')).toBeUndefined()
    // PLA-S rides the PLA temperature window, so the anchor is still plain PLA
    expect(result.anchorGroup).toBe('PLA')
  })

  it('claims no anchor for the params catalog (fabricated families) and one for THH', () => {
    const p = paramsFor('heaven-earth', 'default', 8)
    expect(materialize(design, catalogFromParams(p)).anchorGroup).toBeUndefined()
    expect(
      materialize(design, thh([spool('s-white', 'Matte White', '#ffffff', 'PLA')])).anchorGroup
    ).toBe('PLA')
  })
})

describe('materialize — material warnings answer pins (gh#163)', () => {
  const { design, heavenHex, earthHex, spool, thh } = materialFixtures()
  const warnOf = (code: string, catalog: FilamentCatalog, overrides?: Record<string, string>) =>
    materialize(design, catalog, { overrides }).warnings.find((w) => w.code === code)

  // all-PLA auto-snap with odd-family spools loaded but unmapped: harmless
  // until the user pins onto them.
  const catalog = thh([
    spool('s-black', 'Matte Black', '#000000', 'PLA'),
    spool('s-white', 'Matte White', '#ffffff', 'PLA'),
    spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
    spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
    spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
    spool('s-petg', 'Bambu PETG Basic', '#ff00ff', 'PETG'),
    spool('s-sup', 'Bambu Support for PLA', '#fefefe', 'PLA-S'),
  ])

  it('material-mix: fires only once a pin crosses temperature groups, and only counts USED spools', () => {
    expect(warnOf('material-mix', catalog)).toBeUndefined()
    const result = materialize(design, catalog, { overrides: { 'bead-0': 's-petg' } })
    const w = result.warnings.find((x) => x.code === 'material-mix')
    expect(w).toBeDefined()
    expect(w?.severity).toBe('warning')
    expect(result.ok).toBe(true) // heuristic, never a block — the slicer stays the authority
    // names the odd-one-out pick, not the majority
    expect(w?.roleKeys).toEqual(['bead-0'])
    expect(w?.message).toContain('heaven is on Bambu PETG Basic (PETG)')
    expect(w?.message).toContain('the rest of this plate prints at PLA temperatures')
    expect(w?.message).toContain('Move it onto PLA')
  })

  it('material-mix: a PLA-S pin is NOT a temperature mix (support rides the PLA window)', () => {
    expect(warnOf('material-mix', catalog, { 'marker-white': 's-sup' })).toBeUndefined()
  })

  it('support-material: fires when a visible role is pinned onto breakaway support', () => {
    const w = warnOf('support-material', catalog, { 'marker-white': 's-sup' })
    expect(w).toBeDefined()
    expect(w?.roleKeys).toEqual(['marker-white'])
    expect(w?.message).toContain('ArUco white is on Bambu Support for PLA (PLA-S)')
    expect(w?.message).toContain('breakaway support filament')
    // the weld rule does not double-report the support member
    expect(warnOf('material-interface', catalog, { 'marker-white': 's-sup' })).toBeUndefined()
  })

  it('material-interface: a pin that splits the welded frame/marker piece warns about delamination', () => {
    const overrides = { frame: 's-petg' }
    const weld = warnOf('material-interface', catalog, overrides)
    expect(weld).toBeDefined()
    expect(weld?.severity).toBe('warning')
    expect(weld?.roleKeys).toEqual(['frame'])
    expect(weld?.message).toContain('Frame is on PETG while the rest is PLA')
    expect(weld?.message).toContain('delaminate')
    // The temperature warning fires too — different consequence, same fix. It
    // names the feet as well: this catalog loads no TPU, so the feet fall back to
    // the frame's spool, which the pin just moved to PETG. They really do print in
    // PETG and really do share the split, and only a TPU foot is exempt from the
    // bucketing (Gitea #23).
    expect(warnOf('material-mix', catalog, overrides)?.roleKeys).toEqual(['frame', 'feet'])
  })

  it('marker-contrast: tracks the FINAL pair, so pinning a marker dark kills the warning-free state', () => {
    expect(warnOf('marker-contrast', catalog)).toBeUndefined()
    const w = warnOf('marker-contrast', catalog, { 'marker-white': 's-black' })
    expect(w).toBeDefined()
  })

  it('stays silent when every used spool shares one family', () => {
    expect(
      warnOf(
        'material-mix',
        thh([
          spool('s-black', 'Matte Black', '#000000', 'PLA'),
          spool('s-white', 'Matte White', '#ffffff', 'PLA'),
          spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
          spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
          spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
        ])
      )
    ).toBeUndefined()
  })

  it('stays inert on the manual-params catalog (fabricated families never warn)', () => {
    // same mixed spools, but the source gate must win — the params catalog's
    // families are made up, so warning on them would be a lie.
    const manual: FilamentCatalog = {
      source: 'manual-params',
      spools: [
        spool('s-black', 'Matte Black', '#000000', 'PLA'),
        spool('s-white', 'Matte White', '#ffffff', 'PLA'),
        spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
        spool('s-petg', 'Bambu PETG Basic', heavenHex, 'PETG'),
        spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
      ],
    }
    expect(warnOf('material-mix', manual)).toBeUndefined()
    expect(warnOf('support-material', manual)).toBeUndefined()
    expect(warnOf('material-interface', manual)).toBeUndefined()
  })

  it('names every group when pins leave no majority (a tie has no odd one out)', () => {
    // pins split the plate PLA / PETG / TPU with no winner: markers stay PLA,
    // frame + heaven pinned PETG, earth pinned TPU → 2 / 2 / 1.
    const tied = thh([
      spool('s-black', 'Matte Black', '#000000', 'PLA'),
      spool('s-white', 'Matte White', '#ffffff', 'PLA'),
      spool('s-frame', 'PETG Oak', defaultParams.frame_color, 'PETG'),
      spool('s-heaven', 'Bambu PETG Basic', heavenHex, 'PETG'),
      spool('s-earth', 'Flex Blue', earthHex, 'TPU'),
    ])
    const w = warnOf('material-mix', tied, {
      frame: 's-frame',
      'bead-0': 's-heaven',
      'bead-1': 's-earth',
    })
    expect(w).toBeDefined()
    expect(w?.roleKeys).toEqual(['marker-black', 'marker-white', 'frame', 'bead-0', 'bead-1'])
    expect(w?.message).toContain('This plate splits across PLA, PETG, and TPU temperatures')
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

describe('materialize — total on an empty catalog (regression: the provider crash)', () => {
  // The studio crash: a live THH read that SUCCEEDS but reports zero loaded
  // filaments yields a non-null, EMPTY thh-ams catalog. That reached materialize
  // (in the provider, above every error boundary), the quantizer emitted an
  // out-of-range slot, and `spools[idx].id` threw — blanking the whole page.
  // materialize must be TOTAL: an empty catalog degrades to a valid plan, never a
  // throw. (In the app the provider ALSO falls back to the params catalog so this
  // degenerate plan isn't user-visible — but the pure function is the real
  // boundary and must hold on its own.)
  const empty: FilamentCatalog = {
    source: 'thh-ams',
    fetchedAt: '2026-01-01T00:00:00Z',
    spools: [],
  }
  const design = toAbacusDesign(paramsFor('place-value', 'default', 8), '')

  it('returns a valid degenerate plan instead of throwing', () => {
    const plan = materialize(design, empty)
    expect(plan.assignments).toEqual([])
    expect(plan.warnings).toEqual([])
    expect(plan.ok).toBe(true)
    expect(plan.catalogSource).toBe('thh-ams')
    expect(plan.schemaVersion).toBe(PRINT_PLAN_SCHEMA_VERSION)
  })

  it('projects to a FilamentMap without throwing (planToFilamentMap stays total)', () => {
    const fm = planToFilamentMap(materialize(design, empty), [])
    expect(fm.frame).toBe(0)
    expect(fm.markerBlack).toBe(0)
    expect(fm.markerWhite).toBe(0)
    expect(fm.beadRoles).toEqual([])
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

describe('materialize — printed TPU feet (Gitea #23)', () => {
  const { design, heavenHex, earthHex, spool, thh } = materialFixtures()
  // an all-PLA roster with an exact-match spool per historical role, so the
  // feet role is the only thing under test.
  const plaRoster = () => [
    spool('s-black', 'Matte Black', '#000000', 'PLA'),
    spool('s-white', 'Matte White', '#ffffff', 'PLA'),
    spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
    spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
    spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
  ]
  const feetOf = (result: ReturnType<typeof materialize>) =>
    result.assignments.find((a) => a.role.kind === 'feet')

  it('mints the feet role only for printed mode, appended after the historical roles', () => {
    // The invariant is that every HISTORICAL index is stable, so each new role
    // kind appends. Feet went on the end first; inset text now appends after it,
    // so feet is last among the pre-text roles rather than last outright.
    const printed = materialize(design, thh(plaRoster()))
    const preText = printed.assignments.filter((a) => a.role.kind !== 'text')
    expect(preText[preText.length - 1]?.role.kind).toBe('feet')
    // and nothing but text follows it in the real array
    const feetAt = printed.assignments.findIndex((a) => a.role.kind === 'feet')
    expect(printed.assignments.slice(feetAt + 1).every((a) => a.role.kind === 'text')).toBe(true)
    for (const feet_mode of ['adhesive', 'none']) {
      const d = toAbacusDesign({ ...design.params, feet_mode }, '')
      expect(feetOf(materialize(d, thh(plaRoster())))).toBeUndefined()
    }
  })

  it('lands feet on TPU by FAMILY (outside the anchor), and the deliberate mix never warns', () => {
    // the TPU is hot pink — a color-driven pick would never choose it, and a
    // naive temperature bucketing would warn about it. Both must not happen.
    const result = materialize(
      design,
      thh([...plaRoster(), spool('s-tpu', 'SUNLU TPU 95A', '#ff69b4', 'TPU')])
    )
    expect(feetOf(result)?.spoolId).toBe('s-tpu')
    expect(result.anchorGroup).toBe('PLA') // TPU never bids for the plate anchor
    expect(result.warnings.find((w) => w.code === 'feet-material')).toBeUndefined()
    expect(result.warnings.find((w) => w.code === 'material-mix')).toBeUndefined()
    expect(result.warnings.find((w) => w.code === 'material-interface')).toBeUndefined()
  })

  it('prefers the spool literally named "TPU for AMS" over an earlier generic TPU', () => {
    const result = materialize(
      design,
      thh([
        ...plaRoster(),
        spool('s-tpu-generic', 'SUNLU TPU 95A', '#222222', 'TPU'),
        spool('s-tpu-ams', 'Bambu TPU for AMS Black', '#101010', 'TPU'),
      ])
    )
    expect(feetOf(result)?.spoolId).toBe('s-tpu-ams')
  })

  it('no TPU on a real roster: feet fall back to the frame spool + feet-material warning', () => {
    const result = materialize(design, thh(plaRoster()))
    const feet = feetOf(result)
    const frame = result.assignments.find((a) => a.role.kind === 'frame')
    expect(feet?.spoolIndex).toBe(frame?.spoolIndex)
    const w = result.warnings.find((x) => x.code === 'feet-material')
    expect(w?.severity).toBe('warning')
    expect(w?.roleKeys).toEqual(['feet'])
    expect(result.ok).toBe(true) // advisory, never a block
  })

  it('stays silent on the params catalog (fabricated families have no TPU to miss)', () => {
    const p = paramsFor('heaven-earth', 'default', 8)
    const result = materialize(toAbacusDesign(p, ''), catalogFromParams(p))
    expect(feetOf(result)).toBeDefined()
    expect(result.warnings.find((w) => w.code === 'feet-material')).toBeUndefined()
  })

  it('honors a feet pin, and the pin answers the fallback warning', () => {
    const result = materialize(design, thh(plaRoster()), { overrides: { feet: 's-earth' } })
    const feet = feetOf(result)
    expect(feet?.spoolId).toBe('s-earth')
    expect(feet?.overridden).toBe(true)
    expect(result.warnings.find((w) => w.code === 'feet-material')).toBeUndefined()
  })

  it("the fallback follows a PINNED frame, not the snapper's original pick", () => {
    // "falls back to the frame's filament" is what the warning promises, so a
    // frame pin has to carry the feet with it.
    const roster = [...plaRoster(), spool('s-petg', 'Smoke PETG', '#8899aa', 'PETG')]
    const result = materialize(design, thh(roster), { overrides: { frame: 's-petg' } })
    expect(feetOf(result)?.spoolId).toBe('s-petg')
  })

  it('the plate-temperature exemption belongs to TPU, not to the feet ROW', () => {
    // A TPU foot on a PLA plate is the deliberate mix the feature is built on.
    const roster = [...plaRoster(), spool('s-tpu', 'Bambu TPU for AMS', '#101010', 'TPU')]
    expect(
      materialize(design, thh(roster)).warnings.find((w) => w.code === 'material-mix')
    ).toBeUndefined()
    // Pin those same feet to ABS and it is just an ordinary plate-temp split —
    // the picker offers it, so the guard has to still fire (gh#163).
    const abs = [...roster, spool('s-abs', 'Structural ABS', '#333333', 'ABS')]
    const pinned = materialize(design, thh(abs), { overrides: { feet: 's-abs' } })
    const w = pinned.warnings.find((x) => x.code === 'material-mix')
    expect(w).toBeDefined()
    expect(w?.roleKeys).toEqual(['feet'])
  })

  it('never reports feet as a color shift (family-picked; the distance is decorative)', () => {
    // near-white TPU vs the slate intrinsic: a huge redmean distance that would
    // fleck any user-colored role — feet must stay clean.
    const result = materialize(
      design,
      thh([...plaRoster(), spool('s-tpu', 'Generic TPU Natural', '#f8f8f8', 'TPU')])
    )
    const feet = feetOf(result)
    expect(feet?.distance).toBeGreaterThan(SHIFT_DISTANCE_THRESHOLD)
    expect(feet && roleShifted(feet)).toBe(false)
  })

  it('planToFilamentMap carries the feet slot iff the role exists', () => {
    const roster = [...plaRoster(), spool('s-tpu', 'Bambu TPU for AMS', '#101010', 'TPU')]
    const slots = roster.map((s) => s.hex)
    const printed = planToFilamentMap(materialize(design, thh(roster)), slots)
    expect(printed.feet).toBe(5)
    const off = planToFilamentMap(
      materialize(toAbacusDesign({ ...design.params, feet_mode: 'adhesive' }, ''), thh(roster)),
      slots
    )
    expect('feet' in off).toBe(false)
  })
})
