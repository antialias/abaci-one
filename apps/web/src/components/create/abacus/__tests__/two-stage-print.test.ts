import type { TicketStyle } from '@eink/print-dialog'
import { describe, expect, it } from 'vitest'
import type { FilamentCatalog } from '../abacus-catalog'
import {
  checkSeam,
  clearTwoStageRecord,
  effectiveLayerHeightMm,
  handoffView,
  jobIdFromSubmitBody,
  loadTwoStageRecord,
  STAGE_A_PREP_STEPS,
  STAGE_B_HANDOFF_STEPS,
  saveTwoStageRecord,
  sha256Hex,
  TWO_STAGE_PROCESS,
  TWO_STAGE_SEAM_TOOL_OVERRIDES,
  type TwoStageRecord,
  twoStageAvailability,
  twoStageStorageKey,
  withTwoStageProcess,
} from '../two-stage-print'

const roster: FilamentCatalog = {
  source: 'thh-ams',
  fetchedAt: '2026-09-08T00:00:00Z',
  spools: [
    { id: '0.1', name: 'TPU for AMS', hex: '#222222', material: 'TPU-AMS' },
    { id: '0.2', name: 'Wood PLA', hex: '#C9A26E', material: 'PLA' },
    { id: 'ext', name: 'External TPU95', hex: '#333333', material: 'TPU', external: true },
  ],
}
const printed = { feet_mode: 'printed' as const, feet_proud: 1.6 }

describe('twoStageAvailability (Gitea #38)', () => {
  it('offers the mode when the feet print from an AMS TPU tray', () => {
    const a = twoStageAvailability({ params: printed, filamentMap: { feet: 0 }, catalog: roster })
    expect(a).toEqual({ ok: true, feetSlot: roster.spools[0], feedFamily: 'TPU', atZMm: 1.6 })
  })
  it('is off without printed feet, on kits, and off the live roster', () => {
    expect(
      twoStageAvailability({
        params: { feet_mode: 'none', feet_proud: 1.6 },
        filamentMap: { feet: 0 },
        catalog: roster,
      })
    ).toEqual({ ok: false, reason: 'feet-not-printed' })
    expect(twoStageAvailability({ params: printed, filamentMap: {}, catalog: roster })).toEqual({
      ok: false,
      reason: 'feet-not-printed',
    })
    expect(
      twoStageAvailability({
        params: printed,
        filamentMap: { feet: 0 },
        catalog: roster,
        kit: true,
      })
    ).toEqual({ ok: false, reason: 'kit' })
    expect(
      twoStageAvailability({
        params: printed,
        filamentMap: { feet: 0 },
        catalog: { ...roster, source: 'default' as FilamentCatalog['source'] },
      })
    ).toEqual({ ok: false, reason: 'no-roster' })
  })
  it('is off when the feet already come from the external spool, or are not TPU', () => {
    expect(
      twoStageAvailability({ params: printed, filamentMap: { feet: 2 }, catalog: roster })
    ).toEqual({ ok: false, reason: 'feet-slot-external' })
    expect(
      twoStageAvailability({ params: printed, filamentMap: { feet: 1 }, catalog: roster })
    ).toEqual({ ok: false, reason: 'feet-not-tpu' })
  })
})

describe('seam vs layer boundary', () => {
  const at = (basePreset: string, process: TicketStyle['process'] = {}): TicketStyle => ({
    basePreset,
    process,
  })
  it('reads the layer height from the preset name or an explicit override', () => {
    expect(effectiveLayerHeightMm(at('0.20mm-standard'))).toBe(0.2)
    expect(effectiveLayerHeightMm(at('0.16mm-optimal'))).toBe(0.16)
    expect(effectiveLayerHeightMm(at('0.20mm-standard', { layer_height: '0.25' }))).toBe(0.25)
    expect(effectiveLayerHeightMm(at('fine'))).toBeNull()
    expect(effectiveLayerHeightMm(null)).toBeNull()
  })
  it('1.6 mm is 8 layers at 0.2 and 10 at 0.16 — on a boundary', () => {
    expect(checkSeam(1.6, at('0.20mm-standard')).misses).toBe(false)
    expect(checkSeam(1.6, at('0.16mm-optimal')).misses).toBe(false)
  })
  it('misses at 0.25, and with a 0.2 first layer over 0.16 layers', () => {
    expect(checkSeam(1.6, at('0.25mm-draft')).misses).toBe(true)
    expect(checkSeam(1.6, at('0.16mm-optimal', { initial_layer_print_height: 0.2 })).misses).toBe(
      true
    )
    expect(checkSeam(1.6, at('0.20mm-standard', { initial_layer_print_height: 0.2 })).misses).toBe(
      false
    )
  })
  it('does not block when the layer height is not knowable here', () => {
    expect(checkSeam(1.6, at('fine'))).toEqual({
      atZMm: 1.6,
      layerHeightMm: null,
      firstLayerMm: null,
      misses: false,
    })
  })
})

describe('withTwoStageProcess', () => {
  it('forces the seam-solidity, interface-floor and slow-TPU keys over the operator style, keeping the rest', () => {
    const out = withTwoStageProcess({
      basePreset: '0.20mm-standard',
      process: { wall_loops: 3, sparse_infill_density: 15, support_top_z_distance: 0.2 },
    })
    expect(out.basePreset).toBe('0.20mm-standard')
    expect(out.process.wall_loops).toBe(3)
    expect(out.process.sparse_infill_density).toBe(100)
    expect(out.process.interface_shells).toBe(true)
    // The seam layer's PLA lands on the TPU interface, not on a foot: zero gap on
    // a solid interface makes it a floor (the operator's 0.2 gap is overridden).
    expect(out.process.support_top_z_distance).toBe(0)
    expect(out.process.support_interface_spacing).toBe(0)
    expect(out.process.independent_support_layer_height).toBe(false)
    expect(out.process).toMatchObject(TWO_STAGE_PROCESS)
  })
  it('the overlay is filament-class, vector keys as one-element arrays, no brim', () => {
    for (const v of Object.values(TWO_STAGE_SEAM_TOOL_OVERRIDES)) {
      expect(Array.isArray(v) && v.length === 1).toBe(true)
    }
    expect(Object.keys(TWO_STAGE_PROCESS).some((k) => k.startsWith('brim'))).toBe(false)
  })
})

describe('the Stage A record', () => {
  const store = () => {
    const m = new Map<string, string>()
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    }
  }
  const rec: TwoStageRecord = {
    v: 1,
    printerId: 'x1c',
    stageAJobId: 'job-a',
    modelSha256: 'ab'.repeat(32),
    designSig: 'sig-1',
    atZMm: 1.6,
    feedFamily: 'TPU',
    name: 'Abacus — 13 columns',
    submittedAt: 1_700_000_000_000,
  }
  it('round-trips per printer and clears', () => {
    const s = store()
    saveTwoStageRecord(s, rec)
    expect(loadTwoStageRecord(s, 'x1c')).toEqual(rec)
    expect(loadTwoStageRecord(s, 'other')).toBeNull()
    clearTwoStageRecord(s, 'x1c')
    expect(loadTwoStageRecord(s, 'x1c')).toBeNull()
  })
  it('ignores garbage, a foreign printer, and a missing store', () => {
    const s = store()
    s.setItem(twoStageStorageKey('x1c'), '{not json')
    expect(loadTwoStageRecord(s, 'x1c')).toBeNull()
    s.setItem(twoStageStorageKey('x1c'), JSON.stringify({ ...rec, printerId: 'p1s' }))
    expect(loadTwoStageRecord(s, 'x1c')).toBeNull()
    expect(loadTwoStageRecord(null, 'x1c')).toBeNull()
    expect(() => saveTwoStageRecord(undefined, rec)).not.toThrow()
  })
})

describe('helpers', () => {
  it('sha256Hex matches the known vector', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    const sub = new Uint8Array(new TextEncoder().encode('xxabcxx').buffer, 2, 3)
    expect(await sha256Hex(sub)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })
  it('reads the submit response the way the proxy relays it', () => {
    expect(jobIdFromSubmitBody({ jobId: 'a' })).toBe('a')
    expect(jobIdFromSubmitBody({ id: 'b' })).toBe('b')
    expect(jobIdFromSubmitBody({ job: { id: 'c' } })).toBe('c')
    expect(jobIdFromSubmitBody({ jobId: '' })).toBeNull()
    expect(jobIdFromSubmitBody(null)).toBeNull()
  })
  it('drives the hand-off card off the two jobs’ phases', () => {
    const rec: TwoStageRecord = {
      v: 1,
      printerId: 'x1c',
      stageAJobId: 'a',
      modelSha256: 'x',
      designSig: 's',
      atZMm: 1.6,
      feedFamily: 'TPU',
      name: 'n',
      submittedAt: 0,
    }
    const phases = (m: Record<string, string>) => (id: string) => m[id] ?? null
    expect(handoffView(rec, phases({}))).toEqual({ kind: 'stage-a-running', phase: null })
    expect(handoffView(rec, phases({ a: 'printing' }))).toEqual({
      kind: 'stage-a-running',
      phase: 'printing',
    })
    expect(handoffView(rec, phases({ a: 'completed' }))).toEqual({
      kind: 'ready-for-b',
      retry: false,
    })
    expect(handoffView(rec, phases({ a: 'canceled' }))).toEqual({
      kind: 'stage-a-ended',
      phase: 'canceled',
    })
    const withB = { ...rec, stageBJobId: 'b' }
    expect(handoffView(withB, phases({ a: 'completed', b: 'ready' }))).toEqual({
      kind: 'stage-b-open',
      phase: 'ready',
    })
    expect(handoffView(withB, phases({ a: 'completed' }))).toEqual({
      kind: 'stage-b-open',
      phase: null,
    })
    expect(handoffView(withB, phases({ a: 'completed', b: 'failed' }))).toEqual({
      kind: 'ready-for-b',
      retry: true,
    })
    expect(handoffView(withB, phases({ a: 'completed', b: 'completed' }))).toEqual({ kind: 'done' })
  })
})

describe('STAGE_A_PREP_STEPS', () => {
  it('tells the operator to swap the toolhead feed to the external TPU95 spool before Stage A', () => {
    const text = STAGE_A_PREP_STEPS.join(' ')
    expect(STAGE_A_PREP_STEPS.length).toBeGreaterThanOrEqual(3)
    expect(text).toMatch(/AMS PTFE tube/)
    expect(text).toMatch(/external TPU95 spool/)
    expect(text).toMatch(/printer screen/)
  })

  it('is the mirror of the Stage B hand-off, not a copy of it', () => {
    expect(STAGE_A_PREP_STEPS.join(' ')).not.toMatch(/Unload the external/)
    expect(STAGE_B_HANDOFF_STEPS.join(' ')).toMatch(/Unload the external/)
  })
})
