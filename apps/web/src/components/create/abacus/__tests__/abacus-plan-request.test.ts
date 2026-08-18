import type { FilamentPalettePair } from '@eink/print-dialog'
import { describe, expect, it } from 'vitest'
import type { FilamentCatalog, FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { COLOR_PALETTES, defaultParams, type Params } from '../abacus-model'
import {
  buildFilamentPlanRequest,
  designRoles,
  filamentPlanRequestKey,
} from '../abacus-plan-request'

// The design's filament INTENT, as a `filament-plan/v1` request (Gitea #37).
//
// This is where the intent the old quantizer expressed as loop order now lives —
// distinct-first, frame-last, marker-locked, feet-by-family — and it is the reason
// deleting that quantizer was not a loss of meaning. Each rule below used to be an
// emergent property of an algorithm, legible only by reading it; stated as a
// constraint, the same intent survives a planner that resolves it however it likes,
// and the planner reports which ones it had to relax.
//
// The line these tests hold: a CONSTRAINT is a fact about the design ("the two
// ArUco fields must not be the same filament"); a MATCH is a fact about the printer
// ("slot 0.2 is the closest PETG to #2E86AB"). Only the first belongs here, and
// nothing in this file asserts anything about which spool wins.

const paramsFor = (over: Partial<Params> = {}): Params => ({
  ...defaultParams,
  color_scheme: 'heaven-earth',
  color_palette: 'default',
  filament_count: 8,
  ...over,
})
const designFor = (over: Partial<Params> = {}) => toAbacusDesign(paramsFor(over), '')
const design = designFor()

/** Membership test over `different`, order-insensitive within the pair. */
const hasPair = (pairs: readonly FilamentPalettePair[] | undefined, a: string, b: string) =>
  (pairs ?? []).some(
    (p) =>
      (p.paletteIds[0] === a && p.paletteIds[1] === b) ||
      (p.paletteIds[0] === b && p.paletteIds[1] === a)
  )

const entry = (req: ReturnType<typeof buildFilamentPlanRequest>, id: string) =>
  req.palette.find((e) => e.id === id)

describe('designRoles', () => {
  it('mints markers, frame, one role per bead role, feet, then one per text group', () => {
    const keys = designRoles(design).map((r) => r.key)
    expect(keys.slice(0, 3)).toEqual(['marker-black', 'marker-white', 'frame'])
    expect(keys).toContain('bead-0')
    expect(keys).toContain('bead-1')
    // feet before text: the historical index order, which the FilamentMap
    // projection walks. Appending is safe; reordering is not.
    expect(keys.indexOf('feet')).toBeLessThan(keys.indexOf('text-0'))
    expect(keys.filter((k) => k.startsWith('text-'))).toEqual([
      'text-0',
      'text-1',
      'text-2',
      'text-3',
      'text-4',
    ])
  })

  it('mints roles from design INTENT, not from what a given render emits', () => {
    // Deliberately not gated on show_frame / show_markers: the plan answers "which
    // spool would this role use", and the 3MF re-checks visibility before consuming
    // a slot. A visibility-gated role here is inert (unlike an unreachable BEAD
    // role, which the trim below refuses to mint at all).
    const hidden = designFor({ show_frame: false, show_markers: false })
    const keys = designRoles(hidden).map((r) => r.key)
    expect(keys).toContain('frame')
    expect(keys).toContain('marker-black')
  })

  it('mints only the bead roles a column can actually resolve to', () => {
    // place-value maps column i to role (cols-1-i) % paletteLen, so a 3-column
    // design never touches roles 3/4 ('1k', '10k'). Those phantom entries used to
    // ride the palette anyway — joining every bead `different` pair and counting
    // against the planner's palette cap, a hard 400 for a distinction the design
    // never draws.
    const keys = designRoles(designFor({ color_scheme: 'place-value', cols: 3 })).map((r) => r.key)
    expect(keys.filter((k) => k.startsWith('bead-'))).toEqual(['bead-0', 'bead-1', 'bead-2'])

    // enough columns to reach the whole palette: nothing is trimmed
    const full = designRoles(designFor({ color_scheme: 'place-value', cols: 13 })).map((r) => r.key)
    expect(full.filter((k) => k.startsWith('bead-'))).toEqual([
      'bead-0',
      'bead-1',
      'bead-2',
      'bead-3',
      'bead-4',
    ])

    // alternating with ONE column never renders an odd column — role 1 is phantom
    const single = designRoles(designFor({ color_scheme: 'alternating', cols: 1 })).map(
      (r) => r.key
    )
    expect(single.filter((k) => k.startsWith('bead-'))).toEqual(['bead-0'])

    // heaven-earth indexes by bead TYPE, not column — both roles survive one column
    const he = designRoles(designFor({ color_scheme: 'heaven-earth', cols: 1 })).map((r) => r.key)
    expect(he.filter((k) => k.startsWith('bead-'))).toEqual(['bead-0', 'bead-1'])
  })

  it('constrains only the SURVIVING bead roles to differ', () => {
    // The trim's real payoff: no `different` pair may name a role that no bead can
    // resolve to — such a pair spends a distinct spool on a phantom.
    const req = buildFilamentPlanRequest(designFor({ color_scheme: 'place-value', cols: 3 }))
    const different = req.constraints?.different ?? []
    const beadPairs = different.filter((p) => p.paletteIds.some((id) => id.startsWith('bead-')))
    expect(beadPairs.length).toBe(3) // C(3,2) — not C(5,2)
    for (const p of beadPairs) {
      for (const id of p.paletteIds) expect(['bead-0', 'bead-1', 'bead-2']).toContain(id)
    }
  })

  it('omits feet unless they are printed, and text unless the inlay is inset', () => {
    for (const feet_mode of ['adhesive', 'none']) {
      expect(designRoles(designFor({ feet_mode })).some((r) => r.kind === 'feet')).toBe(false)
    }
    expect(designRoles(designFor({ text_mode: 'emboss' })).some((r) => r.kind === 'text')).toBe(
      false
    )
    expect(
      designRoles(designFor({ aid_10: 'off', aid_5: 'off' })).some((r) => r.kind === 'text')
    ).toBe(false)
  })

  it('carries the intrinsic (designed) hex, never a snapped one', () => {
    const roles = designRoles(design)
    expect(roles.find((r) => r.key === 'marker-black')?.intrinsicHex).toBe('#000000')
    expect(roles.find((r) => r.key === 'marker-white')?.intrinsicHex).toBe('#ffffff')
    expect(roles.find((r) => r.key === 'bead-0')?.intrinsicHex).toBe('#F18F01')
    expect(roles.filter((r) => r.kind === 'text').map((r) => r.intrinsicHex)).toEqual(
      COLOR_PALETTES.default
    )
  })
})

describe('buildFilamentPlanRequest — the palette', () => {
  const req = buildFilamentPlanRequest(design)

  it('declares one entry per role, keyed by the SAME string materialize joins on', () => {
    expect(req.schemaVersion).toBe(1)
    expect(req.palette.map((e) => e.id)).toEqual(designRoles(design).map((r) => r.key))
  })

  it('marks both ArUco fields contrast-critical — a near miss there is not a near miss', () => {
    for (const id of ['marker-black', 'marker-white']) {
      expect(entry(req, id)?.roleSignals).toEqual(['contrast-critical', 'model'])
    }
  })

  it('asks for a FLEXIBLE material for the feet, as an identity rather than a name', () => {
    // Replaces the old `/tpu\s*for\s*ams/i` match on a product string. Bambu's
    // AMS-safe Shore-68D reports the wire family "TPU-AMS" and the service's
    // selector match is strict string equality, so the variant is named
    // explicitly alongside the generic family — otherwise the preference never
    // fires against a Bambu roster and the feet silently print rigid.
    expect(entry(req, 'feet')?.preferred).toEqual([{ family: 'TPU' }, { family: 'TPU-AMS' }])
    // preferred, not required — rigid feet still print, and the studio warns.
    expect(entry(req, 'feet')?.required).toBeUndefined()
  })

  it('marks inlay text decorative and everything structural as model', () => {
    expect(entry(req, 'text-0')?.roleSignals).toEqual(['decorative'])
    expect(entry(req, 'frame')?.roleSignals).toEqual(['model'])
    expect(entry(req, 'bead-0')?.roleSignals).toEqual(['model'])
  })
})

describe('buildFilamentPlanRequest — the constraints', () => {
  const req = buildFilamentPlanRequest(design)
  const different = req.constraints?.different

  it('the ArUco fields must differ, or the marker is not a marker', () => {
    expect(hasPair(different, 'marker-black', 'marker-white')).toBe(true)
  })

  it('bead roles are distinct-first — a scheme exists to be told apart', () => {
    const pv = designFor({ color_scheme: 'place-value' }) // 5 bead roles
    const pairs = buildFilamentPlanRequest(pv).constraints?.different
    for (let i = 0; i < 5; i += 1) {
      for (let j = i + 1; j < 5; j += 1) {
        expect(hasPair(pairs, `bead-${i}`, `bead-${j}`)).toBe(true)
      }
    }
  })

  it('text must not print in the frame filament — a flush plug VANISHES, it does not near-miss', () => {
    // The one role where the nearest color is the wrong answer, which no
    // color-distance planner would infer on its own.
    for (let g = 0; g < 5; g += 1) expect(hasPair(different, `text-${g}`, 'frame')).toBe(true)
  })

  it('text groups are distinct-first too — the original rainbow bug', () => {
    // Five groups each independently taking their nearest spool was the reported
    // failure: four landed on one ink while two contrasting spools sat unused.
    for (let i = 0; i < 5; i += 1) {
      for (let j = i + 1; j < 5; j += 1) expect(hasPair(different, `text-${i}`, `text-${j}`)).toBe(true)
    }
  })

  it('beads are NOT required to differ from the frame — only text is', () => {
    // A bead that matches the frame is a design choice; text that matches it is
    // invisible writing. Over-constraining would make the planner shed real pairs.
    expect(hasPair(different, 'bead-0', 'frame')).toBe(false)
  })

  it('omits `constraints` entirely when the design has nothing to constrain', () => {
    // monochrome, no inlay: one bead role, so no distinct pair beyond the markers.
    const bare = buildFilamentPlanRequest(designFor({ color_scheme: 'monochrome', text_mode: 'emboss' }))
    expect(bare.constraints?.different?.length).toBe(1)
    expect(bare.interfaces?.every((i) => !i.paletteIds.includes('text-0'))).toBe(true)
  })
})

describe('buildFilamentPlanRequest — the welded interfaces', () => {
  const req = buildFilamentPlanRequest(design)

  it('declares frame↔markers and frame↔text as bonded joints', () => {
    // The inlay is welded into the frame and the ArUco fields print into the same
    // body, so their materials have to BOND — a compatibility question about two
    // specific filaments, which is exactly what an interface declares.
    const ids = (req.interfaces ?? []).map((i) => [...i.paletteIds].sort().join('|'))
    expect(ids).toContain(['frame', 'marker-black'].sort().join('|'))
    expect(ids).toContain(['frame', 'marker-white'].sort().join('|'))
    expect(ids).toContain(['frame', 'text-0'].sort().join('|'))
    expect(req.interfaces?.every((i) => i.kind === 'bonded')).toBe(true)
  })

  it('names the frame as the substrate of every bond — weld is the ONLY retention', () => {
    // Inset text and marker fields have no mechanical lock: the weld alone holds
    // them in the frame. `substrate` turns each bond from advisory into a hard
    // constraint (things-haunt-house#448) so an unweldable spool (TPU into a PLA
    // pocket) comes back unresolved instead of placed as a plug that falls out.
    expect(req.interfaces?.length).toBeGreaterThan(0)
    for (const i of req.interfaces ?? []) {
      expect((i as { substrate?: string }).substrate).toBe('frame')
    }
  })

  it('declares NO bead interface — beads are captive on a clearance gap, never welded', () => {
    expect(
      (req.interfaces ?? []).some((i) => i.paletteIds.some((id) => id.startsWith('bead-')))
    ).toBe(false)
  })

  it('declares no feet interface either — the crossbar retains them mechanically', () => {
    expect((req.interfaces ?? []).some((i) => i.paletteIds.includes('feet'))).toBe(false)
  })
})

describe('buildFilamentPlanRequest — pins travel as `required` identities', () => {
  const spool = (over: Partial<FilamentSpool> & { id: string }): FilamentSpool => ({
    name: over.id,
    hex: '#101010',
    material: 'PLA',
    ...over,
  })
  const catalog = (spools: FilamentSpool[]): FilamentCatalog => ({ source: 'thh-ams', spools })

  it('pins by profileKey when the service reports one — a slot is a position, not a filament', () => {
    // Pin by what the spool IS and the plan survives someone moving it to another
    // slot; pin by where it sits and the plan silently means a different filament
    // the moment the AMS is rearranged.
    const cat = catalog([spool({ id: '0.2', profileKey: 'GFL99', brand: 'Bambu', product: 'Basic' })])
    const req = buildFilamentPlanRequest(design, { catalog: cat, overrides: { frame: '0.2' } })
    expect(entry(req, 'frame')?.required).toEqual({ profileKey: 'GFL99' })
  })

  it('falls back to brand/product/family when there is no profileKey', () => {
    const cat = catalog([spool({ id: '0.2', brand: 'Bambu', product: 'PLA Basic', material: 'PLA' })])
    const req = buildFilamentPlanRequest(design, { catalog: cat, overrides: { frame: '0.2' } })
    expect(entry(req, 'frame')?.required).toEqual({
      family: 'PLA',
      brand: 'Bambu',
      product: 'PLA Basic',
    })
  })

  it('sends no `required` at all when the spool carries no identity to express', () => {
    // Better an unconstrained role than a selector that matches everything.
    const cat = catalog([{ id: '0.2', name: 'Slot 2', hex: '#101010', material: '' }])
    const req = buildFilamentPlanRequest(design, { catalog: cat, overrides: { frame: '0.2' } })
    expect(entry(req, 'frame')?.required).toBeUndefined()
  })

  it('ignores a pin naming a spool the catalog does not hold', () => {
    const cat = catalog([spool({ id: '0.2', profileKey: 'GFL99' })])
    const req = buildFilamentPlanRequest(design, { catalog: cat, overrides: { frame: 'gone' } })
    expect(entry(req, 'frame')?.required).toBeUndefined()
  })

  it('leaves every unpinned role unconstrained', () => {
    const cat = catalog([spool({ id: '0.2', profileKey: 'GFL99' })])
    const req = buildFilamentPlanRequest(design, { catalog: cat, overrides: { frame: '0.2' } })
    expect(req.palette.filter((e) => e.required !== undefined).map((e) => e.id)).toEqual(['frame'])
  })

  it('a pin does not disturb the role signals or the feet preference it rides with', () => {
    const cat = catalog([spool({ id: '0.2', profileKey: 'GFL99' })])
    const req = buildFilamentPlanRequest(design, { catalog: cat, overrides: { feet: '0.2' } })
    expect(entry(req, 'feet')?.required).toEqual({ profileKey: 'GFL99' })
    expect(entry(req, 'feet')?.preferred).toEqual([{ family: 'TPU' }, { family: 'TPU-AMS' }])
    expect(entry(req, 'feet')?.roleSignals).toEqual(['model'])
  })
})

describe('filamentPlanRequestKey — the cache identity', () => {
  it('is stable for the same design', () => {
    expect(filamentPlanRequestKey(buildFilamentPlanRequest(design))).toBe(
      filamentPlanRequestKey(buildFilamentPlanRequest(designFor()))
    )
  })

  it('changes when the design changes', () => {
    const a = filamentPlanRequestKey(buildFilamentPlanRequest(design))
    const b = filamentPlanRequestKey(buildFilamentPlanRequest(designFor({ frame_color: '#123456' })))
    expect(a).not.toBe(b)
  })

  it('changes when a pin changes — the pin is part of the question', () => {
    const cat: FilamentCatalog = {
      source: 'thh-ams',
      spools: [{ id: '0.2', name: 'Slot 2', hex: '#101010', material: 'PLA', profileKey: 'GFL99' }],
    }
    const unpinned = filamentPlanRequestKey(buildFilamentPlanRequest(design, { catalog: cat }))
    const pinned = filamentPlanRequestKey(
      buildFilamentPlanRequest(design, { catalog: cat, overrides: { frame: '0.2' } })
    )
    expect(unpinned).not.toBe(pinned)
  })

  it('is IDENTICAL with no pins, so the pinned and unpinned queries share one fetch', () => {
    // The studio asks two questions — "with my pins" and "what would you pick" —
    // and with nothing pinned they are the same question. Equal keys are what make
    // the second query free rather than a duplicate round trip.
    const cat: FilamentCatalog = {
      source: 'thh-ams',
      spools: [{ id: '0.2', name: 'Slot 2', hex: '#101010', material: 'PLA', profileKey: 'GFL99' }],
    }
    expect(filamentPlanRequestKey(buildFilamentPlanRequest(design, { catalog: cat, overrides: {} }))).toBe(
      filamentPlanRequestKey(buildFilamentPlanRequest(design, { catalog: cat }))
    )
  })

  it('is order-stable inside a pair, so an equal design never re-fetches', () => {
    const pairs = buildFilamentPlanRequest(design).constraints?.different ?? []
    for (const pair of pairs) expect(pair.paletteIds[0] <= pair.paletteIds[1]).toBe(true)
  })
})
