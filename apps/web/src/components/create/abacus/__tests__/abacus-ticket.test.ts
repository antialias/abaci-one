/**
 * v2 ticket builder tests (#9): filaments mirror the 3MF's extruder grouping
 * (one spool per distinct body colour, body order), slot ids come from the THH
 * catalog, style passes through verbatim, and non-submittable states fail loud.
 */
import { describe, expect, it } from 'vitest'
import type { SpoolBodySummary } from '../abacus-3mf'
import type { FilamentCatalog } from '../abacus-catalog'
import { buildAbacusTicket } from '../abacus-ticket'

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
})
