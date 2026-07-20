import { describe, expect, it } from 'vitest'
import type { ThhFilamentRow } from '@/lib/thh/types'
import { catalogFromParams, thhFilamentsToCatalog } from '../abacus-catalog'
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
      { slotId: '0.1', family: 'PLA', colorHex: 'A0A0A0FF', brand: 'Bambu Lab', product: 'PLA Basic' },
    ]
    const cat = thhFilamentsToCatalog(rows, FETCHED)
    expect(cat.source).toBe('thh-ams')
    expect(cat.fetchedAt).toBe(FETCHED)
    expect(cat.spools).toEqual([
      { id: '0.1', name: 'Bambu Lab PLA Basic', hex: '#A0A0A0', material: 'PLA' },
    ])
  })

  it('normalizes the 8-digit RGBA hex to #RRGGBB (drops alpha, uppercases, adds #)', () => {
    const hex = (colorHex: string | undefined) =>
      thhFilamentsToCatalog([{ slotId: '0.1', colorHex }], FETCHED).spools[0].hex
    expect(hex('a0a0a0ff')).toBe('#A0A0A0') // lowercase + alpha
    expect(hex('#A0A0A0FF')).toBe('#A0A0A0') // tolerates a leading '#'
    expect(hex('1E88E5')).toBe('#1E88E5') // already 6-digit
    expect(hex(undefined)).toBe('#808080') // missing → neutral grey
    expect(hex('nope')).toBe('#808080') // malformed → neutral grey
    expect(hex('12345')).toBe('#808080') // too short → neutral grey
  })

  it('carries the material family through, defaulting a missing family to PLA', () => {
    const material = (family: string | undefined) =>
      thhFilamentsToCatalog([{ slotId: '0.1', family }], FETCHED).spools[0].material
    expect(material('PETG')).toBe('PETG')
    expect(material('TPU')).toBe('TPU')
    expect(material(undefined)).toBe('PLA')
  })

  it('names an external (no-slot) spool and gives it a stable synthetic id', () => {
    const cat = thhFilamentsToCatalog(
      [
        { slotId: '0.1', family: 'PLA', colorHex: '000000FF' },
        { external: true, family: 'PETG', colorHex: 'FFFFFFFF' },
      ],
      FETCHED
    )
    expect(cat.spools[1].id).toBe('external-1')
    expect(cat.spools[1].name).toBe('External PETG')
  })

  it('falls back through family → slotId → slot number for the display name', () => {
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', brand: 'Bambu Lab' }, // brand only
      { slotId: '0.2', family: 'PLA' }, // family only
      { slotId: '0.3' }, // slotId only
      {}, // nothing → positional "Slot N"
    ]
    const names = thhFilamentsToCatalog(rows, FETCHED).spools.map((s) => s.name)
    expect(names).toEqual(['Bambu Lab', 'PLA', '0.3', 'Slot 4'])
  })

  it('preserves the AMS order THH reports', () => {
    const rows: ThhFilamentRow[] = [
      { slotId: '0.1', colorHex: '111111FF' },
      { slotId: '0.2', colorHex: '222222FF' },
      { slotId: '1.1', colorHex: '333333FF' },
    ]
    expect(thhFilamentsToCatalog(rows, FETCHED).spools.map((s) => s.id)).toEqual(['0.1', '0.2', '1.1'])
  })
})
