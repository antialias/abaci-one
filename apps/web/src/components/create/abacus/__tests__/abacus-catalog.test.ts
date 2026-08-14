import { describe, expect, it } from 'vitest'
import type { ThhFilamentRow } from '@/lib/abacus/print/filament-wire'
import {
  catalogFromParams,
  coPrintGroup,
  type FilamentSpool,
  isSupportMaterial,
  isSupportSpool,
  spoolSupportKind,
  thhFilamentsToCatalog,
} from '../abacus-catalog'
import { defaultParams, type Params } from '../abacus-model'

const withCount = (filament_count: number): Params => ({ ...defaultParams, filament_count })

describe('catalogFromParams', () => {
  it('is a params-derived, color-only catalog defaulting every spool to PLA', () => {
    const cat = catalogFromParams(defaultParams)
    expect(cat.source).toBe('manual-params')
    expect(cat.fetchedAt).toBeUndefined()
    expect(cat.spools.every((s) => s.material === 'PLA')).toBe(true)
  })

  it('takes the first `filament_count` slots in order, with stable ids and hexes', () => {
    const cat = catalogFromParams(withCount(3))
    expect(cat.spools).toEqual([
      { id: 'filament-1', name: 'Filament 1', hex: defaultParams.filament_1, material: 'PLA' },
      { id: 'filament-2', name: 'Filament 2', hex: defaultParams.filament_2, material: 'PLA' },
      { id: 'filament-3', name: 'Filament 3', hex: defaultParams.filament_3, material: 'PLA' },
    ])
  })

  it('clamps the slot count to [1, 8] (matching the historical filament map)', () => {
    expect(catalogFromParams(withCount(0)).spools).toHaveLength(1)
    expect(catalogFromParams(withCount(1)).spools).toHaveLength(1)
    expect(catalogFromParams(withCount(8)).spools).toHaveLength(8)
    expect(catalogFromParams(withCount(99)).spools).toHaveLength(8)
  })
})

describe('thhFilamentsToCatalog', () => {
  const FETCHED = '2026-07-19T00:00:00.000Z'

  it('maps a THH AMS row to a thh-ams spool (color, material, name, id)', () => {
    const rows: ThhFilamentRow[] = [
      {
        slotId: '0.1',
        family: 'PLA',
        colorHex: 'A0A0A0FF',
        brand: 'Bambu Lab',
        product: 'PLA Basic',
      },
    ]
    const cat = thhFilamentsToCatalog(rows, FETCHED)
    expect(cat.source).toBe('thh-ams')
    expect(cat.fetchedAt).toBe(FETCHED)
    expect(cat.spools).toEqual([
      {
        id: '0.1',
        name: 'Bambu Lab PLA Basic',
        hex: '#A0A0A0',
        material: 'PLA',
        // brand/product survive as FIELDS, not only folded into `name`: they are
        // the identity a pin is expressed with when there is no profileKey, and a
        // pin parsed back out of a display string would break the first time the
        // naming changed (Gitea #37).
        brand: 'Bambu Lab',
        product: 'PLA Basic',
      },
    ])
  })

  it('normalizes the 8-digit RGBA hex to #RRGGBB (drops alpha, uppercases, adds #)', () => {
    // every row carries a family — a family-less row is dropped entirely now
    const hex = (colorHex: string | undefined) =>
      thhFilamentsToCatalog([{ slotId: '0.1', family: 'PLA', colorHex }], FETCHED).spools[0].hex
    expect(hex('a0a0a0ff')).toBe('#A0A0A0') // lowercase + alpha
    expect(hex('#A0A0A0FF')).toBe('#A0A0A0') // tolerates a leading '#'
    expect(hex('1E88E5')).toBe('#1E88E5') // already 6-digit
    expect(hex(undefined)).toBe('#808080') // missing → neutral grey
    expect(hex('nope')).toBe('#808080') // malformed → neutral grey
    expect(hex('12345')).toBe('#808080') // too short → neutral grey
  })

  it('carries the material family through', () => {
    const material = (family: string) =>
      thhFilamentsToCatalog([{ slotId: '0.1', family }], FETCHED).spools[0].material
    expect(material('PETG')).toBe('PETG')
    expect(material('TPU')).toBe('TPU')
  })

  it('DROPS an AMS row with no identifiable family — never a PLA default (Gitea #37)', () => {
    // This path used to default to 'PLA', on the stated grounds that THH "always
    // resolves" the family for a slot. It does not: `gateway/print_api.py` derives
    // family from the slot's PROFILE and emits null for an unmapped slot. So an
    // unidentified spool could be assigned to a visible role, and every downstream
    // material check would then reason about a PLA that was never there.
    for (const family of [null, '', undefined]) {
      const cat = thhFilamentsToCatalog([{ slotId: '0.1', family, colorHex: 'A0A0A0FF' }], FETCHED)
      expect(cat.spools).toHaveLength(0)
    }
  })

  it('DROPS a row THH marks as not physically loaded (livePresent:false, THH#343)', () => {
    // THH keeps rows whose spool is gone and marks them rather than deleting them,
    // so an AMS wake blip stays cosmetic. But the catalog's contract is "spools the
    // printer can actually lay down", and a spool that is not loaded is not one.
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', family: 'PLA', livePresent: true },
      { slotId: '0.2', family: 'PETG', livePresent: false },
      { slotId: '0.3', family: 'TPU' }, // absent ⇒ unknown, not stale: kept
    ]
    expect(thhFilamentsToCatalog(rows, FETCHED).spools.map((s) => s.id)).toEqual(['0.1', '0.3'])
  })

  it('names a spool brand+product, else the family', () => {
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', family: 'PLA', brand: 'Bambu Lab', product: 'PLA Basic' },
      { slotId: '0.2', family: 'PLA', brand: 'Bambu Lab' }, // brand only
      { slotId: '0.3', family: 'PETG' }, // neither → the family
    ]
    const names = thhFilamentsToCatalog(rows, FETCHED).spools.map((s) => s.name)
    expect(names).toEqual(['Bambu Lab PLA Basic', 'Bambu Lab', 'PETG'])
  })

  it('projects profileKey and nozzleTempC when the service reports them', () => {
    // Durable identity (a slot id stops meaning this spool the moment it moves)
    // and the temperature window the slot would actually slice with (THH#365).
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', family: 'PLA', profileKey: 'GFL99', nozzleTempC: { value: 220, min: 190 } },
      { slotId: '0.2', family: 'PLA' },
    ]
    const cat = thhFilamentsToCatalog(rows, FETCHED)
    expect(cat.spools[0].profileKey).toBe('GFL99')
    expect(cat.spools[0].nozzleTempC).toEqual({ value: 220, min: 190 })
    // absent on the wire stays absent — never a fabricated default
    expect('profileKey' in cat.spools[1]).toBe(false)
    expect('nozzleTempC' in cat.spools[1]).toBe(false)
  })

  it('preserves the AMS order THH reports', () => {
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', family: 'PLA', colorHex: '111111FF' },
      { slotId: '0.2', family: 'PLA', colorHex: '222222FF' },
      { slotId: '1.1', family: 'PLA', colorHex: '333333FF' },
    ]
    expect(thhFilamentsToCatalog(rows, FETCHED).spools.map((s) => s.id)).toEqual([
      '0.1',
      '0.2',
      '1.1',
    ])
  })
})

// The no-AMS / external-spool path (Gitea #19, wire contract from things-haunt-house#382):
// a printer running off its direct spool holder reports ONE row with `external:true`
// and `slotId:null`. When its family resolves we fold it in as an `external` spool; when
// the family is null/empty (the printer can't identify the loaded material) we DROP it
// rather than invent a PLA default — the honest-unknown rule. The source stays 'thh-ams'.
describe('thhFilamentsToCatalog — external (no-AMS) spool', () => {
  const FETCHED = '2026-07-19T00:00:00.000Z'

  it('folds a resolved external row into an external:true spool, source still thh-ams', () => {
    const rows: ThhFilamentRow[] = [
      {
        external: true,
        slotId: null,
        family: 'PLA',
        colorHex: '112233FF',
        brand: 'Sunlu',
        product: 'PLA+',
      },
    ]
    const cat = thhFilamentsToCatalog(rows, FETCHED)
    expect(cat.source).toBe('thh-ams')
    expect(cat.spools).toEqual([
      {
        id: 'external-0',
        name: 'Sunlu PLA+',
        hex: '#112233',
        material: 'PLA',
        brand: 'Sunlu',
        product: 'PLA+',
        external: true,
      },
    ])
  })

  it('DROPS an external row with an unresolved family — never a PLA-defaulted spool', () => {
    for (const family of [null, '', undefined]) {
      const cat = thhFilamentsToCatalog(
        [{ external: true, slotId: null, family, colorHex: '112233FF' }],
        FETCHED
      )
      expect(cat.source).toBe('thh-ams')
      expect(cat.spools).toHaveLength(0)
      // the "no silent PLA default" rule, made literal: no spool survives at all
      expect(cat.spools.some((s) => s.material === 'PLA')).toBe(false)
    }
  })

  it('keeps the AMS slot but drops a null-family external in a mixed roster', () => {
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', family: 'PETG', colorHex: 'AABBCCFF', brand: 'Bambu Lab' },
      { external: true, slotId: null, family: null, colorHex: '112233FF' },
    ]
    const cat = thhFilamentsToCatalog(rows, FETCHED)
    // only the slot spool survives; the PLA default never touches the external row
    expect(cat.spools).toEqual([
      { id: '0.1', name: 'Bambu Lab', hex: '#AABBCC', material: 'PETG', brand: 'Bambu Lab' },
    ])
  })
})

describe('family knowledge (gh#163)', () => {
  it('flags breakaway support families, case-insensitively', () => {
    expect(isSupportMaterial('PLA-S')).toBe(true)
    expect(isSupportMaterial('PA-S')).toBe(true)
    expect(isSupportMaterial('PVA')).toBe(true)
    expect(isSupportMaterial('HIPS')).toBe(true)
    expect(isSupportMaterial('pla-s')).toBe(true)
    expect(isSupportMaterial('PLA')).toBe(false)
    expect(isSupportMaterial('PETG')).toBe(false)
  })

  it('groups families by shared plate-temperature window', () => {
    // support-for-X and filled variants ride with X; ASA/HIPS ride with ABS
    expect(coPrintGroup('PLA-S')).toBe('PLA')
    expect(coPrintGroup('PLA-CF')).toBe('PLA')
    expect(coPrintGroup('PVA')).toBe('PLA')
    expect(coPrintGroup('PETG-HF')).toBe('PETG')
    expect(coPrintGroup('ASA')).toBe('ABS')
    expect(coPrintGroup('HIPS')).toBe('ABS')
    expect(coPrintGroup('PA-CF')).toBe('PA')
    expect(coPrintGroup('TPU-AMS')).toBe('TPU')
  })

  it('never assumes compatibility for an unknown family — it forms its own group', () => {
    expect(coPrintGroup('PPA-XYZ')).toBe('PPA-XYZ')
    expect(coPrintGroup('TPU')).toBe('TPU')
  })
})

describe('spool support knowledge (THH#367 / Gitea #23)', () => {
  const spool = (over: Partial<FilamentSpool>): FilamentSpool => ({
    id: '0.1',
    name: 'Spool',
    hex: '#FFFFFF',
    material: 'PLA',
    ...over,
  })

  it('a present wire supportKind is authoritative — including an explicit null', () => {
    // The service KNOWS; the name heuristic must not override it either way.
    expect(spoolSupportKind(spool({ material: 'PLA-S', supportKind: null }))).toBe(null)
    expect(spoolSupportKind(spool({ material: 'PLA', supportKind: 'interface' }))).toBe('interface')
    expect(spoolSupportKind(spool({ material: 'PLA', supportKind: 'body' }))).toBe('body')
    expect(isSupportSpool(spool({ material: 'PLA-S', supportKind: null }))).toBe(false)
    expect(isSupportSpool(spool({ material: 'PLA', supportKind: 'interface' }))).toBe(true)
    expect(isSupportSpool(spool({ material: 'PLA', supportKind: 'body' }))).toBe(true)
  })

  it('falls back to the family-name heuristic when the wire omitted the field', () => {
    // Pre-#367 service / manual catalogs: the heuristic answers, mapped onto
    // 'interface' (PLA-S/PVA/HIPS are interface-grade breakaway media).
    expect(spoolSupportKind(spool({ material: 'PLA-S' }))).toBe('interface')
    expect(spoolSupportKind(spool({ material: 'PVA' }))).toBe('interface')
    expect(spoolSupportKind(spool({ material: 'PLA' }))).toBe(null)
    expect(isSupportSpool(spool({ material: 'HIPS' }))).toBe(true)
    expect(isSupportSpool(spool({ material: 'TPU' }))).toBe(false)
  })

  it('projects the wire supportKind through thhFilamentsToCatalog verbatim', () => {
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', family: 'PLA', colorHex: 'A0A0A0FF' },
      { slotId: '0.2', family: 'PLA-S', colorHex: 'FFFFFFFF', supportKind: 'interface' },
      { slotId: '0.3', family: 'PLA', colorHex: '111111FF', supportKind: null },
    ]
    const cat = thhFilamentsToCatalog(rows, '2026-07-28T00:00:00.000Z')
    // Absent on the wire stays absent (heuristic territory), present projects
    // verbatim — an explicit null must survive as a PRESENT null, not vanish.
    expect('supportKind' in cat.spools[0]).toBe(false)
    expect(cat.spools[1].supportKind).toBe('interface')
    expect('supportKind' in cat.spools[2]).toBe(true)
    expect(cat.spools[2].supportKind).toBe(null)
  })

  it('an external row never projects supportKind — it can never be the interface', () => {
    const rows: ThhFilamentRow[] = [
      {
        external: true,
        slotId: null,
        family: 'PLA-S',
        colorHex: 'FFFFFFFF',
        supportKind: 'interface',
      },
    ]
    const cat = thhFilamentsToCatalog(rows, '2026-07-28T00:00:00.000Z')
    expect(cat.spools).toHaveLength(1)
    expect(cat.spools[0].external).toBe(true)
    expect('supportKind' in cat.spools[0]).toBe(false)
  })
})
