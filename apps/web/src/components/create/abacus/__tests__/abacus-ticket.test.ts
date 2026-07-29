/**
 * v2 ticket builder tests (#9, #19): filaments mirror the 3MF's extruder grouping
 * (one spool per distinct body colour, body order); an AMS spool rides as its THH
 * slotId, a no-AMS external spool as {external, family}; style passes through
 * verbatim; and non-submittable states (incl. >1 external) fail loud.
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

  it('collapses same-colour bodies to one spool, matching the 3MF extruder grouping', () => {
    const twoWhites: SpoolBodySummary[] = [
      { slot: 1, label: 'Snow PLA', colorHex: '#F5F5F5', triangleCount: 10 },
      { slot: 2, label: 'Also white', colorHex: '#f5f5f5', triangleCount: 10 }, // case-insensitive
    ]
    const ticket = buildAbacusTicket({ ...base, bodies: twoWhites })
    expect(ticket.filaments).toEqual([{ slotId: '0.2' }])
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
    expect(
      buildAbacusAuthoring('p1', { designId: 'dsn123', origin: 'https://abaci.one' })
    ).toEqual({
      editUrl: 'https://abaci.one/create/abacus?design=dsn123&player=p1',
      editTool: 'Abacus Studio',
    })
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
