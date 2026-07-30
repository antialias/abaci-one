import { describe, expect, it } from 'vitest'
import { catalogFromParams, type FilamentCatalog, type FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import {
  beadRoleColors,
  COLOR_PALETTES,
  defaultParams,
  type Params,
  textSlots,
  tokGroup,
} from '../abacus-model'
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
// text_mode / text_fill / text_color and what's written on the eight slots;
// that axis is covered by its own describe below rather than by widening this
// matrix 5×.
const SCHEMES = ['monochrome', 'heaven-earth', 'alternating', 'place-value']
const PALETTES = ['default', 'colorblind', 'grayscale']
const COUNTS = [8, 3, 1]
// Keys the frozen fixture pins byte-for-byte. `textRoles` is the one key allowed
// to appear beyond them — see the assertion below for why the fixture stayed
// untouched rather than being regenerated.
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
  //
  // toMatchObject, not toEqual, since inset text gained a role: every frozen key
  // must still match exactly (toMatchObject compares arrays by length AND
  // element, so beadRoles/slots keep their byte-parity guarantee) while the new
  // `textRoles` key is allowed through. The fixture itself is deliberately NOT
  // regenerated — transcribing 180 freshly-generated numbers into a "frozen"
  // file would just rubber-stamp whatever the code now does, which is the
  // opposite of what a characterization fixture is for. The key-set guard below
  // stops anything ELSE sneaking in unnoticed.
  for (const color_scheme of SCHEMES) {
    for (const color_palette of PALETTES) {
      for (const filament_count of COUNTS) {
        const key = `${color_scheme}|${color_palette}|${filament_count}`
        it(key, () => {
          const got = computeFilamentMap(paramsFor(color_scheme, color_palette, filament_count))
          expect(got).toMatchObject(
            (snapshot as Record<string, Record<string, unknown>>)[key] as object
          )
          expect(Object.keys(got).sort()).toEqual([...FROZEN_KEYS, 'textRoles'].sort())
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

describe('materialize — inset text inlay roles', () => {
  const { design, heavenHex, earthHex, spool, thh } = materialFixtures()
  const plaRoster = () => [
    spool('s-black', 'Matte Black', '#000000', 'PLA'),
    spool('s-white', 'Matte White', '#ffffff', 'PLA'),
    spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
    spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
    spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
  ]
  const textOf = (r: ReturnType<typeof materialize>) =>
    r.assignments.filter((a) => a.role.kind === 'text')
  // the defaults write friends-of-10 (5 tokens) on the top rail and friends-of-5
  // (4) on the bottom, so rainbow text spans all five palette inks.
  const withText = (over: Partial<Params> = {}) => toAbacusDesign({ ...design.params, ...over }, '')

  it('mints one role per color group — this is what gives the plugs a slot to print in', () => {
    const roles = textOf(materialize(withText(), thh(plaRoster())))
    expect(roles.map((a) => a.role.key)).toEqual(['text-0', 'text-1', 'text-2', 'text-3', 'text-4'])
    // the intrinsic hex is the palette ink the scad would color that token
    expect(roles.map((a) => a.role.intrinsicHex)).toEqual(COLOR_PALETTES.default)
    // labels name the writing the row controls, not an opaque index
    expect(roles[0]?.role.label).toBe('1+9 1+4')
  })

  it('single fill is exactly one role, labelled for the whole inlay', () => {
    const roles = textOf(
      materialize(withText({ text_fill: 'single', text_color: '#00ff88' }), thh(plaRoster()))
    )
    expect(roles).toHaveLength(1)
    expect(roles[0]?.role.key).toBe('text-0')
    expect(roles[0]?.role.intrinsicHex).toBe('#00ff88')
    expect(roles[0]?.role.label).toBe('Inlay text')
  })

  it('mints nothing when there is no inlay to ink (emboss mode, or no writing)', () => {
    expect(textOf(materialize(withText({ text_mode: 'emboss' }), thh(plaRoster())))).toHaveLength(0)
    const blank = withText({ aid_10: 'off', aid_5: 'off' })
    expect(textOf(materialize(blank, thh(plaRoster())))).toHaveLength(0)
  })

  it('stays inside the anchor group — the inlay is welded into the frame', () => {
    // the palette's reds/greens have exact matches on PETG, which a color-blind
    // pick would take; the weld rule says the ink must print in the frame's family.
    const roster = [
      ...plaRoster(),
      ...COLOR_PALETTES.default.map((hex, i) => spool(`s-petg-${i}`, `PETG ${i}`, hex, 'PETG')),
    ]
    const result = materialize(withText(), thh(roster))
    expect(result.anchorGroup).toBe('PLA')
    for (const a of textOf(result)) expect(a.spoolId.startsWith('s-petg')).toBe(false)
    // and the weld warning stays silent precisely because of that
    expect(result.warnings.find((w) => w.code === 'material-interface')).toBeUndefined()
  })

  it('does NOT move the structural mapping — text is assigned after the anchor pass', () => {
    // The regression this whole ordering exists for: text must not vote in
    // snapWithin's distinct-first loop or its cost, or every existing design's
    // beads would shift. Three spools = real contention.
    const tight = [
      spool('s-black', 'Matte Black', '#000000', 'PLA'),
      spool('s-white', 'Matte White', '#ffffff', 'PLA'),
      spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
    ]
    const structural = (r: ReturnType<typeof materialize>) =>
      r.assignments.filter((a) => a.role.kind !== 'text').map((a) => [a.role.key, a.spoolId])
    const withInk = materialize(withText(), thh(tight))
    const noInk = materialize(withText({ text_mode: 'emboss' }), thh(tight))
    expect(structural(withInk)).toEqual(structural(noInk))
    expect(textOf(withInk).length).toBeGreaterThan(0)
  })

  it('shares a spool freely rather than being forced distinct (ink is not a bead)', () => {
    // one spool: every group collapses onto it, and nothing throws or goes
    // undefined. Distinct-first would have had nowhere to go.
    const one = [spool('s-only', 'Solo PLA', '#cccccc', 'PLA')]
    const roles = textOf(materialize(withText(), thh(one)))
    expect(roles).toHaveLength(5)
    for (const a of roles) expect(a.spoolId).toBe('s-only')
  })

  it('honors a per-group pin', () => {
    const roster = [...plaRoster(), spool('s-pink', 'Hot Pink', '#ff69b4', 'PLA')]
    const result = materialize(withText(), thh(roster), { overrides: { 'text-2': 's-pink' } })
    const roles = textOf(result)
    expect(roles[2]?.spoolId).toBe('s-pink')
    expect(roles[2]?.overridden).toBe(true)
    expect(roles.filter((a) => a.overridden)).toHaveLength(1)
  })

  it('planToFilamentMap carries textRoles iff the roles exist, dense over the groups', () => {
    const roster = plaRoster()
    const slots = roster.map((s) => s.hex)
    const map = planToFilamentMap(materialize(withText(), thh(roster)), slots)
    expect(map.textRoles).toHaveLength(5)
    for (const idx of map.textRoles ?? []) {
      expect(Number.isInteger(idx)).toBe(true)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(slots.length)
    }
    const off = planToFilamentMap(
      materialize(withText({ text_mode: 'emboss' }), thh(roster)),
      slots
    )
    expect('textRoles' in off).toBe(false)
  })

  it('a text group on its own spool still counts as a plate material (pins can split it)', () => {
    // The narrow rule: text that merely shares a structural spool doesn't vote in
    // the temperature majority, but text pinned somewhere nothing else prints
    // genuinely introduces a material and must still be reported.
    const roster = [...plaRoster(), spool('s-abs', 'Structural ABS', '#333333', 'ABS')]
    const result = materialize(withText(), thh(roster), { overrides: { 'text-1': 's-abs' } })
    const w = result.warnings.find((x) => x.code === 'material-mix')
    expect(w).toBeDefined()
    expect(w?.roleKeys).toEqual(['text-1'])
    // ...and the weld rule sees it too: the inlay is fused into the frame
    const weld = result.warnings.find((x) => x.code === 'material-interface')
    expect(weld?.roleKeys).toEqual(['text-1'])
    expect(weld?.message).toContain('the inset text')
  })
})

describe('materialize — inset text reductions are warnings, never gates', () => {
  const { design, heavenHex, earthHex, spool, thh } = materialFixtures()
  const withText = (over: Partial<Params> = {}) => toAbacusDesign({ ...design.params, ...over }, '')
  const plaRoster = () => [
    spool('s-black', 'Matte Black', '#000000', 'PLA'),
    spool('s-white', 'Matte White', '#ffffff', 'PLA'),
    spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
    spool('s-heaven', 'Heaven Orange', heavenHex, 'PLA'),
    spool('s-earth', 'Earth Blue', earthHex, 'PLA'),
  ]
  const find = (r: ReturnType<typeof materialize>, code: string) =>
    r.warnings.find((w) => w.code === code)

  it('rainbow-unrealizable fires when the loaded spools cannot serve five inks', () => {
    // two spools, five groups: at least three tokens print somebody else's color.
    const thin = [
      spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
      spool('s-black', 'Matte Black', '#000000', 'PLA'),
    ]
    const result = materialize(withText(), thh(thin))
    const w = find(result, 'rainbow-unrealizable')
    expect(w).toBeDefined()
    expect(w?.severity).toBe('warning')
    // concrete prose: how many were asked for, how many actually serve them
    expect(w?.message).toContain('5 ink colors')
    expect(w?.message).toMatch(/only [12] distinct/)
    expect(w?.roleKeys).toEqual(['text-0', 'text-1', 'text-2', 'text-3', 'text-4'])
  })

  it('stays silent when every group lands on its own filament', () => {
    // exact palette matches for all five groups (two already exist as bead spools)
    const roster = [
      ...plaRoster(),
      ...COLOR_PALETTES.default.map((hex, i) => spool(`s-pal-${i}`, `Ink ${i}`, hex, 'PLA')),
    ]
    const result = materialize(withText(), thh(roster))
    const text = result.assignments.filter((a) => a.role.kind === 'text')
    expect(new Set(text.map((a) => a.spoolIndex)).size).toBe(5)
    expect(find(result, 'rainbow-unrealizable')).toBeUndefined()
  })

  it('single fill never trips the rainbow warning — one group cannot collapse', () => {
    const result = materialize(
      withText({ text_fill: 'single', text_color: '#00ff88' }),
      thh([spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA')])
    )
    expect(find(result, 'rainbow-unrealizable')).toBeUndefined()
  })

  it('spreads the rainbow over every spool that is not the frame', () => {
    // The bug as reported: four PLA spools loaded, three of them not the frame
    // color, and the friends-of facts printed in TWO colors — the first one blue
    // and every other one identical. Independent nearest-match sent four of the
    // five groups to the same spool while two contrasting ones sat unused.
    const roster = [
      spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
      spool('s-wood', 'PLA Wood', '#b5651d', 'PLA'),
      spool('s-walnut', 'PLA Walnut', '#3b2a22', 'PLA'),
      spool('s-blue', 'PLA Matte Blue', '#2e86ab', 'PLA'),
    ]
    const result = materialize(withText(), thh(roster))
    const text = result.assignments.filter((a) => a.role.kind === 'text')
    const frameIdx = result.assignments.find((a) => a.role.kind === 'frame')?.spoolIndex
    expect(text).toHaveLength(5)
    // all three usable spools get work — 3 distinct inks, not 2
    expect(new Set(text.map((a) => a.spoolIndex)).size).toBe(3)
    // ...and not one group vanishes into the frame to get there
    expect(text.some((a) => a.spoolIndex === frameIdx)).toBe(false)
    expect(find(result, 'text-invisible')).toBeUndefined()
    // still honest about the shortfall it cannot fix: 5 groups, 3 usable spools
    expect(find(result, 'rainbow-unrealizable')?.message).toContain('only 3 distinct')
  })

  // Every pair of tokens that TOUCH on the plate, as spool indices. Walks the
  // real layout (slot by slot, k by k) rather than assuming which groups abut,
  // so it stays honest if the wrap or the slot list ever changes.
  const touchingPairs = (r: ReturnType<typeof materialize>, p: Params): [string, string][] => {
    const ink = new Map(
      r.assignments.filter((a) => a.role.kind === 'text').map((a) => [a.role.key, a.spoolIndex])
    )
    const clashes: [string, string][] = []
    for (const toks of textSlots(p)) {
      for (let k = 1; k < toks.length; k++) {
        const a = ink.get(`text-${tokGroup(p, k - 1)}`)
        const b = ink.get(`text-${tokGroup(p, k)}`)
        if (a !== undefined && a === b) clashes.push([toks[k - 1][0], toks[k][0]])
      }
    }
    return clashes
  }

  it('never inks two touching words the same, even when it has to share', () => {
    // The reported bug, from the screenshot: four spools, three of them usable,
    // and the top rail came out blue/brown/dark/brown/BROWN — "4+6 5+5" ran
    // together into one blob. Sharing is unavoidable at 5 groups over 3 spools;
    // sharing with your NEIGHBOUR is not (A B C A B exists, and A B C B C does).
    const roster = [
      spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
      spool('s-wood', 'PLA Wood', '#a9713b', 'PLA'),
      spool('s-walnut', 'PLA Walnut', '#3b2a20', 'PLA'),
      spool('s-blue', 'PLA Matte Blue', '#2e5fa3', 'PLA'),
    ]
    const p = { ...design.params }
    const result = materialize(withText(), thh(roster))
    expect(touchingPairs(result, p)).toEqual([])
    // and it did NOT buy that by spending a fourth ink it doesn't have, nor by
    // letting a group vanish into the frame
    const text = result.assignments.filter((a) => a.role.kind === 'text')
    expect(new Set(text.map((a) => a.spoolIndex)).size).toBe(3)
    const frameIdx = result.assignments.find((a) => a.role.kind === 'frame')?.spoolIndex
    expect(text.some((a) => a.spoolIndex === frameIdx)).toBe(false)
  })

  it('separates neighbours down to two usable spools, and reports honestly below that', () => {
    // three spools, two usable: 5 groups alternate A B A B A — still no clash,
    // because the default rails are 5 and 4 tokens long (paths, not cycles).
    const two = [
      spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
      spool('s-black', 'Matte Black', '#000000', 'PLA'),
      spool('s-blue', 'PLA Matte Blue', '#2e5fa3', 'PLA'),
    ]
    const p = { ...design.params }
    expect(touchingPairs(materialize(withText(), thh(two)), p)).toEqual([])

    // one usable spool: adjacency is unsatisfiable. Readable-but-merged beats
    // vanishing into the frame, so it shares and rainbow-unrealizable says so.
    const one = [
      spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA'),
      spool('s-black', 'Matte Black', '#000000', 'PLA'),
    ]
    const scraped = materialize(withText(), thh(one))
    expect(touchingPairs(scraped, p).length).toBeGreaterThan(0)
    expect(find(scraped, 'rainbow-unrealizable')).toBeDefined()
  })

  it("auto steers the inlay OFF the frame's filament even when the ink asks for it", () => {
    // The nearest color is the one answer that must lose here. A plug fills its
    // pocket flush and level, so frame-colored text doesn't print a near-miss —
    // it vanishes. Auto holds the frame's spool back until nothing else is left,
    // which turns text-invisible into a report on PINS (covered below) and on a
    // roster whose only candidate is the frame (covered by plan.ok, last test).
    const result = materialize(
      withText({ text_fill: 'single', text_color: defaultParams.frame_color }),
      thh(plaRoster())
    )
    const text = result.assignments.filter((a) => a.role.kind === 'text')
    const frameIdx = result.assignments.find((a) => a.role.kind === 'frame')?.spoolIndex
    expect(text).toHaveLength(1)
    expect(text[0].spoolIndex).not.toBe(frameIdx)
    expect(find(result, 'text-invisible')).toBeUndefined()
  })

  it('names only the groups that vanished when some inks still read', () => {
    const roster = [
      ...plaRoster(),
      ...COLOR_PALETTES.default.map((hex, i) => spool(`s-pal-${i}`, `Ink ${i}`, hex, 'PLA')),
    ]
    const result = materialize(withText(), thh(roster), { overrides: { 'text-2': 's-frame' } })
    const w = find(result, 'text-invisible')
    expect(w?.roleKeys).toEqual(['text-2'])
    expect(w?.message).toContain('1 of the inlay text colors print')
  })

  it('stays silent when the inlay contrasts with the frame', () => {
    const roster = [
      ...plaRoster(),
      ...COLOR_PALETTES.default.map((hex, i) => spool(`s-pal-${i}`, `Ink ${i}`, hex, 'PLA')),
    ]
    expect(find(materialize(withText(), thh(roster)), 'text-invisible')).toBeUndefined()
  })

  it('neither reduction blocks the export — plan.ok stays true', () => {
    // The house rule this file states three times: warn, never gate. Rainbow is
    // the DEFAULT text fill, so an error here would ship a studio whose default
    // design refuses to print.
    const worst = materialize(
      withText(),
      thh([spool('s-frame', 'Oak', defaultParams.frame_color, 'PLA')])
    )
    expect(find(worst, 'rainbow-unrealizable')).toBeDefined()
    expect(find(worst, 'text-invisible')).toBeDefined()
    expect(worst.warnings.every((w) => w.severity !== 'error')).toBe(true)
    expect(worst.ok).toBe(true)
  })
})
