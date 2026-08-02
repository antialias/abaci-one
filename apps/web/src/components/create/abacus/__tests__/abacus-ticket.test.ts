/**
 * v2 ticket builder tests (#9, #19, #23): filaments mirror the 3MF's extruder
 * assignment (one spool per distinct body SLOT, body order — never collapsed by
 * colour); an AMS spool rides as its THH slotId, a no-AMS external spool as
 * {external, family}; style passes through verbatim; and non-submittable states
 * (incl. >1 external) fail loud.
 */
import { describe, expect, it } from 'vitest'
import type { SpoolBodySummary } from '../abacus-3mf'
import type { FilamentCatalog } from '../abacus-catalog'
import { buildAbacusAuthoring, buildAbacusTicket } from '../abacus-ticket'

const catalog: FilamentCatalog = {
  source: 'thh-ams',
  fetchedAt: '2026-07-20T00:00:00Z',
  spools: [
    { id: '0.1', name: 'Latte PLA', hex: '#C9A26E', material: 'PLA' },
    { id: '0.2', name: 'Snow PLA', hex: '#F5F5F5', material: 'PLA' },
    { id: '0.3', name: 'Ink PLA', hex: '#111111', material: 'PLA' },
    { id: '0.4', name: 'Ocean PLA', hex: '#2E86AB', material: 'PLA' },
  ],
}

const bodies: SpoolBodySummary[] = [
  { slot: 0, label: 'Latte PLA', colorHex: '#C9A26E', triangleCount: 5000 },
  { slot: 1, label: 'Snow PLA', colorHex: '#F5F5F5', triangleCount: 800 },
  { slot: 3, label: 'Ocean PLA', colorHex: '#2E86AB', triangleCount: 800 },
]

const base = {
  name: 'Abacus — 13 columns',
  source: {
    artifactId: 'design-abc123',
    artifactUrl: 'https://abaci.one/create/abacus',
    label: '13-column abacus',
  },
  bodies,
  catalog,
  style: { basePreset: '0.20mm-standard', process: { wall_loops: 3 } },
  startPolicy: 'hold' as const,
  idempotencyKey: 'idem-1',
}

describe('buildAbacusTicket', () => {
  it('lists one spool per body in extruder order, with AMS slot ids', () => {
    const ticket = buildAbacusTicket(base)
    expect(ticket.filaments).toEqual([{ slotId: '0.1' }, { slotId: '0.2' }, { slotId: '0.4' }])
  })

  it('stamps the source app and passes provenance, style, start, and key verbatim', () => {
    const ticket = buildAbacusTicket(base)
    expect(ticket.source).toEqual({ ...base.source, app: 'abacus-studio' })
    expect(ticket.style).toBe(base.style) // untouched reference — no injection
    expect(ticket.start).toEqual({ policy: 'hold' })
    expect(ticket.idempotencyKey).toBe('idem-1')
    expect(ticket.name).toBe('Abacus — 13 columns')
  })

  it('carries the bounded wipe-tower profile and pin without touching style', () => {
    const wipeTower = {
      profile: 'orca-rectangle-60-v1',
      pinMm: { x: 177.25, y: 102 },
    }
    const ticket = buildAbacusTicket({ ...base, wipeTower })
    expect(ticket.wipeTower).toBe(wipeTower)
    expect(ticket.style).toBe(base.style)
    expect(buildAbacusTicket({ ...base, wipeTower: null })).not.toHaveProperty('wipeTower')
  })

  it('keeps same-colour bodies on DIFFERENT slots as separate spools (slot = extruder)', () => {
    // The 3MF assembly assigns extruders per slot, never per colour: two
    // same-hex slots are two extruders and must be two ticket entries, or
    // THH's extruder→spool alignment shifts by one. (This replaced the old
    // colour-collapse behavior — a latent bug the printed-feet default made
    // real: black TPU feet next to a black PLA frame.)
    const twoWhites: SpoolBodySummary[] = [
      { slot: 1, label: 'Snow PLA', colorHex: '#F5F5F5', triangleCount: 10 },
      { slot: 2, label: 'Also white', colorHex: '#f5f5f5', triangleCount: 10 },
    ]
    const ticket = buildAbacusTicket({ ...base, bodies: twoWhites })
    expect(ticket.filaments).toEqual([{ slotId: '0.2' }, { slotId: '0.3' }])
  })

  it('black TPU feet next to a black PLA frame emit two filament entries (Gitea #23)', () => {
    const blackOnBlack: FilamentCatalog = {
      source: 'thh-ams',
      fetchedAt: '2026-07-20T00:00:00Z',
      spools: [
        { id: '0.1', name: 'Ink PLA', hex: '#111111', material: 'PLA' },
        { id: '0.2', name: 'Bambu TPU for AMS Black', hex: '#111111', material: 'TPU' },
      ],
    }
    const blackBodies: SpoolBodySummary[] = [
      { slot: 0, label: 'Ink PLA', colorHex: '#111111', triangleCount: 5000 },
      { slot: 1, label: 'Bambu TPU for AMS Black', colorHex: '#111111', triangleCount: 300 },
    ]
    const ticket = buildAbacusTicket({ ...base, catalog: blackOnBlack, bodies: blackBodies })
    expect(ticket.filaments).toEqual([{ slotId: '0.1' }, { slotId: '0.2' }])
  })

  it('refuses the params stand-in catalog', () => {
    const manual: FilamentCatalog = { source: 'manual-params', spools: catalog.spools }
    expect(() => buildAbacusTicket({ ...base, catalog: manual })).toThrow(/AMS filament roster/)
  })

  it('refuses an empty body list', () => {
    expect(() => buildAbacusTicket({ ...base, bodies: [] })).toThrow(/no bodies/)
  })

  it('refuses a body whose slot is outside the catalog', () => {
    const stray: SpoolBodySummary[] = [
      { slot: 9, label: 'Ghost', colorHex: '#FF00FF', triangleCount: 1 },
    ]
    expect(() => buildAbacusTicket({ ...base, bodies: stray })).toThrow(/slot 9/)
  })

  it('rides a no-AMS external spool as {external, family} instead of a slotId', () => {
    const externalCatalog: FilamentCatalog = {
      source: 'thh-ams',
      fetchedAt: '2026-07-20T00:00:00Z',
      spools: [
        { id: 'external-0', name: 'Sunlu PLA+', hex: '#1A7A3E', material: 'PLA', external: true },
      ],
    }
    const externalBodies: SpoolBodySummary[] = [
      { slot: 0, label: 'Sunlu PLA+', colorHex: '#1A7A3E', triangleCount: 5000 },
    ]
    const ticket = buildAbacusTicket({ ...base, catalog: externalCatalog, bodies: externalBodies })
    expect(ticket.filaments).toEqual([{ external: true, family: 'PLA' }])
  })

  it('emits both filament shapes for a mixed roster (an AMS slot + one external)', () => {
    const mixed: FilamentCatalog = {
      source: 'thh-ams',
      fetchedAt: '2026-07-20T00:00:00Z',
      spools: [
        { id: '0.1', name: 'Latte PLA', hex: '#C9A26E', material: 'PLA' },
        { id: 'external-1', name: 'Sunlu Red', hex: '#C0392B', material: 'PLA', external: true },
      ],
    }
    const mixedBodies: SpoolBodySummary[] = [
      { slot: 0, label: 'latte', colorHex: '#C9A26E', triangleCount: 10 },
      { slot: 1, label: 'red', colorHex: '#C0392B', triangleCount: 10 },
    ]
    const ticket = buildAbacusTicket({ ...base, catalog: mixed, bodies: mixedBodies })
    expect(ticket.filaments).toEqual([{ slotId: '0.1' }, { external: true, family: 'PLA' }])
  })

  it('rides the authoring hand-off verbatim when given, omits the key when absent', () => {
    const authoring = {
      editUrl: 'https://abaci.one/create/abacus?player=p1',
      editTool: 'Abacus Studio',
    }
    expect(buildAbacusTicket({ ...base, authoring }).authoring).toEqual(authoring)
    expect(buildAbacusTicket(base)).not.toHaveProperty('authoring')
    expect(buildAbacusTicket({ ...base, authoring: null })).not.toHaveProperty('authoring')
  })

  describe('support-interface role (Gitea #23, THH#367)', () => {
    // A roster with a dedicated interface spool (PLA-S) alongside the model spools.
    const supportCatalog: FilamentCatalog = {
      source: 'thh-ams',
      fetchedAt: '2026-07-20T00:00:00Z',
      spools: [
        { id: '0.1', name: 'Latte PLA', hex: '#C9A26E', material: 'PLA' },
        { id: '0.2', name: 'Snow PLA', hex: '#F5F5F5', material: 'PLA' },
        {
          id: '0.3',
          name: 'Bambu Support for PLA',
          hex: '#FFFFFF',
          material: 'PLA-S',
          supportKind: 'interface',
        },
      ],
    }
    const supportBodies: SpoolBodySummary[] = [
      { slot: 0, label: 'Latte PLA', colorHex: '#C9A26E', triangleCount: 5000 },
      { slot: 1, label: 'Snow PLA', colorHex: '#F5F5F5', triangleCount: 800 },
    ]

    it('appends {slotId, role} as the LAST entry, after every model spool', () => {
      // THH computes support_interface_filament from entry ORDER — the role
      // entry must trail the model entries, which stay in body/extruder order.
      const ticket = buildAbacusTicket({
        ...base,
        catalog: supportCatalog,
        bodies: supportBodies,
        supportInterfaceSlotId: '0.3',
      })
      expect(ticket.filaments).toEqual([
        { slotId: '0.1' },
        { slotId: '0.2' },
        { slotId: '0.3', role: 'support-interface' },
      ])
    })

    it('null and absent both mean "interface prints in the model material" — no role entry', () => {
      const withNull = buildAbacusTicket({
        ...base,
        catalog: supportCatalog,
        bodies: supportBodies,
        supportInterfaceSlotId: null,
      })
      const withAbsent = buildAbacusTicket({
        ...base,
        catalog: supportCatalog,
        bodies: supportBodies,
      })
      expect(withNull.filaments).toEqual([{ slotId: '0.1' }, { slotId: '0.2' }])
      expect(withAbsent.filaments).toEqual(withNull.filaments)
    })

    it('a pick that coincides with a model entry is not duplicated (extruder order holds)', () => {
      // Tagging the coinciding entry would either duplicate the slot or move a
      // model entry out of extruder order — and the interface already prints in
      // that loaded material.
      const ticket = buildAbacusTicket({
        ...base,
        catalog: supportCatalog,
        bodies: supportBodies,
        supportInterfaceSlotId: '0.2',
      })
      expect(ticket.filaments).toEqual([{ slotId: '0.1' }, { slotId: '0.2' }])
    })

    it('refuses a pick that is not in the loaded roster', () => {
      expect(() =>
        buildAbacusTicket({
          ...base,
          catalog: supportCatalog,
          bodies: supportBodies,
          supportInterfaceSlotId: '9.9',
        })
      ).toThrow(/not in the loaded roster/)
    })

    it('refuses an external spool as the interface — the role must be a loaded slot', () => {
      const withExternal: FilamentCatalog = {
        source: 'thh-ams',
        fetchedAt: '2026-07-20T00:00:00Z',
        spools: [
          { id: '0.1', name: 'Latte PLA', hex: '#C9A26E', material: 'PLA' },
          { id: 'external-1', name: 'Sunlu Red', hex: '#C0392B', material: 'PLA', external: true },
        ],
      }
      expect(() =>
        buildAbacusTicket({
          ...base,
          catalog: withExternal,
          bodies: [{ slot: 0, label: 'latte', colorHex: '#C9A26E', triangleCount: 10 }],
          supportInterfaceSlotId: 'external-1',
        })
      ).toThrow(/never the external spool/)
    })

    it('refuses routing an interface slot onto a no-AMS (external-spool) print', () => {
      const externalCatalog: FilamentCatalog = {
        source: 'thh-ams',
        fetchedAt: '2026-07-20T00:00:00Z',
        spools: [
          { id: 'external-0', name: 'Sunlu PLA+', hex: '#1A7A3E', material: 'PLA', external: true },
          {
            id: '0.9',
            name: 'Phantom interface',
            hex: '#FFFFFF',
            material: 'PLA-S',
            supportKind: 'interface',
          },
        ],
      }
      expect(() =>
        buildAbacusTicket({
          ...base,
          catalog: externalCatalog,
          bodies: [{ slot: 0, label: 'Sunlu PLA+', colorHex: '#1A7A3E', triangleCount: 10 }],
          supportInterfaceSlotId: '0.9',
        })
      ).toThrow(/no-AMS/)
    })
  })

  it('refuses more than one external spool — a no-AMS print is single-filament', () => {
    const twoExternal: FilamentCatalog = {
      source: 'thh-ams',
      fetchedAt: '2026-07-20T00:00:00Z',
      spools: [
        { id: 'external-0', name: 'Sunlu Green', hex: '#1A7A3E', material: 'PLA', external: true },
        { id: 'external-1', name: 'Sunlu Red', hex: '#C0392B', material: 'PLA', external: true },
      ],
    }
    const twoBodies: SpoolBodySummary[] = [
      { slot: 0, label: 'green', colorHex: '#1A7A3E', triangleCount: 10 },
      { slot: 1, label: 'red', colorHex: '#C0392B', triangleCount: 10 },
    ]
    expect(() => buildAbacusTicket({ ...base, catalog: twoExternal, bodies: twoBodies })).toThrow(
      /exactly one spool/i
    )
  })
})

describe('buildAbacusAuthoring (things-haunt-house#408 / abaci#22)', () => {
  it('builds the https hand-off with the player selection encoded', () => {
    expect(buildAbacusAuthoring('p 1/x', { origin: 'https://abaci.one' })).toEqual({
      editUrl: 'https://abaci.one/create/abacus?player=p+1%2Fx',
      editTool: 'Abacus Studio',
    })
  })

  it('links the bare studio when no player is selected', () => {
    expect(buildAbacusAuthoring(null, { origin: 'https://abaci.one' })).toEqual({
      editUrl: 'https://abaci.one/create/abacus',
      editTool: 'Abacus Studio',
    })
  })

  it('deep-links the persisted design, with the player riding along (abaci#22)', () => {
    expect(buildAbacusAuthoring('p1', { designId: 'dsn123', origin: 'https://abaci.one' })).toEqual(
      {
        editUrl: 'https://abaci.one/create/abacus?design=dsn123&player=p1',
        editTool: 'Abacus Studio',
      }
    )
    expect(buildAbacusAuthoring(null, { designId: 'dsn123', origin: 'https://abaci.one' })).toEqual(
      {
        editUrl: 'https://abaci.one/create/abacus?design=dsn123',
        editTool: 'Abacus Studio',
      }
    )
  })

  it('degrades to the shallow link when the snapshot persist failed (null id)', () => {
    expect(buildAbacusAuthoring('p1', { designId: null, origin: 'https://abaci.one' })).toEqual({
      editUrl: 'https://abaci.one/create/abacus?player=p1',
      editTool: 'Abacus Studio',
    })
  })

  it('stays far under the service’s 2048-char editUrl ceiling', () => {
    // THH hard-rejects editUrl > 2048 (gateway print_jobs.py). Ids are cuid2
    // (~24 chars) — pin that even generous ids leave an order of magnitude of
    // headroom, so this shape can never regress into the rejected-URL class.
    const authoring = buildAbacusAuthoring('p'.repeat(64), {
      designId: 'd'.repeat(64),
      origin: 'https://abaci.one',
    })
    expect(authoring).not.toBeNull()
    expect(authoring!.editUrl.length).toBeLessThan(2048 / 8)
  })

  it('returns null off-https — the service 400s a non-https editUrl', () => {
    expect(buildAbacusAuthoring('p1', { origin: 'http://localhost:3000' })).toBeNull()
    expect(buildAbacusAuthoring('p1', { designId: 'dsn123', origin: '' })).toBeNull()
  })

  it('defaults to the running instance origin (jsdom is http ⇒ null)', () => {
    // jsdom serves tests from an http origin, so the default-origin path must
    // omit the block — the same behavior a dev instance gets.
    expect(buildAbacusAuthoring('p1')).toBeNull()
  })
})
