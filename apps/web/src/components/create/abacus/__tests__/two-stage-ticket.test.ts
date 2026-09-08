import { describe, expect, it } from 'vitest'
import type { SpoolBodySummary } from '../abacus-3mf'
import type { FilamentCatalog } from '../abacus-catalog'
import { buildAbacusTicket } from '../abacus-ticket'
import { TWO_STAGE_SEAM_TOOL_OVERRIDES } from '../two-stage-print'

const catalog: FilamentCatalog = {
  source: 'thh-ams',
  fetchedAt: '2026-09-08T00:00:00Z',
  spools: [
    { id: '0.1', name: 'TPU for AMS', hex: '#222222', material: 'TPU-AMS' },
    { id: '0.2', name: 'Wood PLA', hex: '#C9A26E', material: 'PLA' },
    { id: '0.3', name: 'Snow PLA', hex: '#F5F5F5', material: 'PLA' },
    { id: 'ext', name: 'External TPU95', hex: '#333333', material: 'TPU', external: true },
  ],
}
// Feet first (PR #192): the feet body's slot is emitted as extruder 1 → filaments[0].
const bodies: SpoolBodySummary[] = [
  { slot: 0, label: 'TPU for AMS', colorHex: '#222222', triangleCount: 900 },
  { slot: 1, label: 'Wood PLA', colorHex: '#C9A26E', triangleCount: 5000 },
]
const base = {
  name: 'Abacus — 13 columns',
  source: { artifactId: 'design-1', artifactUrl: 'https://abaci.one/create/abacus', label: '13' },
  bodies,
  catalog,
  style: { basePreset: '0.20mm-standard', process: { wall_loops: 3 } },
  startPolicy: 'auto' as const,
  idempotencyKey: 'idem-a',
}
const split = { atZMm: 1.6, feed: { external: true as const, family: 'TPU' } }

describe('buildAbacusTicket — two-stage feet (Gitea #38 / THH #456)', () => {
  it('Stage A rides the full AMS list + split, with the seam-tool overlay on filaments[0]', () => {
    const t = buildAbacusTicket({
      ...base,
      split,
      seamToolOverrides: TWO_STAGE_SEAM_TOOL_OVERRIDES,
    })
    expect(t.split).toEqual(split)
    expect(t.chain).toBeUndefined()
    expect(t.filaments).toEqual([
      { slotId: '0.1', overrides: TWO_STAGE_SEAM_TOOL_OVERRIDES },
      { slotId: '0.2' },
    ])
    expect(t.start.policy).toBe('auto')
  })
  it('Stage B rides the SAME list + chain, no split', () => {
    const t = buildAbacusTicket({
      ...base,
      startPolicy: 'hold',
      idempotencyKey: 'idem-b',
      chain: { continuesJobId: 'job-a' },
      seamToolOverrides: TWO_STAGE_SEAM_TOOL_OVERRIDES,
    })
    expect(t.chain).toEqual({ continuesJobId: 'job-a' })
    expect(t.split).toBeUndefined()
    expect(t.filaments).toEqual([
      { slotId: '0.1', overrides: TWO_STAGE_SEAM_TOOL_OVERRIDES },
      { slotId: '0.2' },
    ])
    expect(t.start.policy).toBe('hold')
  })
  it('a plain ticket carries neither field and no overlay', () => {
    const t = buildAbacusTicket(base)
    expect('split' in t).toBe(false)
    expect('chain' in t).toBe(false)
    expect(t.filaments).toEqual([{ slotId: '0.1' }, { slotId: '0.2' }])
  })
  it('refuses split + chain on one ticket', () => {
    expect(() => buildAbacusTicket({ ...base, split, chain: { continuesJobId: 'x' } })).toThrow(
      /split and chain/
    )
  })
  it('refuses an external feed as the seam tool — that is the #19 no-AMS shape', () => {
    const ext: SpoolBodySummary[] = [
      { slot: 3, label: 'External TPU95', colorHex: '#333333', triangleCount: 900 },
      { slot: 1, label: 'Wood PLA', colorHex: '#C9A26E', triangleCount: 5000 },
    ]
    expect(() => buildAbacusTicket({ ...base, bodies: ext, split })).toThrow(/loaded AMS slot/)
  })
  it('refuses a feed family that is not filament 0’s (alias-folded, TPU-AMS ≡ TPU)', () => {
    expect(() =>
      buildAbacusTicket({ ...base, split: { ...split, feed: { external: true, family: 'PLA' } } })
    ).toThrow(/feed\.family/)
    expect(() =>
      buildAbacusTicket({
        ...base,
        split: { ...split, feed: { external: true, family: 'TPU-AMS' } },
      })
    ).not.toThrow()
  })
  it('refuses a seam off (0, 100]', () => {
    expect(() => buildAbacusTicket({ ...base, split: { ...split, atZMm: 0 } })).toThrow(/atZMm/)
    expect(() => buildAbacusTicket({ ...base, split: { ...split, atZMm: 120 } })).toThrow(/atZMm/)
  })
  it('the support interface must coincide with filament 0 — a routed one is a toolchange below the seam', () => {
    expect(() => buildAbacusTicket({ ...base, split, supportInterfaceSlotId: '0.3' })).toThrow(
      /support interface/
    )
    expect(() =>
      buildAbacusTicket({
        ...base,
        chain: { continuesJobId: 'job-a' },
        supportInterfaceSlotId: '0.3',
      })
    ).toThrow(/support interface/)
    const t = buildAbacusTicket({ ...base, split, supportInterfaceSlotId: '0.1' })
    expect(t.filaments.some((f) => 'role' in f && f.role === 'support-interface')).toBe(false)
  })
})
